#!/usr/bin/env python3
"""
Chapter 2 DOCX Builder
Converts manuscript/Chapter_2.md into a fully formatted Microsoft Word document
(manuscript/Chapter_2.docx) adhering to PSU Institutional Capstone Formatting Guidelines:
- Standard Letter (8.5 x 11.0 inches)
- Left margin: 1.5 inches (binding)
- Right, Top, Bottom margins: 1.0 inch
- Typography: Times New Roman, 12 pt font size, fully justified text alignment
- Spacing: Double-spaced body text (2.0) with standard 0.5 inch paragraph first-line indention
- References: Center bold heading, APA 7th hanging indent (0.5 inch)
"""

import os
import re
import sys
import argparse
import docx
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def set_cell_borders(cell, top=None, bottom=None, left=None, right=None):
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    borders = {'top': top, 'bottom': bottom, 'left': left, 'right': right}
    for b_name, b_val in borders.items():
        if b_val:
            node = OxmlElement(f'w:{b_name}')
            for k, v in b_val.items():
                node.set(qn(f'w:{k}'), str(v))
            tcBorders.append(node)
        else:
            node = OxmlElement(f'w:{b_name}')
            node.set(qn('w:val'), 'none')
            tcBorders.append(node)
    tcPr.append(tcBorders)

def add_styled_run(paragraph, text, font_name="Times New Roman", font_size_pt=12, bold=False, italic=False):
    run = paragraph.add_run(text)
    run.font.name = font_name
    run.font.size = Pt(font_size_pt)
    run.bold = bold
    run.italic = italic
    
    rPr = run._r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:ascii'), font_name)
    rFonts.set(qn('w:hAnsi'), font_name)
    rFonts.set(qn('w:cs'), font_name)
    rPr.append(rFonts)
    return run

def parse_inline_formatting(paragraph, text, base_font="Times New Roman", base_size=12, base_bold=False, base_italic=False):
    """
    Parses **bold** and *italic* within markdown lines and appends runs.
    """
    pattern = re.compile(r"(\*\*.*?\*\*|\*.*?\*|___.*?___|__.*?__|[^*_]+)")
    tokens = pattern.findall(text)
    for token in tokens:
        if token.startswith("**") and token.endswith("**"):
            add_styled_run(paragraph, token[2:-2], base_font, base_size, bold=True, italic=base_italic)
        elif token.startswith("__") and token.endswith("__"):
            add_styled_run(paragraph, token[2:-2], base_font, base_size, bold=True, italic=base_italic)
        elif token.startswith("*") and token.endswith("*"):
            add_styled_run(paragraph, token[1:-1], base_font, base_size, bold=base_bold, italic=True)
        elif token.startswith("_") and token.endswith("_"):
            add_styled_run(paragraph, token[1:-1], base_font, base_size, bold=base_bold, italic=True)
        else:
            add_styled_run(paragraph, token, base_font, base_size, bold=base_bold, italic=base_italic)

def convert_md_to_docx(md_path: str, docx_path: str, double_spaced: bool = True):
    if not os.path.exists(md_path):
        raise FileNotFoundError(f"Source markdown file not found: {md_path}")

    with open(md_path, "r", encoding="utf-8", errors="ignore") as f:
        md_content = f.read()

    doc = docx.Document()

    # Configure Section & Margins according to PSU Institutional Capstone Handbook
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11.0)
    section.left_margin = Inches(1.5)    # 1.5 inches for binding
    section.right_margin = Inches(1.0)   # 1.0 inch
    section.top_margin = Inches(1.0)     # 1.0 inch
    section.bottom_margin = Inches(1.0)  # 1.0 inch

    in_references = False
    lines = md_content.splitlines()
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        # Handle empty lines
        if not line:
            i += 1
            continue

        # Check for References Section
        if re.search(r"^#+\s*REFERENCES", line, re.IGNORECASE):
            in_references = True
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(18)
            p.paragraph_format.space_after = Pt(12)
            add_styled_run(p, "REFERENCES (CHAPTER II)", font_size_pt=12, bold=True)
            i += 1
            continue

        # Check for Chapter Title
        if line.startswith("# ") and "CHAPTER II" in line.upper():
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(6)
            add_styled_run(p, "Chapter II\nREVIEW OF RELATED LITERATURE AND STUDIES", font_size_pt=14, bold=True)
            i += 1
            continue

        # Check for Major Section Headings (## Related Literature, ## Related Studies, ## Synthesis)
        if line.startswith("## "):
            heading_text = line[3:].strip()
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(6)
            add_styled_run(p, heading_text, font_size_pt=12, bold=True)
            i += 1
            continue

        # Check for Subsection Headings (### SOO 1..., ### Objective No. 1...)
        if line.startswith("### "):
            subheading_text = line[4:].strip()
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
            add_styled_run(p, subheading_text, font_size_pt=12, bold=True)
            i += 1
            continue

        # Check for Table Captions (#### Table ... or Table ...)
        if line.startswith("#### Table ") or re.match(r"^Table\s+\d+\.", line, re.IGNORECASE):
            caption_text = line[5:].strip() if line.startswith("#### ") else line
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.first_line_indent = Inches(0.0)
            p.paragraph_format.left_indent = Inches(0.0)
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(4)
            add_styled_run(p, caption_text, font_size_pt=11, bold=True)
            i += 1
            continue

        # Check for Sub-subheadings (#### ...)
        if line.startswith("#### "):
            h4_text = line[5:].strip()
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(2)
            add_styled_run(p, h4_text, font_size_pt=12, bold=True, italic=True)
            i += 1
            continue

        # Check for Markdown Table (| ... |)
        if line.startswith("|") and line.endswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                tl = lines[i].strip()
                # Exclude delimiter rows (| :--- | :---: | etc.)
                if not re.match(r"^\|(\s*:?-+:?\s*\|)+$", tl):
                    table_lines.append(tl)
                i += 1

            if table_lines:
                raw_rows = []
                for tl in table_lines:
                    # Strip outer pipes and split by pipe
                    parts = [c.strip() for c in tl[1:-1].split("|")]
                    raw_rows.append(parts)

                num_cols = max(len(r) for r in raw_rows)
                tbl = doc.add_table(rows=len(raw_rows), cols=num_cols)
                tbl.alignment = WD_TABLE_ALIGNMENT.CENTER

                border_single = {'val': 'single', 'sz': '8', 'space': '0', 'color': '000000'}

                for r_idx, row_data in enumerate(raw_rows):
                    row = tbl.rows[r_idx]
                    is_header = (r_idx == 0)
                    is_last = (r_idx == len(raw_rows) - 1)

                    for c_idx in range(num_cols):
                        cell = row.cells[c_idx]
                        cell_text = row_data[c_idx] if c_idx < len(row_data) else ""
                        
                        # Set APA 3-line borders
                        top_border = border_single if is_header else None
                        bottom_border = border_single if (is_header or is_last) else None
                        set_cell_borders(cell, top=top_border, bottom=bottom_border)

                        p_cell = cell.paragraphs[0]
                        p_cell.alignment = WD_ALIGN_PARAGRAPH.CENTER if (is_header or c_idx > 0) else WD_ALIGN_PARAGRAPH.LEFT
                        p_cell.paragraph_format.space_before = Pt(3)
                        p_cell.paragraph_format.space_after = Pt(3)
                        p_cell.paragraph_format.line_spacing = 1.15
                        parse_inline_formatting(p_cell, cell_text, base_size=9.5, base_bold=is_header)

                # Add space after table
                p_spacer = doc.add_paragraph()
                p_spacer.paragraph_format.space_before = Pt(0)
                p_spacer.paragraph_format.space_after = Pt(6)
            continue

        # Handle Numbered Lists (1. **Item:** Description)
        if re.match(r"^\d+\.\s+\*\*", line):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            p.paragraph_format.left_indent = Inches(0.5)
            p.paragraph_format.first_line_indent = Inches(-0.25)
            p.paragraph_format.line_spacing = 1.5 if not double_spaced else 2.0
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.space_before = Pt(2)
            parse_inline_formatting(p, line)
            i += 1
            continue

        # Handle References entries with Hanging Indent
        if in_references:
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            p.paragraph_format.left_indent = Inches(0.5)
            p.paragraph_format.first_line_indent = Inches(-0.5)
            p.paragraph_format.line_spacing = 1.5 if not double_spaced else 2.0
            p.paragraph_format.space_after = Pt(6)
            parse_inline_formatting(p, line)
            i += 1
            continue

        # Standard Body Paragraph
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.first_line_indent = Inches(0.5)
        p.paragraph_format.line_spacing = 2.0 if double_spaced else 1.5
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.space_before = Pt(0)
        parse_inline_formatting(p, line)
        i += 1

    os.makedirs(os.path.dirname(docx_path), exist_ok=True)
    candidate_paths = [
        docx_path,
        os.path.join(os.path.dirname(docx_path), "Chapter_2_Simplified.docx"),
        os.path.join(os.path.dirname(docx_path), "Chapter_2_Synthesis.docx"),
        os.path.join(os.path.dirname(docx_path), "Chapter_2_Updated.docx")
    ]
    saved_path = None
    for p in candidate_paths:
        try:
            doc.save(p)
            saved_path = p
            break
        except PermissionError:
            continue

    if saved_path:
        if saved_path == docx_path:
            print(f"Successfully generated DOCX: {saved_path} ({os.path.getsize(saved_path)} bytes)")
        else:
            print(f"NOTICE: Primary DOCX locked by Word. Successfully saved to fallback: {saved_path} ({os.path.getsize(saved_path)} bytes)")
    else:
        raise PermissionError(f"Could not save DOCX to any candidate paths due to file locks.")

def main():
    parser = argparse.ArgumentParser(description="Build Chapter 2 DOCX from Markdown")
    parser.add_argument("--input", "-i", dest="input_file", default=None, help="Input Markdown file path")
    parser.add_argument("--output", "-o", dest="output_file", default=None, help="Output DOCX file path")
    parser.add_argument("positional_args", nargs="*", help="Positional arguments [input] [output]")

    args = parser.parse_args()

    input_path = args.input_file
    output_path = args.output_file

    if not input_path and len(args.positional_args) > 0:
        input_path = args.positional_args[0]
    if not output_path and len(args.positional_args) > 1:
        output_path = args.positional_args[1]

    if not input_path:
        input_path = "manuscript/Chapter_2.md"
    if not output_path:
        output_path = "manuscript/Chapter_2.docx"

    convert_md_to_docx(input_path, output_path, double_spaced=True)

if __name__ == "__main__":
    main()
