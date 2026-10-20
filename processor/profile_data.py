"""
Profile Data Module
Performs comprehensive dataset profiling before transformation:
- Row/column dimensions, per-column types, null rates, unique counts
- Statistical distributions (min/max/mean/std) and sparkline histogram bins
- Detected PII columns with confidence and reasons (single source of truth: pii_columns)
- Pre-aggregated chart series: dtype donut, null bar, speed histogram, hourly trend, 7x24 heatmap, coordinate scatter
- Data Health Score (0-100) with explanation
"""

import json
import math
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
try:
    from detect_pii import detect_pii_columns
except ImportError:
    from processor.detect_pii import detect_pii_columns


def format_bytes(size_bytes: int) -> str:
    """Formats file size into human-readable KB or MB."""
    if not size_bytes or size_bytes <= 0:
        return "0 KB"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / (1024 * 1024):.2f} MB"


def profile_dataset(
    df: pd.DataFrame,
    filename: str = "",
    file_size: int = 0,
    config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Computes in-memory profiling telemetry for a dataset without persisting raw records.
    Single source of truth for PII detection, dimensions, and speed outliers.
    """
    total_rows = int(len(df))
    total_cols = int(len(df.columns))

    formatted_size = format_bytes(file_size)
    ext = (filename.rsplit(".", 1)[-1].lower() if "." in filename else "") if filename else ""
    if ext == "csv":
        f_type = "CSV"
    elif ext == "tsv":
        f_type = "TSV"
    elif ext == "txt":
        f_type = "TXT"
    elif ext in ["xlsx", "xls"]:
        f_type = "Excel"
    elif ext == "json":
        f_type = "JSON"
    else:
        f_type = "Telemetry Dataset"

    sheet_names = getattr(df, "attrs", {}).get("sheet_names", [])
    selected_sheet = getattr(df, "attrs", {}).get("selected_sheet", "")

    if total_rows == 0:
        return {
            "filename": filename,
            "file_name": filename,
            "file_size": file_size,
            "file_size_bytes": file_size,
            "file_size_formatted": formatted_size,
            "file_type": f_type,
            "sheet_names": sheet_names,
            "selected_sheet": selected_sheet,
            "row_count": 0,
            "column_count": total_cols,
            "columns": [],
            "column_profiles": {},
            "date_range": None,
            "duplicate_count": 0,
            "pii_columns": [],
            "detected_pii": [],
            "pii_columns_detected": 0,
            "outliers_count": 0,
            "health_score": 0,
            "health_summary": "Empty dataset",
            "preview_rows": [],
            "charts": {}
        }

    # 1. Column Metrics & Profiling
    column_profiles: List[Dict[str, Any]] = []
    dtype_counts = {"numeric": 0, "string": 0, "datetime": 0, "boolean": 0}
    total_null_cells = 0

    for col in df.columns:
        series = df[col]
        null_count = int(series.isnull().sum())
        total_null_cells += null_count
        null_pct = round((null_count / total_rows) * 100, 2)
        unique_count = int(series.nunique(dropna=True))

        # Classify data type
        col_type = "string"
        stats = {}
        sparkline = []

        if pd.api.types.is_numeric_dtype(series):
            col_type = "numeric"
            dtype_counts["numeric"] += 1
            valid_nums = series.dropna().astype(float)
            if len(valid_nums) > 0:
                min_val = float(valid_nums.min())
                max_val = float(valid_nums.max())
                mean_val = float(valid_nums.mean())
                std_val = float(valid_nums.std()) if len(valid_nums) > 1 else 0.0
                stats = {
                    "min": round(min_val, 2) if not (math.isnan(min_val) or math.isinf(min_val)) else 0.0,
                    "max": round(max_val, 2) if not (math.isnan(max_val) or math.isinf(max_val)) else 0.0,
                    "mean": round(mean_val, 2) if not (math.isnan(mean_val) or math.isinf(mean_val)) else 0.0,
                    "std": round(std_val, 2) if not (math.isnan(std_val) or math.isinf(std_val)) else 0.0
                }
                # Compute 8 sparkline bins
                try:
                    counts, _ = np.histogram(valid_nums, bins=8)
                    sparkline = [int(c) for c in counts]
                except Exception:
                    sparkline = [len(valid_nums)] * 8
        elif any(k in str(col).lower() for k in ["time", "date"]):
            col_type = "datetime"
            dtype_counts["datetime"] += 1
        elif pd.api.types.is_bool_dtype(series):
            col_type = "boolean"
            dtype_counts["boolean"] += 1
        else:
            col_type = "string"
            dtype_counts["string"] += 1

        column_profiles.append({
            "name": str(col),
            "inferred_type": col_type,
            "dtype": col_type,
            "raw_dtype": str(series.dtype),
            "null_count": null_count,
            "null_pct": null_pct,
            "null_percentage": null_pct,
            "unique_count": unique_count,
            "stats": stats,
            "sparkline_bins": sparkline
        })

    # 2. Date Range
    date_range = None
    time_cols = [c for c in df.columns if "time" in str(c).lower() or "date" in str(c).lower()]
    parsed_dates = None
    for tc in time_cols:
        candidate_dates = pd.to_datetime(df[tc], format="mixed", errors="coerce", utc=True).dropna()
        if len(candidate_dates) > 0:
            parsed_dates = candidate_dates
            date_range = {
                "min": candidate_dates.min().strftime("%Y-%m-%d %H:%M UTC"),
                "max": candidate_dates.max().strftime("%Y-%m-%d %H:%M UTC")
            }
            break

    # 3. Duplicate Count & Speed Outliers (Shared function with same thresholds as clean.py)
    duplicate_count = int(df.duplicated().sum())

    speed_cfg = (config or {}).get("cleaning_rules", {}).get("speed", {})
    valid_min = float(speed_cfg.get("valid_min_mph", 0.0))
    valid_max = float(speed_cfg.get("valid_max_mph", 250.0))
    outlier_threshold = float(speed_cfg.get("outlier_threshold_mph", 120.0))

    outliers_count = 0
    speed_cols = [c for c in df.columns if "speed" in str(c).lower() or "velocity" in str(c).lower()]
    for sc in speed_cols:
        s_numeric = pd.to_numeric(df[sc], errors="coerce")
        is_impossible = (s_numeric < valid_min) | (s_numeric > valid_max)
        is_outlier = (s_numeric > outlier_threshold) | is_impossible
        outliers_count += int(is_outlier.sum())

    # 4. Single Source of Truth: PII Columns Detection
    pii_columns = detect_pii_columns(df, config=config)
    pii_count = len(pii_columns)

    # 5. Pre-Aggregated Chart Series
    charts: Dict[str, Any] = {}

    # Donut: Dtype Distribution
    charts["dtype_distribution"] = [
        {"name": "Numeric", "value": dtype_counts["numeric"], "color": "#06b6d4"},
        {"name": "Text/String", "value": dtype_counts["string"], "color": "#3b82f6"},
        {"name": "Datetime", "value": dtype_counts["datetime"], "color": "#10b981"},
        {"name": "Boolean", "value": dtype_counts["boolean"], "color": "#f59e0b"}
    ]

    # Bar: Top Null Percentages
    charts["null_percentages"] = [
        {"column": c["name"], "null_pct": c["null_percentage"]}
        for c in sorted(column_profiles, key=lambda x: x["null_percentage"], reverse=True)[:10]
    ]

    # Donut: Sensitive PII vs Standard Columns (Matches len(pii_columns) exactly)
    non_pii_count = max(0, total_cols - pii_count)
    charts["pii_distribution"] = [
        {"name": "Sensitive PII", "value": pii_count, "color": "#f43f5e"},
        {"name": "Standard Attributes", "value": non_pii_count, "color": "#10b981"}
    ]

    # Histogram: Speed Distribution
    if speed_cols:
        speeds = pd.to_numeric(df[speed_cols[0]], errors="coerce").dropna()
        filtered_speeds = speeds[(speeds >= 0) & (speeds <= 160)]
        if len(filtered_speeds) > 0:
            counts, bin_edges = np.histogram(filtered_speeds, bins=10)
            charts["speed_distribution"] = [
                {
                    "range": f"{int(bin_edges[i])}-{int(bin_edges[i+1])} mph",
                    "count": int(counts[i])
                }
                for i in range(len(counts))
            ]

    # Line/Area: Records by Hour of Day
    if parsed_dates is not None and len(parsed_dates) > 0:
        hour_series = parsed_dates.dt.hour.value_counts().sort_index()
        charts["records_by_hour"] = [
            {"hour": f"{h:02d}:00", "count": int(hour_series.get(h, 0))}
            for h in range(24)
        ]

        # Heatmap: 7 Days (Sun=0 to Sat=6) x 24 Hours
        heatmap_matrix = []
        day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        for day_idx in range(7):
            # pandas dayofweek: Mon=0, Sun=6 -> map so Sun=0, Mon=1, ..., Sat=6
            py_dayofweek = 6 if day_idx == 0 else (day_idx - 1)
            day_dates = parsed_dates[parsed_dates.dt.dayofweek == py_dayofweek]
            h_counts = day_dates.dt.hour.value_counts()
            for h in range(24):
                heatmap_matrix.append({
                    "day": day_names[day_idx],
                    "hour": h,
                    "count": int(h_counts.get(h, 0))
                })
        charts["day_hour_heatmap"] = heatmap_matrix

    # Scatter: Generalized Coordinate Points (max 30 points, rounded to 2 decimals)
    lat_cols = [c for c in df.columns if str(c).lower() in ["latitude", "lat"] or str(c).lower().endswith("_lat")]
    lon_cols = [c for c in df.columns if str(c).lower() in ["longitude", "lon", "long"] or str(c).lower().endswith("_lon")]

    if lat_cols and lon_cols:
        coords_df = df[[lat_cols[0], lon_cols[0]]].dropna().head(30)
        charts["coordinate_scatter"] = [
            {
                "lat": round(float(row[lat_cols[0]]), 2),
                "lon": round(float(row[lon_cols[0]]), 2)
            }
            for _, row in coords_df.iterrows()
            if not math.isnan(row[lat_cols[0]]) and not math.isnan(row[lon_cols[0]])
        ]

    # 6. Data Health Score Calculation (0 - 100)
    null_ratio = total_null_cells / (total_rows * total_cols) if (total_rows * total_cols) > 0 else 0
    dupe_ratio = duplicate_count / total_rows if total_rows > 0 else 0
    outlier_ratio = min(1.0, outliers_count / total_rows) if total_rows > 0 else 0

    score = 100.0
    score -= min(30.0, null_ratio * 100.0 * 2.0)
    score -= min(25.0, dupe_ratio * 100.0 * 2.5)
    score -= min(20.0, outlier_ratio * 30.0)

    final_score = max(10, min(100, int(round(score))))

    if final_score >= 85:
        summary_text = "Excellent data health. Minimal missing values and low anomaly density."
    elif final_score >= 70:
        summary_text = "Good data quality with manageable duplicates or outliers ready for anonymization."
    else:
        summary_text = "Moderate data health. Review duplicate records and missing required fields."

    preview_rows = []
    try:
        preview_rows = json.loads(df.head(5).to_json(orient="records", date_format="iso"))
    except Exception:
        preview_rows = []

    return {
        "filename": filename,
        "file_name": filename,
        "file_size": file_size,
        "file_size_bytes": file_size,
        "file_size_formatted": formatted_size,
        "file_type": f_type,
        "sheet_names": sheet_names,
        "selected_sheet": selected_sheet,
        "row_count": total_rows,
        "column_count": total_cols,
        "columns": column_profiles,
        "column_profiles": {c["name"]: c for c in column_profiles},
        "date_range": date_range,
        "duplicate_count": duplicate_count,
        "pii_columns": pii_columns,
        "detected_pii": pii_columns,
        "pii_columns_detected": pii_count,
        "outliers_count": outliers_count,
        "health_score": final_score,
        "health_summary": summary_text,
        "preview_rows": preview_rows,
        "charts": charts
    }
