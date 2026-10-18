# 🔄 Processing Pipeline & Audit Lifecycle

The processing pipeline executes five deterministic, config-driven stages sequentially. It adheres to strict zero-retention privacy rules, mathematical accountability, and comprehensive quality auditing.

```
[Raw Traffic File (CSV / JSON)]
       │
       ▼
 1. Data Inspection (inspect_data.py)
    • Chunked ingestion for files up to 50MB
    • Schema, null rates, duplicate counts, IQR statistical outliers
       │
       ▼
 2. PII Detection (detect_pii.py)
    • Config-driven column heuristics & value regex matching
    • Confidence scoring (CRITICAL / HIGH / MEDIUM)
       │
       ▼
 3. Data Cleaning & Rejection Accounting (clean.py)
    • Snake_case normalization & whitespace trimming
    • ISO-8601 UTC timestamp conversion & 15-minute floor bucketing
    • Speed outlier flagging (speed_outlier_flag=true) without silent clamping
    • Explicit rejection tracking for duplicates & corrupt timestamps
       │
       ▼
 4. Anonymization & Data Minimization (anonymize.py)
    • Data Minimization: complete removal of SSN, driver name, phone, email
    • HMAC-SHA256 plate pseudonymization (ANON_<12 hex chars>) using HASH_SECRET
    • Spatial generalization: GPS rounded to 2 decimal places (~1.1 km)
    • Free-text scrubbing: regex redaction of incident comments/notes
       │
       ▼
 5. Automated Quality & Privacy Auditing (quality_checks.py)
    • QC-01: Record count reconciliation (Input = Output + Rejected)
    • QC-02: Schema completeness & minimization audit
    • QC-03: Independent zero raw PII leakage re-scan
    • QC-04: Value ranges & physical boundary verification
    • QC-05: Spatial and temporal generalization audit
    • QC-06: Plate pseudonym consistency audit
    • QC-07: Duplicate absence check on cleaned data
    • QC-08: Column null-rate thresholds
       │
       ▼
[Clean Anonymized Dataset] ──► Persisted to MongoDB 'records' collection
[Raw File on Disk]         ──► Deleted immediately in controller 'finally' block
[Before vs. After Sample]  ──► Returned in volatile memory only for active upload
```

---

### Stage 1: Data Inspection (`inspect_data.py`)
- Analyzes dataset dimensions (`total_rows`, `total_columns`).
- Calculates per-column null counts and percentages.
- Computes exact duplicate row counts.
- Evaluates Interquartile Range (IQR) for velocity attributes:
  $$\text{IQR} = Q_3 - Q_1, \quad \text{Lower Bound} = Q_1 - 1.5 \times \text{IQR}, \quad \text{Upper Bound} = Q_3 + 1.5 \times \text{IQR}$$

### Stage 2: PII Detection (`detect_pii.py`)
- Evaluates column names against configured keywords (`plate`, `ssn`, `driver`, `name`, `phone`, `email`, `lat`, `lon`).
- Evaluates sample string values against compiled regular expressions with confidence scoring:
  - `CRITICAL`: Direct government identifiers (SSN).
  - `HIGH`: Plate numbers, phone numbers, emails, operator names, GPS coordinates.
- Recommends target actions (`DROP_COLUMN`, `PSEUDONYMIZE_HMAC`, `GENERALIZE_SPATIAL`, `REDACT_FREE_TEXT`).

### Stage 3: Data Cleaning & Rejection Tracking (`clean.py`)
- Formats headers to `snake_case`.
- Audits and isolates rejected records:
  - Exact duplicate rows are flagged with reason `duplicate_record`.
  - Corrupt or unparseable timestamps are flagged with reason `invalid_timestamp`.
  - Missing mandatory identifiers (`record_id`) are flagged with reason `missing_required_field`.
  - *No PII data is ever included in rejection explanations.*
- Standardizes timestamps to ISO-8601 UTC and floors down to a 15-minute bucket:
  $$\text{Timestamp}_{\text{bucket}} = \text{floor}_{15\text{min}}(\text{Timestamp}_{\text{UTC}})$$
- Speed outliers: Values exceeding $120\text{ mph}$ retain their value and receive `speed_outlier_flag = true`. Values violating physical laws ($< 0$ or $> 250\text{ mph}$) are set to `null` with `speed_outlier_flag = true`.

### Stage 4: Anonymization & Data Minimization (`anonymize.py`)
- **Direct Identifiers**: Columns matching direct PII categories (`ssn`, `driver_name`, `phone`, `email`) are completely dropped from the dataset (Data Minimization).
- **Vehicle Plates**: Transformed into cryptographic pseudonyms via HMAC-SHA256 keyed with secret environment variable `HASH_SECRET`. Format: `ANON_<first 12 hex chars>`.
- **Spatial K-Anonymity Generalization**: Latitude and Longitude rounded to 2 decimal places ($\approx 1.1\text{ km}$ spatial bounding box).
- **Free-Text Scrubbing**: Text columns like `road_segment` or comments are scanned for incidental phone numbers, plates, and SSNs, replacing matches with `[REDACTED_PHONE]`, `[REDACTED_PLATE]`, etc.

### Stage 5: Quality Assurance Audits (`quality_checks.py`)
Executes an automated suite of 8 validation checks:
1. **QC-01: Record Count Reconciliation**: Proves mathematically that $\text{Input Rows} = \text{Output Rows} + \text{Rejected Rows}$, detailing every rejection reason.
2. **QC-02: Schema Completeness**: Confirms all intended analytical columns are retained while direct PII columns are eliminated.
3. **QC-03: Zero Raw PII Leakage**: Performs an independent re-scan across all cells in the output dataset using PII regexes to guarantee zero unredacted sensitive values.
4. **QC-04: Physical Value Ranges**: Verifies speed values adhere to allowable boundaries ($[0, 250]$ mph).
5. **QC-05: Spatial and Temporal Generalization**: Asserts GPS coordinates do not exceed 2 decimal places and timestamps are floored to 15-minute intervals.
6. **QC-06: Plate Pseudonym Consistency**: Confirms deterministic pseudonymization (identical raw plate numbers yield the exact same `ANON_` hash across records).
7. **QC-07: Duplicate Record Absence**: Asserts zero exact duplicates in the cleaned output.
8. **QC-08: Column Null Rate Thresholds**: Verifies missing values remain within acceptable thresholds across analytical fields.
