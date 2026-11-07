import XLSXStyle from "xlsx-js-style";
import { matchesResearcher } from "./facultyUtils";

// Safe reference for bundlers (handles default or namespace import)
const XLSX: any = (XLSXStyle as any)?.default || XLSXStyle;

// Brand Colors (Pangasinan State University Institutional Palette)
const COLOR_NAVY = "1E3A8A";       // Primary Brand Navy
const COLOR_HEADER_BG = "1E3A8A";   // Column Header Background
const COLOR_CITE_HDR_BG = "0F766E"; // Teal-700 for Citing Articles Header
const COLOR_HEADER_TEXT = "FFFFFF"; // Column Header Text
const COLOR_TEXT_MAIN = "0F172A";   // Slate-900 for Primary Text
const COLOR_TEXT_SUBTLE = "334155"; // Slate-700
const COLOR_TEXT_MUTED = "64748B";  // Slate-500
const COLOR_LINK = "1D4ED8";        // Blue-700 for Hyperlinks
const COLOR_ROW_ALT = "F8FAFC";     // Alternating Paper Group Background
const COLOR_BORDER = "CBD5E1";      // Slate-300 Border

const thinBorder = {
  top: { style: "thin", color: { rgb: COLOR_BORDER } },
  bottom: { style: "thin", color: { rgb: COLOR_BORDER } },
  left: { style: "thin", color: { rgb: COLOR_BORDER } },
  right: { style: "thin", color: { rgb: COLOR_BORDER } },
};

const tableHeaderStyle = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: COLOR_HEADER_TEXT } },
  fill: { fgColor: { rgb: COLOR_HEADER_BG } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: thinBorder,
};

const citingHeaderStyle = {
  font: { name: "Calibri", sz: 10, bold: true, color: { rgb: COLOR_HEADER_TEXT } },
  fill: { fgColor: { rgb: COLOR_CITE_HDR_BG } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: thinBorder,
};

function escapeFormula(str: string): string {
  return String(str || "").replace(/"/g, '""');
}

function createTextCell(
  value: string | number | undefined | null,
  options: {
    bold?: boolean;
    align?: "left" | "center" | "right";
    vAlign?: "top" | "center" | "bottom";
    bg?: string;
    italic?: boolean;
  } = {}
) {
  const bg = options.bg || "FFFFFF";
  const align = options.align || "left";
  const vAlign = options.vAlign || "center";
  const isNum = typeof value === "number" && !Number.isNaN(value);

  return {
    t: isNum ? "n" : "s",
    v: value !== undefined && value !== null && value !== "" ? value : "",
    s: {
      font: {
        name: "Calibri",
        sz: 10,
        bold: Boolean(options.bold),
        italic: Boolean(options.italic),
        color: { rgb: COLOR_TEXT_MAIN },
      },
      alignment: { horizontal: align, vertical: vAlign, wrapText: true },
      fill: { fgColor: { rgb: bg } },
      border: thinBorder,
    },
  };
}

function createHyperlinkCell(
  url: string | undefined | null,
  displayUrlOrLabel?: string,
  options: {
    bold?: boolean;
    align?: "center" | "left";
    vAlign?: "top" | "center" | "bottom";
    bg?: string;
  } = {}
) {
  const cleanUrl = String(url || "").trim();
  const bg = options.bg || "FFFFFF";
  const align = options.align || "left";
  const vAlign = options.vAlign || "center";

  if (!cleanUrl || cleanUrl === "#" || cleanUrl === "—") {
    return createTextCell("", { align, vAlign, bg });
  }

  const label = (displayUrlOrLabel || cleanUrl).trim();
  return {
    t: "s",
    v: label,
    l: { Target: cleanUrl, Tooltip: cleanUrl },
    f: `HYPERLINK("${escapeFormula(cleanUrl)}", "${escapeFormula(label)}")`,
    s: {
      font: {
        name: "Calibri",
        sz: 9.5,
        bold: Boolean(options.bold),
        color: { rgb: COLOR_LINK },
        underline: true,
      },
      alignment: { horizontal: align, vertical: vAlign, wrapText: true },
      fill: { fgColor: { rgb: bg } },
      border: thinBorder,
    },
  };
}

/**
 * Formats an author list so all authors (Lead Researcher + Co-Researchers) are listed clearly
 */
function formatAllAuthors(authorsInput: any, fallbackName = ""): string {
  if (!authorsInput) return fallbackName;
  if (Array.isArray(authorsInput)) {
    const cleaned = authorsInput
      .map((a) => (typeof a === "string" ? a.trim() : (a?.name || "").trim()))
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned.join("\n") : fallbackName;
  }
  if (typeof authorsInput === "string") {
    const trimmed = authorsInput.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((a) => String(a).trim()).filter(Boolean).join("\n");
        }
      } catch {
        // Ignore JSON parse error
      }
    }
    // Split comma-separated authors onto clean lines if multiple authors exist
    const parts = trimmed
      .split(/\s*,\s*|\s*;\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length > 1 ? parts.join("\n") : trimmed || fallbackName;
  }
  return fallbackName;
}

function deriveKeywords(pub: any): string {
  if (pub.keywords && String(pub.keywords).trim()) {
    return String(pub.keywords).trim();
  }
  const stopWords = new Set([
    "the", "and", "for", "with", "using", "from", "that", "this", "into", "among",
    "based", "study", "analysis", "towards", "through", "effect", "effects", "impact",
    "between", "under", "over", "case", "review", "approach", "development",
    "pangasinan", "state", "university", "asingan", "campus", "philippines",
  ]);
  const words = `${pub.title || ""} ${pub.abstract || ""}`
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stopWords.has(w.toLowerCase()));
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    const low = w.toLowerCase();
    if (!seen.has(low)) {
      seen.add(low);
      unique.push(w);
    }
    if (unique.length >= 5) break;
  }
  return unique.join(", ");
}

function sanitizeFileSegment(name: string): string {
  return (
    String(name || "Researcher")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "Researcher"
  );
}

/**
 * Builds the 2-sheet Excel Workbook (Publication Sheet + Citation Sheet) for a single researcher
 * matching the official PSU Asingan Campus Research Coordinator format.
 */
export function buildResearcherWorkbook(
  researcher: any,
  researcherPublications: any[],
  exportYear = "all"
): any {
  const workbook = XLSX.utils.book_new();
  const researcherName = researcher?.name || "Faculty Researcher";
  const department = researcher?.department || "Unassigned";

  // ==========================================================================
  // SHEET 1: PUBLICATION SHEET (8 Official Columns)
  // ==========================================================================
  const wsPub: any = {};

  // Title Block
  wsPub["A1"] = {
    t: "s",
    v: `PANGASINAN STATE UNIVERSITY — ASINGAN CAMPUS`,
    s: {
      font: { name: "Calibri", sz: 14, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "left", vertical: "center" },
    },
  };
  wsPub["A2"] = {
    t: "s",
    v: `PUBLICATION SHEET • Researcher: ${researcherName} (${department})${exportYear !== "all" ? ` • Year: ${exportYear}` : ""}`,
    s: {
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: COLOR_TEXT_SUBTLE } },
      alignment: { horizontal: "left", vertical: "center" },
    },
  };

  const pubHeaders = [
    { label: "ARTICLE / TITLE", wch: 46 },
    { label: "AUTHOR (s)", wch: 30 },
    { label: "DATE OF PUBLICATION", wch: 20 },
    { label: "TITLE OF JOURNAL OR PUBLICATION", wch: 34 },
    { label: "VOL. NO. & ISSUE NO.", wch: 22 },
    { label: "ISSN / ISBN", wch: 26 },
    { label: "INDEX -SCOPUS-WOS-GOOGLE SCHOLAR", wch: 28 },
    { label: "Link of Evidence", wch: 42 },
  ];

  const pubCols = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const pubHeaderRow = 4;

  pubHeaders.forEach((col, i) => {
    wsPub[`${pubCols[i]}${pubHeaderRow}`] = {
      t: "s",
      v: col.label,
      s: tableHeaderStyle,
    };
  });

  let pubRow = 5;
  const rowHeightsPub: any[] = [
    { hpt: 22 },
    { hpt: 18 },
    { hpt: 10 },
    { hpt: 30 },
  ];

  if (researcherPublications.length === 0) {
    wsPub[`A${pubRow}`] = createTextCell("No publications recorded for the selected filter.", {
      italic: true,
    });
    rowHeightsPub.push({ hpt: 24 });
    pubRow++;
  } else {
    researcherPublications.forEach((pub, idx) => {
      const bg = idx % 2 === 1 ? COLOR_ROW_ALT : "FFFFFF";
      const allAuthorsStr = formatAllAuthors(pub.authors, researcherName);
      const authorLines = allAuthorsStr.split("\n").length;

      const pubDate =
        pub.publication_date ||
        pub.publicationDate ||
        (pub.year ? String(pub.year) : "");
      const journalTitle = pub.journal || "Academic Publication";
      const volIssue = pub.volume_issue || pub.volumeIssue || "";
      const issnIsbn =
        pub.issn_isbn ||
        pub.issnIsbn ||
        (pub.doi ? `DOI: ${pub.doi}` : "");
      const indexing =
        pub.journal_indexing ||
        pub.journalIndexing ||
        (journalTitle.toLowerCase().includes("scopus") ? "Scopus" : "Google Scholar");
      const evidenceLink = pub.url || pub.citedByLink || pub.cited_by_link || "";

      wsPub[`A${pubRow}`] = createTextCell(pub.title || "Untitled Publication", {
        bold: true,
        align: "left",
        bg,
      });
      wsPub[`B${pubRow}`] = createTextCell(allAuthorsStr, { align: "left", bg });
      wsPub[`C${pubRow}`] = createTextCell(pubDate, { align: "center", bg });
      wsPub[`D${pubRow}`] = createTextCell(journalTitle, { align: "left", bg });
      wsPub[`E${pubRow}`] = createTextCell(volIssue, { align: "center", bg });
      wsPub[`F${pubRow}`] = createTextCell(issnIsbn, { align: "center", bg });
      wsPub[`G${pubRow}`] = createTextCell(indexing, { align: "center", bg });
      wsPub[`H${pubRow}`] = createHyperlinkCell(evidenceLink, evidenceLink, {
        align: "left",
        bg,
      });

      const estimatedHeight = Math.max(28, Math.min(180, authorLines * 15 + 10));
      rowHeightsPub.push({ hpt: estimatedHeight });
      pubRow++;
    });
  }

  wsPub["!ref"] = `A1:H${Math.max(pubRow - 1, 5)}`;
  wsPub["!cols"] = pubHeaders.map((c) => ({ wch: c.wch }));
  wsPub["!rows"] = rowHeightsPub;
  wsPub["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
  ];

  XLSX.utils.book_append_sheet(workbook, wsPub, "Publication Sheet");

  // ==========================================================================
  // SHEET 2: CITATION SHEET (15 Official Columns — Name of Publisher removed)
  // ==========================================================================
  const wsCite: any = {};

  wsCite["A1"] = {
    t: "s",
    v: `PANGASINAN STATE UNIVERSITY — ASINGAN CAMPUS`,
    s: {
      font: { name: "Calibri", sz: 14, bold: true, color: { rgb: COLOR_NAVY } },
      alignment: { horizontal: "left", vertical: "center" },
    },
  };
  wsCite["A2"] = {
    t: "s",
    v: `CITATION SHEET • Researcher: ${researcherName} (${department})${exportYear !== "all" ? ` • Year: ${exportYear}` : ""}`,
    s: {
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: COLOR_TEXT_SUBTLE } },
      alignment: { horizontal: "left", vertical: "center" },
    },
  };

  // 15 Columns:
  // Columns A–H (1–8): Parent PSU Research Output
  // Columns I–O (9–15): Citing Articles (with "Name of Publisher" removed as requested)
  const citeHeaders = [
    { label: "Title of Research Output", wch: 40, isCitingSide: false },
    { label: "Keywords", wch: 26, isCitingSide: false },
    { label: "Researcher(s)", wch: 28, isCitingSide: false },
    { label: "Journal", wch: 28, isCitingSide: false },
    { label: "ISSN/DOI", wch: 24, isCitingSide: false },
    { label: "Year Published", wch: 15, isCitingSide: false },
    { label: "Level", wch: 16, isCitingSide: false },
    { label: "Link", wch: 34, isCitingSide: false },
    { label: "Author(s) Who Cited the Research Output", wch: 32, isCitingSide: true },
    { label: "Title of Article Where the Research Output Was Cited", wch: 44, isCitingSide: true },
    { label: "Title of Journal", wch: 30, isCitingSide: true },
    { label: "Vol. / Issue / Page No.", wch: 24, isCitingSide: true },
    { label: "City/Year Published", wch: 18, isCitingSide: true },
    { label: "Quarter", wch: 14, isCitingSide: true },
    { label: "Link", wch: 38, isCitingSide: true },
  ];

  const citeCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
  const citeHeaderRow = 4;

  citeHeaders.forEach((col, i) => {
    wsCite[`${citeCols[i]}${citeHeaderRow}`] = {
      t: "s",
      v: col.label,
      s: col.isCitingSide ? citingHeaderStyle : tableHeaderStyle,
    };
  });

  let citeRow = 5;
  const rowHeightsCite: any[] = [
    { hpt: 22 },
    { hpt: 18 },
    { hpt: 10 },
    { hpt: 32 },
  ];
  const citeMerges: any[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },
  ];

  if (researcherPublications.length === 0) {
    wsCite[`A${citeRow}`] = createTextCell("No citation records found for the selected filter.", {
      italic: true,
    });
    rowHeightsCite.push({ hpt: 24 });
    citeRow++;
  } else {
    researcherPublications.forEach((pub, pubIdx) => {
      const bg = pubIdx % 2 === 1 ? COLOR_ROW_ALT : "FFFFFF";
      const parentAuthors = formatAllAuthors(pub.authors, researcherName);
      const keywords = deriveKeywords(pub);
      const journal = pub.journal || "Academic Publication";
      const issnDoi =
        pub.issn_isbn ||
        pub.issnIsbn ||
        (pub.doi ? `https://doi.org/${pub.doi}` : "");
      const yearPub = pub.year || "";
      const level = pub.publication_level || pub.publicationLevel || "International";
      const parentLink = pub.url || pub.citedByLink || pub.cited_by_link || "";

      const citingList = Array.isArray(pub.citingPapers) ? pub.citingPapers : [];

      if (citingList.length === 0) {
        // Render the parent research output row even if it has 0 citing papers yet
        wsCite[`A${citeRow}`] = createTextCell(pub.title || "Untitled Publication", {
          bold: true,
          align: "left",
          vAlign: "center",
          bg,
        });
        wsCite[`B${citeRow}`] = createTextCell(keywords, { align: "left", vAlign: "center", bg });
        wsCite[`C${citeRow}`] = createTextCell(parentAuthors, { align: "left", vAlign: "center", bg });
        wsCite[`D${citeRow}`] = createTextCell(journal, { align: "left", vAlign: "center", bg });
        wsCite[`E${citeRow}`] = createTextCell(issnDoi, { align: "center", vAlign: "center", bg });
        wsCite[`F${citeRow}`] = createTextCell(yearPub, { align: "center", vAlign: "center", bg });
        wsCite[`G${citeRow}`] = createTextCell(level, { align: "center", vAlign: "center", bg });
        wsCite[`H${citeRow}`] = createHyperlinkCell(parentLink, parentLink, {
          align: "left",
          vAlign: "center",
          bg,
        });

        // Empty citing columns I–O
        for (let c = 8; c < 15; c++) {
          wsCite[`${citeCols[c]}${citeRow}`] = createTextCell("", { bg });
        }

        const lines = Math.max(parentAuthors.split("\n").length, 2);
        rowHeightsCite.push({ hpt: Math.max(28, Math.min(140, lines * 15 + 8)) });
        citeRow++;
      } else {
        const startCiteRow = citeRow; // 1-based row index where this parent paper starts
        const endCiteRow = startCiteRow + citingList.length - 1;

        // Vertically merge Columns 1–8 (A–H, indices 0–7) across all citing rows for this research output
        if (citingList.length > 1) {
          for (let colIdx = 0; colIdx < 8; colIdx++) {
            citeMerges.push({
              s: { r: startCiteRow - 1, c: colIdx },
              e: { r: endCiteRow - 1, c: colIdx },
            });
          }
        }

        // Render 1st row with Parent (Cols A–H) + 1st Citing Paper (Cols I–O),
        // and subsequent rows with styled Cols A–H (merged into 1st row) + Nth Citing Paper (Cols I–O)
        citingList.forEach((cp: any, citeIdx: number) => {
          if (citeIdx === 0) {
            wsCite[`A${citeRow}`] = createTextCell(pub.title || "Untitled Publication", {
              bold: true,
              align: "left",
              vAlign: "center",
              bg,
            });
            wsCite[`B${citeRow}`] = createTextCell(keywords, { align: "left", vAlign: "center", bg });
            wsCite[`C${citeRow}`] = createTextCell(parentAuthors, {
              align: "left",
              vAlign: "center",
              bg,
            });
            wsCite[`D${citeRow}`] = createTextCell(journal, { align: "left", vAlign: "center", bg });
            wsCite[`E${citeRow}`] = createTextCell(issnDoi, { align: "center", vAlign: "center", bg });
            wsCite[`F${citeRow}`] = createTextCell(yearPub, { align: "center", vAlign: "center", bg });
            wsCite[`G${citeRow}`] = createTextCell(level, { align: "center", vAlign: "center", bg });
            wsCite[`H${citeRow}`] = createHyperlinkCell(parentLink, parentLink, {
              align: "left",
              vAlign: "center",
              bg,
            });
          } else {
            for (let c = 0; c < 8; c++) {
              wsCite[`${citeCols[c]}${citeRow}`] = createTextCell("", { vAlign: "center", bg });
            }
          }

          const citingAuthorsStr = formatAllAuthors(cp.authors, "Academic Authors");
          const citingTitle = cp.title || "Citing Article";
          const citingJournal = cp.journal || cp.publisher || "Academic Journal";
          const citingVolIssue = cp.volume_issue || cp.volumeIssue || cp.doi_issn || "";
          const citingYear = cp.year || "";
          const citingQuarter = cp.quarter || "First";
          const citingLink = cp.link || cp.url || "";

          wsCite[`I${citeRow}`] = createTextCell(citingAuthorsStr, { align: "left", vAlign: "center", bg });
          wsCite[`J${citeRow}`] = createTextCell(citingTitle, { align: "left", vAlign: "center", bg });
          wsCite[`K${citeRow}`] = createTextCell(citingJournal, { align: "left", vAlign: "center", bg });
          wsCite[`L${citeRow}`] = createTextCell(citingVolIssue, { align: "center", vAlign: "center", bg });
          wsCite[`M${citeRow}`] = createTextCell(citingYear, { align: "center", vAlign: "center", bg });
          wsCite[`N${citeRow}`] = createTextCell(citingQuarter, { align: "center", vAlign: "center", bg });
          wsCite[`O${citeRow}`] = createHyperlinkCell(citingLink, citingLink, {
            align: "left",
            vAlign: "center",
            bg,
          });

          const maxLines = Math.max(
            citingList.length === 1 ? parentAuthors.split("\n").length : 1,
            citingAuthorsStr.split("\n").length,
            Math.ceil(citingTitle.length / 42)
          );
          rowHeightsCite.push({ hpt: Math.max(28, Math.min(160, maxLines * 15 + 8)) });
          citeRow++;
        });
      }
    });
  }

  wsCite["!ref"] = `A1:O${Math.max(citeRow - 1, 5)}`;
  wsCite["!cols"] = citeHeaders.map((c) => ({ wch: c.wch }));
  wsCite["!rows"] = rowHeightsCite;
  wsCite["!merges"] = citeMerges;

  XLSX.utils.book_append_sheet(workbook, wsCite, "Citation Sheet");

  return workbook;
}

// ============================================================================
// STANDARD ZIP ARCHIVE BUILDER (Organizes Excel files into Department Folders)
// ============================================================================
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntryFile {
  path: string; // e.g. "BSIT/Rodelio_M_Garin.xlsx"
  data: Uint8Array;
}

/**
 * Packages multiple files into a valid ZIP archive with department folder structure
 */
export function buildZipArchive(files: ZipEntryFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = file.data;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + file name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true);         // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true);     // UTF-8 filename flag
    lv.setUint16(8, 0, true);          // Compression method (0 = Store)
    lv.setUint16(10, 0, true);         // File last modification time
    lv.setUint16(12, 0x5421, true);    // File last modification date
    lv.setUint32(14, crc, true);       // CRC-32
    lv.setUint32(18, size, true);      // Compressed size
    lv.setUint32(22, size, true);      // Uncompressed size
    lv.setUint16(26, nameBytes.length, true); // File name length
    lv.setUint16(28, 0, true);         // Extra field length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    // Central directory file header (46 bytes + file name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory signature
    cv.setUint16(4, 20, true);         // Version made by
    cv.setUint16(6, 20, true);         // Version needed to extract
    cv.setUint16(8, 0x0800, true);     // UTF-8 flag
    cv.setUint16(10, 0, true);         // Compression method (0 = Store)
    cv.setUint16(12, 0, true);         // Last mod file time
    cv.setUint16(14, 0x5421, true);    // Last mod file date
    cv.setUint32(16, crc, true);       // CRC-32
    cv.setUint32(20, size, true);      // Compressed size
    cv.setUint32(24, size, true);      // Uncompressed size
    cv.setUint16(28, nameBytes.length, true); // File name length
    cv.setUint16(30, 0, true);         // Extra field length
    cv.setUint16(32, 0, true);         // File comment length
    cv.setUint16(34, 0, true);         // Disk number start
    cv.setUint16(36, 0, true);         // Internal file attributes
    cv.setUint32(38, 0, true);         // External file attributes
    cv.setUint32(42, offset, true);    // Relative offset of local header
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((acc, arr) => acc + arr.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // End of central directory signature
  ev.setUint16(4, 0, true);          // Number of this disk
  ev.setUint16(6, 0, true);          // Disk where central directory starts
  ev.setUint16(8, files.length, true);  // Number of central directory records on this disk
  ev.setUint16(10, files.length, true); // Total number of central directory records
  ev.setUint32(12, centralSize, true);  // Size of central directory
  ev.setUint32(16, offset, true);       // Offset of start of central directory
  ev.setUint16(20, 0, true);            // Comment length

  const totalLength = offset + centralSize + eocd.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of localParts) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    result.set(part, pos);
    pos += part.length;
  }
  result.set(eocd, pos);
  return result;
}

function triggerBlobDownload(bytes: Uint8Array, filename: string, mimeType: string) {
  const blob = new Blob([bytes as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export interface MultiResearcherExportOptions {
  selectedResearchers: any[];
  publications: any[];
  exportYear: string;
}

/**
 * Generates individual Excel reports per selected researcher:
 * - If 1 researcher: downloads the single .xlsx file directly (NO zip).
 * - If multiple researchers: packages them into a clean .zip archive organized by department.
 */
export async function exportPerResearcherReportsByDepartment(
  options: MultiResearcherExportOptions
): Promise<{ exportedFiles: number; departments: string[]; isZip: boolean }> {
  const { selectedResearchers, publications, exportYear } = options;

  const generatedFiles: {
    department: string;
    fileName: string;
    prefixedFileName: string;
    relativePath: string;
    bytes: Uint8Array;
  }[] = [];

  const deptSet = new Set<string>();

  for (const researcher of selectedResearchers) {
    const dept = sanitizeFileSegment(researcher.department || "General");
    deptSet.add(dept);

    // Filter publications belonging to this researcher and matching the year filter
    const researcherPubs = publications
      .filter((pub) => matchesResearcher(pub, researcher))
      .filter((pub) => exportYear === "all" || String(pub.year) === String(exportYear));

    const wb = buildResearcherWorkbook(researcher, researcherPubs, exportYear);
    const wbArrayBuffer: ArrayBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
    });
    const bytes = new Uint8Array(wbArrayBuffer);
    const cleanName = sanitizeFileSegment(researcher.name || researcher.instructorId || "Researcher");
    const yearSuffix = exportYear === "all" ? "All_Years" : exportYear;
    const fileName = `${cleanName}_${yearSuffix}.xlsx`;
    const prefixedFileName = `[${dept}]_${cleanName}_${yearSuffix}.xlsx`;

    generatedFiles.push({
      department: dept,
      fileName,
      prefixedFileName,
      relativePath: `${dept}/${fileName}`,
      bytes,
    });
  }

  // Case 1: Single researcher — download the single .xlsx file directly (no ZIP)
  if (generatedFiles.length === 1) {
    const singleFile = generatedFiles[0];
    triggerBlobDownload(
      singleFile.bytes,
      singleFile.fileName,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    return {
      exportedFiles: 1,
      departments: Array.from(deptSet),
      isZip: false,
    };
  }

  // Case 2: Multiple researchers — package into a single clean ZIP archive
  const zipEntries: ZipEntryFile[] = generatedFiles.map((item) => ({
    path: `${item.department}/${item.fileName}`,
    data: item.bytes,
  }));
  const zipBytes = buildZipArchive(zipEntries);
  const zipName = `PSU_Faculty_Research_Reports_${exportYear === "all" ? "All_Years" : exportYear}.zip`;
  triggerBlobDownload(zipBytes, zipName, "application/zip");

  return {
    exportedFiles: generatedFiles.length,
    departments: Array.from(deptSet),
    isZip: true,
  };
}

/**
 * Exports a single publication (with its Publication Sheet and merged Citation Sheet)
 * directly as an .xlsx file.
 */
export function exportSinglePublicationToExcel(publication: any): void {
  const ownerName = publication.owner_name || publication.ownerName || "PSU_Researcher";
  const wb = buildResearcherWorkbook(
    { name: ownerName, instructorId: publication.owner_id || publication.ownerId || "" },
    [publication]
  );
  const wbArrayBuffer = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
  });
  const bytes = new Uint8Array(wbArrayBuffer);
  const safeTitle = sanitizeFileSegment(String(publication.title || "Publication").slice(0, 45));
  triggerBlobDownload(
    bytes,
    `${safeTitle}_Report.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

/**
 * Legacy helper maintained for compatibility
 */
export interface ExcelExportOptions {
  publications: any[];
  researchers: any[];
  exportDepartment: string;
  exportYear: string;
  departmentOrder?: string[];
  filename?: string;
}

export function exportResearchMatrixToExcel(options: ExcelExportOptions): void {
  const { publications, researchers, exportDepartment, exportYear } = options;
  const targetResearchers =
    exportDepartment === "all"
      ? researchers
      : researchers.filter((r) => r.department === exportDepartment);

  exportPerResearcherReportsByDepartment({
    selectedResearchers:
      targetResearchers.length > 0
        ? targetResearchers
        : [{ name: "PSU_Asingan_Campus", department: exportDepartment === "all" ? "Campus" : exportDepartment }],
    publications,
    exportYear,
  });
}
