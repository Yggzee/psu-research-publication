import XLSXStyle from "xlsx-js-style";

// Safe reference for bundlers (handles default or namespace import)
const XLSX: any = (XLSXStyle as any)?.default || XLSXStyle;

// Brand Colors (Pangasinan State University Institutional Palette)
const COLOR_NAVY = "1E3A8A";       // Primary Brand Navy
const COLOR_HEADER_BG = "1E3A8A";   // Column Header Background
const COLOR_HEADER_TEXT = "FFFFFF"; // Column Header Text
const COLOR_TEXT_MAIN = "0F172A";   // Slate-900 for Primary Text
const COLOR_TEXT_SUBTLE = "334155"; // Slate-700
const COLOR_TEXT_MUTED = "64748B";  // Slate-500
const COLOR_LINK = "1D4ED8";        // Blue-700 for Hyperlinks
const COLOR_ROW_ALT = "F8FAFC";     // Alternating Row Background
const COLOR_HIGHLIGHT = "EFF6FF";   // Soft Blue for Totals & Citation Badges
const COLOR_BORDER = "CBD5E1";      // Slate-300 Border

// Border definitions
const thinBorder = {
  top: { style: "thin", color: { rgb: COLOR_BORDER } },
  bottom: { style: "thin", color: { rgb: COLOR_BORDER } },
  left: { style: "thin", color: { rgb: COLOR_BORDER } },
  right: { style: "thin", color: { rgb: COLOR_BORDER } }
};

const doubleSummaryBorder = {
  top: { style: "thin", color: { rgb: COLOR_BORDER } },
  bottom: { style: "double", color: { rgb: COLOR_NAVY } },
  left: { style: "thin", color: { rgb: COLOR_BORDER } },
  right: { style: "thin", color: { rgb: COLOR_BORDER } }
};

// Reusable Cell Style Presets
const tableHeaderStyle = {
  font: { name: "Calibri", sz: 10.5, bold: true, color: { rgb: COLOR_HEADER_TEXT } },
  fill: { fgColor: { rgb: COLOR_HEADER_BG } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: thinBorder
};

/**
 * Escapes quotes in Excel formula strings
 */
function escapeFormula(str: string): string {
  return String(str || "").replace(/"/g, '""');
}

/**
 * Creates a clean clickable hyperlink cell with shortened text and styling
 */
function createHyperlinkCell(
  url: string | undefined | null,
  shortLabel: string,
  tooltip?: string,
  options: { bold?: boolean; align?: "center" | "left"; bg?: string } = {}
) {
  const cleanUrl = (url || "").trim();
  const label = (shortLabel || "").trim();
  const isBold = Boolean(options.bold);
  const align = options.align || "center";
  const bg = options.bg || "FFFFFF";

  if (!cleanUrl || cleanUrl === "#" || cleanUrl === "—") {
    return {
      t: "s",
      v: "—",
      s: {
        font: { name: "Calibri", sz: 9.5, color: { rgb: COLOR_TEXT_MUTED } },
        alignment: { horizontal: align, vertical: "center" },
        fill: { fgColor: { rgb: bg } },
        border: thinBorder
      }
    };
  }

  return {
    t: "s",
    v: label,
    l: { Target: cleanUrl, Tooltip: tooltip || label },
    f: `HYPERLINK("${escapeFormula(cleanUrl)}", "${escapeFormula(label)}")`,
    s: {
      font: { name: "Calibri", sz: 9.5, bold: isBold, color: { rgb: COLOR_LINK }, underline: true },
      alignment: { horizontal: align, vertical: "center" },
      fill: { fgColor: { rgb: bg } },
      border: thinBorder
    }
  };
}

/**
 * Options for generating the research publications export
 */
export interface ExcelExportOptions {
  publications: any[];
  researchers: any[];
  exportDepartment: string;
  exportYear: string;
  departmentOrder?: string[];
  filename?: string;
}

/**
 * Generates and downloads a beautifully styled, organized multi-sheet Excel file
 * with clean hyperlinks, bold titles, and tailored cell alignments.
 */
export function exportResearchMatrixToExcel(options: ExcelExportOptions): void {
  const {
    publications,
    researchers,
    exportDepartment,
    exportYear,
    departmentOrder = [],
    filename
  } = options;

  const workbook = XLSX.utils.book_new();
  const exportDateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const scopeDeptText = exportDepartment === "all" ? "All Departments" : exportDepartment;
  const scopeYearText = exportYear === "all" ? "All Academic Years" : `Year ${exportYear}`;

  // --------------------------------------------------------------------------
  // SHEET 1: RESEARCH PUBLICATIONS
  // --------------------------------------------------------------------------
  const wsPubs: any = {};

  // University Header Banner
  wsPubs["A1"] = {
    t: "s",
    v: "PANGASINAN STATE UNIVERSITY",
    s: {
      font: { name: "Calibri", sz: 16, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "left", vertical: "center" }
    }
  };

  wsPubs["A2"] = {
    t: "s",
    v: "Research & Publication Tracking Matrix — Official Citation Audit",
    s: {
      font: { name: "Calibri", sz: 11.5, bold: true, color: { rgb: COLOR_TEXT_SUBTLE } },
      alignment: { horizontal: "left", vertical: "center" }
    }
  };

  wsPubs["A3"] = {
    t: "s",
    v: `Scope: ${scopeDeptText}   |   Year Filter: ${scopeYearText}   |   Total Publications: ${publications.length}   |   Generated: ${exportDateStr}`,
    s: {
      font: { name: "Calibri", sz: 9.5, italic: true, color: { rgb: COLOR_TEXT_MUTED } },
      alignment: { horizontal: "left", vertical: "center" }
    }
  };

  // Table Column Definitions
  const pubHeaders = [
    { label: "#", wch: 6, align: "center" },
    { label: "Research Title", wch: 44, align: "left" },
    { label: "Lead Researcher", wch: 22, align: "left" },
    { label: "Department", wch: 25, align: "left" },
    { label: "Authors", wch: 30, align: "left" },
    { label: "Journal / Venue", wch: 28, align: "left" },
    { label: "Indexing", wch: 20, align: "center" },
    { label: "Year", wch: 10, align: "center" },
    { label: "NBC 461 Points", wch: 16, align: "center" },
    { label: "Total Citations", wch: 15, align: "center" },
    { label: "Scholar Citations", wch: 23, align: "center" },
    { label: "Publication Link", wch: 18, align: "center" },
    { label: "Verified Citing Works (Overview)", wch: 54, align: "left" }
  ];

  const colLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
  const headerRowIdx = 5;

  // Render Table Headers
  pubHeaders.forEach((col, idx) => {
    wsPubs[`${colLetters[idx]}${headerRowIdx}`] = {
      t: "s",
      v: col.label,
      s: tableHeaderStyle
    };
  });

  let curRow = 6;
  let totalCitationsSum = 0;
  let totalPointsSum = 0;

  publications.forEach((pub, idx) => {
    const isAlt = idx % 2 === 1;
    const rowBg = isAlt ? COLOR_ROW_ALT : "FFFFFF";

    const researcher = researchers.find(
      (r: any) => r.instructorId === pub.owner_id || r.instructorId === pub.ownerId
    );

    const totalCites = Number(pub.citations) || 0;
    const points = Number(pub.nbc461_points) || 5.0;
    totalCitationsSum += totalCites;
    totalPointsSum += points;

    const citing = Array.isArray(pub.citingPapers) ? pub.citingPapers : [];
    const citedByLink = pub.citedByLink || pub.cited_by_link || "";
    const citesMatch = citedByLink.match(/cites=([0-9]+)/) || citedByLink.match(/([0-9]{15,25})/);
    const citesId = citesMatch ? citesMatch[1] : "";
    const primaryScholarLink = citesId
      ? `https://scholar.google.com/scholar?cites=${citesId}&hl=en`
      : citedByLink;

    // Col A: # (Index) — CENTERED
    wsPubs[`A${curRow}`] = {
      t: "n",
      v: idx + 1,
      s: {
        font: { name: "Calibri", sz: 10 },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col B: Research Title — LEFT-ALIGNED & BOLD (Recognizable)
    wsPubs[`B${curRow}`] = {
      t: "s",
      v: pub.title || "Untitled Publication",
      s: {
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col C: Lead Researcher — LEFT-ALIGNED
    wsPubs[`C${curRow}`] = {
      t: "s",
      v: pub.owner_name || pub.ownerName || researcher?.name || "Unknown",
      s: {
        font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { horizontal: "left", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col D: Department — LEFT-ALIGNED
    wsPubs[`D${curRow}`] = {
      t: "s",
      v: pub.department || researcher?.department || "Unassigned",
      s: {
        font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_SUBTLE } },
        alignment: { horizontal: "left", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col E: Authors — LEFT-ALIGNED
    wsPubs[`E${curRow}`] = {
      t: "s",
      v: Array.isArray(pub.authors) ? pub.authors.join(", ") : (pub.authors || ""),
      s: {
        font: { name: "Calibri", sz: 9.5, color: { rgb: COLOR_TEXT_SUBTLE } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col F: Journal / Venue — LEFT-ALIGNED
    wsPubs[`F${curRow}`] = {
      t: "s",
      v: pub.journal || "—",
      s: {
        font: { name: "Calibri", sz: 9.5, color: { rgb: COLOR_TEXT_SUBTLE } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col G: Indexing — CENTERED
    wsPubs[`G${curRow}`] = {
      t: "s",
      v: pub.journal_indexing || "Institutional Refereed",
      s: {
        font: { name: "Calibri", sz: 9.5, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col H: Year — CENTERED
    wsPubs[`H${curRow}`] = {
      t: pub.year ? "n" : "s",
      v: pub.year || "—",
      s: {
        font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col I: NBC 461 Points — CENTERED
    wsPubs[`I${curRow}`] = {
      t: "n",
      v: points,
      z: "0.0",
      s: {
        font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col J: Total Citations — CENTERED & BOLD
    wsPubs[`J${curRow}`] = {
      t: "n",
      v: totalCites,
      s: {
        font: {
          name: "Calibri",
          sz: 10.5,
          bold: true,
          color: { rgb: totalCites > 0 ? COLOR_NAVY : COLOR_TEXT_MUTED }
        },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: totalCites > 0 ? COLOR_HIGHLIGHT : rowBg } },
        border: thinBorder
      }
    };

    // Col K: Scholar Citations Link — SHORTENED HYPERLINK & CENTERED
    if (totalCites > 0 && primaryScholarLink) {
      wsPubs[`K${curRow}`] = createHyperlinkCell(
        primaryScholarLink,
        `View Citations (${totalCites}) ↗`,
        `Google Scholar Citations for: ${pub.title}`,
        { bold: true, align: "center", bg: rowBg }
      );
    } else if (totalCites > 0) {
      wsPubs[`K${curRow}`] = {
        t: "s",
        v: `${totalCites} Verified`,
        s: {
          font: { name: "Calibri", sz: 9.5, bold: true, color: { rgb: COLOR_NAVY } },
          alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: rowBg } },
          border: thinBorder
        }
      };
    } else {
      wsPubs[`K${curRow}`] = {
        t: "s",
        v: "None (0)",
        s: {
          font: { name: "Calibri", sz: 9.5, color: { rgb: COLOR_TEXT_MUTED } },
          alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: rowBg } },
          border: thinBorder
        }
      };
    }

    // Col L: Publication Link — SHORTENED HYPERLINK & CENTERED
    if (pub.url) {
      wsPubs[`L${curRow}`] = createHyperlinkCell(
        pub.url,
        "Open Article ↗",
        `Direct Link to: ${pub.title}`,
        { align: "center", bg: rowBg }
      );
    } else {
      wsPubs[`L${curRow}`] = {
        t: "s",
        v: "—",
        s: {
          font: { name: "Calibri", sz: 9.5, color: { rgb: COLOR_TEXT_MUTED } },
          alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: rowBg } },
          border: thinBorder
        }
      };
    }

    // Col M: Verified Citing Works Summary (Cleaned, without raw clutter) — LEFT-ALIGNED
    let citingSummary = "";
    if (citing.length > 0) {
      citingSummary = citing
        .map((cp: any, cIdx: number) => `[${cIdx + 1}] ${cp.title || "Citing Work"}${cp.year ? ` (${cp.year})` : ""}`)
        .join("\n");
      if (totalCites > citing.length) {
        citingSummary += `\n...and ${totalCites - citing.length} additional cited reference(s) (See 'Citations Breakdown' tab)`;
      } else {
        citingSummary += `\n(See 'Citations Breakdown' tab for direct clickable links)`;
      }
    } else if (totalCites > 0) {
      citingSummary = `${totalCites} verified Google Scholar citations recorded (See 'Citations Breakdown' tab)`;
    } else {
      citingSummary = "0 citations";
    }

    wsPubs[`M${curRow}`] = {
      t: "s",
      v: citingSummary,
      s: {
        font: { name: "Calibri", sz: 9, color: { rgb: COLOR_TEXT_SUBTLE } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    curRow++;
  });

  // Summary / Institutional Aggregate Row
  wsPubs[`A${curRow}`] = {
    t: "s",
    v: "TOTAL",
    s: {
      font: { name: "Calibri", sz: 10.5, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: COLOR_HIGHLIGHT } },
      border: doubleSummaryBorder
    }
  };

  wsPubs[`B${curRow}`] = {
    t: "s",
    v: `Total Publications: ${publications.length}`,
    s: {
      font: { name: "Calibri", sz: 10, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "left", vertical: "center" },
      fill: { fgColor: { rgb: COLOR_HIGHLIGHT } },
      border: doubleSummaryBorder
    }
  };

  ["C", "D", "E", "F", "G", "H"].forEach((col) => {
    wsPubs[`${col}${curRow}`] = {
      t: "s",
      v: "",
      s: { fill: { fgColor: { rgb: COLOR_HIGHLIGHT } }, border: doubleSummaryBorder }
    };
  });

  // Total NBC 461 Points
  wsPubs[`I${curRow}`] = {
    t: "n",
    v: totalPointsSum,
    z: "0.0",
    s: {
      font: { name: "Calibri", sz: 10.5, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: COLOR_HIGHLIGHT } },
      border: doubleSummaryBorder
    }
  };

  // Total Citations Sum
  wsPubs[`J${curRow}`] = {
    t: "n",
    v: totalCitationsSum,
    s: {
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: COLOR_HIGHLIGHT } },
      border: doubleSummaryBorder
    }
  };

  ["K", "L", "M"].forEach((col) => {
    wsPubs[`${col}${curRow}`] = {
      t: "s",
      v: "",
      s: { fill: { fgColor: { rgb: COLOR_HIGHLIGHT } }, border: doubleSummaryBorder }
    };
  });

  // Sheet 1 Range & Dimensions
  wsPubs["!ref"] = `A1:M${curRow}`;
  wsPubs["!cols"] = pubHeaders.map((h) => ({ wch: h.wch }));
  wsPubs["!rows"] = [
    { hpt: 26 }, // Title 1
    { hpt: 20 }, // Title 2
    { hpt: 18 }, // Scope
    { hpt: 10 }, // Spacer
    { hpt: 28 }, // Headers
  ];

  XLSX.utils.book_append_sheet(workbook, wsPubs, "Research Publications");

  // --------------------------------------------------------------------------
  // SHEET 2: CITATIONS BREAKDOWN (DEDICATED CITATION AUDIT)
  // --------------------------------------------------------------------------
  const wsCitations: any = {};

  wsCitations["A1"] = {
    t: "s",
    v: "PANGASINAN STATE UNIVERSITY",
    s: {
      font: { name: "Calibri", sz: 16, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "left", vertical: "center" }
    }
  };

  wsCitations["A2"] = {
    t: "s",
    v: "Verified Citation Breakdown & Cited Works Audit",
    s: {
      font: { name: "Calibri", sz: 11.5, bold: true, color: { rgb: COLOR_TEXT_SUBTLE } },
      alignment: { horizontal: "left", vertical: "center" }
    }
  };

  wsCitations["A3"] = {
    t: "s",
    v: `Individual verification links for accreditation, NBC 461, and academic audit   |   Generated: ${exportDateStr}`,
    s: {
      font: { name: "Calibri", sz: 9.5, italic: true, color: { rgb: COLOR_TEXT_MUTED } },
      alignment: { horizontal: "left", vertical: "center" }
    }
  };

  const citeHeaders = [
    { label: "#", wch: 6 },
    { label: "Cited PSU Publication", wch: 40 },
    { label: "Lead Researcher", wch: 22 },
    { label: "Department", wch: 24 },
    { label: "Cite #", wch: 8 },
    { label: "Citing Paper Title", wch: 42 },
    { label: "Citing Year", wch: 12 },
    { label: "Citing Authors / Venue", wch: 30 },
    { label: "Direct Paper Link", wch: 20 },
    { label: "Google Scholar Entry", wch: 22 }
  ];

  const citeColLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  citeHeaders.forEach((col, idx) => {
    wsCitations[`${citeColLetters[idx]}5`] = {
      t: "s",
      v: col.label,
      s: tableHeaderStyle
    };
  });

  let citeRow = 6;
  let globalCiteIdx = 1;

  publications.forEach((pub) => {
    const researcher = researchers.find(
      (r: any) => r.instructorId === pub.owner_id || r.instructorId === pub.ownerId
    );
    const citing = Array.isArray(pub.citingPapers) ? pub.citingPapers : [];
    const totalCites = Number(pub.citations) || 0;
    const count = Math.max(totalCites, citing.length);

    if (count === 0) return;

    const citedByLink = pub.citedByLink || pub.cited_by_link || "";
    const citesMatch = citedByLink.match(/cites=([0-9]+)/) || citedByLink.match(/([0-9]{15,25})/);
    const citesId = citesMatch ? citesMatch[1] : "";

    for (let i = 1; i <= count; i++) {
      const isAlt = globalCiteIdx % 2 === 0;
      const rowBg = isAlt ? COLOR_ROW_ALT : "FFFFFF";
      const cp = i <= citing.length ? citing[i - 1] : null;

      const citingTitle = cp ? (cp.title || `Citing Paper #${i}`) : `Google Scholar Citation Entry #${i}`;
      const citingYear = cp?.year || "—";
      const citingAuthors = cp?.authors || "—";
      const directPaperLink = cp?.link || "";

      const pageStart = Math.floor((i - 1) / 10) * 10;
      const scholarEntryLink = citesId
        ? `https://scholar.google.com/scholar?cites=${citesId}&hl=en&start=${pageStart}`
        : (citedByLink || "");

      // Col A: Global # — CENTERED
      wsCitations[`A${citeRow}`] = {
        t: "n",
        v: globalCiteIdx,
        s: {
          font: { name: "Calibri", sz: 10 },
          alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: rowBg } },
          border: thinBorder
        }
      };

      // Col B: Cited PSU Publication — BOLD & LEFT-ALIGNED
      wsCitations[`B${citeRow}`] = {
        t: "s",
        v: pub.title || "Untitled Publication",
        s: {
          font: { name: "Calibri", sz: 10, bold: true, color: { rgb: COLOR_TEXT_MAIN } },
          alignment: { horizontal: "left", vertical: "center", wrapText: true },
          fill: { fgColor: { rgb: rowBg } },
          border: thinBorder
        }
      };

      // Col C: Lead Researcher — LEFT-ALIGNED
      wsCitations[`C${citeRow}`] = {
        t: "s",
        v: pub.owner_name || pub.ownerName || researcher?.name || "Unknown",
        s: {
          font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_MAIN } },
          alignment: { horizontal: "left", vertical: "center" },
          fill: { fgColor: { rgb: rowBg } },
          border: thinBorder
        }
      };

      // Col D: Department — LEFT-ALIGNED
      wsCitations[`D${citeRow}`] = {
        t: "s",
        v: pub.department || researcher?.department || "Unassigned",
        s: {
          font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_SUBTLE } },
          alignment: { horizontal: "left", vertical: "center" },
          fill: { fgColor: { rgb: rowBg } },
          border: thinBorder
        }
      };

      // Col E: Cite # — CENTERED & BOLD
      wsCitations[`E${citeRow}`] = {
        t: "s",
        v: `#${i}`,
        s: {
          font: { name: "Calibri", sz: 10, bold: true, color: { rgb: COLOR_NAVY } },
          alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: rowBg } },
          border: thinBorder
        }
      };

      // Col F: Citing Paper Title — LEFT-ALIGNED
      wsCitations[`F${citeRow}`] = {
        t: "s",
        v: citingTitle,
        s: {
          font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_MAIN } },
          alignment: { horizontal: "left", vertical: "center", wrapText: true },
          fill: { fgColor: { rgb: rowBg } },
          border: thinBorder
        }
      };

      // Col G: Citing Year — CENTERED
      wsCitations[`G${citeRow}`] = {
        t: citingYear !== "—" ? "n" : "s",
        v: citingYear,
        s: {
          font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_MAIN } },
          alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: rowBg } },
          border: thinBorder
        }
      };

      // Col H: Citing Authors / Venue — LEFT-ALIGNED
      wsCitations[`H${citeRow}`] = {
        t: "s",
        v: citingAuthors,
        s: {
          font: { name: "Calibri", sz: 9.5, color: { rgb: COLOR_TEXT_SUBTLE } },
          alignment: { horizontal: "left", vertical: "center", wrapText: true },
          fill: { fgColor: { rgb: rowBg } },
          border: thinBorder
        }
      };

      // Col I: Direct Paper Link — SHORTENED HYPERLINK & CENTERED
      if (directPaperLink) {
        wsCitations[`I${citeRow}`] = createHyperlinkCell(
          directPaperLink,
          "Open Paper ↗",
          `Open Citing Paper: ${citingTitle}`,
          { bold: true, align: "center", bg: rowBg }
        );
      } else {
        wsCitations[`I${citeRow}`] = {
          t: "s",
          v: "—",
          s: {
            font: { name: "Calibri", sz: 9.5, color: { rgb: COLOR_TEXT_MUTED } },
            alignment: { horizontal: "center", vertical: "center" },
            fill: { fgColor: { rgb: rowBg } },
            border: thinBorder
          }
        };
      }

      // Col J: Google Scholar Entry Link — SHORTENED HYPERLINK & CENTERED
      if (scholarEntryLink) {
        wsCitations[`J${citeRow}`] = createHyperlinkCell(
          scholarEntryLink,
          "Scholar Entry ↗",
          `View Scholar Citation Result for Entry #${i}`,
          { align: "center", bg: rowBg }
        );
      } else {
        wsCitations[`J${citeRow}`] = {
          t: "s",
          v: "—",
          s: {
            font: { name: "Calibri", sz: 9.5, color: { rgb: COLOR_TEXT_MUTED } },
            alignment: { horizontal: "center", vertical: "center" },
            fill: { fgColor: { rgb: rowBg } },
            border: thinBorder
          }
        };
      }

      citeRow++;
      globalCiteIdx++;
    }
  });

  if (globalCiteIdx === 1) {
    wsCitations["A6"] = {
      t: "s",
      v: "No verified citations recorded for the selected filter scope.",
      s: {
        font: { name: "Calibri", sz: 10, italic: true, color: { rgb: COLOR_TEXT_MUTED } },
        alignment: { horizontal: "left", vertical: "center" }
      }
    };
    citeRow = 7;
  }

  wsCitations["!ref"] = `A1:J${citeRow - 1}`;
  wsCitations["!cols"] = citeHeaders.map((h) => ({ wch: h.wch }));
  wsCitations["!rows"] = [
    { hpt: 26 },
    { hpt: 20 },
    { hpt: 18 },
    { hpt: 10 },
    { hpt: 28 },
  ];

  XLSX.utils.book_append_sheet(workbook, wsCitations, "Citations Breakdown");

  // --------------------------------------------------------------------------
  // SHEET 3: DEPARTMENT SUMMARY
  // --------------------------------------------------------------------------
  const wsDept: any = {};

  wsDept["A1"] = {
    t: "s",
    v: "PANGASINAN STATE UNIVERSITY",
    s: {
      font: { name: "Calibri", sz: 16, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "left", vertical: "center" }
    }
  };

  wsDept["A2"] = {
    t: "s",
    v: "Departmental Research Productivity & Citation Summary",
    s: {
      font: { name: "Calibri", sz: 11.5, bold: true, color: { rgb: COLOR_TEXT_SUBTLE } },
      alignment: { horizontal: "left", vertical: "center" }
    }
  };

  wsDept["A3"] = {
    t: "s",
    v: `Aggregated statistics by academic unit   |   Generated: ${exportDateStr}`,
    s: {
      font: { name: "Calibri", sz: 9.5, italic: true, color: { rgb: COLOR_TEXT_MUTED } },
      alignment: { horizontal: "left", vertical: "center" }
    }
  };

  const deptHeaders = [
    { label: "#", wch: 6 },
    { label: "Department / College", wch: 36 },
    { label: "Active Faculty", wch: 16 },
    { label: "Total Publications", wch: 18 },
    { label: "Total Citations", wch: 16 },
    { label: "Avg Citations / Pub", wch: 20 },
    { label: "Avg Citations / Faculty", wch: 22 }
  ];

  const deptColLetters = ["A", "B", "C", "D", "E", "F", "G"];
  deptHeaders.forEach((col, idx) => {
    wsDept[`${deptColLetters[idx]}5`] = {
      t: "s",
      v: col.label,
      s: tableHeaderStyle
    };
  });

  // Calculate department aggregations
  const deptStatsMap: Record<string, { faculty: number; pubs: number; citations: number }> = {};

  // First seed from researchers list
  researchers.forEach((r: any) => {
    const dept = r.department || "Unassigned";
    if (!deptStatsMap[dept]) {
      deptStatsMap[dept] = { faculty: 0, pubs: 0, citations: 0 };
    }
    deptStatsMap[dept].faculty += 1;
  });

  // Aggregate publications and citations
  publications.forEach((pub: any) => {
    const researcher = researchers.find(
      (r: any) => r.instructorId === pub.owner_id || r.instructorId === pub.ownerId
    );
    const dept = pub.department || researcher?.department || "Unassigned";
    if (!deptStatsMap[dept]) {
      deptStatsMap[dept] = { faculty: 0, pubs: 0, citations: 0 };
    }
    deptStatsMap[dept].pubs += 1;
    deptStatsMap[dept].citations += Number(pub.citations) || 0;
  });

  const allDepts = Array.from(new Set([...departmentOrder, ...Object.keys(deptStatsMap)])).filter(
    (d) => deptStatsMap[d] && (deptStatsMap[d].faculty > 0 || deptStatsMap[d].pubs > 0)
  );

  let deptRow = 6;
  let totalDeptFaculty = 0;
  let totalDeptPubs = 0;
  let totalDeptCites = 0;

  allDepts.forEach((deptName, idx) => {
    const stats = deptStatsMap[deptName];
    const isAlt = idx % 2 === 1;
    const rowBg = isAlt ? COLOR_ROW_ALT : "FFFFFF";

    totalDeptFaculty += stats.faculty;
    totalDeptPubs += stats.pubs;
    totalDeptCites += stats.citations;

    const avgPerPub = stats.pubs > 0 ? (stats.citations / stats.pubs).toFixed(1) : "0.0";
    const avgPerFaculty = stats.faculty > 0 ? (stats.citations / stats.faculty).toFixed(1) : "0.0";

    // Col A: # — CENTERED
    wsDept[`A${deptRow}`] = {
      t: "n",
      v: idx + 1,
      s: {
        font: { name: "Calibri", sz: 10 },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col B: Department — BOLD & LEFT-ALIGNED
    wsDept[`B${deptRow}`] = {
      t: "s",
      v: deptName,
      s: {
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { horizontal: "left", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col C: Active Faculty — CENTERED
    wsDept[`C${deptRow}`] = {
      t: "n",
      v: stats.faculty,
      s: {
        font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col D: Total Publications — CENTERED
    wsDept[`D${deptRow}`] = {
      t: "n",
      v: stats.pubs,
      s: {
        font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col E: Total Citations — CENTERED & BOLD
    wsDept[`E${deptRow}`] = {
      t: "n",
      v: stats.citations,
      s: {
        font: {
          name: "Calibri",
          sz: 10.5,
          bold: true,
          color: { rgb: stats.citations > 0 ? COLOR_NAVY : COLOR_TEXT_MUTED }
        },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: stats.citations > 0 ? COLOR_HIGHLIGHT : rowBg } },
        border: thinBorder
      }
    };

    // Col F: Avg Citations / Pub — CENTERED
    wsDept[`F${deptRow}`] = {
      t: "n",
      v: Number(avgPerPub),
      z: "0.0",
      s: {
        font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    // Col G: Avg Citations / Faculty — CENTERED
    wsDept[`G${deptRow}`] = {
      t: "n",
      v: Number(avgPerFaculty),
      z: "0.0",
      s: {
        font: { name: "Calibri", sz: 10, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: rowBg } },
        border: thinBorder
      }
    };

    deptRow++;
  });

  // Department Summary Total Row
  wsDept[`A${deptRow}`] = {
    t: "s",
    v: "TOTAL",
    s: {
      font: { name: "Calibri", sz: 10.5, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: COLOR_HIGHLIGHT } },
      border: doubleSummaryBorder
    }
  };

  wsDept[`B${deptRow}`] = {
    t: "s",
    v: "University Total",
    s: {
      font: { name: "Calibri", sz: 10, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "left", vertical: "center" },
      fill: { fgColor: { rgb: COLOR_HIGHLIGHT } },
      border: doubleSummaryBorder
    }
  };

  wsDept[`C${deptRow}`] = {
    t: "n",
    v: totalDeptFaculty,
    s: {
      font: { name: "Calibri", sz: 10.5, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: COLOR_HIGHLIGHT } },
      border: doubleSummaryBorder
    }
  };

  wsDept[`D${deptRow}`] = {
    t: "n",
    v: totalDeptPubs,
    s: {
      font: { name: "Calibri", sz: 10.5, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: COLOR_HIGHLIGHT } },
      border: doubleSummaryBorder
    }
  };

  wsDept[`E${deptRow}`] = {
    t: "n",
    v: totalDeptCites,
    s: {
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: COLOR_HIGHLIGHT } },
      border: doubleSummaryBorder
    }
  };

  const overallAvgPerPub = totalDeptPubs > 0 ? (totalDeptCites / totalDeptPubs).toFixed(1) : "0.0";
  const overallAvgPerFaculty = totalDeptFaculty > 0 ? (totalDeptCites / totalDeptFaculty).toFixed(1) : "0.0";

  wsDept[`F${deptRow}`] = {
    t: "n",
    v: Number(overallAvgPerPub),
    z: "0.0",
    s: {
      font: { name: "Calibri", sz: 10.5, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: COLOR_HIGHLIGHT } },
      border: doubleSummaryBorder
    }
  };

  wsDept[`G${deptRow}`] = {
    t: "n",
    v: Number(overallAvgPerFaculty),
    z: "0.0",
    s: {
      font: { name: "Calibri", sz: 10.5, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: COLOR_HIGHLIGHT } },
      border: doubleSummaryBorder
    }
  };

  wsDept["!ref"] = `A1:G${deptRow}`;
  wsDept["!cols"] = deptHeaders.map((h) => ({ wch: h.wch }));
  wsDept["!rows"] = [
    { hpt: 26 },
    { hpt: 20 },
    { hpt: 18 },
    { hpt: 10 },
    { hpt: 28 },
  ];

  XLSX.utils.book_append_sheet(workbook, wsDept, "Department Summary");

  // Determine final filename
  const cleanDept = exportDepartment.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);
  const outFileName = filename || `psu-research-matrix-${cleanDept}-${exportYear}.xlsx`;

  // Write and trigger download in browser
  XLSX.writeFile(workbook, outFileName);
}
