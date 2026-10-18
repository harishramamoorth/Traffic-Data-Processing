# 📚 Traffic Data Processor — Documentation Hub

Welcome to the technical documentation for the Traffic Data Processor platform.

## Architecture Highlights
- **Client (Frontend)**: React 18 with Vite, React Router, Axios, dark-mode design system, responsive layouts, sticky table headers, loading skeletons, and empty states.
- **Server (Backend)**: Express.js REST API, Mongoose ORM, Helmet security headers, CORS with strict origin, Express Rate Limiting, Multer 50MB validation, Morgan logging, and child-process Python execution with timeout and stderr capture.
- **Processor (Data Engine)**: Config-driven modular Python pipeline (`config.yaml`) with pandas and numpy, HMAC-SHA256 plate pseudonymization, 15-minute floor bucketing, 2-decimal spatial generalization, non-clamping outlier flagging, and automated reconciliation (QC-01 to QC-08).

## Documentation Sitemap
1. [Privacy Decisions & Rationale](file:///c:/Users/haris/OneDrive/Pictures/Desktop/project/traffic-data-processor/docs/PRIVACY_DECISIONS.md) — Detailed justifications, risks, and trade-offs for each privacy method.
2. [Data Dictionary](file:///c:/Users/haris/OneDrive/Pictures/Desktop/project/traffic-data-processor/docs/DATA_DICTIONARY.md) — Raw schema vs. anonymized schema vs. rejection audit log.
3. [Processing Pipeline & Lifecycle](file:///c:/Users/haris/OneDrive/Pictures/Desktop/project/traffic-data-processor/docs/PROCESSING_STEPS.md) — Detailed breakdown of the 5 sequential transformation stages.
