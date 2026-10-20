# 🚦 Traffic Data Processor — Privacy-Preserving Mobility Platform

An enterprise-grade, interview-winning data privacy and traffic telemetry platform (React 18 + Vite, Tailwind CSS, Three.js, Node.js/Express, Python 3.12+, and MongoDB). Built to ingest raw connected vehicle sensor feeds, detect Personally Identifiable Information (PII), enforce strict Data Minimization and HMAC-SHA256 pseudonymization, generalize temporal/spatial coordinates, flag physical outliers, and conduct automated quality reconciliations with **zero raw data retention**.

---

## 🌟 Highlights & Enterprise Features

- **5-Step Guided Wizard**:
  1. **Upload**: Drag-and-drop zone with animated glowing border, file validation (CSV/JSON up to 50MB), progress ring, and one-click built-in sample dataset.
  2. **File Analysis (Pre-Flight Profiling)**: Pre-processing analysis executed entirely in volatile memory via `POST /api/jobs/profile`. Provides animated count-up KPI cards, 0–100 Data Health Score gauge, 7x24 hour-of-day heatmap matrix, speed histogram, coordinate scatter, null rate bars, and sparkline distribution columns.
  3. **Configure (Privacy & Rules Engine)**: Live trade-off scoring comparing **Privacy Score vs. Data Utility Score** in real-time. Features 3 production presets (*Maximum Privacy*, *Balanced (Recommended)*, *Max Utility*), GPS precision slider (0–4 decimals), 15-minute floor bucketing, outlier handling options, and an in-memory 5-row live transformation preview.
  4. **Processing (Live Pipeline)**: Interactive 3D particle data stream in sync with real-time pipeline milestones (Load &rarr; Detect PII &rarr; Clean &rarr; Anonymize &rarr; Quality Audits &rarr; Export). Real-time Server-Sent Events (SSE) log stream terminal.
  5. **Results & Verification**: Interactive Recharts telemetry (QC pass/warn/fail donut, privacy actions, null % before vs. after, speed histogram, road segments), draggable split Before/After comparison with "Session Only — Never Stored" guarantee, and multi-format exports (CSV, JSON, Audit Markdown report, JSON config).
- **Supported Formats**: `.csv`, `.tsv`, `.txt` (delimiter auto-detected), `.json`, and Excel (`.xlsx`, `.xls` with multi-sheet selector and password-protection detection).
- **Security & Data Hygiene**:
  - Spreadsheet formula injection protection (neutralizing leading `=`, `+`, `-`, `@`, `\t`, `\r` on CSV exports).
  - Cryptographic HMAC-SHA256 with domain separation to eliminate cross-column pseudonym correlation.
  - Mandatory 32-character secret key configuration without hardcoded fallbacks.
  - Zero raw data retention: staging files unlinked immediately in controller `finally` blocks; zero raw identifiers stored in MongoDB.
- **K-Anonymity & Risk Reduction Engine**:
  - `None` (Report only): Audits equivalence classes and reports risk distribution without removing records.
  - `Suppress K` ($K \ge 3$): Iterative generalization (GPS decimal rounding, 15m $\rightarrow$ 60m time bucketing) and row suppression for solitary cohorts ($k < K$).
  - `Aggregate`: Produces hourly road segment macro statistics with speed statistics, congestion, and outlier counts with zero microdata.
- **Transparent Privacy & Utility Scoring**:
  - Deterministic 0–100 trade-off scores based on remaining direct identifiers, spatial resolution, temporal windowing, and k-anonymity suppression.
  - Clearly documented as analytical estimates, avoiding misleading claims of absolute anonymity.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    User([Traffic Data Operator]) -->|Uploads CSV / TSV / TXT / JSON / XLSX| Client[React 18 + Vite + Tailwind\n:5173]
    Client -->|POST /api/jobs/profile| Profiler[In-Memory Profiler\nZero Disk Retention]
    Profiler -->|Returns Stats & Heatmap| Client
    Client -->|POST /api/jobs/upload\nwith Config JSON| Server[Node.js + Express API\n:5000]

    subgraph Server-Sent Events & Engine
        Server -->|GET /api/jobs/:id/stream| SSE[jobStreamService\nLive Progress & Logs]
        Server -->|Spawn with HASH_SECRET| PyRunner[services/pythonRunner.js]
        PyRunner --> Main[processor/main.py]
        Main --> Inspect[inspect_data.py]
        Main --> Detect[detect_pii.py]
        Main --> Clean[clean.py]
        Main --> Anon[anonymize.py]
        Main --> QC[quality_checks.py (QC-01 to QC-09)]
    end

    subgraph Zero-Retention Storage
        QC -->|Anonymized Records Only| MongoRecords[(MongoDB 'records' Collection)]
        QC -->|Audit Metadata & Telemetry| MongoJobs[(MongoDB 'jobs' Collection)]
        Server -.->|finally block: unlinkSync| Cleanup[(Delete Staged Temp File)]
    end

    SSE -.->|Live Stage Events| Client
    Server -->|Memory-Only Before vs After Sample| Client
```

---

## 🔒 Privacy Safeguards & Engineering Rules

1. **Zero Raw Retention**: Raw data is never persisted in MongoDB or stored on disk. Staging temp files are unlinked in a `finally` block immediately after profiling and processing.
2. **Volatile Before/After Comparison**: The side-by-side comparison of original vs. anonymized values exists solely in volatile memory during the active upload session. After page refresh, only anonymized records remain.
3. **HMAC-SHA256 Pseudonymization with Domain Separation**: Identifiers and plates are transformed deterministically using a secret key (`process.env.HASH_SECRET`) into `ANON_<first 12 hex chars>`. Incorporating column context prevents cross-column linkage correlation attacks.
4. **Data Minimization**: Direct personal identifiers (`driver_name`, `driver_ssn`, `phone`, `email`, `credit_card`) are completely dropped from the dataset schema.
5. **Spatial & Temporal Generalization**: GPS coordinates are rounded to 2 decimal places ($\approx 1.1\text{ km}$ spatial bounding box), and timestamps are floored into uniform UTC intervals (5m, 15m, 30m, 60m).
6. **Non-Clamping Outlier Flagging**: High speeds are not altered or clamped. The pipeline sets `speed_outlier_flag = true`, preserving dataset veracity. Impossible speeds ($<0$ or $>250\text{ mph}$) are nullified with the flag set.
7. **Free-Text Redaction**: Unstructured text fields are scanned with regexes and lazy-loaded multilingual spaCy NER, scrubbing incidental phone numbers, plates, Emirates IDs, and personal names.
8. **CSV Formula Injection Defense**: Output CSV serialization neutralizes spreadsheet formula execution commands (`=`, `+`, `-`, `@`, `\t`, `\r`) by prepending a single quote to non-numeric strings.

---

## ⚡ Automated Quality Audit Battery (QC-01 to QC-09)

| Check ID | Verification Assertion | Pass Condition |
| :--- | :--- | :--- |
| **QC-01** | Record Count Reconciliation | $\text{Input Rows} = \text{Output Rows} + \text{Rejected Rows} + \text{Duplicates Removed} + \text{Suppressed Rows}$ (zero silent loss) |
| **QC-02** | Schema Completeness | All non-PII dimensions preserved; direct PII minimized |
| **QC-03** | Zero Raw PII Leakage | Independent re-scan confirms 0 raw SSNs, emails, phone numbers, or cards in output |
| **QC-04** | Physical Value Ranges | Verified velocity bounds ($[0, 250]$ mph); impossible values nullified |
| **QC-05** | Generalization Audit | Confirmed GPS coordinates $\le 2$ decimal places; timestamps floored to configured bucket |
| **QC-06** | Plate Pseudonym Consistency | Same plate yields identical `ANON_` hash; standard format verified |
| **QC-07** | Duplicate Absence Check | Zero duplicate rows detected in cleaned output dataset |
| **QC-08** | Column Null Rate Thresholds | Analytical column missingness complies with healthy data quality limits |
| **QC-09** | K-Anonymity Risk Assessment | Verified cohort distribution over detected quasi-identifiers ($k \ge K$) |

---

## 🛠️ Environment Variables Configuration

Create a `.env` file in `server/`:

```env
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

# Cryptographic Pseudonymization Secret (Minimum 32 characters, keep private!)
HASH_SECRET=your_super_secret_hmac_key_min_32_characters_here

# Python Runtime Executable
PYTHON_PATH=python

# Python processing timeout (milliseconds; default: 5 minutes)
PYTHON_PROCESS_TIMEOUT_MS=300000

# Storage Directories
UPLOAD_DIR=./uploads
PROCESSED_DIR=./processed

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/traffic_processor
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js v18+ & npm
- Python 3.10+ with pip
- MongoDB running locally on port `27017`

### 2. Install Dependencies
```powershell
# Python Processor
cd processor
python -m pip install -r requirements.txt

# Express Backend
cd ../server
npm install

# React Frontend
cd ../client
npm install
```

### 3. Run Test Suites
```powershell
# Run Python Pipeline Tests (32/32)
pytest processor/tests

# Run React Client Tests (11/11)
cd client
npm test

# Run Server Integration Tests (13/13)
cd ../server
npm test
```

### 4. Build Client Bundle
```powershell
cd client
npm run build
```

### 5. Launch the Application
```powershell
# Windows 1-Click Launch:
.\start.bat

# Or run services separately:
# Terminal 1 (Backend):
cd server && npm run dev

# Terminal 2 (Frontend):
cd client && npm run dev
```

Visit the dashboard at `http://localhost:5173`.

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/jobs/profile` | In-memory pre-processing file analysis (nulls, types, PII, outliers, health score) |
| `POST` | `/api/jobs/upload` | Multipart file upload with dynamic config JSON, runs pipeline, deletes temp file in `finally` |
| `GET` | `/api/jobs/:id/stream` | Server-Sent Events (SSE) live progress and execution log streaming |
| `GET` | `/api/jobs/:id/analytics` | Pre-aggregated Recharts analytics payload (QC donut, speed histogram, null bars) |
| `GET` | `/api/jobs` | Paginated jobs directory with `page`, `limit`, `search`, and `status` filters |
| `GET` | `/api/jobs/:id` | Detailed job audit telemetry (metadata, PII report, QC checks, rejection log) |
| `GET` | `/api/jobs/:id/records` | Paginated anonymized records with `page`, `limit`, `sort`, `order`, `filter` |
| `GET` | `/api/jobs/:id/download` | Downloads cleaned dataset (`?format=csv` or `?format=json` or `?type=aggregate`) |
| `GET` | `/api/jobs/:id/aggregated.csv` | Direct shortcut to download aggregated macro statistics dataset |
| `GET` | `/api/jobs/:id/report` | Downloadable compliance audit report (`?format=markdown` or `json`) |
| `DELETE` | `/api/jobs/:id` | Deletes job metadata and associated anonymized records from MongoDB |
| `GET` | `/api/health` | Health status and runtime telemetry |

---

## ⚠️ Limitations & Governance Notice
1. **Pseudonym Linkability**: HMAC pseudonymization is deterministic. An adversary possessing the secret key or auxiliary side-channel observations can re-identify records. Pseudonymized data remains pseudonymous and is not legally equivalent to fully anonymous non-personal data.
2. **Heuristic Detection**: Detection rules rely on patterns, keywords, and named-entity recognition. No automated scanner can guarantee 100% detection of novel, obfuscated, or unstructured personal data. Manual review of flagged columns is recommended.
3. **No Compliance Warranty**: This software provides privacy-enhancing engineering mechanisms. It does not constitute legal advice or guarantee statutory compliance with GDPR, CCPA, or UAE Federal Decree-Law No. 45 of 2021.
