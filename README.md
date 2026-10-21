# 🚦 Traffic Data Processor — Backend & Data Processing Engine

Enterprise-grade, privacy-preserving mobility and traffic telemetry backend platform. Combines a high-throughput **Node.js/Express API gateway** with an advanced **Python data processing engine** (Python 3.12+ / Pandas / NumPy / SciPy / OpenPyXL) and **MongoDB** zero-retention storage.

Ingests connected vehicle sensor feeds, detects Personally Identifiable Information (PII), enforces strict Data Minimization and HMAC-SHA256 pseudonymization, generalizes coordinates/temporal stamps, conducts 9 automated quality audits (QC-01 to QC-09), and streams live pipeline telemetry via Server-Sent Events (SSE).

---

## 🏛️ Architecture & Components

```mermaid
flowchart TD
    Client([Frontend Client / API Consumer]) -->|POST /api/jobs/profile| Express[Node.js Express API Server\n:5000]
    Client -->|POST /api/jobs/upload| Express
    Client -->|GET /api/jobs/:id/stream| SSE[Server-Sent Events Stream]

    subgraph Backend Orchestration
        Express --> PyRunner[services/pythonRunner.js]
        PyRunner -->|CLI Spawn with HASH_SECRET| Engine[processor/main.py]
    end

    subgraph Python Processing Engine
        Engine --> Profile[profile_data.py (In-Memory Pre-Flight)]
        Engine --> Inspect[inspect_data.py (Schema & Quality)]
        Engine --> Detect[detect_pii.py (Regex & Heuristics)]
        Engine --> Clean[clean.py (Sanitization & Outliers)]
        Engine --> Anon[anonymize.py (HMAC-SHA256, Generalization, K-Anonymity)]
        Engine --> QC[quality_checks.py (QC-01 to QC-09 Reconciliations)]
    end

    subgraph Zero-Retention Database
        QC -->|Cleaned Anonymized Records| MongoRecords[(MongoDB 'records')]
        QC -->|Audit Logs & Metrics| MongoJobs[(MongoDB 'jobs')]
        Express -.->|finally: unlinkSync| TempCleanup[(Delete Staged Temp Files)]
    end

    SSE -.->|Real-time Stage Progress| Client
```

### Components:
- **`server/`**: Express API server handling authentication, upload staging, rate limiting, MongoDB persistence, SSE job streaming, and process orchestration.
- **`processor/`**: Core mathematical, statistical, and privacy transformation pipeline executing PII scanning, K-Anonymity generalization/suppression, HMAC masking, and data quality verification.
- **`docs/`**: API specifications and methodology references.

---

## 🔒 Privacy & Compliance Features

- **HMAC-SHA256 Pseudonymization**: Domain-separated salted cryptographic hashing for vehicle IDs, driver IDs, VINs, and MAC addresses.
- **Spatial & Temporal Generalization**: Configurable GPS coordinate rounding (0–4 decimal places) and 15-minute / 60-minute interval bucketing.
- **K-Anonymity Engine ($K \ge 3$)**:
  - `None`: Risk audit reporting without record removal.
  - `Suppress K`: Iterative generalization with row suppression for equivalence classes where $k < K$.
  - `Aggregate`: Cohort-level macro statistics with speed percentiles and zero raw microdata retention.
- **Zero Raw Data Retention**: Staged uploaded files are unlinked in memory and on disk immediately upon pipeline execution; raw PII is never stored in MongoDB.
- **Spreadsheet Formula Injection Defense**: Sanitizes leading `=, +, -, @, \t, \r` on all export outputs.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18+ & npm
- **Python**: v3.10+ (v3.12 recommended)
- **MongoDB**: v6.0+ (local instance or MongoDB Atlas)

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/harishramamoorth/Traffic-Data-Processing-Backend.git
cd Traffic-Data-Processing-Backend

# Install Node.js API dependencies
cd server
npm install
cd ..

# Set up Python environment & dependencies
cd processor
pip install -r requirements.txt
cd ..
```

### 2. Environment Configuration

Create a `.env` file in the root or `server/` directory:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/traffic_processor
HASH_SECRET=your_minimum_32_character_secret_key_here
PYTHON_PATH=python
CORS_ORIGIN=http://localhost:5173
PYTHON_PROCESS_TIMEOUT_MS=120000
```

### 3. Run the Backend Server

```bash
# Start API in development mode (with hot reloading)
npm run dev

# Or start directly
npm start
```

The API server will listen at `http://localhost:5000`.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Healthcheck and service status |
| `POST` | `/api/jobs/profile` | In-memory dataset pre-flight profiling (zero retention) |
| `POST` | `/api/jobs/upload` | Upload dataset and trigger privacy pipeline |
| `GET` | `/api/jobs/:id/stream` | Server-Sent Events (SSE) live progress & log feed |
| `GET` | `/api/jobs` | Paginated job history with audit summaries |
| `GET` | `/api/jobs/:id` | Full job audit report, QC results, and metrics |
| `GET` | `/api/jobs/:id/export` | Download processed results (.csv, .json, config) |

---

## 🧪 Testing

```bash
# Run Express API unit and integration tests
npm run test:server

# Run Python processor tests
npm run test:python

# Run processor on sample data
npm run test:processor
```
