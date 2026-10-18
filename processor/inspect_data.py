"""
Inspect Data Module
Performs structural, schema, null-value, duplicate, and outlier inspection.
Supports large tabular traffic datasets.
"""

from typing import Any, Dict
import numpy as np
import pandas as pd


def inspect_dataset(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Inspects a DataFrame and returns a comprehensive health report.
    Analyzes schema, null rates, duplicate counts, and statistical IQR outliers.
    """
    total_rows = int(len(df))
    total_cols = int(len(df.columns))

    if total_rows == 0:
        return {
            "total_rows": 0,
            "total_columns": total_cols,
            "columns": list(df.columns),
            "schema": {},
            "null_counts": {},
            "null_percentages": {},
            "duplicate_rows": 0,
            "outliers": {}
        }

    # Schema & Types
    schema = {col: str(df[col].dtype) for col in df.columns}

    # Missing value analysis
    null_counts = {col: int(df[col].isnull().sum()) for col in df.columns}
    null_percentages = {
        col: round((count / total_rows) * 100, 2)
        for col, count in null_counts.items()
    }

    # Duplicate rows count
    duplicate_rows = int(df.duplicated().sum())

    # Outlier detection for numeric fields using Interquartile Range (IQR)
    outliers = {}
    for col in df.select_dtypes(include=[np.number]).columns:
        series = df[col].dropna()
        if len(series) > 0:
            q1 = float(series.quantile(0.25))
            q3 = float(series.quantile(0.75))
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            outlier_count = int(((series < lower_bound) | (series > upper_bound)).sum())
            outliers[col] = {
                "q1": round(q1, 2),
                "q3": round(q3, 2),
                "iqr": round(iqr, 2),
                "lower_bound": round(lower_bound, 2),
                "upper_bound": round(upper_bound, 2),
                "outlier_count": outlier_count
            }

    return {
        "total_rows": total_rows,
        "total_columns": total_cols,
        "columns": list(df.columns),
        "schema": schema,
        "null_counts": null_counts,
        "null_percentages": null_percentages,
        "duplicate_rows": duplicate_rows,
        "outliers": outliers
    }
