"""
Clean Module
Standardizes formats, cleans strings, normalizes categorical text, handles missing data,
parses mixed timestamp formats to 15-minute ISO-8601 UTC buckets, validates coordinate ranges
with coordinate_invalid_flag, flags speed outliers without clamping, separates exact duplicates
from conflicting duplicate record_ids, and audits all rejected rows without dropping any row silently.
"""

import re
from typing import Any, Dict, List, Tuple
import numpy as np
import pandas as pd


def clean_dataset(
    df: pd.DataFrame, config: Dict[str, Any] | None = None
) -> Tuple[pd.DataFrame, List[Dict[str, Any]], List[str]]:
    """
    Cleans raw traffic data and tracks rejected rows with non-PII explanations.

    Returns:
        clean_df: Cleaned and standardized DataFrame.
        rejected_rows: List of rejected rows with index, record_id, and reason (no PII).
        logs: Timestamped step execution log entries.
    """
    logs: List[str] = []
    rejected_rows: List[Dict[str, Any]] = []

    if df.empty:
        return df.copy(), rejected_rows, ["Dataset is empty. No cleaning operations performed."]

    clean_df = df.copy()

    # 1. Standardize column names (snake_case, stripped)
    clean_df.columns = [
        str(c).strip().lower().replace(" ", "_").replace("-", "_")
        for c in clean_df.columns
    ]
    logs.append(f"Standardized {len(clean_df.columns)} column names to snake_case.")

    # 2. Categorical normalization before processing (vehicle_type, road_segment, congestion_level)
    # Trim, collapse spaces, consistent casing (Title Case; alias map for 'suv' -> 'SUV', 'HIGH' -> 'High')
    # Blank values stay null, never silently filled.
    alias_cfg = (config or {}).get("cleaning_rules", {}).get("categorical_aliases", {
        "vehicle_type": {
            "suv": "SUV",
            "commercial van": "Commercial Van",
            "delivery truck": "Delivery Truck",
            "electric sedan": "Electric Sedan"
        },
        "congestion_level": {
            "high": "High",
            "moderate": "Moderate",
            "low": "Low",
            "extreme": "Extreme"
        },
        "road_segment": {
            "5th avenue": "5th Avenue",
            "8th avenue": "8th Avenue",
            "fdr drive south": "FDR Drive South",
            "west side hwy": "West Side Hwy",
            "central park west": "Central Park West"
        }
    })

    categorical_targets = ["vehicle_type", "road_segment", "congestion_level"]
    normalized_count = 0

    for col in categorical_targets:
        if col in clean_df.columns:
            col_aliases = {
                str(k).strip().lower(): str(v).strip()
                for k, v in alias_cfg.get(col, {}).items()
            }

            def norm_cat_val(val: Any) -> Any:
                nonlocal normalized_count
                if pd.isna(val) or val is None:
                    return val
                s = str(val).strip()
                if not s or s.lower() in ["nan", "none", "null"]:
                    return None
                collapsed = re.sub(r"\s+", " ", s)
                lowered = collapsed.lower()
                if lowered in col_aliases:
                    norm = col_aliases[lowered]
                else:
                    norm = collapsed.title()
                if norm != val:
                    normalized_count += 1
                return norm

            clean_df[col] = clean_df[col].apply(norm_cat_val)

    if normalized_count > 0:
        logs.append(
            f"Normalized {normalized_count} categorical value(s) across {', '.join(categorical_targets)}."
        )

    # 3. Trim string whitespace for other string columns while preserving nulls as null
    str_cols = clean_df.select_dtypes(include=["object", "string"]).columns
    for c in str_cols:
        if c not in categorical_targets:
            clean_df[c] = clean_df[c].apply(
                lambda x: re.sub(r"^\s+|\s+$", "", str(x))
                if pd.notna(x) and str(x).lower() not in ["nan", "none", "null", ""]
                else (None if pd.isna(x) or str(x).lower() in ["nan", "none", "null", ""] else x)
            )
    logs.append(f"Trimmed leading/trailing whitespace across string columns while preserving null values.")

    # 4. Check for exact duplicate rows (record each with record_id and reason, count duplicates_removed)
    duplicate_mask = clean_df.duplicated()
    dupe_indices = clean_df[duplicate_mask].index.tolist()
    duplicates_removed_rows: List[Dict[str, Any]] = []

    for idx in dupe_indices:
        rec_id = str(clean_df.loc[idx, "record_id"]) if "record_id" in clean_df.columns and pd.notna(clean_df.loc[idx, "record_id"]) else None
        duplicates_removed_rows.append({
            "row_index": int(idx),
            "record_id": rec_id,
            "reason": "exact_duplicate",
            "details": "Exact identical duplicate row removed."
        })

    duplicates_removed_count = len(dupe_indices)
    if duplicates_removed_count > 0:
        clean_df = clean_df.drop_duplicates(keep="first")
        logs.append(f"Identified and removed {duplicates_removed_count} exact duplicate row(s).")

    # 5. Duplicate record_id with different values: keep the first row, move others to rejected_rows with reason "conflicting_duplicate_id"
    if "record_id" in clean_df.columns:
        conflicting_mask = clean_df.duplicated(subset=["record_id"], keep="first")
        conflicting_indices = clean_df[conflicting_mask].index.tolist()
        for idx in conflicting_indices:
            rec_id = str(clean_df.loc[idx, "record_id"])
            rejected_rows.append({
                "row_index": int(idx),
                "record_id": rec_id,
                "reason": "conflicting_duplicate_id",
                "details": f"Conflicting duplicate record_id '{rec_id}' detected with differing values; kept first occurrence."
            })
        if conflicting_indices:
            clean_df = clean_df[~conflicting_mask]
            logs.append(
                f"Moved {len(conflicting_indices)} conflicting duplicate record_id row(s) to rejected_rows with reason 'conflicting_duplicate_id'."
            )

    # 6. Required fields check (drop missing required fields explicitly with reasons)
    req_cols = (config or {}).get("cleaning_rules", {}).get("null_handling", {}).get(
        "drop_if_missing_required", ["record_id"]
    )
    for rc in req_cols:
        if rc in clean_df.columns:
            missing_mask = clean_df[rc].isnull() | (clean_df[rc].astype(str).str.lower().isin(["", "nan", "none", "null"]))
            missing_indices = clean_df[missing_mask].index.tolist()
            for idx in missing_indices:
                rejected_rows.append({
                    "row_index": int(idx),
                    "record_id": None,
                    "reason": f"missing_required_field_{rc}",
                    "details": f"Row rejected due to missing mandatory identifier: '{rc}'."
                })
            if missing_indices:
                clean_df = clean_df[~missing_mask]
                logs.append(f"Rejected {len(missing_indices)} row(s) missing mandatory '{rc}'.")

    # 7. Standardize timestamps & Round down to 15-minute bucket
    # Parse formats: MM/DD/YYYY HH:MM:SS, YYYY-MM-DD HH:MM, DD-Mon-YYYY HH:MM:SS, ISO-8601
    # Truly invalid values ("not_a_date", "2026-13-45T99:00:00Z") go to rejected_rows with reason "invalid_timestamp"
    time_bucket_minutes = (config or {}).get("privacy_actions", {}).get("generalization", {}).get(
        "time_bucket_minutes", 15
    )
    timestamp_candidates = [c for c in clean_df.columns if "time" in c or "date" in c]

    for tc in timestamp_candidates:
        parsed_dates = pd.to_datetime(clean_df[tc], format="mixed", errors="coerce", utc=True)
        invalid_date_mask = parsed_dates.isnull()
        invalid_indices = clean_df[invalid_date_mask].index.tolist()

        for idx in invalid_indices:
            rec_id = str(clean_df.loc[idx, "record_id"]) if "record_id" in clean_df.columns and pd.notna(clean_df.loc[idx, "record_id"]) else None
            rejected_rows.append({
                "row_index": int(idx),
                "record_id": rec_id,
                "reason": "invalid_timestamp",
                "details": f"Row rejected due to unparseable datetime format in '{tc}'."
            })

        if invalid_indices:
            clean_df = clean_df[~invalid_date_mask]
            parsed_dates = parsed_dates[~invalid_date_mask]
            logs.append(f"Rejected {len(invalid_indices)} row(s) with invalid datetime in '{tc}'.")

        # Round down (floor) to nearest 15-minute interval for temporal privacy
        if not parsed_dates.empty:
            floored = parsed_dates.dt.floor(f"{time_bucket_minutes}min")
            clean_df[tc] = floored.dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            logs.append(
                f"Standardized and floored datetime in '{tc}' to {time_bucket_minutes}-minute UTC buckets."
            )

    # 8. Coordinates: latitude must be -90..90 and longitude -180..180
    # Invalid values become null with a flag column coordinate_invalid_flag
    coord_cfg = (config or {}).get("cleaning_rules", {}).get("coordinates", {})
    lat_min = float(coord_cfg.get("lat_min", -90.0))
    lat_max = float(coord_cfg.get("lat_max", 90.0))
    lon_min = float(coord_cfg.get("lon_min", -180.0))
    lon_max = float(coord_cfg.get("lon_max", 180.0))
    coord_flag_col = coord_cfg.get("flag_column_name", "coordinate_invalid_flag")

    lat_cols = [c for c in clean_df.columns if c in ["latitude", "lat"] or c.endswith("_lat") or c.startswith("lat_")]
    lon_cols = [c for c in clean_df.columns if c in ["longitude", "lon", "long"] or c.endswith("_lon") or c.endswith("_long") or c.startswith("lon_") or c.startswith("long_")]

    is_invalid_coord = pd.Series(False, index=clean_df.index)

    for lat_c in lat_cols:
        raw_val = clean_df[lat_c]
        lat_numeric = pd.to_numeric(raw_val, errors="coerce")
        out_of_range = (lat_numeric < lat_min) | (lat_numeric > lat_max)
        malformed = raw_val.notna() & lat_numeric.isna() & (raw_val.astype(str).str.strip().str.lower().isin(["nan", "none", "null"]) == False)
        bad_lat = out_of_range | malformed
        is_invalid_coord = is_invalid_coord | bad_lat
        bad_lat_count = int(bad_lat.sum())
        if bad_lat_count > 0:
            clean_df.loc[bad_lat, lat_c] = np.nan
            logs.append(
                f"Nullified {bad_lat_count} invalid latitude value(s) outside [{lat_min}, {lat_max}] in '{lat_c}'."
            )

    for lon_c in lon_cols:
        raw_val = clean_df[lon_c]
        lon_numeric = pd.to_numeric(raw_val, errors="coerce")
        out_of_range = (lon_numeric < lon_min) | (lon_numeric > lon_max)
        malformed = raw_val.notna() & lon_numeric.isna() & (raw_val.astype(str).str.strip().str.lower().isin(["nan", "none", "null"]) == False)
        bad_lon = out_of_range | malformed
        is_invalid_coord = is_invalid_coord | bad_lon
        bad_lon_count = int(bad_lon.sum())
        if bad_lon_count > 0:
            clean_df.loc[bad_lon, lon_c] = np.nan
            logs.append(
                f"Nullified {bad_lon_count} invalid longitude value(s) outside [{lon_min}, {lon_max}] in '{lon_c}'."
            )

    clean_df[coord_flag_col] = is_invalid_coord.fillna(False)

    # 9. Speed outlier handling (Do NOT clamp silently! Add speed_outlier_flag; set <0 or >250 to null)
    speed_cfg = (config or {}).get("cleaning_rules", {}).get("speed", {})
    valid_min = float(speed_cfg.get("valid_min_mph", 0.0))
    valid_max = float(speed_cfg.get("valid_max_mph", 250.0))
    outlier_threshold = float(speed_cfg.get("outlier_threshold_mph", 120.0))
    flag_col = speed_cfg.get("flag_column_name", "speed_outlier_flag")

    speed_cols = [c for c in clean_df.columns if "speed" in c or "velocity" in c]
    for sc in speed_cols:
        clean_df[sc] = pd.to_numeric(clean_df[sc], errors="coerce")
        # Flag if > outlier threshold OR < valid_min OR > valid_max
        is_impossible = (clean_df[sc] < valid_min) | (clean_df[sc] > valid_max)
        is_outlier = (clean_df[sc] > outlier_threshold) | is_impossible

        clean_df[flag_col] = is_outlier.fillna(False)

        impossible_count = int(is_impossible.sum())
        if impossible_count > 0:
            # Nullify impossible physical values while keeping the flag
            clean_df.loc[is_impossible, sc] = np.nan
            logs.append(
                f"Flagged and nullified {impossible_count} impossible speed values (< {valid_min} or > {valid_max} mph) in '{sc}'."
            )

        high_outliers_count = int(((clean_df[sc] > outlier_threshold) & ~is_impossible).sum())
        if high_outliers_count > 0:
            logs.append(
                f"Flagged {high_outliers_count} high-speed outlier(s) (> {outlier_threshold} mph) in '{sc}' with '{flag_col}=True' without altering values."
            )

    # Attach metadata attributes for row accounting and audit logs
    clean_df.attrs["duplicates_removed_count"] = duplicates_removed_count
    clean_df.attrs["duplicates_removed_rows"] = duplicates_removed_rows
    clean_df.attrs["categorical_normalized_count"] = normalized_count

    return clean_df, rejected_rows, logs
