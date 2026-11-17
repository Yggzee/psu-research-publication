#!/usr/bin/env python3
"""
Automated Programmatic Verification Script for Chapter 2 Deliverables
Verifies both manuscript/Chapter_2.md and manuscript/Chapter_2.docx against
the thesis acceptance criteria defined in ORIGINAL_REQUEST.md.
"""

import os
import sys
import re
import math
import argparse
from typing import List, Dict, Tuple, Any

try:
    import docx
    from docx.shared import Inches, Pt
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

# ==============================================================================
# CONFIGURATION & CONSTANTS
# ==============================================================================

# Required Citation Mappings per Section & SOO
# Each slot is a list of acceptable aliases / author keys to support dual reconciliation
REQUIRED_CITATIONS = {
    "Related Literature": {
        "SOO1": {
            "foreign": [
                ["Abramo"],
                ["Huang"]
            ],
            "local": [
                ["Rogayan", "Corpuz"]
            ]
        },
        "SOO2": {
            "foreign": [
                ["Kim"],       # Kim & Owen-Smith (2021)
                ["Santini"]
            ],
            "local": [
                ["Salcedo", "Yabut"]  # Salcedo (2026) / Yabut et al. (2026)
            ]
        },
        "SOO3": {
            "foreign": [
                ["Raman", "R"],  # R (2024) / Raman et al. (2024)
                ["Sianes"]
            ],
            "local": [
                ["Palompon", "Cordova"]  # Palompon et al. (2024) / Cordova (2024)
            ]
        },
        "SOO4": {
            "foreign": [
                ["Mishra"],
                ["Natarajan"]
            ],
            "local": [
                ["Bautista", "Olipas"]  # Bautista (2022) / Olipas et al. (2022)
            ]
        },
        "SOO5": {
            "foreign": [
                ["Borhanifard", "Salomón", "Salomon"],
                ["Kumar", "Neelu"]
            ],
            "local": [
                ["Ilustrisimo"]
            ]
        }
    },
    "Related Studies": {
        "SOO1": {
            "foreign": [
                ["Makiria"],
                ["Labib"]
            ],
            "local": [
                ["Rogayan", "Corpuz"]
            ]
        },
        "SOO2": {
            "foreign": [
                ["Bogaard"],
                ["Kim"]
            ],
            "local": [
                ["Salcedo", "Yabut"]
            ]
        },
        "SOO3": {
            "foreign": [
                ["Hussein"],
                ["MacDonald"]
            ],
            "local": [
                ["Palompon", "Cordova"]
            ]
        },
        "SOO4": {
            "foreign": [
                ["Boa-Nova"],
                ["Taia"]
            ],
            "local": [
                ["Bautista", "Olipas"]
            ]
        },
        "SOO5": {
            "foreign": [
                ["Costa"],
                ["Krasniqi"]
            ],
            "local": [
                ["Ilustrisimo"]
            ]
        }
    }
}

PROHIBITED_TERMS_BODY = [
    (r"\bAgile\b", "Prohibited software methodology: 'Agile' (must be Iterative Waterfall Model)"),
    (r"\bScrum\b", "Prohibited agile methodology: 'Scrum'"),
    (r"\bSprint\b", "Prohibited agile concept: 'Sprint'"),
    (r"\bSprints\b", "Prohibited agile concept: 'Sprints'"),
    (r"\bKanban\b", "Prohibited agile concept: 'Kanban'"),
    (r"\bExtreme Programming\b", "Prohibited agile concept: 'Extreme Programming'"),
    (r"\bFaculty Roster\b", "Prohibited terminology: 'Faculty Roster' (must be 'Researchers')"),
    (r"\bInstitutional Faculty Roster\b", "Prohibited terminology: 'Institutional Faculty Roster' (must be 'Researchers')"),
    (r"\bFaculty Researchers\b", "Prohibited terminology: 'Faculty Researchers' (must be 'Researchers')"),
    (r"\bEmployee ID\b", "Prohibited terminology: 'Employee ID' (must be 'Instructor ID')"),
    (r"\bSDG Radar\b", "Prohibited terminology: 'SDG Radar' (must be 'SDG Alignment')"),
    (r"\bSDG Matrix\b", "Prohibited terminology: 'SDG Matrix' (must be 'SDG Alignment')")
]

PROHIBITED_INSTITUTIONS_ALL = [
    (r"\b(University of the Philippines|UP Diliman|UP Los Baños|UP Manila|UP Visayas)\b",
     "Prohibited institution in local context: 'University of the Philippines' (must cite Philippine State Universities)")
]

REQUIRED_INVARIANTS = [
    (r"\bResearchers\b|\bResearcher\b", "Researchers / Researcher"),
    (r"\bInstructor ID\b", "Instructor ID"),
    (r"\bResearch Coordinator\b", "Research Coordinator"),
    (r"\bIterative Waterfall Model\b", "Iterative Waterfall Model"),
    (r"\bSDG Alignment\b|\bSDG Goals\b", "SDG Alignment / SDG Goals"),
    (r"\bPublications\b", "Publications")
]

REQUIRED_STATE_UNIVERSITIES = [
    (r"\b(President Ramon Magsaysay State University|PRMSU)\b", "PRMSU"),
    (r"\b(Philippine Normal University|PNU)\b", "PNU"),
    (r"\b(Cebu Technological University|CTU)\b", "CTU"),
    (r"\b(Cebu Normal University|CNU)\b", "CNU"),
    (r"\b(Nueva Ecija University of Science and Technology|NEUST)\b", "NEUST")
]

EMOJI_PATTERN = re.compile(
    r"[\U00010000-\U0010ffff\u2600-\u27bf\ud83c-\ud83e]",
    flags=re.UNICODE
)

ROBOTIC_CLICHES = [
    r"\bdelve\b", r"\btapestry\b", r"\btestament\b", r"\bbeacon\b",
    r"\bpivotal\b", r"\bseamless\b", r"\bparamount\b", r"\bcrucial role\b",
    r"\bfosters\b", r"\brevolutionize\b"
]

# ==============================================================================
# VERIFICATION ENGINE
# ==============================================================================

class VerificationResult:
    def __init__(self, target_name: str):
        self.target_name = target_name
        self.passed_checks = 0
        self.failed_checks = 0
        self.warnings = 0
        self.errors: List[str] = []
        self.warning_msgs: List[str] = []
        self.info_msgs: List[str] = []

    def log_pass(self, check_name: str, detail: str = ""):
        self.passed_checks += 1
        self.info_msgs.append(f"[PASS] {check_name}: {detail}")

    def log_fail(self, check_name: str, detail: str):
        self.failed_checks += 1
        msg = f"[FAIL] {check_name}: {detail}"
        self.errors.append(msg)
        self.info_msgs.append(msg)

    def log_warning(self, check_name: str, detail: str):
        self.warnings += 1
        msg = f"[WARN] {check_name}: {detail}"
        self.warning_msgs.append(msg)
        self.info_msgs.append(msg)

    def print_summary(self):
        print(f"\n==================================================")
        print(f"VERIFICATION SUMMARY: {self.target_name}")
        print(f"==================================================")
        for msg in self.info_msgs:
            print(msg)
        print(f"--------------------------------------------------")
        print(f"Passed: {self.passed_checks} | Failed: {self.failed_checks} | Warnings: {self.warnings}")
        if self.failed_checks == 0:
            print(f">>> OVERALL STATUS: ALL CHECKS PASSED <<<")
        else:
            print(f">>> OVERALL STATUS: VERIFICATION FAILED ({self.failed_checks} errors) <<<")
        print(f"==================================================\n")


def parse_markdown_subsections(md_text: str) -> Dict[str, Dict[str, List[str]]]:
    """
    Parses Markdown into structured sections and subsections.
    Returns: {
        'Related Literature': { 'SOO1': [p1, p2, p3], 'SOO2': [...], ... },
        'Related Studies': { 'SOO1': [p1, p2, p3], 'SOO2': [...], ... }
    }
    """
    sections: Dict[str, Dict[str, List[str]]] = {
        "Related Literature": {},
        "Related Studies": {}
    }
    
    current_major = None
    current_soo = None
    
    lines = md_text.split("\n")
    current_paragraphs: List[str] = []
    
    def flush_paragraph():
        if current_paragraphs:
            if current_major and current_soo:
                p_text = " ".join([l.strip() for l in current_paragraphs if l.strip()]).strip()
                if p_text and not p_text.startswith("#"):
                    sections[current_major].setdefault(current_soo, []).append(p_text)
            current_paragraphs.clear()

    for line in lines:
        stripped = line.strip()
        # Detect Major Sections
        if re.search(r"^#+\s*(?:2\.1\s*)?Related Literature", stripped, re.IGNORECASE):
            flush_paragraph()
            current_major = "Related Literature"
            current_soo = None
            continue
        elif re.search(r"^#+\s*(?:2\.2\s*)?Related Studies", stripped, re.IGNORECASE):
            flush_paragraph()
            current_major = "Related Studies"
            current_soo = None
            continue
        elif re.search(r"^#+\s*(?:2\.3\s*)?Synthesis", stripped, re.IGNORECASE) or re.search(r"^#+\s*REFERENCES", stripped, re.IGNORECASE):
            flush_paragraph()
            current_major = None
            current_soo = None
            continue

        # Detect SOO Subsections
        soo_match = re.search(r"^#+\s*.*?(SOO\s*#?(\d)|Objective\s*No\.?\s*(\d))", stripped, re.IGNORECASE)
        if soo_match and current_major:
            flush_paragraph()
            num = soo_match.group(2) or soo_match.group(3)
            current_soo = f"SOO{num}"
            continue

        if stripped == "":
            flush_paragraph()
        else:
            if not stripped.startswith("#"):
                current_paragraphs.append(stripped)

    flush_paragraph()
    return sections


def verify_content_rules(full_text: str, body_text: str, result: VerificationResult, label: str):
    # 1. Emoji Absence (entire text)
    emojis_found = EMOJI_PATTERN.findall(full_text)
    if emojis_found:
        result.log_fail("Emoji Check", f"Found {len(emojis_found)} emojis in {label}: {emojis_found[:5]}")
    else:
        result.log_pass("Emoji Check", f"Zero emojis detected across {label}")

    # 2. Prohibited Terms (checked in body text to enforce methodology without tripping on published reference titles)
    for pattern, description in PROHIBITED_TERMS_BODY:
        matches = re.findall(pattern, body_text, re.IGNORECASE)
        if matches:
            result.log_fail("Prohibited Term Check", f"Found '{matches[0]}' in {label} body - {description}")
        else:
            result.log_pass("Prohibited Term Check", f"No occurrences of '{pattern}' in {label} body")

    # 3. Prohibited Institutions (checked across entire document)
    for pattern, description in PROHIBITED_INSTITUTIONS_ALL:
        matches = re.findall(pattern, full_text, re.IGNORECASE)
        if matches:
            result.log_fail("Prohibited Institution Check", f"Found '{matches[0]}' in {label} - {description}")
        else:
            result.log_pass("Prohibited Institution Check", f"No occurrences of '{pattern}' in {label}")

    # 4. Required State Universities Presence
    for pattern, name in REQUIRED_STATE_UNIVERSITIES:
        if re.search(pattern, full_text, re.IGNORECASE):
            result.log_pass("Required State University", f"Verified presence of '{name}' in {label}")
        else:
            result.log_warning("Required State University", f"Could not find explicit mention of '{name}' in {label}")

    # 5. Required Terminology Invariants
    for pattern, name in REQUIRED_INVARIANTS:
        if re.search(pattern, full_text, re.IGNORECASE):
            result.log_pass("Required Term Invariant", f"Verified presence of '{name}' in {label}")
        else:
            result.log_fail("Required Term Invariant", f"Missing required term '{name}' in {label}")

    # 6. Citation Recency (All >= 2021)
    year_matches = re.finditer(r"\b(19\d{2}|20\d{2})\b", full_text)
    pre_2021_years = []
    for m in year_matches:
        year = int(m.group(1))
        start_idx = max(0, m.start() - 30)
        end_idx = min(len(full_text), m.end() + 30)
        snippet = full_text[start_idx:end_idx]
        # Exclude standard ISO standard designations (e.g., ISO/IEC 25010:2011) or statutory orders
        if "25010" in snippet or "ISO" in snippet or "IEC" in snippet or "NBC" in snippet or "CMO" in snippet:
            continue
        if year < 2021 and year > 1950:
            pre_2021_years.append((year, snippet.strip()))

    if pre_2021_years:
        sample = pre_2021_years[:3]
        result.log_fail("Citation Recency (>= 2021)", f"Found {len(pre_2021_years)} pre-2021 year citations: {sample}")
    else:
        result.log_pass("Citation Recency (>= 2021)", f"100% of citations in {label} are >= 2021 (zero pre-2021 citations)")


def analyze_academic_tone_and_burstiness(paragraphs: List[str], result: VerificationResult, label: str):
    """
    Computes sentence length statistics and evaluates burstiness and readability.
    """
    sentence_lengths = []
    cliche_counts = 0
    total_words = 0

    for p in paragraphs:
        sentences = [s.strip() for s in re.split(r"[.!?]+", p) if len(s.strip().split()) > 3]
        for s in sentences:
            words = s.split()
            word_count = len(words)
            sentence_lengths.append(word_count)
            total_words += word_count

        for c in ROBOTIC_CLICHES:
            if re.search(c, p, re.IGNORECASE):
                cliche_counts += 1

    if not sentence_lengths:
        result.log_fail("Readability Analysis", f"No valid sentences extracted from {label}")
        return

    mean_len = sum(sentence_lengths) / len(sentence_lengths)
    variance = sum((x - mean_len) ** 2 for x in sentence_lengths) / len(sentence_lengths)
    std_dev = math.sqrt(variance)
    min_len = min(sentence_lengths)
    max_len = max(sentence_lengths)

    burstiness_rating = "High" if std_dev >= 8.0 else ("Moderate" if std_dev >= 5.0 else "Low")
    
    if std_dev >= 8.0:
        result.log_pass(
            "Academic Burstiness Metric",
            f"{label} has {len(sentence_lengths)} sentences (Total words: {total_words}). "
            f"Mean length: {mean_len:.1f} words, StdDev: {std_dev:.1f} (Rating: {burstiness_rating}), "
            f"Range: [{min_len} to {max_len}] words"
        )
    else:
        result.log_warning(
            "Academic Burstiness Metric",
            f"{label} StdDev is {std_dev:.1f} words (Target >= 8.0 for high burstiness). "
            f"Mean length: {mean_len:.1f} words"
        )

    if cliche_counts == 0:
        result.log_pass("Anti-Robotic Tone", f"Zero AI robotic clichés found in {label}")
    else:
        result.log_warning("Anti-Robotic Tone", f"Found {cliche_counts} instances of robotic/AI clichés in {label}")


def verify_markdown_document(md_path: str) -> VerificationResult:
    res = VerificationResult(f"Markdown File ({md_path})")
    if not os.path.exists(md_path):
        res.log_fail("File Existence", f"File does not exist: {md_path}")
        return res

    with open(md_path, "r", encoding="utf-8", errors="ignore") as f:
        md_text = f.read()

    res.log_pass("File Existence", f"Found {md_path} ({len(md_text)} characters, {len(md_text.splitlines())} lines)")

    # Separate body from references
    parts = re.split(r"^#+\s*REFERENCES", md_text, flags=re.MULTILINE | re.IGNORECASE)
    body_text = parts[0]

    # Content checks (Emoji, prohibited terms, invariants, recency)
    verify_content_rules(md_text, body_text, res, "Chapter_2.md")

    # Structure & Paragraph counts
    parsed = parse_markdown_subsections(md_text)
    total_paragraphs = 0
    all_body_paragraphs = []

    for major in ["Related Literature", "Related Studies"]:
        soo_dict = parsed.get(major, {})
        for soo_idx in range(1, 6):
            soo_key = f"SOO{soo_idx}"
            p_list = soo_dict.get(soo_key, [])
            p_count = len(p_list)
            total_paragraphs += p_count
            all_body_paragraphs.extend(p_list)

            if p_count == 3:
                res.log_pass(f"Paragraph Count ({major} - {soo_key})", "Exactly 3 paragraphs present")
            else:
                res.log_fail(f"Paragraph Count ({major} - {soo_key})", f"Expected 3 paragraphs, found {p_count}")

            # Verify citations in this subsection
            expected = REQUIRED_CITATIONS[major][soo_key]
            combined_soo_text = " ".join(p_list)

            # Check foreign
            for slot_idx, f_aliases in enumerate(expected["foreign"], 1):
                found_alias = any(alias.lower() in combined_soo_text.lower() for alias in f_aliases)
                if found_alias:
                    res.log_pass(f"Citation Verification ({major} - {soo_key})", f"Found Foreign author slot {slot_idx}: {f_aliases}")
                else:
                    res.log_fail(f"Citation Verification ({major} - {soo_key})", f"Missing Foreign author slot {slot_idx} matching {f_aliases}")

            # Check local
            for slot_idx, l_aliases in enumerate(expected["local"], 1):
                found_local = any(alias.lower() in combined_soo_text.lower() for alias in l_aliases)
                if found_local:
                    res.log_pass(f"Citation Verification ({major} - {soo_key})", f"Found Local author: {l_aliases}")
                else:
                    res.log_fail(f"Citation Verification ({major} - {soo_key})", f"Missing Local author matching {l_aliases}")

    if total_paragraphs == 30:
        res.log_pass("Total Synthesized Paragraphs", "Exactly 30 paragraphs synthesized across all 10 subsections (15 RRL + 15 RRS)")
    else:
        res.log_fail("Total Synthesized Paragraphs", f"Expected exactly 30 paragraphs, but found {total_paragraphs}")

    # Readability and Burstiness
    analyze_academic_tone_and_burstiness(all_body_paragraphs, res, "Chapter_2.md Body")

    return res


def verify_docx_document(docx_path: str) -> VerificationResult:
    res = VerificationResult(f"Word Document ({docx_path})")
    if not os.path.exists(docx_path):
        res.log_fail("File Existence", f"File does not exist: {docx_path}")
        return res

    if not DOCX_AVAILABLE:
        res.log_fail("Dependency Check", "python-docx is not installed in the Python environment")
        return res

    try:
        doc = docx.Document(docx_path)
    except Exception as e:
        res.log_fail("DOCX Loading", f"Failed to load docx file: {e}")
        return res

    res.log_pass("File Existence", f"Successfully loaded {docx_path} ({len(doc.paragraphs)} paragraphs)")

    # 1. Page Margins and Setup
    if doc.sections:
        s = doc.sections[0]
        left_m = s.left_margin.inches if s.left_margin else 0.0
        right_m = s.right_margin.inches if s.right_margin else 0.0
        top_m = s.top_margin.inches if s.top_margin else 0.0
        bottom_m = s.bottom_margin.inches if s.bottom_margin else 0.0

        if abs(left_m - 1.5) <= 0.05:
            res.log_pass("Page Margins (Left)", f"Left margin is {left_m:.2f} inches (PSU 1.5-inch binding standard)")
        else:
            res.log_fail("Page Margins (Left)", f"Left margin is {left_m:.2f} inches (expected 1.5 inches)")

        if abs(right_m - 1.0) <= 0.05 and abs(top_m - 1.0) <= 0.05 and abs(bottom_m - 1.0) <= 0.05:
            res.log_pass("Page Margins (Top/Right/Bottom)", f"Standard 1.0 inch margins confirmed (T={top_m}, R={right_m}, B={bottom_m})")
        else:
            res.log_warning("Page Margins (Top/Right/Bottom)", f"Margins: Top={top_m}, Right={right_m}, Bottom={bottom_m} (expected 1.0 inch each)")

    # 2. Typography and Content Rules
    body_paragraphs_text = []
    full_paragraphs_text = []
    past_references = False

    for p in doc.paragraphs:
        txt = p.text.strip()
        if not txt:
            continue
        full_paragraphs_text.append(txt)
        if "REFERENCES" in txt.upper():
            past_references = True
        if not past_references:
            body_paragraphs_text.append(txt)

    full_text = "\n".join(full_paragraphs_text)
    body_text = "\n".join(body_paragraphs_text)
    verify_content_rules(full_text, body_text, res, "Chapter_2.docx")

    # 3. Check Body Paragraph Font
    sample_body = [p for p in doc.paragraphs if len(p.text.split()) > 20]
    font_issues = 0
    for p in sample_body[:10]:
        for r in p.runs:
            if r.font.name and "Times New Roman" not in r.font.name:
                font_issues += 1
    if font_issues == 0:
        res.log_pass("Typography (Font Name)", "Times New Roman consistently applied across sample body paragraphs")
    else:
        res.log_warning("Typography (Font Name)", f"Found {font_issues} runs with non-Times New Roman font in sample paragraphs")

    return res


# ==============================================================================
# MAIN RUNNER
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Chapter 2 Deliverables Verification Script")
    parser.add_argument("--md", default="manuscript/Chapter_2.md", help="Path to Chapter_2.md")
    parser.add_argument("--docx", default="manuscript/Chapter_2.docx", help="Path to Chapter_2.docx")
    args = parser.parse_args()

    print("==================================================")
    print("STARTING CHAPTER 2 DELIVERABLES VERIFICATION")
    print("==================================================")

    md_res = verify_markdown_document(args.md)
    docx_res = verify_docx_document(args.docx)

    md_res.print_summary()
    docx_res.print_summary()

    total_failures = md_res.failed_checks + docx_res.failed_checks
    if total_failures > 0:
        print(f"VERIFICATION FAILED: Total {total_failures} errors encountered.")
        sys.exit(1)
    else:
        print("VERIFICATION SUCCESS: All criteria verified successfully.")
        sys.exit(0)

if __name__ == "__main__":
    main()
