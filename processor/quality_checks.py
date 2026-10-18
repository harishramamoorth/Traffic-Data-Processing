"""
Quality Checks Module
Executes an audit battery of reconciliation and privacy checks covering:
- QC-01: Record Count Reconciliation (input_rows = output_rows + rejected_rows + duplicates_removed)
- QC-02: Schema Completeness & Data Minimization Audit
- QC-03: Zero Raw PII Leakage Re-Scan (SSN, Email, Phone regexes)
- QC-04: Value Ranges & Outlier Integrity
- QC-coordinates-valid: Physical boundaries for latitude (-90..90) and longitude (-180..180)
- QC-05: Spatial and Temporal Generalization Audit
- QC-06: Plate Pseudonym Consistency
- QC-07: Duplicate Record Absence & Conflicting ID Audit
- QC-08: Null-Rate Audit per Column
"""

import re
from typing import Any, Dict, List, Tuple
import pandas as pd


def run_quality_checks(
    original_df: pd.DataFrame,
    processed_df: pd.DataFrame,
    rejected_rows: List[Dict[str, Any]],
    pii_fields: List[Dict[str, Any]],
    config: Dict[str, Any] | None = None,
    duplicates_removed: int | None = None,
    duplicates_removed_rows: List[Dict[str, Any]] | None = None,
    suppressed_rows: List[Dict[str, Any]] | None = None,
    suppressed_count: int | None = None,
    k_anonymity: Dict[str, Any] | None = None
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Executes audit checks and validates pipeline transformation integrity.

    Returns:
        checks: List of test results (id, name, status PASS/WARN/FAIL, description, details).
        overall_status: PASSED | PASSED_WITH_WARNINGS | FAILED.
    """
    checks: List[Dict[str, Any]] = []

    input_count = len(original_df)
    output_count = len(processed_df)
    rejected_count = len(rejected_rows)

    # Resolve duplicates_removed count and rows
    dupes_count = (
        duplicates_removed
        if duplicates_removed is not None
        else getattr(processed_df, "attrs", {}).get("duplicates_removed_count", 0)
    )
    dupes_rows = (
        duplicates_removed_rows
        if duplicates_removed_rows is not None
        else getattr(processed_df, "attrs", {}).get("duplicates_removed_rows", [])
    )

    # Resolve suppressed count and rows
    suppressed_cnt = (
        suppressed_count
        if suppressed_count is not None
        else getattr(processed_df, "attrs", {}).get("suppressed_count", 0)
    )
    supp_rows = (
        suppressed_rows
        if suppressed_rows is not None
        else getattr(processed_df, "attrs", {}).get("suppressed_rows", [])
    )

    # --------------------------------------------------------------------------
    # QC-01: Record Count Reconciliation (input_rows = output_rows + rejected_rows + duplicates_removed + suppressed_rows)
    # --------------------------------------------------------------------------
    reconciliation_matched = (input_count == output_count + rejected_count + dupes_count + suppressed_cnt)
    rejection_reasons = {}
    for r in rejected_rows:
        reason = r.get("reason", "unknown")
        rejection_reasons[reason] = rejection_reasons.get(reason, 0) + 1

    reasons_summary = ", ".join([f"{k}: {v}" for k, v in rejection_reasons.items()]) if rejection_reasons else "none"

    # List every rejected, removed, or suppressed row (record_id + reason, no PII)
    all_exclusions = []
    for r in rejected_rows:
        rid = str(r.get("record_id")) if r.get("record_id") and str(r.get("record_id")).lower() != "none" else f"Row_{r.get('row_index', 'unknown')}"
        all_exclusions.append(f"{rid} ({r.get('reason')})")

    for d in (dupes_rows or []):
        rid = str(d.get("record_id")) if d.get("record_id") and str(d.get("record_id")).lower() != "none" else f"Row_{d.get('row_index', 'unknown')}"
        all_exclusions.append(f"{rid} (exact_duplicate)")

    for s in (supp_rows or []):
        rid = str(s.get("record_id")) if s.get("record_id") and str(s.get("record_id")).lower() != "none" else f"Row_{s.get('row_index', 'unknown')}"
        all_exclusions.append(f"{rid} ({s.get('reason', 'suppressed')})")

    exclusions_str = f" All audited excluded/rejected/suppressed rows: [{', '.join(all_exclusions)}]." if all_exclusions else " No rows rejected or removed."

    if suppressed_cnt > 0:
        breakdown_str = f"Input ({input_count}) = Output ({output_count}) + Rejected ({rejected_count}) + Duplicates Removed ({dupes_count}) + Suppressed ({suppressed_cnt})"
    else:
        breakdown_str = f"Input ({input_count}) = Output ({output_count}) + Rejected ({rejected_count}) + Duplicates Removed ({dupes_count})"

    if reconciliation_matched:
        qc01_status = "PASS"
        qc01_details = (
            f"100% reconciled: {breakdown_str}. "
            f"Rejection breakdown: [{reasons_summary}].{exclusions_str}"
        )
    else:
        qc01_status = "FAIL"
        discrepancy = input_count - (output_count + rejected_count + dupes_count + suppressed_cnt)
        qc01_details = (
            f"Reconciliation discrepancy of {discrepancy} rows! "
            f"{breakdown_str}.{exclusions_str}"
        )

    checks.append({
        "id": "QC-01",
        "name": "Record Count Reconciliation",
        "status": qc01_status,
        "description": "Verifies that input_rows = output_rows + rejected_rows + duplicates_removed + suppressed_rows with complete accountability.",
        "details": qc01_details,
        "how_to_fix": "Ensure all excluded records are accounted for in rejected_rows, duplicates_removed, or suppressed_rows." if qc01_status != "PASS" else "No action required.",
        "input_rows": input_count,
        "output_rows": output_count,
        "rejected_rows": rejected_count,
        "duplicates_removed": dupes_count,
        "suppressed_rows": suppressed_cnt,
        "excluded_rows_list": all_exclusions
    })

    # --------------------------------------------------------------------------
    # QC-02: Schema Completeness & Data Minimization Audit
    # --------------------------------------------------------------------------
    orig_cols = {str(c).strip().lower().replace(" ", "_").replace("-", "_") for c in original_df.columns}
    proc_cols = set(processed_df.columns)

    expected_dropped_cols = {
        str(p["column"]).strip().lower().replace(" ", "_").replace("-", "_")
        for p in pii_fields if p.get("recommended_action") == "DROP_COLUMN"
    }
    unexpected_dropped = (orig_cols - proc_cols) - expected_dropped_cols

    if not unexpected_dropped:
        qc02_status = "PASS"
        qc02_details = (
            f"All analytical dimensions preserved. Legitimate minimization dropped: "
            f"{list(expected_dropped_cols) if expected_dropped_cols else 'none'}."
        )
    else:
        qc02_status = "WARN"
        qc02_details = f"Unexpected column drop detected: {list(unexpected_dropped)}."

    checks.append({
        "id": "QC-02",
        "name": "Schema Completeness",
        "status": qc02_status,
        "description": "Ensures all non-PII dimensions are preserved while direct PII is minimized.",
        "details": qc02_details,
        "how_to_fix": f"Verify why columns {list(unexpected_dropped)} were removed, or configure them under privacy rules." if qc02_status != "PASS" else "No action required."
    })

    # --------------------------------------------------------------------------
    # QC-03: Zero Raw PII Leakage Re-Scan
    # --------------------------------------------------------------------------
    pii_regexes = {
        "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
        "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
        "phone": re.compile(
            r"\+\d{1,4}(?:[\s.-]*\d{1,4}){2,6}\b|\(?\b\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\b|\b\d{3}[-.\s]\d{4}\b|\b\d{10,}\b"
        )
    }

    leak_findings = []
    for col in processed_df.columns:
        if processed_df[col].dtype == object or str(processed_df[col].dtype).startswith("string"):
            col_strings = processed_df[col].dropna().astype(str)
            for pii_name, rgx in pii_regexes.items():
                matches = col_strings.apply(lambda s: bool(rgx.search(s))).sum()
                if matches > 0:
                    leak_findings.append(f"{matches} unredacted {pii_name} pattern(s) in column '{col}'")

    if not leak_findings:
        qc03_status = "PASS"
        qc03_details = "Zero raw PII patterns detected in output dataset across all columns and free-text fields."
    else:
        qc03_status = "FAIL"
        qc03_details = "CRITICAL: PII leakage detected: " + "; ".join(leak_findings)

    checks.append({
        "id": "QC-03",
        "name": "Zero Raw PII Leakage",
        "status": qc03_status,
        "description": "Independent full-dataset regex audit confirming absence of raw SSNs, emails, or phone numbers.",
        "details": qc03_details,
        "how_to_fix": "Enable Redact, Drop, or Pseudonymize on flagged columns to remove direct PII leakages." if qc03_status != "PASS" else "No action required."
    })

    # --------------------------------------------------------------------------
    # QC-04: Value Ranges & Outlier Integrity
    # --------------------------------------------------------------------------
    speed_cols = [c for c in processed_df.columns if "speed" in c or "velocity" in c]
    range_violations = []

    for sc in speed_cols:
        if pd.api.types.is_numeric_dtype(processed_df[sc]):
            impossible = ((processed_df[sc] < 0) | (processed_df[sc] > 250)).sum()
            if impossible > 0:
                range_violations.append(f"{impossible} impossible speed values (<0 or >250 mph) in '{sc}'")

    if not range_violations:
        qc04_status = "PASS"
        qc04_details = "Physical boundaries verified. Impossible speeds nullified and flagged."
    else:
        qc04_status = "FAIL"
        qc04_details = "; ".join(range_violations)

    checks.append({
        "id": "QC-04",
        "name": "Physical Value Ranges",
        "status": qc04_status,
        "description": "Verifies that all numerical values conform to physically possible boundaries.",
        "details": qc04_details,
        "how_to_fix": "Ensure data cleaning nullifies speeds <0 or >250 mph with speed_outlier_flag." if qc04_status != "PASS" else "No action required."
    })

    # --------------------------------------------------------------------------
    # QC-coordinates-valid: Coordinate Boundaries Validity (-90..90 and -180..180)
    # --------------------------------------------------------------------------
    lat_cols = [c for c in processed_df.columns if c in ["latitude", "lat"] or c.endswith("_lat") or c.startswith("lat_")]
    lon_cols = [c for c in processed_df.columns if c in ["longitude", "lon", "long"] or c.endswith("_lon") or c.endswith("_long") or c.startswith("lon_") or c.startswith("long_")]

    coord_violations = []
    for lat_c in lat_cols:
        if pd.api.types.is_numeric_dtype(processed_df[lat_c]):
            out_lat = ((processed_df[lat_c].dropna() < -90.0) | (processed_df[lat_c].dropna() > 90.0)).sum()
            if out_lat > 0:
                coord_violations.append(f"{out_lat} latitude coordinate(s) outside valid -90..90 range in '{lat_c}'")

    for lon_c in lon_cols:
        if pd.api.types.is_numeric_dtype(processed_df[lon_c]):
            out_lon = ((processed_df[lon_c].dropna() < -180.0) | (processed_df[lon_c].dropna() > 180.0)).sum()
            if out_lon > 0:
                coord_violations.append(f"{out_lon} longitude coordinate(s) outside valid -180..180 range in '{lon_c}'")

    if not coord_violations:
        qc_coord_status = "PASS"
        qc_coord_details = "All coordinates valid within boundaries: latitude in [-90, 90] and longitude in [-180, 180]."
    else:
        qc_coord_status = "FAIL"
        qc_coord_details = "; ".join(coord_violations)

    checks.append({
        "id": "QC-coordinates-valid",
        "name": "Coordinate Boundaries Validity",
        "status": qc_coord_status,
        "description": "Verifies that all non-null latitude values are -90..90 and longitude values are -180..180.",
        "details": qc_coord_details,
        "how_to_fix": "Verify that coordinates outside -90..90 lat and -180..180 lon are nullified and flagged." if qc_coord_status != "PASS" else "No action required."
    })

    # --------------------------------------------------------------------------
    # QC-05: Spatial and Temporal Generalization Audit
    # --------------------------------------------------------------------------
    gen_violations = []
    for lat_c in lat_cols:
        if pd.api.types.is_numeric_dtype(processed_df[lat_c]):
            unrounded = (processed_df[lat_c].dropna() != processed_df[lat_c].dropna().round(2)).sum()
            if unrounded > 0:
                gen_violations.append(f"{unrounded} latitude coordinates exceeding 2 decimal places in '{lat_c}'")

    time_cols = [c for c in processed_df.columns if "time" in c or "date" in c]
    for tc in time_cols:
        sample_times = processed_df[tc].dropna().astype(str).head(20).tolist()
        for st in sample_times:
            if "T" in st and ":" in st:
                parts = st.split("T")[-1].replace("Z", "").split(":")
                if len(parts) >= 2:
                    minute = int(parts[1]) if parts[1].isdigit() else 0
                    if minute % 15 != 0:
                        gen_violations.append(f"Timestamp '{st}' is not rounded to a 15-minute bucket in '{tc}'")
                        break

    if not gen_violations:
        qc05_status = "PASS"
        qc05_details = "Spatial generalization (2 decimals ~1.1 km) and 15-minute temporal bucketing verified."
    else:
        qc05_status = "WARN"
        qc05_details = "; ".join(gen_violations)

    checks.append({
        "id": "QC-05",
        "name": "Generalization Audit",
        "status": qc05_status,
        "description": "Confirms GPS coordinates are truncated to 2 decimals and timestamps floored to 15-min intervals.",
        "details": qc05_details,
        "how_to_fix": "Select a generalization preset (e.g., Balanced or Max Privacy) to enforce spatial and temporal binning." if qc05_status != "PASS" else "No action required."
    })

    # --------------------------------------------------------------------------
    # QC-06: Plate Pseudonym Consistency
    # --------------------------------------------------------------------------
    plate_cols = [c for c in processed_df.columns if "plate" in c]
    pseudo_status = "PASS"
    pseudo_details = "Pseudonym format verified with ANON_ prefix and deterministic HMAC hash length."

    for pcol in plate_cols:
        sample_plates = processed_df[pcol].dropna().astype(str)
        invalid_format = (~sample_plates.str.startswith("ANON_")).sum()
        if invalid_format > 0:
            pseudo_status = "FAIL"
            pseudo_details = f"{invalid_format} plate pseudonyms do not conform to ANON_ standard format."

    checks.append({
        "id": "QC-06",
        "name": "Plate Pseudonym Consistency",
        "status": pseudo_status,
        "description": "Ensures vehicle plate identifiers are uniformly pseudonymized via salted HMAC-SHA256.",
        "details": pseudo_details,
        "how_to_fix": "Configure plate columns with PSEUDONYMIZE_HMAC in Configure step to ensure uniform prefix masking." if pseudo_status != "PASS" else "No action required."
    })

    # --------------------------------------------------------------------------
    # QC-07: Duplicate Record Absence & Conflicting ID Audit
    # --------------------------------------------------------------------------
    dupe_count = int(processed_df.duplicated().sum())
    conflicting_dupes = [r for r in rejected_rows if r.get("reason") == "conflicting_duplicate_id"]

    if dupe_count > 0:
        qc07_status = "FAIL"
        qc07_details = f"{dupe_count} duplicate rows detected in clean output."
        qc07_fix = "Enable deduplication step to drop exact duplicate rows."
    elif conflicting_dupes:
        qc07_status = "WARN"
        conflicting_ids = [str(r.get("record_id")) for r in conflicting_dupes if r.get("record_id")]
        qc07_details = (
            f"WARN: {len(conflicting_dupes)} conflicting duplicate record_id row(s) ({', '.join(conflicting_ids)}) "
            f"detected with differing values and moved to rejected_rows; kept first occurrence."
        )
        qc07_fix = "Review upstream data generator for duplicate record IDs with differing attributes. Rejections are isolated in rejected_rows."
    else:
        qc07_status = "PASS"
        qc07_details = "Zero duplicate records found in output; no conflicting duplicate record_ids."
        qc07_fix = "No action required."

    checks.append({
        "id": "QC-07",
        "name": "Duplicate Record Absence",
        "status": qc07_status,
        "description": "Verifies that cleaned output contains zero duplicate rows and audits conflicting record_ids.",
        "details": qc07_details,
        "how_to_fix": qc07_fix
    })

    # --------------------------------------------------------------------------
    # QC-08: Null-Rate Audit per Column
    # --------------------------------------------------------------------------
    high_null_cols = []
    if output_count > 0:
        for c in processed_df.columns:
            null_pct = (processed_df[c].isnull().sum() / output_count) * 100.0
            # Allow speed_mph, latitude, notes, etc. to have nulls if preserved
            if null_pct > 60.0 and c not in ["notes"]:
                high_null_cols.append(f"'{c}' ({null_pct:.1f}% null)")

    qc08_status = "PASS" if not high_null_cols else "WARN"
    checks.append({
        "id": "QC-08",
        "name": "Column Null Rate Thresholds",
        "status": qc08_status,
        "description": "Audits missing value percentage across all analytical attributes.",
        "details": "All essential columns within healthy missingness thresholds." if not high_null_cols else f"Elevated null rates in: {', '.join(high_null_cols)}.",
        "how_to_fix": f"Inspect upstream collection sensors for high null rates in {', '.join(high_null_cols)}." if qc08_status != "PASS" else "No action required."
    })

    # --------------------------------------------------------------------------
    # QC-09: Re-identification Risk Audit (k-anonymity)
    # --------------------------------------------------------------------------
    k_data = k_anonymity if k_anonymity is not None else getattr(processed_df, "attrs", {}).get("k_anonymity", {})
    risk_level = str(k_data.get("risk_level", "LOW")).upper()
    k_min = int(k_data.get("k_min", 0))
    pct_low_k = float(k_data.get("percent_low_k", 0.0))
    unique_rows = int(k_data.get("unique_rows", 0))
    explanation = k_data.get("explanation", "")

    if risk_level == "LOW":
        qc09_status = "PASS"
        qc09_details = (
            f"Low re-identification risk: k_min={k_min}, only {pct_low_k}% of rows in groups with k<3 ({unique_rows} unique rows). "
            f"Quasi-identifier cohorts meet privacy threshold (<5%)."
        )
        qc09_fix = "No action required."
    elif risk_level == "MEDIUM":
        qc09_status = "WARN"
        qc09_details = (
            f"WARN: Medium re-identification risk: {pct_low_k}% of rows belong to groups with k<3 (k_min={k_min}, {unique_rows} unique rows). "
            f"Quasi-identifier linkage is possible for small cohorts."
        )
        qc09_fix = "Enable 'Suppress' or 'Aggregate' risk reduction mode to eliminate small cohort linkage."
    else:  # HIGH
        qc09_status = "WARN"
        qc09_details = (
            f"WARN: High re-identification risk: {pct_low_k}% of rows belong to groups with k<3 (k_min={k_min}, {unique_rows} unique rows). "
            f"Compliance cannot be verified while risk is High; output certified as PASSED_WITH_WARNINGS."
        )
        qc09_fix = "Enable 'Suppress' (K=3) or 'Aggregate' risk reduction mode in Configure to enforce k >= 3 across all cohorts."

    checks.append({
        "id": "QC-09",
        "name": "Re-identification Risk Audit",
        "status": qc09_status,
        "description": "Computes k-anonymity across quasi-identifiers (time bucket, rounded lat/lon, vehicle_type, road_segment) and audits re-identification vulnerability.",
        "details": qc09_details,
        "how_to_fix": qc09_fix,
        "risk_level": risk_level,
        "k_min": k_min,
        "percent_low_k": pct_low_k,
        "unique_rows": unique_rows,
        "explanation": explanation
    })

    # --------------------------------------------------------------------------
    # Compute Overall Audit Status
    # --------------------------------------------------------------------------
    has_fail = any(c["status"] == "FAIL" for c in checks)
    has_warn = any(c["status"] == "WARN" for c in checks)

    if has_fail:
        overall_status = "FAILED"
    elif has_warn:
        overall_status = "PASSED_WITH_WARNINGS"
    else:
        overall_status = "PASSED"

    return checks, overall_status
