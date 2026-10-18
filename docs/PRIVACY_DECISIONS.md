# 🛡️ Privacy Engineering Decisions & Rationale

This document details the architectural, cryptographic, and mathematical justifications for the privacy-preserving transformation techniques applied across the Traffic Data Processor platform, alongside documented residual risks and trade-offs.

---

## 1. Data Minimization: Direct Identifier Removal

### Technique
Complete column dropping of direct personal identifiers, including:
- Social Security Numbers (`ssn`, `driver_ssn`)
- Driver and operator full names (`driver_name`, `operator_name`)
- Contact phone numbers and email addresses

### Rationale
- **Legal Compliance**: Conforms directly with GDPR Article 5(1)(c) (*"Data Minimisation"*) and CCPA/CPRA requirements. Personal identity attributes have zero relevance to macroscopic vehicle flow calculations, highway speed profiling, or transit congestion modeling.
- **Attack Surface Elimination**: Masking or partial hashing of high-entropy identifiers (like names or SSNs) leaves datasets vulnerable to frequency analysis, auxiliary database joining, or dictionary attacks. Total column removal eliminates the vulnerability entirely.

### Residual Risks & Limitations
- Prevents longitudinal individual-driver profiling (e.g., driver-specific fatigue tracking). If driver-level longitudinal tracking is required in the future, it must be performed using ephemeral session keys within an isolated cryptographic enclave.

---

## 2. Vehicle License Plate Pseudonymization (HMAC-SHA256)

### Technique
- Salted Hash-based Message Authentication Code: $\text{HMAC-SHA256}(K, \text{Plate})$
- Secret Key $K$: Loaded securely via environment variable `process.env.HASH_SECRET` (never hardcoded or exposed to client).
- Output Standard: `ANON_<first 12 hex characters>` (e.g., `ANON_332f994a2611`).

### Rationale
- **Trajectory Continuity**: Deterministic hashing ensures that the same vehicle plate across multiple intersections or timestamps consistently maps to the same anonymous identifier, preserving trip linkage and origin-destination analysis.
- **Rainbow Table & Dictionary Attack Immunity**: Standard SHA-256 without a secret key is trivial to reverse for license plates due to their constrained search space (e.g., state format `AAA-1234` is easily brute-forced). HMAC-SHA256 prevents offline dictionary enumeration without possession of the secret key.

### Residual Risks & Limitations
- If the secret key `HASH_SECRET` is compromised, an attacker can re-identify vehicle pseudonyms. Key rotation schedules and secret management (e.g. AWS KMS / HashiCorp Vault) are essential in production.

---

## 3. Spatial Generalization (GPS Coordinates to 2 Decimal Places)

### Technique
- Latitude and longitude coordinates are rounded to two decimal places:
  $$\text{Latitude}_{\text{gen}} = \text{round}(\text{Lat}, 2), \quad \text{Longitude}_{\text{gen}} = \text{round}(\text{Lon}, 2)$$
- Resolution: $\approx 1.1 \text{ km}$ bounding box grid cell.

### Rationale
- **Location Privacy**: Unrounded GPS coordinates (4 to 6 decimal places) pin down vehicle positions to within meters, readily identifying private driveways, sensitive healthcare clinics, or private residences.
- **Macroscopic Utility**: A $1.1 \text{ km}$ spatial granularity preserves arterial road classification, highway corridor monitoring, and regional traffic volume distribution.

### Residual Risks & Limitations
- Microscopic lane-level tracking or precision intersection queue length modeling cannot be performed on the anonymized data.

---

## 4. Temporal Generalization (15-Minute Floor Bucketing)

### Technique
- Timestamps are converted to ISO-8601 UTC and rounded down (floored) to the nearest 15-minute interval:
  $$\text{Timestamp}_{\text{bucket}} = \text{floor}_{15\text{m}}(\text{Timestamp}_{\text{UTC}})$$

### Rationale
- **Side-Channel Correlation Defense**: High-resolution timestamps (exact seconds) allow re-identification by correlating traffic sensor events with external timestamped sources (such as CCTV footage, credit card toll transactions, or smartphone pings).
- **Peak Hour Aggregation**: 15-minute intervals represent the gold standard in transportation engineering for Level of Service (LOS) and Peak Hour Factor (PHF) calculations.

### Residual Risks & Limitations
- Fine-grained signal light timing analysis or sub-second vehicle headway measurements are excluded from this analytical layer.

---

## 5. Non-Clamping Outlier Management

### Technique
- Extreme speed values are not silently clamped.
- The pipeline appends a boolean flag `speed_outlier_flag` (`true` / `false`).
- Legitimate extreme speeds (e.g. $135 \text{ mph}$) retain their value with the flag set to `true`.
- Physically impossible speeds ($< 0 \text{ mph}$ or $> 250 \text{ mph}$) are set to `null` while retaining `speed_outlier_flag = true`.

### Rationale
- **Scientific Integrity**: Silently altering values (e.g., clamping $140 \text{ mph}$ to $120 \text{ mph}$) falsifies statistical distributions and distorts safety investigations or emergency vehicle analysis. Explicit flagging enables downstream consumers to filter or include outliers with full transparency.

---

## 6. Zero-Retention Storage Architecture

### Technique
- **Disk**: Uploaded raw datasets are stored in a temporary directory and deleted in a controller `finally` block immediately upon pipeline conclusion.
- **Database**: MongoDB only receives the processed schema in `jobs` and `records`. Raw records are never written to disk or database collections.
- **In-Memory Volatility**: The Before vs. After comparison is returned strictly in the HTTP response of the initial upload session. After page refresh, only anonymized records remain retrievable.
