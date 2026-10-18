"""
Detect PII Module
Identifies sensitive data columns containing Personally Identifiable Information (PII)
and quasi-identifiers using:
1. Multi-language/multi-style name keyword heuristics (plate, reg_no, vin, name, ssn, nid, passport, phone, mobile, email, ip, device, imei, mac, address, dob)
2. Value pattern inspections on sample up to 1000 rows (regex, Luhn for credit cards, email, phone, IP, IBAN, UUID, VIN)
3. Free-text scanning for embedded PII patterns
4. High-cardinality ID-like column detection (>90% unique strings, defaulting to PSEUDONYMIZE_HMAC)

Returns single-source-of-truth `pii_columns` with unified schema:
- name / column
- classification
- category
- confidence (0.0 to 1.0)
- confidence_level (CRITICAL | HIGH | MEDIUM | LOW)
- reason
- default_action / recommended_action
- sample_masked
- risk_badge (CRITICAL | HIGH | MEDIUM | LOW)
"""

import math
import re
from typing import Any, Dict, List, Optional
import pandas as pd


def check_luhn(val: str) -> bool:
    """Verifies credit card numbers using Luhn checksum algorithm."""
    digits = [int(c) for c in str(val) if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def detect_pii_columns(df: pd.DataFrame, config: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
    """
    Analyzes DataFrame columns and sample values to detect sensitive PII fields.
    Returns unified list of detected PII entries conforming to single source of truth.
    """
    detected_pii: List[Dict[str, Any]] = []

    if df.empty or len(df.columns) == 0:
        return detected_pii

    total_rows = len(df)
    sample_size = min(total_rows, 1000)

    # Keywords dictionary for multi-style and multi-lingual column names
    KEYWORD_CATEGORIES = {
        "plate_number": {
            "keywords": ["plate", "license_plate", "vehicle_plate", "reg_number", "reg_no", "registration", "licence", "license", "matricula"],
            "classification": "License Plate",
            "default_action": "PSEUDONYMIZE_HMAC",
            "risk_badge": "HIGH",
            "sample_masked": "ANON_8492XXXX"
        },
        "vin": {
            "keywords": ["vin", "vehicle_id", "chassis_number", "chassis_no", "serial_no"],
            "classification": "Vehicle Identification Number (VIN)",
            "default_action": "PSEUDONYMIZE_HMAC",
            "risk_badge": "HIGH",
            "sample_masked": "ANON_1HGCR2F8XXXX"
        },
        "ssn": {
            "keywords": ["ssn", "social_security", "national_id", "tax_id", "nid", "passport", "id_number", "driver_ssn"],
            "classification": "National ID / SSN",
            "default_action": "DROP_COLUMN",
            "risk_badge": "CRITICAL",
            "sample_masked": "***-**-****"
        },
        "driver_name": {
            "keywords": ["driver", "driver_name", "operator", "operator_name", "owner", "owner_name", "full_name", "first_name", "last_name", "name", "client_name"],
            "classification": "Full Name / Driver Identity",
            "default_action": "DROP_COLUMN",
            "risk_badge": "HIGH",
            "sample_masked": "[REDACTED_NAME]"
        },
        "phone": {
            "keywords": ["phone", "mobile", "cell", "contact", "tel", "telephone", "phone_number"],
            "classification": "Phone / Mobile Number",
            "default_action": "DROP_COLUMN",
            "risk_badge": "HIGH",
            "sample_masked": "[REDACTED_PHONE]"
        },
        "email": {
            "keywords": ["email", "mail", "e_mail", "email_address"],
            "classification": "Email Address",
            "default_action": "DROP_COLUMN",
            "risk_badge": "HIGH",
            "sample_masked": "[REDACTED_EMAIL]"
        },
        "ip_address": {
            "keywords": ["ip", "ip_address", "ipv4", "ipv6", "host_ip", "client_ip"],
            "classification": "IP Address (Network Quasi-ID)",
            "default_action": "DROP_COLUMN",
            "risk_badge": "HIGH",
            "sample_masked": "192.168.***.***"
        },
        "device_id": {
            "keywords": ["device", "imei", "mac", "mac_address", "device_id", "hardware_id"],
            "classification": "Device Identifier / IMEI",
            "default_action": "DROP_COLUMN",
            "risk_badge": "HIGH",
            "sample_masked": "ANON_DEV_XXXX"
        },
        "dob": {
            "keywords": ["dob", "birth_date", "date_of_birth", "birthday"],
            "classification": "Date of Birth",
            "default_action": "DROP_COLUMN",
            "risk_badge": "HIGH",
            "sample_masked": "[REDACTED_DOB]"
        },
        "address": {
            "keywords": ["address", "street_address", "home_address", "billing_address", "residence"],
            "classification": "Physical Street Address",
            "default_action": "REDACT",
            "risk_badge": "HIGH",
            "sample_masked": "[REDACTED_ADDRESS]"
        },
        "coordinates": {
            "keywords": ["latitude", "longitude", "lat", "lon", "lng", "long", "gps", "coord", "coords"],
            "classification": "Geographic Coordinates (GPS)",
            "default_action": "GENERALIZE_SPATIAL",
            "risk_badge": "MEDIUM",
            "sample_masked": "40.71, -74.01 (~1.1 km)"
        }
    }

    # Value Regex Patterns
    REGEX_PATTERNS = {
        "ssn": re.compile(r"^\d{3}-\d{2}-\d{4}$"),
        "email": re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"),
        "phone": re.compile(r"^(?:\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$|^\d{3}[-.\s]\d{4}$|^\d{10,12}$"),
        "ip_address": re.compile(r"^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"),
        "uuid": re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"),
        "vin": re.compile(r"^[A-HJ-NPR-Z0-9]{17}$"),
        "plate_number": re.compile(r"^[A-Z0-9]{2,4}[-\s]?[A-Z0-9]{3,5}$")
    }

    # Free-text embedded PII regexes
    EMBEDDED_PHONE = re.compile(r"\+\d{1,4}(?:[\s.-]*\d{1,4}){2,6}\b|\(?\b\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\b|\b\d{3}[-.\s]\d{4}\b|\b\d{10,}\b")
    EMBEDDED_SSN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
    EMBEDDED_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")

    for col in df.columns:
        col_raw = str(col)
        col_clean = col_raw.lower().strip().replace(" ", "_").replace("-", "_")

        matched_category: Optional[str] = None
        matched_classification: Optional[str] = None
        default_action: str = "MASK"
        risk_badge: str = "MEDIUM"
        sample_masked: str = "[REDACTED]"
        reasons: List[str] = []
        confidence_score: float = 0.0

        series = df[col]
        non_null_series = series.dropna()
        unique_count = int(non_null_series.nunique()) if len(non_null_series) > 0 else 0
        uniqueness_ratio = unique_count / len(non_null_series) if len(non_null_series) > 0 else 0

        # Sample values for pattern detection
        sample_values = [str(v).strip() for v in non_null_series.head(sample_size).tolist() if str(v).strip() and str(v).lower() not in ["nan", "none", "null"]]

        # 0. Check if column is datetime
        is_datetime = any(dt in col_clean for dt in ["time", "timestamp", "datetime", "date", "created_at", "updated_at"])
        if not is_datetime and sample_values:
            try:
                sample_dt = pd.to_datetime(sample_values[:50], format="mixed", errors="coerce")
                if sample_dt.notna().sum() >= max(3, int(len(sample_values[:50]) * 0.8)):
                    is_datetime = True
            except Exception:
                pass

        # 1. Coordinate specific name check (exact keywords to avoid false matches)
        is_coord = False
        if col_clean in ["latitude", "lat"] or col_clean.startswith("lat_") or col_clean.endswith("_lat"):
            matched_category = "coordinates"
            matched_classification = "Geographic Latitude (GPS)"
            default_action = "GENERALIZE_SPATIAL"
            risk_badge = "MEDIUM"
            sample_masked = "40.71 (~1.1 km)"
            reasons.append("Column name indicates geographic latitude")
            confidence_score = 0.95
            is_coord = True
        elif col_clean in ["longitude", "lon", "lng", "long"] or col_clean.startswith("lon_") or col_clean.endswith("_lon") or col_clean.endswith("_lng"):
            matched_category = "coordinates"
            matched_classification = "Geographic Longitude (GPS)"
            default_action = "GENERALIZE_SPATIAL"
            risk_badge = "MEDIUM"
            sample_masked = "-74.01 (~1.1 km)"
            reasons.append("Column name indicates geographic longitude")
            confidence_score = 0.95
            is_coord = True

        is_free_text_col = any(
            ft in col_clean.split("_") or ft == col_clean
            for ft in ["notes", "note", "comment", "comments", "remark", "remarks", "description", "text", "message"]
        )
        is_id_name = any(
            id_kw in col_clean.split("_") or id_kw == col_clean
            for id_kw in ["id", "uuid", "guid", "key", "ref", "hash", "record", "tracking"]
        ) or col_clean.endswith("_id") or col_clean.startswith("id_")

        # 2. General Keyword Matching (skip if datetime or coordinate)
        if not is_coord and not is_datetime:
            if is_free_text_col:
                matched_category = "free_text_pii"
                matched_classification = "Free-Text with Embedded PII"
                default_action = "REDACT"
                risk_badge = "HIGH"
                sample_masked = "...[REDACTED_PHONE]..."
                reasons.append(f"Free-text column for embedded PII scanning & redaction ('{col_clean}')")
                confidence_score = 0.90
            elif is_id_name and not any(kw in col_clean for kw in ["plate", "ssn", "vin", "driver"]):
                matched_category = "identifier"
                matched_classification = "High-Cardinality Identifier (ID)"
                default_action = "PSEUDONYMIZE_HMAC"
                risk_badge = "MEDIUM"
                sample_masked = "ANON_7c9f8a12e4b0"
                reasons.append(f"Column name indicates unique tracking record identifier")
                confidence_score = 0.95
            else:
                for cat_key, cat_meta in KEYWORD_CATEGORIES.items():
                    if cat_key == "coordinates":
                        continue
                    for kw in cat_meta["keywords"]:
                        # Exact token or delimiter-bounded match
                        tokens = col_clean.split("_")
                        if kw == col_clean or kw in tokens or f"_{kw}" in col_clean or f"{kw}_" in col_clean:
                            matched_category = cat_key
                            matched_classification = cat_meta["classification"]
                            default_action = cat_meta["default_action"]
                            risk_badge = cat_meta["risk_badge"]
                            sample_masked = cat_meta["sample_masked"]
                            reasons.append(f"Column name keyword match ('{kw}')")
                            confidence_score = 0.88
                            break
                    if matched_category:
                        break

        # 3. Value Pattern Inspection (up to 1000 sample values, skip if datetime or coord)
        if sample_values and not is_coord and not is_datetime:
            # Check for Credit Card (Luhn)
            luhn_matches = sum(check_luhn(v) for v in sample_values if any(c.isdigit() for c in v))
            if luhn_matches >= max(2, int(len(sample_values) * 0.15)):
                matched_category = "credit_card"
                matched_classification = "Credit / Debit Card Number"
                default_action = "DROP_COLUMN"
                risk_badge = "CRITICAL"
                sample_masked = "****-****-****-1234"
                reasons.append(f"Value Luhn checksum match ({luhn_matches} card numbers)")
                confidence_score = 0.99

            if not matched_category or matched_category in ["ssn", "email", "phone", "ip_address", "vin", "plate_number"]:
                for pat_name, regex in REGEX_PATTERNS.items():
                    # For plate_number, skip if unique count <= 10 or if already detected as identifier
                    if pat_name == "plate_number" and (unique_count <= 10 or is_id_name):
                        continue
                    matches = sum(bool(regex.search(v)) for v in sample_values)
                    ratio = matches / len(sample_values) if sample_values else 0
                    if ratio >= 0.25:
                        cat_info = KEYWORD_CATEGORIES.get(pat_name, {})
                        if matched_category == pat_name:
                            confidence_score = max(confidence_score, 0.98)
                            reasons.append(f"Value regex match ({int(ratio * 100)}% conformity)")
                        elif not matched_category:
                            matched_category = pat_name
                            matched_classification = cat_info.get("classification", pat_name.title())
                            default_action = cat_info.get("default_action", "DROP_COLUMN")
                            risk_badge = cat_info.get("risk_badge", "HIGH")
                            sample_masked = cat_info.get("sample_masked", "[REDACTED]")
                            reasons.append(f"Value regex pattern match ({int(ratio * 100)}% conformity)")
                            confidence_score = 0.92
                        break

        # 4. Free-Text Column Scanning (for embedded PII in notes, comments, descriptions)
        if not matched_category and sample_values and not is_datetime and not is_coord:
            avg_len = sum(len(v) for v in sample_values) / len(sample_values)
            has_spaces = any(" " in v for v in sample_values)
            if avg_len >= 12 and has_spaces:
                phone_embedded = sum(bool(EMBEDDED_PHONE.search(v)) for v in sample_values)
                ssn_embedded = sum(bool(EMBEDDED_SSN.search(v)) for v in sample_values)
                email_embedded = sum(bool(EMBEDDED_EMAIL.search(v)) for v in sample_values)
                total_embedded = phone_embedded + ssn_embedded + email_embedded
                if total_embedded > 0:
                    matched_category = "free_text_pii"
                    matched_classification = "Free-Text with Embedded PII"
                    default_action = "REDACT"
                    risk_badge = "HIGH"
                    sample_masked = "...[REDACTED_PHONE]..."
                    reasons.append(f"Free-text contains embedded sensitive data ({total_embedded} detected in sample)")
                    confidence_score = 0.90

        # 5. High-Cardinality ID-like Column Detection (Item 12c & 14)
        # >90% unique strings, unknown ID-like columns default to PSEUDONYMIZE_HMAC, never Keep
        if not matched_category and sample_values and not is_datetime and not is_coord:
            is_string_like = all(isinstance(v, str) for v in sample_values)
            if is_string_like and uniqueness_ratio >= 0.90 and total_rows >= 10:
                matched_category = "identifier"
                matched_classification = "High-Cardinality Identifier (ID)"
                default_action = "PSEUDONYMIZE_HMAC"
                risk_badge = "MEDIUM"
                sample_masked = "ANON_7c9f8a12e4b0"
                reasons.append(f"High-cardinality ID column ({round(uniqueness_ratio * 100, 1)}% unique values)")
                confidence_score = 0.85 if is_id_name else 0.75

        # If matched, append to detected_pii
        if matched_category:
            meta = KEYWORD_CATEGORIES.get(matched_category, {})
            final_class = matched_classification or meta.get("classification", matched_category.replace("_", " ").title())
            final_action = default_action or meta.get("default_action", "DROP_COLUMN")
            final_risk = risk_badge or meta.get("risk_badge", "HIGH")
            final_sample = sample_masked or meta.get("sample_masked", "[REDACTED]")

            # Confidence Level
            if confidence_score >= 0.95 or final_risk == "CRITICAL":
                conf_level = "CRITICAL" if final_risk == "CRITICAL" else "HIGH"
            elif confidence_score >= 0.80:
                conf_level = "HIGH"
            elif confidence_score >= 0.65:
                conf_level = "MEDIUM"
            else:
                conf_level = "LOW"

            reason_str = "; ".join(reasons) if reasons else "Detected via heuristic analysis"

            detected_pii.append({
                "name": col_raw,
                "column": col_raw,
                "classification": final_class,
                "category": matched_category,
                "confidence": round(confidence_score, 2),
                "confidence_level": conf_level,
                "reason": reason_str,
                "default_action": final_action,
                "recommended_action": final_action,
                "sample_masked": final_sample,
                "risk_badge": final_risk
            })

    return detected_pii
