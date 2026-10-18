# 📖 Data Dictionary

This document details the schema definitions for raw input datasets, their transformed anonymized equivalents, and rejection audit tracking.

---

## 1. Raw Input Schema

| Field Name | Raw Type | Description | Sensitivity Level | Raw Example |
| :--- | :--- | :--- | :--- | :--- |
| `record_id` | String / Int | Mandatory event identifier | Low | `TRF-9001` |
| `timestamp` | String | Event date and time | Medium | `2026-10-17 07:32:10` |
| `vehicle_plate` | String | Vehicle registration license plate | **High (Direct PII)** | `NYC-8492` |
| `driver_name` | String | Vehicle operator full name | **High (Direct PII)** | `Alexander Wright` |
| `driver_ssn` | String | Driver national ID / Social Security | **Critical (Direct PII)**| `102-45-7890` |
| `vehicle_type` | String | Vehicle classification (Sedan, Bus) | Low | `Sedan` |
| `speed_mph` | Float | Measured velocity | Medium | `135.2` / `-8.0` |
| `latitude` | Float | High-precision GPS Latitude | **High (Spatial PII)** | `40.712776` |
| `longitude` | Float | High-precision GPS Longitude | **High (Spatial PII)** | `-74.005974` |
| `road_segment` | String | Street or highway notes | Medium (PII Risk) | `Broadway (call 555-0199)` |
| `congestion_level`| String | Traffic condition (Low, High) | Low | `Moderate` |

---

## 2. Processed & Anonymized Output Schema

| Field Name | Transformed Type | Enforced Privacy / Cleaning Rule | Output Sample |
| :--- | :--- | :--- | :--- |
| `record_id` | String | Preserved mandatory dimension | `TRF-9001` |
| `timestamp` | ISO-8601 UTC | Rounded down to 15-minute floor bucket | `2026-10-17T07:30:00Z` |
| `vehicle_plate` | String | Pseudonymized with HMAC-SHA256 (`ANON_<12hex>`) | `ANON_332f994a2611` |
| `driver_name` | *Dropped* | **Data Minimization: Column removed completely** | *None (Omitted)* |
| `driver_ssn` | *Dropped* | **Data Minimization: Column removed completely** | *None (Omitted)* |
| `vehicle_type` | String | Trimmed & snake_case normalized | `Sedan` |
| `speed_mph` | Float / Null | Kept intact; set to `null` if `< 0` or `> 250` | `135.2` or `null` |
| `speed_outlier_flag`| Boolean | True if speed $> 120$ mph or impossible ($<0$ or $>250$) | `true` |
| `latitude` | Float (2 Decimals) | Truncated to 2 decimal places ($\approx 1.1\text{ km}$ spatial grid) | `40.71` |
| `longitude` | Float (2 Decimals) | Truncated to 2 decimal places ($\approx 1.1\text{ km}$ spatial grid) | `-74.01` |
| `road_segment` | String | Free-text scrubbed with regex for plates/phones/SSNs | `Broadway ([REDACTED_PHONE])` |
| `congestion_level`| String | Trimmed standard categorical | `Moderate` |

---

## 3. Rejected Records Schema (Audited Zero-PII Log)

| Field Name | Type | Description | Sample Value |
| :--- | :--- | :--- | :--- |
| `row_index` | Integer | Zero-indexed row number from the original file | `5` |
| `reason` | String | Machine-readable rejection code | `duplicate_record` / `invalid_timestamp` |
| `details` | String | Human-readable non-PII explanation | `Exact identical duplicate row detected and rejected.` |
