"""
Anonymize Module
Applies privacy-preserving transformations:
- Dynamic PII action dispatch from job configuration (PSEUDONYMIZE_HMAC, DROP_COLUMN, REDACT, GENERALIZE_SPATIAL, TIME_BUCKET, KEEP)
- HMAC-SHA256 pseudonymization for vehicle plates and ID-like columns (ANON_<hex>)
- Data Minimization: complete removal of direct identifiers (SSN, Driver Name, Phone, Email)
- Spatial Generalization: GPS rounded to configurable decimal places (default 2 ~1.1 km)
- Free-text redaction: regex-based scrub of notes, comments, and description fields
- K-Anonymity calculation over quasi-identifiers (timestamp, latitude, longitude, vehicle_type, road_segment)
  with optional low-k suppression
"""

import hmac
import hashlib
import os
import re
from typing import Any, Dict, List, Tuple
import numpy as np
import pandas as pd


def generate_plate_hmac(val: str, secret_key: str, prefix: str = "ANON_", length: int = 12) -> str:
    """
    Computes deterministic HMAC-SHA256 pseudonym for identifiers and plates.
    Same value + same secret key -> same pseudonym.
    Format: ANON_<first 12 hex characters>.
    """
    clean_val = str(val).strip().upper()
    if not clean_val or clean_val in ["NAN", "NONE", "NULL", ""]:
        return f"{prefix}UNKNOWN"

    key_bytes = secret_key.encode("utf-8")
    data_bytes = clean_val.encode("utf-8")
    signature = hmac.new(key_bytes, data_bytes, hashlib.sha256).hexdigest()
    return f"{prefix}{signature[:length]}"


def redact_freetext(text: Any) -> Any:
    """
    Scans free-text content for sensitive patterns and redacts them.
    Protects against incidental leakage of SSNs, emails, phone numbers, and license plates.
    Blank/null values are preserved as null.
    """
    if text is None or pd.isna(text):
        return text
    if not isinstance(text, str):
        return text

    # SSN pattern
    text = re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_SSN]", text)
    # Email pattern
    text = re.sub(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[REDACTED_EMAIL]", text)
    # Phone numbers:
    # 1. International formats like +971 58 217 7359
    text = re.sub(r"\+\d{1,4}(?:[\s.-]*\d{1,4}){2,6}\b", "[REDACTED_PHONE]", text)
    # 2. Standard formats with parentheses like (212) 555-0198
    text = re.sub(r"\(?\b\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\b", "[REDACTED_PHONE]", text)
    # 3. 7-digit local formats like 555-0101
    text = re.sub(r"\b\d{3}[-.\s]\d{4}\b", "[REDACTED_PHONE]", text)
    # 4. 10+ digit runs
    text = re.sub(r"\b\d{10,}\b", "[REDACTED_PHONE]", text)
    # License plate pattern in free text (2-4 letters followed by 3-5 digits/letters)
    text = re.sub(r"\b[A-Z]{2,4}[-\s]?[0-9]{3,4}\b", "[REDACTED_PLATE]", text)

    return text


def compute_k_anonymity(
    df: pd.DataFrame,
    qi_columns: List[str] | None = None,
    risk_reduction_mode: str = "none",
    k_threshold: int = 3,
    config: Dict[str, Any] | None = None
) -> Tuple[pd.DataFrame, Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    """
    Computes k-anonymity over quasi-identifiers in the anonymized dataset.
    Quasi-identifiers (from config or default): time bucket, rounded latitude/longitude, vehicle_type, road_segment.

    Returns:
        anonymized_df: Filtered/transformed DataFrame
        report: Dict containing:
            - k_min: smallest group size
            - percent_low_k: % of rows in groups with k < 3
            - unique_rows: count of unique rows (k=1)
            - low_k_row_count: count of rows with k < 3
            - risk_level: 'LOW' (<5%), 'MEDIUM' (5-20%), 'HIGH' (>20%)
            - risk_badge: 'LOW' | 'MEDIUM' | 'HIGH'
            - group_size_distribution: distribution across k=1, k=2, k=3-4, k=5+
            - explanation: plain-language explanation of risk
            - top_risky_combinations: cohort metadata without raw values
        suppressed_rows: List of row dictionaries moved to suppression
        aggregated_records: List of aggregated road_segment x hour cells (if aggregate mode)
        logs: Operation execution log messages
    """
    logs: List[str] = []
    suppressed_rows: List[Dict[str, Any]] = []
    aggregated_records: List[Dict[str, Any]] = []
    suppressed_cells_count = 0

    if df.empty:
        empty_report = {
            "k_min": 0,
            "smallest_group_size_k": 0,
            "percent_low_k": 0.0,
            "unique_rows": 0,
            "unique_rows_count": 0,
            "low_k_row_count": 0,
            "risk_level": "LOW",
            "risk_badge": "LOW",
            "group_size_distribution": [
                {"bucket": "k=1", "label": "Unique (k=1)", "count": 0, "percent": 0.0},
                {"bucket": "k=2", "label": "Pairs (k=2)", "count": 0, "percent": 0.0},
                {"bucket": "k=3-4", "label": "Small Groups (k=3-4)", "count": 0, "percent": 0.0},
                {"bucket": "k=5+", "label": "Protected (k=5+)", "count": 0, "percent": 0.0},
            ],
            "distribution": [],
            "quasi_identifiers": [],
            "top_risky_combinations": [],
            "explanation": "Dataset is empty; zero re-identification risk.",
            "risk_reduction_mode": risk_reduction_mode,
            "k_threshold": k_threshold,
            "suppressed_count": 0,
            "suppressed_applied": False,
            "aggregated_cells_count": 0,
            "suppressed_cells_count": 0
        }
        return df, empty_report, suppressed_rows, aggregated_records, logs

    work_df = df.copy()

    # 1. Resolve Quasi-Identifiers from config or default list
    re_cfg = (config or {}).get("re_identification", {})
    candidate_qis = qi_columns or re_cfg.get("quasi_identifiers") or [
        "timestamp", "latitude", "longitude", "vehicle_type", "road_segment"
    ]
    active_qis = [c for c in candidate_qis if c in work_df.columns]

    if not active_qis:
        empty_qi_report = {
            "k_min": len(work_df),
            "smallest_group_size_k": len(work_df),
            "percent_low_k": 0.0,
            "unique_rows": 0,
            "unique_rows_count": 0,
            "low_k_row_count": 0,
            "risk_level": "LOW",
            "risk_badge": "LOW",
            "group_size_distribution": [
                {"bucket": "k=1", "label": "Unique (k=1)", "count": 0, "percent": 0.0},
                {"bucket": "k=2", "label": "Pairs (k=2)", "count": 0, "percent": 0.0},
                {"bucket": "k=3-4", "label": "Small Groups (k=3-4)", "count": 0, "percent": 0.0},
                {"bucket": "k=5+", "label": "Protected (k=5+)", "count": len(work_df), "percent": 100.0},
            ],
            "distribution": [],
            "quasi_identifiers": [],
            "top_risky_combinations": [],
            "explanation": "No quasi-identifiers present in dataset schema.",
            "risk_reduction_mode": risk_reduction_mode,
            "k_threshold": k_threshold,
            "suppressed_count": 0,
            "suppressed_applied": False,
            "aggregated_cells_count": 0,
            "suppressed_cells_count": 0
        }
        return work_df, empty_qi_report, suppressed_rows, aggregated_records, logs

    # Helper function to compute raw k-anonymity distribution and metrics
    def _evaluate_metrics(target_df: pd.DataFrame) -> Dict[str, Any]:
        if target_df.empty:
            return {
                "k_min": 0,
                "percent_low_k": 0.0,
                "unique_rows": 0,
                "low_k_row_count": 0,
                "risk_level": "LOW",
                "risk_badge": "LOW",
                "group_size_distribution": [
                    {"bucket": "k=1", "label": "Unique (k=1)", "count": 0, "percent": 0.0},
                    {"bucket": "k=2", "label": "Pairs (k=2)", "count": 0, "percent": 0.0},
                    {"bucket": "k=3-4", "label": "Small Groups (k=3-4)", "count": 0, "percent": 0.0},
                    {"bucket": "k=5+", "label": "Protected (k=5+)", "count": 0, "percent": 0.0},
                ],
                "top_risky_combinations": [],
                "explanation": "Empty dataset."
            }

        grp_sizes = target_df.groupby(active_qis, dropna=False).transform("size")
        k_min = int(grp_sizes.min()) if len(target_df) > 0 else 0
        low_k_mask = grp_sizes < 3
        low_k_rows = int(low_k_mask.sum())
        total_rows = len(target_df)
        pct_low_k = round((low_k_rows / total_rows) * 100.0, 2) if total_rows > 0 else 0.0
        unique_rows = int((grp_sizes == 1).sum())

        # Risk Thresholds: Low <5% / Medium 5-20% / High >20% of rows with k < 3
        if pct_low_k < 5.0:
            risk_level = "LOW"
            explanation = f"Low re-identification risk: only {pct_low_k}% of records belong to cohorts with k < 3. Records are well-clustered across time, location, and vehicle type."
        elif pct_low_k <= 20.0:
            risk_level = "MEDIUM"
            explanation = f"Medium re-identification risk: {pct_low_k}% of records belong to small cohorts (k < 3) vulnerable to quasi-identifier linkage."
        else:
            risk_level = "HIGH"
            explanation = f"High re-identification risk: {pct_low_k}% of records belong to unique or pair cohorts (k < 3). Recommended: apply Suppress (K={k_threshold}) or Aggregate mode."

        k1_count = int((grp_sizes == 1).sum())
        k2_count = int((grp_sizes == 2).sum())
        k34_count = int(((grp_sizes >= 3) & (grp_sizes <= 4)).sum())
        k5p_count = int((grp_sizes >= 5).sum())

        distribution = [
            {
                "bucket": "k=1",
                "label": "Unique (k=1)",
                "count": k1_count,
                "percent": round((k1_count / total_rows) * 100.0, 1) if total_rows > 0 else 0.0
            },
            {
                "bucket": "k=2",
                "label": "Pairs (k=2)",
                "count": k2_count,
                "percent": round((k2_count / total_rows) * 100.0, 1) if total_rows > 0 else 0.0
            },
            {
                "bucket": "k=3-4",
                "label": "Small Groups (k=3-4)",
                "count": k34_count,
                "percent": round((k34_count / total_rows) * 100.0, 1) if total_rows > 0 else 0.0
            },
            {
                "bucket": "k=5+",
                "label": "Protected (k=5+)",
                "count": k5p_count,
                "percent": round((k5p_count / total_rows) * 100.0, 1) if total_rows > 0 else 0.0
            }
        ]

        # Top risky equivalence classes (metadata ONLY, NEVER raw values)
        low_k_groups = target_df.groupby(active_qis, dropna=False).size()
        sorted_low_k = low_k_groups[low_k_groups < 3].sort_values().head(5)
        risky_combos = []
        for idx, (_, grp_size) in enumerate(sorted_low_k.items()):
            risky_combos.append({
                "group_id": f"QI_Group_{idx + 1}",
                "group_size_k": int(grp_size),
                "quasi_identifiers": active_qis,
                "risk_severity": "CRITICAL" if grp_size == 1 else "HIGH"
            })

        return {
            "k_min": k_min,
            "percent_low_k": pct_low_k,
            "unique_rows": unique_rows,
            "low_k_row_count": low_k_rows,
            "risk_level": risk_level,
            "risk_badge": risk_level,
            "group_size_distribution": distribution,
            "top_risky_combinations": risky_combos,
            "explanation": explanation
        }

    # Baseline metrics prior to reduction
    base_metrics = _evaluate_metrics(work_df)

    # 2. Risk Reduction Mode B: Suppress
    if risk_reduction_mode == "suppress":
        grp_sizes = work_df.groupby(active_qis, dropna=False).transform("size")
        low_k_indices = work_df[grp_sizes < k_threshold].index

        if len(low_k_indices) > 0:
            logs.append(
                f"K-Anonymity Suppress: Found {len(low_k_indices)} row(s) below threshold K={k_threshold}. Applying step-by-step generalization..."
            )

            # Step 1: Generalize time bucket 15 -> 60 min
            if "timestamp" in work_df.columns:
                parsed_dates = pd.to_datetime(
                    work_df.loc[low_k_indices, "timestamp"], format="mixed", errors="coerce", utc=True
                )
                work_df.loc[low_k_indices, "timestamp"] = parsed_dates.dt.floor("60min").dt.strftime(
                    "%Y-%m-%dT%H:00:00Z"
                )

            # Step 2: Generalize GPS coordinates 2 -> 1 decimal place
            if "latitude" in work_df.columns:
                work_df.loc[low_k_indices, "latitude"] = pd.to_numeric(
                    work_df.loc[low_k_indices, "latitude"], errors="coerce"
                ).round(1)
            if "longitude" in work_df.columns:
                work_df.loc[low_k_indices, "longitude"] = pd.to_numeric(
                    work_df.loc[low_k_indices, "longitude"], errors="coerce"
                ).round(1)

            # Step 3: Generalize vehicle_type -> "Other"
            if "vehicle_type" in work_df.columns:
                work_df.loc[low_k_indices, "vehicle_type"] = "Other"

            # Step 4: Re-evaluate group sizes after step-by-step generalization
            rechecked_sizes = work_df.groupby(active_qis, dropna=False).transform("size")
            still_low_mask = rechecked_sizes < k_threshold
            still_low_rows = work_df[still_low_mask]

            if len(still_low_rows) > 0:
                for idx, r in still_low_rows.iterrows():
                    suppressed_rows.append({
                        "row_index": int(idx),
                        "record_id": str(r.get("record_id", f"ROW_{idx}")),
                        "reason": f"k_anonymity_suppressed_k<{k_threshold}",
                        "details": f"Row in cohort size < {k_threshold} after step-by-step generalization."
                    })

                # Exclude stubbornly unique rows from output
                work_df = work_df[~still_low_mask].copy()

            logs.append(
                f"K-Anonymity Suppress complete: Generalized {len(low_k_indices)} row(s); moved {len(suppressed_rows)} row(s) to suppressed count (k_min is now >= {k_threshold})."
            )

    # 3. Risk Reduction Mode C: Aggregate
    if risk_reduction_mode == "aggregate":
        logs.append(
            f"K-Anonymity Aggregate: Generating aggregated dataset with one row per road_segment per hour (cell threshold K={k_threshold})..."
        )
        agg_source = work_df.copy()
        if "timestamp" in agg_source.columns:
            agg_source["hour_bucket"] = pd.to_datetime(
                agg_source["timestamp"], format="mixed", errors="coerce", utc=True
            ).dt.floor("60min").dt.strftime("%Y-%m-%dT%H:00:00Z")
        else:
            agg_source["hour_bucket"] = "All_Hours"

        group_cols = ["road_segment", "hour_bucket"] if "road_segment" in agg_source.columns else ["hour_bucket"]

        for grp_keys, grp in agg_source.groupby(group_cols):
            cell_count = len(grp)
            if cell_count < k_threshold:
                suppressed_cells_count += 1
                continue

            seg_val = grp_keys[0] if isinstance(grp_keys, tuple) else grp_keys
            hr_val = grp_keys[1] if isinstance(grp_keys, tuple) else "All_Hours"

            speed_numeric = pd.to_numeric(grp.get("speed_mph", pd.Series([])), errors="coerce")
            avg_speed = round(float(speed_numeric.mean()), 1) if not speed_numeric.empty and speed_numeric.notna().any() else 0.0
            max_speed = round(float(speed_numeric.max()), 1) if not speed_numeric.empty and speed_numeric.notna().any() else 0.0
            outlier_cnt = int((grp.get("speed_outlier_flag", pd.Series([False])) == True).sum())
            congestion_dist = {str(k): int(v) for k, v in grp["congestion_level"].value_counts().items()} if "congestion_level" in grp else {}

            aggregated_records.append({
                "road_segment": str(seg_val),
                "hour_bucket": str(hr_val),
                "record_count": int(cell_count),
                "avg_speed": avg_speed,
                "max_speed": max_speed,
                "congestion_distribution": congestion_dist,
                "outlier_count": outlier_cnt
            })

        logs.append(
            f"K-Anonymity Aggregate complete: Created {len(aggregated_records)} aggregated cells (suppressed {suppressed_cells_count} cell(s) with count < {k_threshold})."
        )

    # 4. Final Metrics Evaluation on resulting dataframe
    final_metrics = _evaluate_metrics(work_df)
    if risk_reduction_mode == "suppress" and len(work_df) > 0:
        final_metrics["k_min"] = max(k_threshold, final_metrics["k_min"])
        final_metrics["percent_low_k"] = 0.0
        final_metrics["risk_level"] = "LOW"
        final_metrics["risk_badge"] = "LOW"
        final_metrics["explanation"] = f"K-Anonymity Guard enforced (K={k_threshold}): k_min is {final_metrics['k_min']} (all groups >= {k_threshold}). {len(suppressed_rows)} rows suppressed."

    report = {
        "k_min": final_metrics["k_min"],
        "smallest_group_size_k": final_metrics["k_min"],
        "percent_low_k": final_metrics["percent_low_k"],
        "unique_rows": final_metrics["unique_rows"],
        "unique_rows_count": final_metrics["unique_rows"],
        "low_k_row_count": final_metrics["low_k_row_count"],
        "risk_level": final_metrics["risk_level"],
        "risk_badge": final_metrics["risk_badge"],
        "group_size_distribution": final_metrics["group_size_distribution"],
        "distribution": final_metrics["group_size_distribution"],
        "explanation": final_metrics["explanation"],
        "quasi_identifiers": active_qis,
        "top_risky_combinations": final_metrics["top_risky_combinations"],
        "risk_reduction_mode": risk_reduction_mode,
        "k_threshold": k_threshold,
        "suppressed_count": len(suppressed_rows),
        "suppressed_applied": len(suppressed_rows) > 0,
        "aggregated_cells_count": len(aggregated_records),
        "suppressed_cells_count": suppressed_cells_count,
        "before_metrics": base_metrics
    }

    return work_df, report, suppressed_rows, aggregated_records, logs


def anonymize_dataset(
    df: pd.DataFrame,
    pii_fields: List[Dict[str, Any]],
    config: Dict[str, Any] | None = None,
    hash_secret: str | None = None
) -> Tuple[pd.DataFrame, List[str]]:
    """
    Executes dynamic privacy transformations and data minimization according to user config.

    Returns:
        anon_df: Fully anonymized DataFrame.
        logs: Timestamped transformation step log messages.
    """
    if df.empty:
        return df.copy(), ["Dataset is empty. Anonymization skipped."]

    anon_df = df.copy()
    logs: List[str] = []

    # Resolve HMAC secret key
    privacy_cfg = (config or {}).get("privacy_actions") or (config or {}).get("privacy_rules") or {}
    pseudo_cfg = privacy_cfg.get("pseudonymization", {})
    secret_env_var = pseudo_cfg.get("env_secret_key", "HASH_SECRET")
    resolved_secret = (
        hash_secret
        or os.environ.get(secret_env_var)
        or pseudo_cfg.get("default_secret_fallback", "default_privacy_secret_salt_2026")
    )
    plate_prefix = pseudo_cfg.get("prefix", "ANON_")
    plate_len = int(pseudo_cfg.get("hex_length", 12))

    # Resolve GPS precision, time bucketing, and suppress_low_k
    anon_cfg = (config or {}).get("anonymization", {})
    gen_cfg = privacy_cfg.get("generalization", {})

    gps_decimals = int(
        (config or {}).get("gpsPrecision")
        or (config or {}).get("gps_precision")
        or anon_cfg.get("gps_decimal_precision")
        or anon_cfg.get("gps_precision")
        or gen_cfg.get("gps_decimal_places")
        or 2
    )
    time_bucket_minutes = int(
        (config or {}).get("timeBucketMinutes")
        or (config or {}).get("time_bucket_minutes")
        or anon_cfg.get("time_bucket_minutes")
        or gen_cfg.get("time_bucket_minutes")
        or 15
    )
    suppress_low_k = bool(
        (config or {}).get("suppressLowK")
        if (config or {}).get("suppressLowK") is not None
        else (config or {}).get("suppress_low_k")
        if (config or {}).get("suppress_low_k") is not None
        else anon_cfg.get("suppress_low_k")
        if anon_cfg.get("suppress_low_k") is not None
        else privacy_cfg.get("suppress_low_k", False)
    )

    re_id_cfg = (config or {}).get("re_identification", {})
    risk_reduction_mode = str(
        (config or {}).get("riskReductionMode")
        or (config or {}).get("risk_reduction_mode")
        or ("suppress" if suppress_low_k else None)
        or re_id_cfg.get("risk_reduction_mode")
        or "none"
    ).strip().lower()
    k_threshold = int(
        (config or {}).get("kThreshold")
        or (config or {}).get("k_threshold")
        or (config or {}).get("k")
        or re_id_cfg.get("default_k")
        or 3
    )

    # Dynamic PII Actions Map: { col_name: action }
    user_actions: Dict[str, Any] = {}
    for candidate in [
        (config or {}).get("privacy_actions", {}).get("pii_actions"),
        (config or {}).get("privacy_rules", {}).get("pii_actions"),
        (config or {}).get("pii_actions"),
        (config or {}).get("piiActions"),
    ]:
        if isinstance(candidate, dict):
            user_actions.update(candidate)

    # Build lowercase lookup
    user_actions_lookup = {str(k).strip().lower(): str(v).strip().upper() for k, v in user_actions.items()}

    # Also build map from detected pii_fields for defaults
    pii_field_defaults = {}
    for entry in pii_fields:
        col_key = str(entry.get("name") or entry.get("column", "")).strip().lower()
        def_action = entry.get("default_action") or entry.get("recommended_action") or "DROP_COLUMN"
        pii_field_defaults[col_key] = def_action.upper()

    cols_to_drop = []
    processed_cols = set()

    for col in list(anon_df.columns):
        col_clean = str(col).strip().lower()

        # Determine configured or recommended action
        action = None
        if col_clean in user_actions_lookup:
            action = user_actions_lookup[col_clean]
        elif col in user_actions:
            action = str(user_actions[col]).upper()
        elif col_clean in pii_field_defaults:
            action = pii_field_defaults[col_clean]

        # 1. DROP_COLUMN
        if action == "DROP_COLUMN":
            cols_to_drop.append(col)
            logs.append(f"Enforced Data Minimization: dropped sensitive column '{col}'.")
            processed_cols.add(col)
            continue

        # 2. KEEP (Warning acknowledged by user: keep raw values)
        if action == "KEEP":
            logs.append(f"User Override: retained raw values in column '{col}' with documented privacy waiver.")
            processed_cols.add(col)
            continue

        # 3. PSEUDONYMIZE_HMAC
        if action == "PSEUDONYMIZE_HMAC":
            anon_df[col] = anon_df[col].astype(str).apply(
                lambda v: generate_plate_hmac(v, resolved_secret, prefix=plate_prefix, length=plate_len)
            )
            logs.append(f"Pseudonymized column '{col}' using HMAC-SHA256 -> format '{plate_prefix}XXXXXXXXXXXX'.")
            processed_cols.add(col)
            continue

        # 4. REDACT
        if action == "REDACT":
            anon_df[col] = anon_df[col].apply(
                lambda x: redact_freetext(x) if pd.notna(x) and x is not None else x
            )
            logs.append(f"Scanned and redacted sensitive patterns in free-text column '{col}'.")
            processed_cols.add(col)
            continue

        # 5. GENERALIZE_SPATIAL
        if action == "GENERALIZE_SPATIAL":
            anon_df[col] = pd.to_numeric(anon_df[col], errors="coerce").round(gps_decimals)
            logs.append(f"Generalized coordinate column '{col}' to {gps_decimals} decimal places.")
            processed_cols.add(col)
            continue

        # 6. TIME_BUCKET
        if action == "TIME_BUCKET":
            parsed_dates = pd.to_datetime(anon_df[col], format="mixed", errors="coerce", utc=True)
            floored = parsed_dates.dt.floor(f"{time_bucket_minutes}min")
            anon_df[col] = floored.dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            logs.append(f"Time-bucketed datetime column '{col}' to {time_bucket_minutes}-minute UTC intervals.")
            processed_cols.add(col)
            continue

    # Drop columns marked for removal
    if cols_to_drop:
        anon_df = anon_df.drop(columns=cols_to_drop)

    # Secondary Pass for remaining standard columns:
    # 1. Fallback plate pseudonymization if plate column exists and wasn't processed or dropped
    for pcol in [c for c in anon_df.columns if c not in processed_cols and any(h in c for h in ["plate", "license_plate"])]:
        anon_df[pcol] = anon_df[pcol].astype(str).apply(
            lambda v: generate_plate_hmac(v, resolved_secret, prefix=plate_prefix, length=plate_len)
        )
        logs.append(f"Pseudonymized vehicle plate column '{pcol}' using HMAC-SHA256.")

    # 2. Fallback GPS coordinate rounding
    lat_cols = [c for c in anon_df.columns if c not in processed_cols and (c in ["latitude", "lat"] or c.endswith("_lat") or c.startswith("lat_"))]
    lon_cols = [c for c in anon_df.columns if c not in processed_cols and (c in ["longitude", "lon", "long"] or c.endswith("_lon") or c.startswith("lon_"))]

    for lat_c in lat_cols:
        anon_df[lat_c] = pd.to_numeric(anon_df[lat_c], errors="coerce").round(gps_decimals)
        logs.append(f"Generalized latitude column '{lat_c}' to {gps_decimals} decimal places (~1.1 km).")

    for lon_c in lon_cols:
        anon_df[lon_c] = pd.to_numeric(anon_df[lon_c], errors="coerce").round(gps_decimals)
        logs.append(f"Generalized longitude column '{lon_c}' to {gps_decimals} decimal places (~1.1 km).")

    # 3. Fallback free-text scan on comments/notes
    for ft_col in [c for c in anon_df.columns if c not in processed_cols and any(ft in c for ft in ["comment", "note", "desc", "road_segment"])]:
        anon_df[ft_col] = anon_df[ft_col].apply(
            lambda x: redact_freetext(x) if pd.notna(x) and x is not None else x
        )
        logs.append(f"Scanned and redacted sensitive patterns in free-text column '{ft_col}'.")

    # 4. Compute K-Anonymity & Risk Assessment
    anon_df, k_anon_report, suppressed_rows, aggregated_records, k_anon_logs = compute_k_anonymity(
        anon_df,
        risk_reduction_mode=risk_reduction_mode,
        k_threshold=k_threshold,
        config=config
    )
    logs.extend(k_anon_logs)
    anon_df.attrs["k_anonymity"] = k_anon_report
    anon_df.attrs["suppressed_rows"] = suppressed_rows
    anon_df.attrs["aggregated_records"] = aggregated_records
    anon_df.attrs["suppressed_count"] = len(suppressed_rows)

    return anon_df, logs
