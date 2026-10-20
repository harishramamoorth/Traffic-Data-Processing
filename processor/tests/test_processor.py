"""
Pytest Suite for Traffic Data Processor
Tests bugs, fixes, and edge cases:
1. PII in free text: phone formats (555-0101, +971 58 217 7359, (212) 555-0198, 10+ digits) replaced with [REDACTED_PHONE]
2. Timestamps: parse MM/DD/YYYY HH:MM:SS, YYYY-MM-DD HH:MM, DD-Mon-YYYY HH:MM:SS, ISO-8601 with 15-min bucketing; truly invalid to rejected_rows
3. Row accounting: input_rows = output_rows + rejected_rows + duplicates_removed; list every rejected or removed row
4. Coordinates: latitude -90..90 and longitude -180..180; invalid values become null with coordinate_invalid_flag and QC-coordinates-valid check
5. Categorical text normalization: trim, collapse spaces, consistent casing (Title Case; alias map e.g. "suv" -> "SUV", "HIGH" -> "High"); report normalized count
6. Duplicate record_id with different values: keep first row, move others to rejected_rows with reason "conflicting_duplicate_id", and show WARN in QC
7. Per-column null report (count and %) in results; blank values stay null, never silently filled
8. Comprehensive tests against sample_traffic_data.csv (527 input rows, 0 phone numbers left, 0 out-of-range coordinates, 0 case-variant labels, 2 timestamp rejections)
"""

import os
import re
import sys
import pandas as pd
import pytest

# Add processor root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from inspect_data import inspect_dataset
from detect_pii import detect_pii_columns
from clean import clean_dataset
from anonymize import anonymize_dataset, redact_freetext, redact_freetext_batch
from quality_checks import run_quality_checks
from main import process_pipeline, load_config, load_dataset


SAMPLE_CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sample_traffic_data.csv"))
SAMPLE_TSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sample_traffic_data.tsv"))
SAMPLE_XLSX_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sample_traffic_data.xlsx"))


@pytest.fixture(autouse=True)
def default_test_hash_secret(monkeypatch):
    """Sets a valid >=32-char test secret for tests that do not test missing secret behavior."""
    monkeypatch.setenv("HASH_SECRET", "test_mandatory_hmac_secret_32_characters_key_2026")


@pytest.fixture
def test_config():
    return load_config()


@pytest.fixture
def synthetic_edge_case_data():
    return pd.DataFrame([
        {
            "record_id": "REC-01",
            "timestamp": "2026-10-17 10:05:30",
            "vehicle_plate": "ABC-1234",
            "driver_name": "John Doe",
            "driver_ssn": "000-11-2222",
            "vehicle_type": "Sedan",
            "speed_mph": 45.0,
            "latitude": 40.71289,
            "longitude": -74.00602,
            "road_segment": "Route 1 call 555-123-4567",
            "congestion_level": "Moderate",
            "notes": "Normal flow"
        },
        {
            "record_id": "REC-01",
            "timestamp": "2026-10-17 10:05:30",
            "vehicle_plate": "ABC-1234",
            "driver_name": "John Doe",
            "driver_ssn": "000-11-2222",
            "vehicle_type": "Sedan",
            "speed_mph": 45.0,
            "latitude": 40.71289,
            "longitude": -74.00602,
            "road_segment": "Route 1 call 555-123-4567",
            "congestion_level": "Moderate",
            "notes": "Normal flow"
        },  # Exact duplicate
        {
            "record_id": "REC-02",
            "timestamp": "bad_corrupted_date_2026",
            "vehicle_plate": "XYZ-9999",
            "driver_name": "Jane Smith",
            "driver_ssn": "999-88-7777",
            "vehicle_type": " suv ",
            "speed_mph": -15.0,  # Negative speed
            "latitude": 40.75889,
            "longitude": -73.98513,
            "road_segment": "Broadway",
            "congestion_level": "HIGH",
            "notes": "Call +971 58 217 7359 urgently"
        },
        {
            "record_id": "REC-03",
            "timestamp": "2026-10-17 10:14:00",
            "vehicle_plate": "ABC-1234",  # Same plate as REC-01
            "driver_name": "John Doe",
            "driver_ssn": "000-11-2222",
            "vehicle_type": "Sedan",
            "speed_mph": 999.0,  # Impossible high speed
            "latitude": 40.74881,
            "longitude": -73.98542,
            "road_segment": "Park Ave with plate NY 9821",
            "congestion_level": "Low",
            "notes": None
        },
        {
            "record_id": None,  # Missing required ID
            "timestamp": "2026-10-17 10:20:00",
            "vehicle_plate": "TEX-5555",
            "driver_name": "Bob Taylor",
            "driver_ssn": "111-22-3333",
            "vehicle_type": "Bus",
            "speed_mph": 55.0,
            "latitude": 40.78286,
            "longitude": -73.96535,
            "road_segment": "Highway 10",
            "congestion_level": "Moderate",
            "notes": None
        }
    ])


# ==============================================================================
# Requirement 1: PII in free text - Phone Number Regexes
# ==============================================================================
def test_phone_number_redaction_formats():
    """Verifies that all specified phone formats are correctly redacted to [REDACTED_PHONE]."""
    test_cases = [
        ("Driver called 555-0101 about plate", "Driver called [REDACTED_PHONE] about plate"),
        ("Call +971 58 217 7359 urgently", "Call [REDACTED_PHONE] urgently"),
        ("Dispatch at (212) 555-0198 confirmed", "Dispatch at [REDACTED_PHONE] confirmed"),
        ("Contact 12345678901 for details", "Contact [REDACTED_PHONE] for details"),
        ("Direct phone 971582177359", "Direct phone [REDACTED_PHONE]"),
        ("Local 555-0198 reported incident", "Local [REDACTED_PHONE] reported incident")
    ]
    for raw_text, expected in test_cases:
        redacted = redact_freetext(raw_text)
        assert "[REDACTED_PHONE]" in redacted
        assert "555-0101" not in redacted
        assert "+971 58 217 7359" not in redacted
        assert "(212) 555-0198" not in redacted
        assert "12345678901" not in redacted
        assert "971582177359" not in redacted
        assert "555-0198" not in redacted


def test_batch_freetext_redaction_preserves_nulls_and_masks_pii():
    values = pd.Series([
        "Driver Alexander Wright called 555-0101",
        None,
        "FDR Drive South",
    ])

    redacted = redact_freetext_batch(values)

    assert redacted.iloc[0] == "Driver [REDACTED_NAME] called [REDACTED_PHONE]"
    assert pd.isna(redacted.iloc[1])
    assert redacted.iloc[2] == "FDR Drive South"


# ==============================================================================
# Requirement 2: Timestamp Parsing & 15-Minute Bucketing
# ==============================================================================
def test_timestamp_formats_parsing(test_config):
    """
    Parses MM/DD/YYYY HH:MM:SS, YYYY-MM-DD HH:MM, DD-Mon-YYYY HH:MM:SS, ISO-8601
    into 15-minute UTC buckets, while truly invalid values go to rejected_rows with 'invalid_timestamp'.
    """
    df = pd.DataFrame([
        {"record_id": "T1", "timestamp": "10/17/2026 08:15:00"},
        {"record_id": "T2", "timestamp": "2026-10-17 09:37"},
        {"record_id": "T3", "timestamp": "17-Oct-2026 10:05:11"},
        {"record_id": "T4", "timestamp": "2026-10-17T14:44:59Z"},
        {"record_id": "T5", "timestamp": "not_a_date"},
        {"record_id": "T6", "timestamp": "2026-13-45T99:00:00Z"}
    ])

    clean_df, rejected_rows, _ = clean_dataset(df, config=test_config)

    # T1, T2, T3, T4 parsed; T5 and T6 rejected
    assert len(clean_df) == 4
    assert len(rejected_rows) == 2

    for r in rejected_rows:
        assert r["reason"] == "invalid_timestamp"
        assert r["record_id"] in ["T5", "T6"]

    # Verify 15-minute floor bucketing format (%Y-%m-%dT%H:%M:%SZ)
    t1_val = clean_df.loc[clean_df["record_id"] == "T1", "timestamp"].iloc[0]
    t2_val = clean_df.loc[clean_df["record_id"] == "T2", "timestamp"].iloc[0]
    t3_val = clean_df.loc[clean_df["record_id"] == "T3", "timestamp"].iloc[0]
    t4_val = clean_df.loc[clean_df["record_id"] == "T4", "timestamp"].iloc[0]

    assert t1_val == "2026-10-17T08:15:00Z"
    assert t2_val == "2026-10-17T09:30:00Z"  # 09:37 floored to 09:30
    assert t3_val == "2026-10-17T10:00:00Z"  # 10:05 floored to 10:00
    assert t4_val == "2026-10-17T14:30:00Z"  # 14:44 floored to 14:30


# ==============================================================================
# Requirement 3: Row Accounting
# ==============================================================================
def test_row_accounting_reconciliation(test_config):
    """
    Verifies input_rows = output_rows + rejected_rows + duplicates_removed.
    Shows all three numbers and lists every rejected or removed row with record_id + reason.
    """
    df = pd.DataFrame([
        {"record_id": "R1", "timestamp": "2026-10-17 10:00:00", "speed_mph": 30.0},
        {"record_id": "R1", "timestamp": "2026-10-17 10:00:00", "speed_mph": 30.0},  # Exact duplicate
        {"record_id": "R2", "timestamp": "2026-10-17 10:00:00", "speed_mph": 40.0},
        {"record_id": "R2", "timestamp": "2026-10-17 10:00:00", "speed_mph": 20.0},  # Conflicting duplicate ID
        {"record_id": "R3", "timestamp": "invalid_date_xyz", "speed_mph": 50.0}       # Bad timestamp
    ])

    clean_df, rejected_rows, _ = clean_dataset(df, config=test_config)
    checks, status = run_quality_checks(
        original_df=df,
        processed_df=clean_df,
        rejected_rows=rejected_rows,
        pii_fields=[],
        config=test_config
    )

    qc01 = next(c for c in checks if c["id"] == "QC-01")
    assert qc01["status"] == "PASS"

    input_rows = qc01["input_rows"]
    output_rows = qc01["output_rows"]
    rejected_rows_cnt = qc01["rejected_rows"]
    duplicates_removed_cnt = qc01["duplicates_removed"]

    # Equation: input_rows = output_rows + rejected_rows + duplicates_removed
    assert input_rows == 5
    assert output_rows == 2  # R1 and first R2
    assert rejected_rows_cnt == 2  # second R2 (conflicting_id) and R3 (bad timestamp)
    assert duplicates_removed_cnt == 1  # exact duplicate R1
    assert input_rows == output_rows + rejected_rows_cnt + duplicates_removed_cnt

    # Details must show all three numbers and list every rejected or removed row with record_id + reason
    assert "Input (5) = Output (2) + Rejected (2) + Duplicates Removed (1)" in qc01["details"]
    assert "R2 (conflicting_duplicate_id)" in qc01["details"]
    assert "R3 (invalid_timestamp)" in qc01["details"]
    assert "R1 (exact_duplicate)" in qc01["details"]


# ==============================================================================
# Requirement 4: Coordinates -90..90 and -180..180
# ==============================================================================
def test_coordinates_validation_and_flag(test_config):
    """
    Latitude must be -90..90 and longitude -180..180.
    Invalid values become null with flag coordinate_invalid_flag, and QC-coordinates-valid check passes.
    """
    df = pd.DataFrame([
        {"record_id": "C1", "timestamp": "2026-10-17 10:00:00", "latitude": 40.71, "longitude": -74.00},
        {"record_id": "C2", "timestamp": "2026-10-17 10:00:00", "latitude": 95.2, "longitude": -73.98},   # Invalid lat > 90
        {"record_id": "C3", "timestamp": "2026-10-17 10:00:00", "latitude": 40.75, "longitude": -200.4},  # Invalid lon < -180
        {"record_id": "C4", "timestamp": "2026-10-17 10:00:00", "latitude": None, "longitude": -73.99}    # Blank stays null
    ])

    clean_df, rejected_rows, _ = clean_dataset(df, config=test_config)

    # Flag column exists
    assert "coordinate_invalid_flag" in clean_df.columns

    # Valid row
    c1 = clean_df[clean_df["record_id"] == "C1"].iloc[0]
    assert c1["coordinate_invalid_flag"] is False or c1["coordinate_invalid_flag"] == 0
    assert c1["latitude"] == 40.71

    # C2 invalid lat became null with flag True
    c2 = clean_df[clean_df["record_id"] == "C2"].iloc[0]
    assert pd.isna(c2["latitude"])
    assert c2["coordinate_invalid_flag"] is True or c2["coordinate_invalid_flag"] == 1

    # C3 invalid lon became null with flag True
    c3 = clean_df[clean_df["record_id"] == "C3"].iloc[0]
    assert pd.isna(c3["longitude"])
    assert c3["coordinate_invalid_flag"] is True or c3["coordinate_invalid_flag"] == 1

    # C4 blank latitude stays null
    c4 = clean_df[clean_df["record_id"] == "C4"].iloc[0]
    assert pd.isna(c4["latitude"])

    # Quality check QC-coordinates-valid
    checks, _ = run_quality_checks(original_df=df, processed_df=clean_df, rejected_rows=rejected_rows, pii_fields=[], config=test_config)
    qc_coords = next(c for c in checks if c["id"] == "QC-coordinates-valid")
    assert qc_coords["status"] == "PASS"


# ==============================================================================
# Requirement 5: Categorical Normalization
# ==============================================================================
def test_categorical_normalization(test_config):
    """
    Trim, collapse spaces, consistent casing (Title Case; alias map e.g. 'suv' -> 'SUV', 'HIGH' -> 'High').
    Reports count of normalized values. Blank values stay null.
    """
    df = pd.DataFrame([
        {"record_id": "N1", "timestamp": "2026-10-17 10:00:00", "vehicle_type": " suv ", "road_segment": "  CENTRAL PARK WEST  ", "congestion_level": "HIGH"},
        {"record_id": "N2", "timestamp": "2026-10-17 10:00:00", "vehicle_type": "Commercial Van", "road_segment": "5th Avenue", "congestion_level": "Moderate"},
        {"record_id": "N3", "timestamp": "2026-10-17 10:00:00", "vehicle_type": "Sedan", "road_segment": None, "congestion_level": None}
    ])

    clean_df, _, logs = clean_dataset(df, config=test_config)

    # N1 normalized
    n1 = clean_df[clean_df["record_id"] == "N1"].iloc[0]
    assert n1["vehicle_type"] == "SUV"
    assert n1["road_segment"] == "Central Park West"
    assert n1["congestion_level"] == "High"

    # N3 blank values stay null, never silently filled
    n3 = clean_df[clean_df["record_id"] == "N3"].iloc[0]
    assert pd.isna(n3["road_segment"])
    assert pd.isna(n3["congestion_level"])

    # Normalized count reported in attrs
    assert clean_df.attrs.get("categorical_normalized_count") == 3


# ==============================================================================
# Requirement 6: Duplicate record_id with Different Values
# ==============================================================================
def test_conflicting_duplicate_record_id(test_config):
    """
    Keep first row, move others to rejected_rows with reason 'conflicting_duplicate_id', and show WARN in QC.
    """
    df = pd.DataFrame([
        {"record_id": "DUP-1", "timestamp": "2026-10-17 10:00:00", "speed_mph": 40.0, "road_segment": "FDR Drive"},
        {"record_id": "DUP-1", "timestamp": "2026-10-17 10:00:00", "speed_mph": 12.0, "road_segment": "FDR Drive"}  # Same ID, different speed
    ])

    clean_df, rejected_rows, _ = clean_dataset(df, config=test_config)

    # Only first row kept
    assert len(clean_df) == 1
    assert clean_df.iloc[0]["speed_mph"] == 40.0

    # Second row moved to rejected_rows with reason 'conflicting_duplicate_id'
    assert len(rejected_rows) == 1
    assert rejected_rows[0]["record_id"] == "DUP-1"
    assert rejected_rows[0]["reason"] == "conflicting_duplicate_id"

    # Quality check QC-07 shows a WARN
    checks, overall_status = run_quality_checks(original_df=df, processed_df=clean_df, rejected_rows=rejected_rows, pii_fields=[], config=test_config)
    qc07 = next(c for c in checks if c["id"] == "QC-07")
    assert qc07["status"] == "WARN"
    assert overall_status == "PASSED_WITH_WARNINGS"


# ==============================================================================
# Requirement 7: Per-Column Null Report
# ==============================================================================
def test_per_column_null_report(test_config):
    """
    Verifies that the per-column null report contains count and percentage for every column.
    Blank values stay null, never silently filled.
    """
    res = process_pipeline(filepath=SAMPLE_CSV_PATH)
    null_report = res.get("null_report", {})
    assert len(null_report) > 0

    for col, data in null_report.items():
        assert "null_count" in data
        assert "null_pct" in data
        assert "total_rows" in data
        assert data["null_count"] >= 0
        assert 0.0 <= data["null_pct"] <= 100.0

    # In sample_traffic_data.csv, notes, speed_mph, latitude have nulls and stay null
    assert null_report["notes"]["null_count"] > 0
    assert null_report["latitude"]["null_count"] > 0


# ==============================================================================
# Requirement 8: Comprehensive Pipeline Audit on sample_traffic_data.csv
# ==============================================================================
def test_sample_traffic_data_all_eight_requirements():
    """
    Pytest suite covering all 8 requirements against sample_traffic_data.csv.
    Expected:
      - 527 input rows
      - 518 output rows, 3 rejected rows, 6 duplicates removed (527 = 518 + 3 + 6)
      - 0 phone numbers left in output
      - 0 out-of-range coordinates
      - 0 case-variant labels
      - All valid timestamp formats parsed
      - Exactly 2 timestamp rejections
    """
    assert os.path.exists(SAMPLE_CSV_PATH), f"sample_traffic_data.csv not found at {SAMPLE_CSV_PATH}"

    res = process_pipeline(filepath=SAMPLE_CSV_PATH)
    summary = res["summary"]
    cleaned_records = res["cleaned_records"]
    rejected_rows = res["rejected_rows"]
    quality_checks = res["quality_checks"]

    # 1. 527 input rows
    assert summary["original_rows"] == 527

    # 2. Row accounting equation: 527 = 518 output + 3 rejected + 6 duplicates removed
    assert summary["processed_rows"] == 518
    assert summary["rejected_rows_count"] == 3
    assert summary["duplicates_removed"] == 6
    assert summary["original_rows"] == summary["processed_rows"] + summary["rejected_rows_count"] + summary["duplicates_removed"]

    # QC-01 is PASS
    qc01 = next(q for q in quality_checks if q["id"] == "QC-01")
    assert qc01["status"] == "PASS"
    assert "Input (527) = Output (518) + Rejected (3) + Duplicates Removed (6)" in qc01["details"]

    # 3. Exactly 2 timestamp rejections
    timestamp_rejections = [r for r in rejected_rows if r["reason"] == "invalid_timestamp"]
    assert len(timestamp_rejections) == 2
    ts_rejected_ids = {r["record_id"] for r in timestamp_rejections}
    assert ts_rejected_ids == {"TRF-9372", "TRF-9037"}

    # 4. Conflicting duplicate record_id rejection (TRF-9051) and WARN in QC
    conflicting_rejections = [r for r in rejected_rows if r["reason"] == "conflicting_duplicate_id"]
    assert len(conflicting_rejections) == 1
    assert conflicting_rejections[0]["record_id"] == "TRF-9051"
    qc07 = next(q for q in quality_checks if q["id"] == "QC-07")
    assert qc07["status"] == "WARN"

    # 5. 0 phone numbers left in output
    phone_pattern = re.compile(r"\+\d{1,4}(?:[\s.-]*\d{1,4}){2,6}\b|\(?\b\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\b|\b\d{3}[-.\s]\d{4}\b|\b\d{10,}\b")
    for r in cleaned_records:
        for field in ["notes", "road_segment"]:
            val = r.get(field)
            if val and isinstance(val, str):
                # Ensure no raw phones remaining; [REDACTED_PHONE] is allowed
                cleaned_val = val.replace("[REDACTED_PHONE]", "")
                assert not phone_pattern.search(cleaned_val), f"Unredacted phone in {field}: '{val}'"

    # 6. 0 out-of-range coordinates left
    for r in cleaned_records:
        lat = r.get("latitude")
        lon = r.get("longitude")
        if lat is not None and not pd.isna(lat):
            assert -90.0 <= float(lat) <= 90.0, f"Out of range latitude: {lat}"
        if lon is not None and not pd.isna(lon):
            assert -180.0 <= float(lon) <= 180.0, f"Out of range longitude: {lon}"

    # Flag column coordinate_invalid_flag is True on exactly 2 rows (lat 95.2 and lon -200.4)
    invalid_coord_rows = [r for r in cleaned_records if r.get("coordinate_invalid_flag") is True]
    assert len(invalid_coord_rows) == 2
    for r in invalid_coord_rows:
        assert r["latitude"] is None or r["longitude"] is None

    # QC-coordinates-valid is PASS
    qc_coords = next(q for q in quality_checks if q["id"] == "QC-coordinates-valid")
    assert qc_coords["status"] == "PASS"

    # 7. 0 case-variant labels (e.g. no ' suv ', no 'HIGH', no '  CENTRAL PARK WEST  ')
    vehicle_types = {r.get("vehicle_type") for r in cleaned_records}
    assert " suv " not in vehicle_types
    assert "suv" not in vehicle_types
    assert "SUV" in vehicle_types

    congestion_levels = {r.get("congestion_level") for r in cleaned_records}
    assert "HIGH" not in congestion_levels
    assert "High" in congestion_levels

    road_segments = {r.get("road_segment") for r in cleaned_records}
    assert "  CENTRAL PARK WEST  " not in road_segments
    assert "CENTRAL PARK WEST" not in road_segments
    assert "Central Park West" in road_segments

    # 8. All valid timestamp formats parsed to 15-minute UTC intervals
    for r in cleaned_records:
        ts = r.get("timestamp")
        assert ts is not None
        assert ts.endswith("Z")
        # Minute is multiple of 15 and seconds are 00
        time_part = ts.split("T")[-1].replace("Z", "")
        minute = int(time_part.split(":")[1])
        second = int(time_part.split(":")[2])
        assert minute in [0, 15, 30, 45], f"Timestamp not floored to 15-min bucket: {ts}"
        assert second == 0, f"Seconds not 00: {ts}"

    # 9. Verify 0 raw direct identifiers across all output records (Requirement 22)
    ssn_regex = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
    email_regex = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
    for r in cleaned_records:
        # Check plates and record_ids are pseudonymized
        assert str(r.get("vehicle_plate", "")).startswith("ANON_")
        assert str(r.get("record_id", "")).startswith("ANON_")
        # Direct PII columns dropped
        assert "driver_name" not in r
        assert "driver_ssn" not in r
        # Free text has zero SSN or email
        for field in ["notes", "road_segment"]:
            val = str(r.get(field, "") or "")
            assert not ssn_regex.search(val)
            assert not email_regex.search(val)


# ==============================================================================
# Existing Edge Case Tests (Updated for Row Accounting & ID Pseudonymization)
# ==============================================================================
def test_pii_detection(synthetic_edge_case_data, test_config):
    pii = detect_pii_columns(synthetic_edge_case_data, config=test_config)
    detected_cols = [p["column"] for p in pii]
    assert "vehicle_plate" in detected_cols
    assert "driver_name" in detected_cols
    assert "driver_ssn" in detected_cols
    assert "latitude" in detected_cols
    assert "longitude" in detected_cols


def test_rejection_tracking_and_no_silent_drop(synthetic_edge_case_data, test_config):
    cleaned_df, rejected_rows, _ = clean_dataset(synthetic_edge_case_data, config=test_config)
    # Expected rejections: 1 bad date, 1 missing record_id = 2. Duplicates removed = 1.
    assert len(rejected_rows) == 2
    assert cleaned_df.attrs["duplicates_removed_count"] == 1
    reasons = [r["reason"] for r in rejected_rows]
    assert "invalid_timestamp" in reasons
    assert "missing_required_field_record_id" in reasons
    # Ensure no PII in rejection reasons
    for r in rejected_rows:
        assert "000-11-2222" not in r["details"]
        assert "John Doe" not in r["details"]


def test_speed_outlier_flagging_without_silent_clamping(synthetic_edge_case_data, test_config):
    cleaned_df, _, _ = clean_dataset(synthetic_edge_case_data, config=test_config)
    rec03 = cleaned_df[cleaned_df["record_id"] == "REC-03"].iloc[0]
    assert pd.isna(rec03["speed_mph"])
    assert rec03["speed_outlier_flag"] is True or rec03["speed_outlier_flag"] == 1


def test_anonymization_and_data_minimization(synthetic_edge_case_data, test_config):
    cleaned_df, _, _ = clean_dataset(synthetic_edge_case_data, config=test_config)
    pii = detect_pii_columns(cleaned_df, config=test_config)
    anon_df, _ = anonymize_dataset(cleaned_df, pii_fields=pii, config=test_config, hash_secret="test_secret_32_characters_mandatory_key")

    assert "driver_name" not in anon_df.columns
    assert "driver_ssn" not in anon_df.columns

    for plate in anon_df["vehicle_plate"]:
        assert plate.startswith("ANON_")
        assert len(plate) == 5 + 12

    # Deterministic HMAC hash for identical plates (REC-01 and REC-03 had identical plate ABC-1234)
    plates = anon_df["vehicle_plate"].tolist()
    assert plates[0] == plates[1]

    for lat in anon_df["latitude"].dropna():
        assert lat == round(lat, 2)


def test_free_text_redaction(synthetic_edge_case_data, test_config):
    cleaned_df, _, _ = clean_dataset(synthetic_edge_case_data, config=test_config)
    pii = detect_pii_columns(cleaned_df, config=test_config)
    anon_df, _ = anonymize_dataset(cleaned_df, pii_fields=pii, config=test_config, hash_secret="test_secret_32_characters_mandatory_key")

    rec01_segment = anon_df.iloc[0]["road_segment"]
    assert "555-123-4567" not in rec01_segment
    assert "[REDACTED_PHONE]" in rec01_segment


def test_config_changes_alter_output():
    """
    Requirement 22: Tests proving that changing job configuration alters pipeline output.
    (e.g., dropping vehicle_plate or altering GPS precision).
    """
    assert os.path.exists(SAMPLE_CSV_PATH)

    # 1. Default config preserves vehicle_plate as ANON_
    default_res = process_pipeline(filepath=SAMPLE_CSV_PATH)
    assert "vehicle_plate" in default_res["cleaned_records"][0]
    assert default_res["cleaned_records"][0]["vehicle_plate"].startswith("ANON_")

    # 2. Config with DROP_COLUMN on vehicle_plate removes the column entirely
    drop_plate_config = {
        "privacy_rules": {
            "pii_actions": {
                "vehicle_plate": "DROP_COLUMN"
            }
        }
    }
    drop_res = process_pipeline(filepath=SAMPLE_CSV_PATH, config_override=drop_plate_config)
    assert "vehicle_plate" not in drop_res["cleaned_records"][0]

    # 3. Altering GPS precision from 2 to 1 rounds coordinates to 1 decimal place
    coarse_gps_config = {
        "anonymization": {
            "gps_decimal_precision": 1
        }
    }
    coarse_res = process_pipeline(filepath=SAMPLE_CSV_PATH, config_override=coarse_gps_config)
    for r in coarse_res["cleaned_records"]:
        lat = r.get("latitude")
        if lat is not None:
            assert lat == round(lat, 1)


def test_alternate_schema_pii_detection_and_masking(tmp_path):
    """
    Requirement 24: Test a second, differently structured file
    (columns: reg_no, full_name, mobile, ip_address, dob, lat, lng, driver_notes)
    and confirm PII is detected and masked with no code changes.
    """
    alt_df = pd.DataFrame([
        {
            "reg_no": "DXB-98124",
            "full_name": "Sarah Connor",
            "mobile": "+1 (555) 234-5678",
            "ip_address": "192.168.1.105",
            "dob": "1984-05-12",
            "lat": 25.204849,
            "lng": 55.270783,
            "driver_notes": "Driver email is sarah@sky.net and contact is 555-0199"
        },
        {
            "reg_no": "DXB-44120",
            "full_name": "Kyle Reese",
            "mobile": "0501234567",
            "ip_address": "10.0.0.12",
            "dob": "1980-02-28",
            "lat": 25.210012,
            "lng": 55.275510,
            "driver_notes": "Routine checkpoint clearance"
        }
    ])

    alt_csv_path = str(tmp_path / "alternate_traffic_data.csv")
    alt_df.to_csv(alt_csv_path, index=False)

    # 1. PII Detection on alternate schema
    detected_pii = detect_pii_columns(alt_df)
    detected_col_names = {p["column"] for p in detected_pii}

    # Verify multi-keyword and pattern detection across distinct schemas
    assert "reg_no" in detected_col_names
    assert "full_name" in detected_col_names
    assert "mobile" in detected_col_names
    assert "ip_address" in detected_col_names
    assert "dob" in detected_col_names
    assert "lat" in detected_col_names
    assert "lng" in detected_col_names

    # 2. End-to-End Pipeline on alternate schema
    res = process_pipeline(filepath=alt_csv_path)
    output_records = res["cleaned_records"]

    assert len(output_records) == 2
    for r in output_records:
        # reg_no pseudonymized
        assert r["reg_no"].startswith("ANON_")
        # Direct PII dropped
        assert "full_name" not in r
        assert "mobile" not in r
        assert "ip_address" not in r
        assert "dob" not in r
        # Coordinates generalized to 2 decimals
        assert r["lat"] == round(r["lat"], 2)
        assert r["lng"] == round(r["lng"], 2)
        # Free text notes redacted
        assert "sarah@sky.net" not in r["driver_notes"]
        assert "555-0199" not in r["driver_notes"]
        if "sarah" in alt_df.iloc[0]["driver_notes"]:
            assert "[REDACTED_EMAIL]" in output_records[0]["driver_notes"] or "[REDACTED_PHONE]" in output_records[0]["driver_notes"]


def test_quality_checks_reconciliation(synthetic_edge_case_data, test_config):
    cleaned_df, rejected_rows, _ = clean_dataset(synthetic_edge_case_data, config=test_config)
    pii = detect_pii_columns(cleaned_df, config=test_config)
    anon_df, _ = anonymize_dataset(cleaned_df, pii_fields=pii, config=test_config, hash_secret="test_secret_32_characters_mandatory_key")

    checks, overall_status = run_quality_checks(
        original_df=synthetic_edge_case_data,
        processed_df=anon_df,
        rejected_rows=rejected_rows,
        pii_fields=pii,
        config=test_config
    )

    qc01 = next(c for c in checks if c["id"] == "QC-01")
    assert qc01["status"] == "PASS"

    qc03 = next(c for c in checks if c["id"] == "QC-03")
    assert qc03["status"] == "PASS"


def test_empty_dataset(test_config):
    empty_df = pd.DataFrame()
    inspection = inspect_dataset(empty_df)
    assert inspection["total_rows"] == 0

    cleaned_df, rejected, _ = clean_dataset(empty_df, config=test_config)
    assert len(cleaned_df) == 0
    assert len(rejected) == 0


def test_dataset_profiling(synthetic_edge_case_data):
    from profile_data import profile_dataset
    profile = profile_dataset(synthetic_edge_case_data, filename="synthetic.csv", file_size=4096)
    assert profile["row_count"] == len(synthetic_edge_case_data)
    assert profile["column_count"] == len(synthetic_edge_case_data.columns)
    assert "health_score" in profile
    assert profile["health_score"] >= 0 and profile["health_score"] <= 100
    assert "charts" in profile
    assert "dtype_distribution" in profile["charts"]
    assert "null_percentages" in profile["charts"]
    assert "day_hour_heatmap" in profile["charts"]


def test_re_identification_suppress_and_aggregate(test_config):
    """
    Requirement 5:
    With sample_traffic_data.csv:
    1. Suppress with K=3 must give k_min >= 3 with the suppressed count reported.
    2. Aggregate must contain no cell with count < K and no plate, id, GPS or timestamp columns.
    """
    import os
    csv_path = os.path.join(os.path.dirname(__file__), "..", "sample_traffic_data.csv")
    assert os.path.exists(csv_path), f"sample_traffic_data.csv not found at {csv_path}"

    sample_df = pd.read_csv(csv_path)
    clean_df, rejected_rows, _ = clean_dataset(sample_df, config=test_config)
    pii = detect_pii_columns(clean_df, config=test_config)

    # 1. Suppress mode with K=3
    suppress_cfg = dict(test_config)
    suppress_cfg["riskReductionMode"] = "suppress"
    suppress_cfg["kThreshold"] = 3
    suppress_anon_df, _ = anonymize_dataset(clean_df, pii_fields=pii, config=suppress_cfg)

    k_report = suppress_anon_df.attrs.get("k_anonymity", {})
    suppressed_count = suppress_anon_df.attrs.get("suppressed_count", 0)
    suppressed_rows = suppress_anon_df.attrs.get("suppressed_rows", [])

    assert k_report.get("k_min", 0) >= 3, f"Expected k_min >= 3, got {k_report.get('k_min')}"
    assert suppressed_count > 0, "Expected suppressed_count > 0"
    assert len(suppressed_rows) == suppressed_count

    # 2. Aggregate mode with K=3
    agg_cfg = dict(test_config)
    agg_cfg["riskReductionMode"] = "aggregate"
    agg_cfg["kThreshold"] = 3
    agg_anon_df, _ = anonymize_dataset(clean_df, pii_fields=pii, config=agg_cfg)

    agg_records = agg_anon_df.attrs.get("aggregated_records", [])
    assert len(agg_records) > 0, "Expected aggregated records to be produced"

    forbidden_cols = {"plate", "license_plate", "vehicle_plate", "id", "record_id", "latitude", "lat", "longitude", "lon", "timestamp"}
    for cell in agg_records:
        assert cell["record_count"] >= 3, f"Cell has record_count < 3: {cell}"
        for key in cell.keys():
            assert key.lower() not in forbidden_cols, f"Forbidden column {key} found in cell: {cell}"


def test_risk_reduction_modes_output_changes(test_config):
    """
    Proves that the output changes distinctly for each mode (None, Suppress K, Aggregate):
    - None: Full row count, k_min < 3, 0 suppressed rows, 0 aggregated records, after_risk is HIGH.
    - Suppress K=3: Output rows reduced (len < none), k_min >= 3, suppressed_count > 0 reported, after_risk is LOW.
    - Aggregate: Produces hourly road_segment aggregated records with count >= K, no microdata/GPS/plate/timestamp, after_risk is LOW.
    """
    import os
    csv_path = os.path.join(os.path.dirname(__file__), "..", "sample_traffic_data.csv")
    assert os.path.exists(csv_path), f"sample_traffic_data.csv not found at {csv_path}"

    sample_df = pd.read_csv(csv_path)
    clean_df, _, _ = clean_dataset(sample_df, config=test_config)
    pii = detect_pii_columns(clean_df, config=test_config)

    # 1. Mode None
    none_cfg = dict(test_config)
    none_cfg["riskReductionMode"] = "none"
    none_cfg["kThreshold"] = 3
    none_df, _ = anonymize_dataset(clean_df, pii_fields=pii, config=none_cfg)
    none_k = none_df.attrs.get("k_anonymity", {})
    none_suppressed = none_df.attrs.get("suppressed_count", 0)
    none_agg = none_df.attrs.get("aggregated_records", [])

    # 2. Mode Suppress K=3
    suppress_cfg = dict(test_config)
    suppress_cfg["riskReductionMode"] = "suppress"
    suppress_cfg["kThreshold"] = 3
    suppress_df, _ = anonymize_dataset(clean_df, pii_fields=pii, config=suppress_cfg)
    suppress_k = suppress_df.attrs.get("k_anonymity", {})
    suppress_suppressed = suppress_df.attrs.get("suppressed_count", 0)
    suppress_agg = suppress_df.attrs.get("aggregated_records", [])

    # 3. Mode Aggregate K=3
    agg_cfg = dict(test_config)
    agg_cfg["riskReductionMode"] = "aggregate"
    agg_cfg["kThreshold"] = 3
    agg_df, _ = anonymize_dataset(clean_df, pii_fields=pii, config=agg_cfg)
    agg_k = agg_df.attrs.get("k_anonymity", {})
    agg_records = agg_df.attrs.get("aggregated_records", [])

    # PROOF 1: Mode 'None' vs Mode 'Suppress'
    # Row counts change: suppress removes low-k rows
    assert len(suppress_df) < len(none_df), (
        f"Expected suppress row count ({len(suppress_df)}) to be less than none ({len(none_df)})"
    )
    # Suppressed count changes: 0 in none, > 0 in suppress
    assert none_suppressed == 0, f"Expected 0 suppressed in none mode, got {none_suppressed}"
    assert suppress_suppressed > 0, "Expected > 0 suppressed rows in suppress mode"
    assert len(none_df) - len(suppress_df) == suppress_suppressed
    # k_min changes: none has k_min < 3, suppress enforces k_min >= 3
    assert none_k.get("k_min", 0) < 3, f"Expected none mode k_min < 3, got {none_k.get('k_min')}"
    assert suppress_k.get("k_min", 0) >= 3, f"Expected suppress mode k_min >= 3, got {suppress_k.get('k_min')}"
    # Risk changes: none after_risk is HIGH, suppress after_risk is LOW
    assert none_k.get("after_risk") == "HIGH"
    assert suppress_k.get("after_risk") == "LOW"

    # PROOF 2: Mode 'Aggregate' vs Other Modes
    # Aggregated records: none and suppress produce 0, aggregate produces > 0
    assert len(none_agg) == 0, "Mode none should produce 0 aggregated records"
    assert len(suppress_agg) == 0, "Mode suppress should produce 0 aggregated records"
    assert len(agg_records) > 0, "Mode aggregate must produce aggregated records"
    # Structure changes: Aggregate produces hourly road_segment records with count >= 3
    exact_forbidden = {"record_id", "vehicle_plate", "latitude", "longitude", "timestamp"}
    for cell in agg_records:
        assert cell["record_count"] >= 3, f"Cell count < 3 not suppressed: {cell}"
        assert "road_segment" in cell
        assert "hour" in cell or "hour_bucket" in cell
        assert "avg_speed" in cell
        assert "max_speed" in cell
        assert "outlier_count" in cell
        assert "congestion_counts" in cell or "congestion_moderate_count" in cell
        for k in cell:
            assert k.lower() not in exact_forbidden, f"Found forbidden column {k} in aggregate cell"

    # Risk changes: Aggregate after_risk is LOW (zero microdata released)
    assert agg_k.get("after_risk") == "LOW"
    assert agg_k.get("before_risk") == "HIGH"

    # PROOF 3: Pipeline execution reflects the differences end-to-end
    from main import process_pipeline
    pipe_none = process_pipeline(filepath=csv_path, config_override=none_cfg)
    pipe_suppress = process_pipeline(filepath=csv_path, config_override=suppress_cfg)
    pipe_agg = process_pipeline(filepath=csv_path, config_override=agg_cfg)

    assert pipe_none["summary"]["suppressed_count"] == 0
    assert pipe_suppress["summary"]["suppressed_count"] > 0
    assert pipe_none["summary"]["processed_rows"] > pipe_suppress["summary"]["processed_rows"]
    assert pipe_agg["summary"]["aggregated_cells_count"] > 0
    assert pipe_none["summary"]["re_identification_risk_after"] == "HIGH"
    assert pipe_suppress["summary"]["re_identification_risk_after"] == "LOW"
    assert pipe_agg["summary"]["re_identification_risk_after"] == "LOW"
    assert pipe_suppress["summary"]["overall_status"] == "PASSED"
    assert pipe_agg["summary"]["overall_status"] == "PASSED"


# ==============================================================================
# Requirement: XLSX, TSV, TXT, Excel Multi-Sheet, Name Redaction & Error Tests
# ==============================================================================

def test_tsv_and_xlsx_give_same_output_as_csv():
    """
    Verifies that .xlsx and .tsv versions of sample_traffic_data.csv produce the exact
    same pipeline output as the .csv version (same record count, status, QC battery, and cleaned records).
    """
    secret = "test_secret_for_equivalence_verification_32chars"
    csv_res = process_pipeline(filepath=SAMPLE_CSV_PATH, hash_secret=secret)
    tsv_res = process_pipeline(filepath=SAMPLE_TSV_PATH, hash_secret=secret)
    xlsx_res = process_pipeline(filepath=SAMPLE_XLSX_PATH, hash_secret=secret)

    # 1. Summary assertions
    keys = ["processed_rows", "original_rows", "rejected_rows_count", "overall_status", "pii_columns_detected"]
    for k in keys:
        assert csv_res["summary"][k] == tsv_res["summary"][k] == xlsx_res["summary"][k], (
            f"Summary mismatch for key '{k}': CSV={csv_res['summary'][k]}, TSV={tsv_res['summary'][k]}, XLSX={xlsx_res['summary'][k]}"
        )

    # 2. Output records count
    assert len(csv_res["cleaned_records"]) == len(tsv_res["cleaned_records"]) == len(xlsx_res["cleaned_records"])
    assert len(csv_res["cleaned_records"]) == 518

    # 3. Exact column and value parity across records
    for i in range(len(csv_res["cleaned_records"])):
        c_rec = csv_res["cleaned_records"][i]
        t_rec = tsv_res["cleaned_records"][i]
        x_rec = xlsx_res["cleaned_records"][i]
        for col in c_rec:
            assert c_rec[col] == t_rec[col], f"TSV diff at row {i}, col '{col}': {c_rec[col]} vs {t_rec[col]}"
            assert c_rec[col] == x_rec[col], f"XLSX diff at row {i}, col '{col}': {c_rec[col]} vs {x_rec[col]}"


def test_person_name_in_notes_column_redacted():
    """
    Adds a test row containing a person's name inside the notes column and confirms
    it is detected and redacted to [REDACTED_NAME].
    """
    raw_df = pd.read_csv(SAMPLE_CSV_PATH)
    test_row = {
        "record_id": "TRF-NAME-TEST",
        "timestamp": "2026-10-17T15:00:00Z",
        "vehicle_plate": "NAME-9999",
        "driver_name": "Test Driver",
        "driver_ssn": "999-99-9999",
        "vehicle_type": "Sedan",
        "speed_mph": 35.0,
        "latitude": 40.75,
        "longitude": -73.98,
        "road_segment": "5th Avenue",
        "congestion_level": "Low",
        "notes": "Driver Alexander Wright arrived on site and spoke with Jane Smith"
    }
    df_with_name = pd.concat([raw_df, pd.DataFrame([test_row])], ignore_index=True)

    cleaned_df, rejected, _ = clean_dataset(df_with_name)
    pii_cols = detect_pii_columns(cleaned_df)
    anon_df, _ = anonymize_dataset(cleaned_df, pii_fields=pii_cols, hash_secret="test_secret_key_32_characters_long_1234")

    # Locate the test row
    name_row = anon_df[anon_df["notes"].str.contains("REDACTED_NAME", na=False)]
    assert len(name_row) > 0, "Expected row with redacted name in notes column"
    redacted_note = name_row.iloc[0]["notes"]

    assert "Alexander Wright" not in redacted_note
    assert "Alexander" not in redacted_note
    assert "Jane Smith" not in redacted_note
    assert "[REDACTED_NAME]" in redacted_note


def test_free_text_name_redaction_unit():
    """Unit test for redact_freetext confirming various person name patterns are redacted."""
    test_cases = [
        ("Driver Alexander Wright reported vehicle issue", "Driver [REDACTED_NAME] reported vehicle issue"),
        ("Spoke with Jane Smith regarding delay", "Spoke with [REDACTED_NAME] regarding delay"),
        ("Contacted Officer Robert Davis on scene", "Contacted Officer [REDACTED_NAME] on scene"),
        ("Notes: Alice Johnson called in", "Notes: [REDACTED_NAME] called in"),
        ("John Doe had a flat tire on route", "[REDACTED_NAME] had a flat tire on route")
    ]
    for raw, expected in test_cases:
        res = redact_freetext(raw)
        assert "[REDACTED_NAME]" in res
        assert "Alexander" not in res
        assert "Jane Smith" not in res
        assert "Robert Davis" not in res
        assert "Alice Johnson" not in res
        assert "John Doe" not in res


def test_auto_delimiter_detection_txt(tmp_path):
    """Verifies that delimiter auto-detection properly reads semicolon and pipe separated .txt files."""
    sample_df = pd.read_csv(SAMPLE_CSV_PATH).head(20)

    # Semicolon delimited .txt
    semi_path = str(tmp_path / "telemetry_semi.txt")
    sample_df.to_csv(semi_path, sep=";", index=False)
    df_semi = load_dataset(semi_path)
    assert len(df_semi) == 20
    assert list(df_semi.columns) == list(sample_df.columns)

    # Pipe delimited .txt
    pipe_path = str(tmp_path / "telemetry_pipe.txt")
    sample_df.to_csv(pipe_path, sep="|", index=False)
    df_pipe = load_dataset(pipe_path)
    assert len(df_pipe) == 20
    assert list(df_pipe.columns) == list(sample_df.columns)


def test_password_protected_excel_error(tmp_path):
    """Confirms that encrypted/password-protected Excel files raise a clear, explicit error."""
    mock_enc = tmp_path / "protected.xlsx"
    ole_header = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
    mock_enc.write_bytes(ole_header + b"\x00" * 200 + b"EncryptionInfo\x00" + b"EncryptedPackage\x00")

    with pytest.raises(ValueError) as excinfo:
        load_dataset(str(mock_enc))
    assert "password-protected or encrypted" in str(excinfo.value).lower()


def test_unsupported_file_format_error(tmp_path):
    """Confirms that unsupported file extensions like .pdf raise a clear error."""
    mock_pdf = tmp_path / "traffic_report.pdf"
    mock_pdf.write_bytes(b"%PDF-1.4 mock content")

    with pytest.raises(ValueError) as excinfo:
        load_dataset(str(mock_pdf))
    assert "unsupported file format" in str(excinfo.value).lower()


def test_multi_sheet_excel_selection(tmp_path):
    """Confirms that multi-sheet Excel files load the first sheet by default and allow sheet selection."""
    sample_df = pd.read_csv(SAMPLE_CSV_PATH).head(30)
    meta_df = pd.DataFrame([{"key": "feed_name", "value": "NYC Midtown"}])

    multi_path = str(tmp_path / "multi_feed.xlsx")
    with pd.ExcelWriter(multi_path, engine="openpyxl") as writer:
        sample_df.to_excel(writer, sheet_name="Telemetry_Feed", index=False)
        meta_df.to_excel(writer, sheet_name="Feed_Metadata", index=False)

    # 1. Default to first sheet
    df_default = load_dataset(multi_path)
    assert len(df_default) == 30
    assert df_default.attrs["sheet_names"] == ["Telemetry_Feed", "Feed_Metadata"]
    assert df_default.attrs["selected_sheet"] == "Telemetry_Feed"

    # 2. Select second sheet by name
    df_meta = load_dataset(multi_path, sheet="Feed_Metadata")
    assert len(df_meta) == 1
    assert "key" in df_meta.columns
    assert df_meta.attrs["selected_sheet"] == "Feed_Metadata"


def test_dob_detected_as_pii_even_when_formatted_as_datetime():
    """
    Critical Leak Test: DOB column values formatted as ISO datetimes (YYYY-MM-DD)
    must still be classified as Date of Birth PII and not treated as generic traffic timestamps.
    """
    df = pd.DataFrame({
        "record_id": ["R1", "R2", "R3", "R4"],
        "dob": ["1985-05-12", "1990-07-22", "1978-11-03", "1995-02-18"],
        "birth_date": ["1985-05-12", "1990-07-22", "1978-11-03", "1995-02-18"]
    })
    detected = detect_pii_columns(df)
    names = [d.get("name") or d.get("column") for d in detected]
    assert "dob" in names, "dob column was bypassed and not detected as PII!"
    assert "birth_date" in names, "birth_date column was bypassed and not detected as PII!"
    dob_entry = next(d for d in detected if (d.get("name") or d.get("column")) == "dob")
    assert dob_entry["classification"] == "Date of Birth"


def test_mandatory_hash_secret_missing_or_short(monkeypatch):
    """
    Critical Leak Test: HASH_SECRET must be mandatory with a minimum of 32 characters
    and must NEVER silently fall back to an insecure default salt string.
    """
    monkeypatch.delenv("HASH_SECRET", raising=False)
    df = pd.DataFrame({"record_id": ["R1"], "vehicle_plate": ["ABC-1234"]})
    pii = [{"name": "vehicle_plate", "classification": "License Plate", "default_action": "PSEUDONYMIZE_HMAC"}]
    with pytest.raises((ValueError, RuntimeError)) as excinfo:
        anonymize_dataset(df, pii_fields=pii, hash_secret=None)
    assert "hash_secret" in str(excinfo.value).lower() or "32" in str(excinfo.value)

    with pytest.raises((ValueError, RuntimeError)) as excinfo2:
        anonymize_dataset(df, pii_fields=pii, hash_secret="short_key_12345")
    assert "32" in str(excinfo2.value)


def test_emirates_id_iban_card_uae_phone_redaction():
    """
    Step 2 Test: Validates whole-token redaction for:
    - Emirates ID (with and without hyphens, never sliced into partial phone)
    - IBAN
    - Luhn-validated payment card
    - UAE mobile and landline phones
    """
    cases = [
        ("ID 784-1990-1234567-1", "[REDACTED_NATIONAL_ID]"),
        ("Emirates ID 784199012345671 presented", "[REDACTED_NATIONAL_ID]"),
        ("Contact 050 123 4567 immediately", "[REDACTED_PHONE]"),
        ("Call +971 50 123 4567 on arrival", "[REDACTED_PHONE]"),
        ("Call landline 04 123 4567 today", "[REDACTED_PHONE]"),
        ("Wire funds to IBAN AE070331234567890123456", "[REDACTED_IBAN]"),
        ("Card 4111 1111 1111 1111 charged", "[REDACTED_CARD]"),
        ("Card 4532-0150-1234-5671 processed", "[REDACTED_CARD]"),
    ]

    for raw, expected_token in cases:
        redacted = redact_freetext(raw)
        assert expected_token in redacted, f"Expected {expected_token} in '{redacted}' for raw '{raw}'"
        # Confirm no partial dangling numbers
        assert "-1234567-1" not in redacted
        assert "784199012345671" not in redacted
        assert "AE070331234567890123456" not in redacted
        assert "4111 1111 1111 1111" not in redacted


def test_multilingual_name_recall_seven_targets():
    """
    Step 2 Test: Evaluates and asserts 100% recall on the 7 required multilingual names:
    Rahul Sharma, Zhang Wei, Fatima Al Hashimi, Olamide, Mohammed bin Rashid, Ahmed Al Mansoori, Priya Nair.
    """
    targets = [
        ("Rahul Sharma stopped near the junction", "Rahul Sharma"),
        ("Zhang Wei reported a breakdown", "Zhang Wei"),
        ("Call Fatima Al Hashimi on arrival", "Fatima Al Hashimi"),
        ("Driver was Olamide", "Olamide"),
        ("Mohammed bin Rashid approved the permit", "Mohammed bin Rashid"),
        ("Ahmed Al Mansoori inspected the scene", "Ahmed Al Mansoori"),
        ("Priya Nair logged the telemetry", "Priya Nair")
    ]

    for text, name in targets:
        redacted = redact_freetext(text)
        assert name not in redacted, f"Target name '{name}' was LEAKED in: '{redacted}'"
        assert "[REDACTED_NAME]" in redacted, f"Expected [REDACTED_NAME] token in: '{redacted}'"


def test_masked_samples_generated_from_real_first_non_null_value():
    """
    Step 3 Test: Asserts that masked samples for detected PII columns are generated
    dynamically from the real first non-null values in the dataset, not static dummy strings.
    """
    import hmac
    import hashlib
    test_df = pd.DataFrame({
        "latitude": [None, 34.052235, 34.060000],
        "longitude": [None, -118.243683, -118.250000],
        "user_id": [None, "USR_CUSTOM_9999", "USR_CUSTOM_8888"],
        "notes": [None, "Driver called 050-123-4567 regarding accident", "Clear road"]
    })
    
    detected = detect_pii_columns(test_df)
    det_map = {d["column"]: d for d in detected}
    
    assert "latitude" in det_map
    assert "longitude" in det_map
    assert "user_id" in det_map
    assert "notes" in det_map

    # Check latitude masked sample reflects 34.05, NOT 40.71
    assert "34.05" in det_map["latitude"]["sample_masked"]
    assert "40.71" not in det_map["latitude"]["sample_masked"]
    assert det_map["latitude"]["first_non_null_value"] == "34.052235"

    # Check longitude masked sample reflects -118.24, NOT -74.01
    assert "-118.24" in det_map["longitude"]["sample_masked"]
    assert "-74.01" not in det_map["longitude"]["sample_masked"]
    assert det_map["longitude"]["first_non_null_value"] == "-118.243683"

    # Check user_id masked sample is derived from USR_CUSTOM_9999, NOT static ANON_7c9f8a12e4b0
    assert det_map["user_id"]["sample_masked"] != "ANON_7c9f8a12e4b0"
    salt = os.environ.get("HASH_SECRET", "default_salt_for_testing_purposes_only")
    expected_hash = hmac.new(salt.encode("utf-8"), b"USR_CUSTOM_9999", hashlib.sha256).hexdigest()[:12]
    assert expected_hash in det_map["user_id"]["sample_masked"]
    assert det_map["user_id"]["first_non_null_value"] == "USR_CUSTOM_9999"

    # Check notes redacted sample redacted the phone
    assert "050-123-4567" not in det_map["notes"]["sample_masked"]
    assert "[REDACTED_PHONE]" in det_map["notes"]["sample_masked"]


