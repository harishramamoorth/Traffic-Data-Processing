"""
Main Processing Engine CLI Entry Point
Pipeline:
  Input File -> Inspection -> PII Detection -> Cleaning & Floor Bucketing
  -> Anonymization & Data Minimization -> Quality Audits (QC-01 to QC-08)
  -> JSON Output to stdout
"""

import argparse
from datetime import datetime, timezone
import json
import os
import sys
from typing import Any, Dict, List
import numpy as np
import pandas as pd
import yaml

from profile_data import profile_dataset


def json_default(obj):
    """Serialize numpy and pandas types cleanly to native JSON types."""
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.isoformat()
    return str(obj)


def load_config(config_path: str | None = None, config_json: str | None = None) -> Dict[str, Any]:
    """Loads configuration YAML file, with dynamic JSON override support."""
    default_config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
    target_path = config_path or default_config_path

    base_config = {}
    if os.path.exists(target_path):
        try:
            with open(target_path, "r", encoding="utf-8") as f:
                base_config = yaml.safe_load(f) or {}
        except Exception as e:
            sys.stderr.write(f"[WARN] Failed to read config YAML ({e}). Using default rules.\n")

    if config_json:
        try:
            overrides = json.loads(config_json)
            # Merge top-level overrides
            for k, v in overrides.items():
                if isinstance(v, dict) and isinstance(base_config.get(k), dict):
                    base_config[k].update(v)
                else:
                    base_config[k] = v
        except Exception as e:
            sys.stderr.write(f"[WARN] Failed to parse config JSON ({e}).\n")

    return base_config




def is_excel_encrypted(filepath: str) -> bool:
    """Detects whether an Excel file (.xlsx or .xls) is password-protected/encrypted."""
    try:
        with open(filepath, "rb") as f:
            header = f.read(4096)
        if header.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1") and (
            b"EncryptionInfo" in header or b"EncryptedPackage" in header
        ):
            return True
        return False
    except Exception:
        return False


def detect_delimiter(filepath: str, sample_size: int = 8192) -> str:
    """Auto-detects delimiter for .txt or .csv files using Sniffer and frequency analysis."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            sample = f.read(sample_size)
        if not sample:
            return ","
        import csv
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
            return dialect.delimiter
        except Exception:
            first_line = sample.splitlines()[0] if sample.splitlines() else sample
            counts = {c: first_line.count(c) for c in [",", "\t", ";", "|"]}
            best = max(counts, key=counts.get)
            return best if counts[best] > 0 else ","
    except Exception:
        return ","


def load_dataset(filepath: str, sheet: str | int | None = None) -> pd.DataFrame:
    """
    Loads .csv, .tsv, .txt (delimiter auto-detected), .json, .xlsx, .xls datasets.
    Supports multi-sheet Excel files (defaulting to first sheet if unspecified).
    Enforces 50MB file size limits and validates encryption/corruption status.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Input file not found: {filepath}")

    file_size_bytes = os.path.getsize(filepath)
    file_size_mb = file_size_bytes / (1024 * 1024)
    if file_size_mb > 50.0:
        raise ValueError(f"File size ({file_size_mb:.1f}MB) exceeds the maximum allowed 50MB limit.")

    ext = os.path.splitext(filepath)[1].lower()

    # 1. JSON
    if ext == ".json":
        try:
            return pd.read_json(filepath)
        except Exception as e:
            raise ValueError(f"Failed to read JSON dataset: {e}")

    # 2. Excel (.xlsx, .xls)
    if ext in [".xlsx", ".xls"]:
        if is_excel_encrypted(filepath):
            raise ValueError(
                "The Excel file is password-protected or encrypted. Please remove password protection before uploading."
            )

        try:
            with pd.ExcelFile(filepath) as excel_file:
                sheet_names = excel_file.sheet_names
                if not sheet_names:
                    raise ValueError("The Excel workbook contains no visible sheets.")

                target_sheet = 0
                if sheet is not None:
                    if str(sheet).isdigit() and int(sheet) < len(sheet_names):
                        target_sheet = int(sheet)
                    elif str(sheet) in sheet_names:
                        target_sheet = str(sheet)
                    else:
                        target_sheet = sheet_names[0]
                else:
                    target_sheet = sheet_names[0]

                df = pd.read_excel(excel_file, sheet_name=target_sheet)
                df.attrs["sheet_names"] = sheet_names
                df.attrs["selected_sheet"] = str(target_sheet if isinstance(target_sheet, str) else sheet_names[target_sheet])
                return df
        except Exception as e:
            err_msg = str(e)
            if "encrypted" in err_msg.lower() or "password" in err_msg.lower() or "protected" in err_msg.lower():
                raise ValueError(
                    "The Excel file is password-protected or encrypted. Please remove password protection before uploading."
                )
            raise ValueError(f"Failed to read Excel workbook: {err_msg}")

    # 3. TSV (.tsv)
    if ext == ".tsv":
        try:
            if file_size_mb > 10.0:
                chunks = []
                for chunk in pd.read_csv(filepath, sep="\t", chunksize=10000, low_memory=False):
                    chunks.append(chunk)
                return pd.concat(chunks, ignore_index=True)
            return pd.read_csv(filepath, sep="\t", low_memory=False)
        except Exception as e:
            raise ValueError(f"Failed to read TSV dataset: {e}")

    # 4. Text (.txt) - Auto-detect delimiter
    if ext == ".txt":
        try:
            delimiter = detect_delimiter(filepath)
            if file_size_mb > 10.0:
                chunks = []
                for chunk in pd.read_csv(filepath, sep=delimiter, chunksize=10000, low_memory=False):
                    chunks.append(chunk)
                return pd.concat(chunks, ignore_index=True)
            return pd.read_csv(filepath, sep=delimiter, low_memory=False)
        except Exception as e:
            raise ValueError(f"Failed to read text dataset: {e}")

    # 5. CSV (.csv)
    if ext == ".csv":
        try:
            if file_size_mb > 10.0:
                chunks = []
                for chunk in pd.read_csv(filepath, chunksize=10000, low_memory=False):
                    chunks.append(chunk)
                return pd.concat(chunks, ignore_index=True)
            return pd.read_csv(filepath, low_memory=False)
        except Exception as e:
            raise ValueError(f"Failed to read CSV dataset: {e}")

    # 6. Unsupported format
    raise ValueError(
        f"Unsupported file format '{ext}'. Supported formats are .csv, .tsv, .txt, .json, .xlsx, and .xls."
    )


def generate_sample_data() -> pd.DataFrame:
    """Generates synthetic traffic data for testing edge cases."""
    data = [
        {"record_id": "TRF-9001", "timestamp": "2026-10-17 07:32:10", "vehicle_plate": "NYC-8492", "driver_name": "Alexander Wright", "driver_ssn": "102-45-7890", "vehicle_type": "Sedan", "speed_mph": 34.5, "latitude": 40.712776, "longitude": -74.005974, "road_segment": "FDR Drive South plate NY 8829", "congestion_level": "Moderate"},
        {"record_id": "TRF-9002", "timestamp": "2026-10-17 07:44:45", "vehicle_plate": "CAL-1234", "driver_name": "Sophia Martinez", "driver_ssn": "234-56-8901", "vehicle_type": "SUV", "speed_mph": 135.2, "latitude": 40.758896, "longitude": -73.985130, "road_segment": "Broadway North (call 212-555-0199)", "congestion_level": "High"},
        {"record_id": "TRF-9003", "timestamp": "2026-10-17 07:47:00", "vehicle_plate": "TEX-9988", "driver_name": "Liam Johnson", "driver_ssn": "345-67-9012", "vehicle_type": "Van", "speed_mph": 52.0, "latitude": 40.748817, "longitude": -73.985428, "road_segment": "5th Avenue", "congestion_level": "Low"},
        {"record_id": "TRF-9004", "timestamp": "2026-10-17 07:55:15", "vehicle_plate": "FLA-5544", "driver_name": "Olivia Brown", "driver_ssn": "456-78-0123", "vehicle_type": "Bus", "speed_mph": 18.5, "latitude": 40.782865, "longitude": -73.965355, "road_segment": "Central Park West", "congestion_level": "High"},
        {"record_id": "TRF-9005", "timestamp": "2026-10-17 08:02:20", "vehicle_plate": "ILL-7721", "driver_name": "Noah Davis", "driver_ssn": "567-89-1234", "vehicle_type": "Coupe", "speed_mph": 999.0, "latitude": 40.706086, "longitude": -74.008863, "road_segment": "West Side Hwy", "congestion_level": "Extreme"},
        {"record_id": "TRF-9005", "timestamp": "2026-10-17 08:02:20", "vehicle_plate": "ILL-7721", "driver_name": "Noah Davis", "driver_ssn": "567-89-1234", "vehicle_type": "Coupe", "speed_mph": 999.0, "latitude": 40.706086, "longitude": -74.008863, "road_segment": "West Side Hwy", "congestion_level": "Extreme"}, # Exact duplicate
        {"record_id": "TRF-9006", "timestamp": "invalid_date_format_test", "vehicle_plate": "WA-3319", "driver_name": "Emma Garcia", "driver_ssn": "678-90-2345", "vehicle_type": "Sedan", "speed_mph": -8.0, "latitude": 40.728157, "longitude": -73.994200, "road_segment": "Houston Street", "congestion_level": "Low"}, # Bad date & negative speed
        {"record_id": "TRF-9007", "timestamp": "2026-10-17 08:15:12", "vehicle_plate": "NYC-8492", "driver_name": "Alexander Wright", "driver_ssn": "102-45-7890", "vehicle_type": "Sedan", "speed_mph": 42.1, "latitude": 40.712776, "longitude": -74.005974, "road_segment": "FDR Drive MP 4", "congestion_level": "Moderate"} # Same plate as TRF-9001
    ]
    return pd.DataFrame(data)


def emit_progress(stage: str, percent: int, message: str):
    """Flushes stage milestone to stderr for real-time SSE consumption."""
    sys.stderr.write(f"[STAGE:{stage}:{percent}] {message}\n")
    sys.stderr.flush()


def emit_log(message: str):
    """Flushes individual log line to stderr for real-time SSE streaming."""
    sys.stderr.write(f"[LOG] {message}\n")
    sys.stderr.flush()


def process_pipeline(
    filepath: str | None = None,
    generate_sample: bool = False,
    config_path: str | None = None,
    config_json: str | None = None,
    hash_secret: str | None = None,
    config_override: Dict[str, Any] | None = None,
    sheet: str | int | None = None
) -> Dict[str, Any]:
    """
    Executes the comprehensive traffic data transformation and privacy pipeline.
    """
    from inspect_data import inspect_dataset
    from detect_pii import detect_pii_columns
    from clean import clean_dataset
    from anonymize import anonymize_dataset
    from quality_checks import run_quality_checks

    now_str = lambda: datetime.now(timezone.utc).strftime("%H:%M:%S")
    logs: List[str] = []

    def record_log(msg: str):
        full_msg = f"[{now_str()}] {msg}"
        logs.append(full_msg)
        emit_log(full_msg)

    # 1. Load Configuration
    emit_progress("load", 10, "Loading privacy pipeline configuration...")
    config = load_config(config_path, config_json)
    if config_override:
        for k, v in config_override.items():
            if isinstance(v, dict) and k in config and isinstance(config[k], dict):
                config[k].update(v)
            else:
                config[k] = v
    record_log("Loaded privacy pipeline configuration.")

    # 2. Ingest Data
    emit_progress("load", 20, "Ingesting dataset into memory...")
    sample_file = os.path.join(os.path.dirname(__file__), "sample_traffic_data.csv")
    effective_sheet = sheet or (config or {}).get("sheet")
    if generate_sample or not filepath:
        if os.path.exists(sample_file):
            raw_df = load_dataset(sample_file)
            record_log(f"Ingested sample traffic dataset from '{os.path.basename(sample_file)}' ({len(raw_df)} records).")
        else:
            raw_df = generate_sample_data()
            record_log(f"Ingested synthetic test dataset ({len(raw_df)} records).")
    else:
        raw_df = load_dataset(filepath, sheet=effective_sheet)
        sheet_info = f" [Sheet: '{raw_df.attrs.get('selected_sheet')}']" if raw_df.attrs.get("selected_sheet") else ""
        record_log(f"Successfully loaded {len(raw_df)} records from '{os.path.basename(filepath)}'{sheet_info}.")

    # 3. Stage 1: Data Inspection
    emit_progress("load", 30, "Inspecting data schema and duplicates...")
    inspection_report = inspect_dataset(raw_df)
    record_log(
        f"Inspection complete: {inspection_report['total_rows']} rows, "
        f"{inspection_report['total_columns']} columns, {inspection_report['duplicate_rows']} duplicates."
    )

    # 4. Stage 2: PII Detection
    emit_progress("detect_pii", 45, "Scanning fields for direct and quasi-identifiers...")
    pii_report = detect_pii_columns(raw_df, config=config)
    record_log(f"PII detection complete: {len(pii_report)} sensitive column(s) identified.")

    # 5. Stage 3: Cleaning & Rejection Tracking
    emit_progress("clean", 60, "Standardizing schemas and enforcing zero-loss cleaning...")
    cleaned_df, rejected_rows, clean_logs = clean_dataset(raw_df, config=config)
    for cl in clean_logs:
        record_log(cl)

    # 6. Stage 4: Anonymization & Data Minimization
    emit_progress("anonymize", 75, "Applying HMAC-SHA256, spatial & temporal generalization...")
    anonymized_df, anon_logs = anonymize_dataset(
        cleaned_df, pii_fields=pii_report, config=config, hash_secret=hash_secret
    )
    for al in anon_logs:
        record_log(al)

    # 7. Stage 5: Quality Assurance Audits (QC-01 to QC-09 + QC-coordinates-valid)
    emit_progress("validate", 90, "Running QC-01 through QC-09 reconciliation checks...")
    duplicates_removed_count = cleaned_df.attrs.get("duplicates_removed_count", 0)
    duplicates_removed_rows = cleaned_df.attrs.get("duplicates_removed_rows", [])
    categorical_normalized_count = cleaned_df.attrs.get("categorical_normalized_count", 0)
    suppressed_rows = getattr(anonymized_df, "attrs", {}).get("suppressed_rows", [])
    aggregated_records = getattr(anonymized_df, "attrs", {}).get("aggregated_records", [])
    suppressed_count = getattr(anonymized_df, "attrs", {}).get("suppressed_count", len(suppressed_rows))
    k_anonymity_data = getattr(anonymized_df, "attrs", {}).get("k_anonymity", {})

    quality_checks, overall_status = run_quality_checks(
        original_df=raw_df,
        processed_df=anonymized_df,
        rejected_rows=rejected_rows,
        pii_fields=pii_report,
        config=config,
        duplicates_removed=duplicates_removed_count,
        duplicates_removed_rows=duplicates_removed_rows,
        suppressed_rows=suppressed_rows,
        suppressed_count=suppressed_count,
        k_anonymity=k_anonymity_data
    )
    passed_count = sum(1 for q in quality_checks if q["status"] == "PASS")
    record_log(f"Quality checks complete: {passed_count}/{len(quality_checks)} passed (Status: {overall_status}).")

    emit_progress("save", 98, "Preparing sanitized outputs...")

    # 8. Per-Column Null Report (count and %)
    null_report: Dict[str, Dict[str, Any]] = {}
    total_output_rows = len(anonymized_df)
    for col in anonymized_df.columns:
        null_cnt = int(anonymized_df[col].isnull().sum())
        null_pct = round((null_cnt / total_output_rows) * 100, 2) if total_output_rows > 0 else 0.0
        null_report[col] = {
            "null_count": null_cnt,
            "null_pct": null_pct,
            "total_rows": total_output_rows
        }

    # 9. In-Memory Before vs After Comparison (max 20 rows, sanitized with PII masked, NOT to be persisted in DB)
    sample_limit = min(20, (config or {}).get("quality_checks", {}).get("max_before_after_sample_rows", 20))
    raw_preview_df = raw_df.head(sample_limit).copy()
    pii_col_set = {str(p.get("name") or p.get("column", "")).strip().lower() for p in pii_report}
    for col in raw_preview_df.columns:
        if str(col).strip().lower() in pii_col_set:
            raw_preview_df[col] = "[CONFIDENTIAL_PII_PROTECTED]"
    sample_before = json.loads(raw_preview_df.to_json(orient="records", date_format="iso"))
    sample_after = json.loads(anonymized_df.head(sample_limit).to_json(orient="records", date_format="iso"))

    # 10. Cleaned Records (Anonymized rows ready for DB persistence)
    # Using to_json ensures NaN/Inf are converted to JSON-compliant null without failing JSON.parse
    cleaned_records = json.loads(anonymized_df.to_json(orient="records", date_format="iso"))
    risk_lvl = k_anonymity_data.get("risk_level", "LOW")
    honest_privacy_claim = f"No direct identifiers detected; re-identification risk: {risk_lvl}"

    risk_mode = str(k_anonymity_data.get("risk_reduction_mode", "none")).lower()
    k_target = int(k_anonymity_data.get("k_threshold", 3))
    k_achieved = int(k_anonymity_data.get("k_min", 0))

    if risk_mode in ["suppress", "aggregate"] and k_achieved >= k_target:
        if overall_status != "FAILED":
            overall_status = "PASSED"
            compliance_status = "COMPLIANCE_VERIFIED"
            compliance_explanation = (
                f"PASSED: Risk reduction ({risk_mode.title()} mode, K={k_target}) successfully enforced "
                f"k_min={k_achieved} >= {k_target}. Cohort privacy verified."
            )
    elif risk_lvl == "HIGH":
        compliance_status = "PASSED_WITH_WARNINGS"
        compliance_explanation = (
            f"PASSED_WITH_WARNINGS: Re-identification risk is High ({k_anonymity_data.get('percent_low_k', 0.0)}% rows with k<3). "
            f"The dataset cannot be certified as compliance verified while risk is High. Consider enabling Suppress or Aggregate mode."
        )
    elif overall_status == "PASSED_WITH_WARNINGS":
        compliance_status = "PASSED_WITH_WARNINGS"
        compliance_explanation = "Pipeline finished with warnings. Review audit checks for detailed warnings."
    elif overall_status == "FAILED":
        compliance_status = "FAILED"
        compliance_explanation = "One or more critical quality/compliance checks failed."
    else:
        compliance_status = "COMPLIANCE_VERIFIED"
        compliance_explanation = "All quality checks passed and re-identification risk is within safe parameters (<5%)."

    output_payload = {
        "status": "SUCCESS",
        "summary": {
            "original_rows": len(raw_df),
            "processed_rows": len(anonymized_df),
            "rejected_rows_count": len(rejected_rows),
            "duplicates_removed": duplicates_removed_count,
            "categorical_normalized": categorical_normalized_count,
            "suppressed_count": suppressed_count,
            "suppressed_rows_count": suppressed_count,
            "aggregated_cells_count": len(aggregated_records),
            "pii_columns_detected": len(pii_report),
            "quality_checks_passed": f"{passed_count}/{len(quality_checks)}",
            "overall_status": overall_status,
            "overall_health": "AUDIT_REQUIRED" if overall_status == "FAILED" else ("WARNINGS_PRESENT" if overall_status == "PASSED_WITH_WARNINGS" else "OPTIMAL"),
            "compliance_status": compliance_status,
            "compliance_explanation": compliance_explanation,
            "re_identification_risk": risk_lvl,
            "re_identification_risk_before": k_anonymity_data.get("before_risk", k_anonymity_data.get("before_metrics", {}).get("risk_level", "LOW")),
            "re_identification_risk_after": k_anonymity_data.get("after_risk", risk_lvl),
            "privacy_claim": honest_privacy_claim,
            "smallest_group_size_k": k_anonymity_data.get("smallest_group_size_k", 1),
            "percent_low_k": k_anonymity_data.get("percent_low_k", 0.0)
        },
        "k_anonymity": k_anonymity_data,
        "suppressed_rows": suppressed_rows,
        "suppressed_count": suppressed_count,
        "aggregated_records": aggregated_records,
        "compliance_status": compliance_status,
        "compliance_explanation": compliance_explanation,
        "privacy_claim": honest_privacy_claim,
        "null_report": null_report,
        "inspection": inspection_report,
        "pii_columns": pii_report,
        "pii_report": pii_report,
        "quality_checks": quality_checks,
        "rejected_rows": rejected_rows,
        "duplicates_removed": duplicates_removed_count,
        "duplicates_removed_rows": duplicates_removed_rows,
        "processing_logs": logs,
        "cleaned_records": cleaned_records,
        "before_after_sample": {
            "before": sample_before,
            "after": sample_after
        }
    }

    if getattr(raw_df, "attrs", {}).get("sheet_names"):
        output_payload["sheet_names"] = raw_df.attrs["sheet_names"]
        output_payload["selected_sheet"] = raw_df.attrs.get("selected_sheet", "")
        output_payload["summary"]["sheet_names"] = raw_df.attrs["sheet_names"]
        output_payload["summary"]["selected_sheet"] = raw_df.attrs.get("selected_sheet", "")

    return output_payload


def main():
    parser = argparse.ArgumentParser(description="Privacy-Preserving Traffic Data Processing Engine")
    parser.add_argument("--input", "-i", type=str, help="Path to input CSV or JSON traffic dataset")
    parser.add_argument("--output", "-o", type=str, help="Optional path to output processed JSON payload")
    parser.add_argument("--config", "-c", type=str, help="Path to config.yaml file")
    parser.add_argument("--config-json", type=str, help="Dynamic JSON string overriding config rules")
    parser.add_argument("--hash-secret", "-s", type=str, help="Secret key for HMAC-SHA256 pseudonymization")
    parser.add_argument("--sheet", type=str, help="Excel sheet name or index to process (defaults to first sheet)")
    parser.add_argument("--sample", action="store_true", help="Execute pipeline using built-in synthetic test data")
    parser.add_argument("--profile", action="store_true", help="Generate rapid pre-processing dataset profile only")

    args = parser.parse_args()

    try:
        if args.profile:
            sample_file = os.path.join(os.path.dirname(__file__), "sample_traffic_data.csv")
            config = load_config(args.config, args.config_json)
            effective_sheet = args.sheet or (config or {}).get("sheet")

            if args.sample or not args.input:
                if os.path.exists(sample_file):
                    raw_df = load_dataset(sample_file, sheet=effective_sheet)
                    filename = "sample_traffic_data.csv"
                    file_size = os.path.getsize(sample_file)
                else:
                    raw_df = generate_sample_data()
                    filename = "sample_traffic_data.csv"
                    file_size = 1200
            else:
                raw_df = load_dataset(args.input, sheet=effective_sheet)
                filename = os.path.basename(args.input)
                file_size = os.path.getsize(args.input)

            profile_results = profile_dataset(raw_df, filename=filename, file_size=file_size, config=config)
            print(json.dumps(profile_results, indent=2, default=json_default))
            sys.exit(0)

        results = process_pipeline(
            filepath=args.input,
            generate_sample=args.sample,
            config_path=args.config,
            config_json=args.config_json,
            hash_secret=args.hash_secret,
            sheet=args.sheet
        )

        if args.output:
            out_dir = os.path.dirname(os.path.abspath(args.output))
            os.makedirs(out_dir, exist_ok=True)
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(results, f, indent=2, default=json_default)
            if results.get("aggregated_records"):
                agg_df = pd.DataFrame(results["aggregated_records"])
                cols_to_keep = [c for c in ["road_segment", "hour", "record_count", "avg_speed", "max_speed", "outlier_count"] if c in agg_df.columns]
                if cols_to_keep:
                    agg_df[cols_to_keep].to_csv(os.path.join(out_dir, "aggregated.csv"), index=False)

        print(json.dumps(results, indent=2, default=json_default))
        sys.exit(0)

    except Exception as e:
        error_payload = {
            "status": "ERROR",
            "error": str(e)
        }
        print(json.dumps(error_payload, indent=2, default=json_default), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
