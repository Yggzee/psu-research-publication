import XLSXStyle from "xlsx-js-style";
import { matchesResearcher } from "./facultyUtils";

// Safe reference for bundlers (handles default or namespace import)
const XLSX: any = (XLSXStyle as any)?.default || XLSXStyle;

const COLOR_BLACK = "000000";

export interface BoxBorderEdges {
  isTop?: boolean;
  isBottom?: boolean;
  isLeft?: boolean;
  isRight?: boolean;
}

/**
 * Builds cell borders where the outermost perimeter of a publication block uses
 * a larger ('medium') border and all interior cell boundaries use standard ('thin') borders.
 */
function buildBoxBorder(edges: BoxBorderEdges = {}) {
  const thin = { style: "thin", color: { rgb: COLOR_BLACK } };
  const outer = { style: "medium", color: { rgb: COLOR_BLACK } };
  return {
    top: edges.isTop ? outer : thin,
    bottom: edges.isBottom ? outer : thin,
    left: edges.isLeft ? outer : thin,
    right: edges.isRight ? outer : thin,
  };
}

function escapeFormula(str: string): string {
  return String(str || "").replace(/"/g, '""');
}

function createTextCell(
  value: string | number | undefined | null,
  options: {
    bold?: boolean;
    align?: "left" | "center" | "right";
    vAlign?: "top" | "center" | "bottom";
    italic?: boolean;
    edges?: BoxBorderEdges;
  } = {}
) {
  const align = options.align || "left";
  const vAlign = options.vAlign || "top";
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
        color: { rgb: COLOR_BLACK },
      },
      alignment: { horizontal: align, vertical: vAlign, wrapText: true },
      border: buildBoxBorder(options.edges),
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
    edges?: BoxBorderEdges;
  } = {}
) {
  const cleanUrl = String(url || "").trim();
  const align = options.align || "left";
  const vAlign = options.vAlign || "top";

  if (!cleanUrl || cleanUrl === "#" || cleanUrl === "—") {
    return createTextCell("", { align, vAlign, edges: options.edges });
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
        sz: 10,
        bold: Boolean(options.bold),
        color: { rgb: COLOR_BLACK },
        underline: true,
      },
      alignment: { horizontal: align, vertical: vAlign, wrapText: true },
      border: buildBoxBorder(options.edges),
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

export function sanitizeSheetName(name: string, fallback = "Sheet"): string {
  let clean = String(name || fallback)
    .replace(/[\\/?*:[\]]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  return clean || fallback.slice(0, 31);
}

/**
 * Builds the 8-column Publication Worksheet starting directly at Row 1 (no titles, no fills, top-aligned,
 * medium outer border per publication row and thin interior borders).
 */
export function buildPublicationWorksheet(options: {
  mainTitle?: string;
  subtitle?: string;
  publications: any[];
  researcherName?: string;
  department?: string;
  exportYear?: string;
}): any {
  const wsPub: any = {};
  const researcherName = options.researcherName || "Researcher";

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
  const totalCols = pubCols.length;
  const pubHeaderRow = 1;

  pubHeaders.forEach((col, i) => {
    wsPub[`${pubCols[i]}${pubHeaderRow}`] = createTextCell(col.label, {
      bold: true,
      align: "center",
      vAlign: "top",
      edges: {
        isTop: true,
        isBottom: true,
        isLeft: i === 0,
        isRight: i === totalCols - 1,
      },
    });
  });

  let pubRow = 2;
  const rowHeightsPub: any[] = [{ hpt: 28 }];

  const pubs = options.publications || [];
  if (pubs.length === 0) {
    for (let c = 0; c < totalCols; c++) {
      wsPub[`${pubCols[c]}${pubRow}`] = createTextCell(
        c === 0 ? "No publications recorded for the selected filter." : "",
        {
          italic: c === 0,
          vAlign: "top",
          edges: {
            isTop: true,
            isBottom: true,
            isLeft: c === 0,
            isRight: c === totalCols - 1,
          },
        }
      );
    }
    rowHeightsPub.push({ hpt: 24 });
    pubRow++;
  } else {
    pubs.forEach((pub) => {
      const allAuthorsStr = formatAllAuthors(pub.authors, pub.owner_name || pub.ownerName || researcherName);
      const authorLines = allAuthorsStr.split("\n").length;

      const pubDate =
        pub.publication_date ||
        pub.publicationDate ||
        (pub.year ? String(pub.year) : "");
      const journalTitle = pub.journal || "";
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

      const rowValues = [
        pub.title || "Untitled Publication",
        allAuthorsStr,
        pubDate,
        journalTitle,
        volIssue,
        issnIsbn,
        indexing,
      ];

      rowValues.forEach((val, c) => {
        wsPub[`${pubCols[c]}${pubRow}`] = createTextCell(val, {
          align: "left",
          vAlign: "top",
          edges: {
            isTop: true,
            isBottom: true,
            isLeft: c === 0,
            isRight: false,
          },
        });
      });

      wsPub[`H${pubRow}`] = createHyperlinkCell(evidenceLink, evidenceLink, {
        align: "left",
        vAlign: "top",
        edges: {
          isTop: true,
          isBottom: true,
          isLeft: false,
          isRight: true,
        },
      });

      const titleLines = Math.ceil(String(pub.title || "").length / 42);
      const maxLines = Math.max(authorLines, titleLines, 2);
      const estimatedHeight = Math.max(26, Math.min(180, maxLines * 15 + 8));
      rowHeightsPub.push({ hpt: estimatedHeight });
      pubRow++;
    });
  }

  wsPub["!ref"] = `A1:H${Math.max(pubRow - 1, 2)}`;
  wsPub["!cols"] = pubHeaders.map((c) => ({ wch: c.wch }));
  wsPub["!rows"] = rowHeightsPub;

  return wsPub;
}

/**
 * Builds the 16-column Citation Worksheet matching the reference file (Columns A–P, starting at Row 1,
 * no fill colors, plain black text, top-aligned cells, merged Columns A–H per publication,
 * and a 'medium' outer border wrapping each publication + all its citations with 'thin' inside borders).
 */
export function buildCitationWorksheet(options: {
  mainTitle?: string;
  subtitle?: string;
  publications: any[];
  researcherName?: string;
  department?: string;
  exportYear?: string;
}): any {
  const wsCite: any = {};
  const researcherName = options.researcherName || "Researcher";

  // 16 Columns (A–P):
  // Columns A–H (0–7): Parent PSU Research Output
  // Columns I–P (8–15): Citing Articles (including 'Name of Publisher' at O and 'Link' at P)
  const citeHeaders = [
    { label: "Title of Research Output", wch: 40 },
    { label: "Keywords", wch: 26 },
    { label: "Researcher(s)", wch: 28 },
    { label: "Journal", wch: 28 },
    { label: "ISSN/DOI", wch: 24 },
    { label: "Year Published", wch: 15 },
    { label: "Level", wch: 16 },
    { label: "Link", wch: 34 },
    { label: "Author(s) Who Cited the Research Output", wch: 32 },
    { label: "Title of Article Where the Research Output Was Cited", wch: 44 },
    { label: "Title of Journal", wch: 30 },
    { label: "Vol. / Issue / Page No.", wch: 24 },
    { label: "City/Year Published", wch: 18 },
    { label: "Quarter", wch: 14 },
    { label: "Name of Publisher", wch: 28 },
    { label: "Link", wch: 38 },
  ];

  const citeCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
  const totalCols = citeCols.length;
  const citeHeaderRow = 1;

  citeHeaders.forEach((col, i) => {
    wsCite[`${citeCols[i]}${citeHeaderRow}`] = createTextCell(col.label, {
      bold: true,
      align: "center",
      vAlign: "top",
      edges: {
        isTop: true,
        isBottom: true,
        isLeft: i === 0,
        isRight: i === totalCols - 1,
      },
    });
  });

  let citeRow = 2;
  const rowHeightsCite: any[] = [{ hpt: 30 }];
  const citeMerges: any[] = [];

  const pubs = options.publications || [];
  if (pubs.length === 0) {
    for (let c = 0; c < totalCols; c++) {
      wsCite[`${citeCols[c]}${citeRow}`] = createTextCell(
        c === 0 ? "No citation records found for the selected filter." : "",
        {
          italic: c === 0,
          vAlign: "top",
          edges: {
            isTop: true,
            isBottom: true,
            isLeft: c === 0,
            isRight: c === totalCols - 1,
          },
        }
      );
    }
    rowHeightsCite.push({ hpt: 24 });
    citeRow++;
  } else {
    pubs.forEach((pub) => {
      const parentAuthors = formatAllAuthors(pub.authors, pub.owner_name || pub.ownerName || researcherName);
      const keywords = deriveKeywords(pub);
      const journal = pub.journal || "";
      const issnDoi =
        pub.issn_isbn ||
        pub.issnIsbn ||
        (pub.doi ? `https://doi.org/${pub.doi}` : "");
      const yearPub = pub.year || "";
      const level = pub.publication_level || pub.publicationLevel || "International";
      const parentLink = pub.url || pub.citedByLink || pub.cited_by_link || "";

      const citingList = Array.isArray(pub.citingPapers) ? pub.citingPapers : [];

      if (citingList.length === 0) {
        // Single-row block when publication has 0 citing papers
        const parentValues = [
          pub.title || "Untitled Publication",
          keywords,
          parentAuthors,
          journal,
          issnDoi,
          yearPub,
          level,
        ];
        parentValues.forEach((val, c) => {
          wsCite[`${citeCols[c]}${citeRow}`] = createTextCell(val, {
            align: "left",
            vAlign: "top",
            edges: {
              isTop: true,
              isBottom: true,
              isLeft: c === 0,
              isRight: false,
            },
          });
        });

        wsCite[`H${citeRow}`] = createHyperlinkCell(parentLink, parentLink, {
          align: "left",
          vAlign: "top",
          edges: { isTop: true, isBottom: true, isLeft: false, isRight: false },
        });

        for (let c = 8; c < totalCols; c++) {
          wsCite[`${citeCols[c]}${citeRow}`] = createTextCell("", {
            align: "left",
            vAlign: "top",
            edges: {
              isTop: true,
              isBottom: true,
              isLeft: false,
              isRight: c === totalCols - 1,
            },
          });
        }

        const lines = Math.max(parentAuthors.split("\n").length, 2);
        rowHeightsCite.push({ hpt: Math.max(26, Math.min(140, lines * 15 + 8)) });
        citeRow++;
      } else {
        const startCiteRow = citeRow;
        const endCiteRow = startCiteRow + citingList.length - 1;

        // Vertically merge Columns A–H (indices 0–7) across all citing rows for this publication
        if (citingList.length > 1) {
          for (let colIdx = 0; colIdx < 8; colIdx++) {
            citeMerges.push({
              s: { r: startCiteRow - 1, c: colIdx },
              e: { r: endCiteRow - 1, c: colIdx },
            });
          }
        }

        citingList.forEach((cp: any, citeIdx: number) => {
          const isFirstRow = citeIdx === 0;
          const isLastRow = citeIdx === citingList.length - 1;

          // Columns A–H (0–7)
          if (isFirstRow) {
            const parentValues = [
              pub.title || "Untitled Publication",
              keywords,
              parentAuthors,
              journal,
              issnDoi,
              yearPub,
              level,
            ];
            parentValues.forEach((val, c) => {
              wsCite[`${citeCols[c]}${citeRow}`] = createTextCell(val, {
                align: "left",
                vAlign: "top",
                edges: {
                  isTop: true,
                  isBottom: isLastRow,
                  isLeft: c === 0,
                  isRight: false,
                },
              });
            });
            wsCite[`H${citeRow}`] = createHyperlinkCell(parentLink, parentLink, {
              align: "left",
              vAlign: "top",
              edges: {
                isTop: true,
                isBottom: isLastRow,
                isLeft: false,
                isRight: false,
              },
            });
          } else {
            for (let c = 0; c < 8; c++) {
              wsCite[`${citeCols[c]}${citeRow}`] = createTextCell("", {
                align: "left",
                vAlign: "top",
                edges: {
                  isTop: false,
                  isBottom: isLastRow,
                  isLeft: c === 0,
                  isRight: false,
                },
              });
            }
          }

          // Columns I–P (8–15)
          const citingAuthorsStr = formatAllAuthors(cp.authors, "");
          const citingTitle = cp.title || "";
          const citingJournal = cp.journal || cp.publisher || "";
          const citingVolIssue = cp.volume_issue || cp.volumeIssue || cp.doi_issn || "";
          const citingYear = cp.year || "";
          const citingQuarter = cp.quarter || "First";
          const citingPublisher = cp.publisher || cp.journal || "";
          const citingLink = cp.link || cp.url || "";

          const citingValues = [
            citingAuthorsStr, // I (8)
            citingTitle,      // J (9)
            citingJournal,    // K (10)
            citingVolIssue,   // L (11)
            citingYear,       // M (12)
            citingQuarter,    // N (13)
            citingPublisher,  // O (14)
          ];

          citingValues.forEach((val, idx) => {
            const colIndex = 8 + idx;
            wsCite[`${citeCols[colIndex]}${citeRow}`] = createTextCell(val, {
              align: "left",
              vAlign: "top",
              edges: {
                isTop: isFirstRow,
                isBottom: isLastRow,
                isLeft: false,
                isRight: false,
              },
            });
          });

          // Column P (15): Citing Link (rightmost boundary of the publication block)
          wsCite[`P${citeRow}`] = createHyperlinkCell(citingLink, citingLink, {
            align: "left",
            vAlign: "top",
            edges: {
              isTop: isFirstRow,
              isBottom: isLastRow,
              isLeft: false,
              isRight: true,
            },
          });

          const maxLines = Math.max(
            citingList.length === 1 ? parentAuthors.split("\n").length : 1,
            citingAuthorsStr.split("\n").length,
            Math.ceil(citingTitle.length / 42),
            2
          );
          rowHeightsCite.push({ hpt: Math.max(26, Math.min(160, maxLines * 15 + 8)) });
          citeRow++;
        });
      }
    });
  }

  wsCite["!ref"] = `A1:P${Math.max(citeRow - 1, 2)}`;
  wsCite["!cols"] = citeHeaders.map((c) => ({ wch: c.wch }));
  wsCite["!rows"] = rowHeightsCite;
  wsCite["!merges"] = citeMerges;

  return wsCite;
}

/**
 * Builds the 2-sheet Excel Workbook ('Publication' + 'Citation') for a single researcher
 * matching the official PSU Asingan Campus Research Coordinator format.
 */
export function buildResearcherWorkbook(
  researcher: any,
  researcherPublications: any[],
  exportYear = "all"
): any {
  const workbook = XLSX.utils.book_new();
  const researcherName = researcher?.name || "Researcher";
  const department = researcher?.department || "Unassigned";

  const wsPub = buildPublicationWorksheet({
    researcherName,
    department,
    exportYear,
    publications: researcherPublications,
  });
  XLSX.utils.book_append_sheet(workbook, wsPub, "Publication");

  const wsCite = buildCitationWorksheet({
    researcherName,
    department,
    exportYear,
    publications: researcherPublications,
  });
  XLSX.utils.book_append_sheet(workbook, wsCite, "Citation");

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
  path: string;
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

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5421, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((acc, arr) => acc + arr.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

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

export interface ExportReportResult {
  success: boolean;
  count: number;
  exportedFiles: number;
  departments: string[];
  isZip: boolean;
  mode: "single" | "zip";
  filename: string;
}

/**
 * Generates individual Excel reports per selected researcher:
 * - If 1 researcher: downloads the single .xlsx file directly (NO zip).
 * - If multiple researchers: packages them into a clean .zip archive organized by department and researcher folder.
 */
export async function exportPerResearcherReportsByDepartment(
  options: MultiResearcherExportOptions
): Promise<ExportReportResult> {
  const { selectedResearchers, publications, exportYear } = options;

  const generatedFiles: {
    department: string;
    cleanName: string;
    fileName: string;
    prefixedFileName: string;
    relativePath: string;
    bytes: Uint8Array;
  }[] = [];

  const deptSet = new Set<string>();

  for (const researcher of selectedResearchers) {
    const dept = sanitizeFileSegment(researcher.department || "General");
    deptSet.add(dept);

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
      cleanName,
      fileName,
      prefixedFileName,
      relativePath: `${dept}/${cleanName}/${fileName}`,
      bytes,
    });
  }

  if (generatedFiles.length === 1) {
    const singleFile = generatedFiles[0];
    triggerBlobDownload(
      singleFile.bytes,
      singleFile.fileName,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    return {
      success: true,
      count: 1,
      exportedFiles: 1,
      departments: Array.from(deptSet),
      isZip: false,
      mode: "single",
      filename: singleFile.fileName,
    };
  }

  const zipEntries: ZipEntryFile[] = generatedFiles.map((item) => ({
    path: `${item.department}/${item.cleanName}/${item.fileName}`,
    data: item.bytes,
  }));
  const zipBytes = buildZipArchive(zipEntries);
  const zipName = `PSU_Research_Reports_${exportYear === "all" ? "All_Years" : exportYear}.zip`;
  triggerBlobDownload(zipBytes, zipName, "application/zip");

  return {
    success: true,
    count: generatedFiles.length,
    exportedFiles: generatedFiles.length,
    departments: Array.from(deptSet),
    isZip: true,
    mode: "zip",
    filename: zipName,
  };
}

/**
 * Exports multiple researchers into ONE single Excel file:
 * - Sheet 1: Master "Publication" (combined publications for all selected researchers)
 * - Sheet 2: Master "Citation" (combined citations for all selected researchers)
 * - Subsequent Sheets: Dedicated individual tabs for each researcher
 */
export function exportCombinedResearchersToSingleWorkbook(options: {
  selectedResearchers: any[];
  publications: any[];
  exportYear?: string;
  filename?: string;
  title?: string;
}): ExportReportResult {
  const { selectedResearchers, publications, exportYear = "all" } = options;
  if (!selectedResearchers || selectedResearchers.length === 0) {
    throw new Error("No researchers selected for export.");
  }

  const workbook = XLSX.utils.book_new();

  const targetPubs = publications.filter((pub: any) => {
    const matchesYear = exportYear === "all" || String(pub.year) === String(exportYear);
    const belongsToSelected = selectedResearchers.some((r: any) => matchesResearcher(pub, r));
    return matchesYear && belongsToSelected;
  });

  const yearSuffix = exportYear === "all" ? "All_Years" : exportYear;

  // Sheet 1: Combined Master Publication Sheet (8 columns)
  const masterWsPub = buildPublicationWorksheet({
    publications: targetPubs,
    researcherName: "All Selected Researchers",
    department: "Campus",
    exportYear,
  });
  XLSX.utils.book_append_sheet(workbook, masterWsPub, "Publication");

  // Sheet 2: Combined Master Citation Sheet (16 columns)
  const masterWsCite = buildCitationWorksheet({
    publications: targetPubs,
    researcherName: "All Selected Researchers",
    department: "Campus",
    exportYear,
  });
  XLSX.utils.book_append_sheet(workbook, masterWsCite, "Citation");

  // Subsequent Sheets: Dedicated tab per selected researcher
  const usedSheetNames = new Set<string>(["publication", "citation"]);
  for (const researcher of selectedResearchers) {
    const researcherPubs = publications.filter(
      (pub: any) =>
        matchesResearcher(pub, researcher) &&
        (exportYear === "all" || String(pub.year) === String(exportYear))
    );
    const rawName = researcher.name || researcher.instructorId || "Researcher";
    const baseSheetName = sanitizeSheetName(rawName, "Researcher");
    let finalSheetName = baseSheetName;
    let counter = 1;
    while (usedSheetNames.has(finalSheetName.toLowerCase())) {
      const suffix = `_${counter}`;
      finalSheetName = `${baseSheetName.slice(0, 31 - suffix.length)}${suffix}`;
      counter++;
    }
    usedSheetNames.add(finalSheetName.toLowerCase());

    const wsResearcherPub = buildPublicationWorksheet({
      publications: researcherPubs,
      researcherName: researcher.name,
      department: researcher.department,
      exportYear,
    });
    XLSX.utils.book_append_sheet(workbook, wsResearcherPub, finalSheetName);
  }

  const wbArrayBuffer: ArrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const bytes = new Uint8Array(wbArrayBuffer);
  const outFilename =
    options.filename ||
    `PSU_Combined_${selectedResearchers.length}_Researchers_${yearSuffix}.xlsx`;

  triggerBlobDownload(
    bytes,
    outFilename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  const deptSet = new Set<string>(selectedResearchers.map((r: any) => r.department || "General"));

  return {
    success: true,
    count: selectedResearchers.length,
    exportedFiles: 1,
    departments: Array.from(deptSet),
    isZip: false,
    mode: "single",
    filename: outFilename,
  };
}

/**
 * Exports 1 or more specific publications selected by the user into an official Excel file
 * (Sheet 1: 'Publication' with the exact 8 columns; Sheet 2: 'Citation' with the exact 16 columns).
 */
export function exportSelectedPublicationsToExcel(
  selectedPublications: any[],
  options?: { title?: string; filename?: string; exportYear?: string }
): ExportReportResult {
  if (!selectedPublications || selectedPublications.length === 0) {
    throw new Error("No publications selected for export.");
  }

  const workbook = XLSX.utils.book_new();
  const exportYear = options?.exportYear || "all";
  const yearSuffix = exportYear === "all" ? "All_Years" : exportYear;
  const count = selectedPublications.length;

  const wsPub = buildPublicationWorksheet({
    publications: selectedPublications,
    researcherName:
      count === 1
        ? selectedPublications[0].owner_name || selectedPublications[0].ownerName || "Researcher"
        : "Selected Researchers",
    exportYear,
  });
  XLSX.utils.book_append_sheet(workbook, wsPub, "Publication");

  const wsCite = buildCitationWorksheet({
    publications: selectedPublications,
    researcherName:
      count === 1
        ? selectedPublications[0].owner_name || selectedPublications[0].ownerName || "Researcher"
        : "Selected Researchers",
    exportYear,
  });
  XLSX.utils.book_append_sheet(workbook, wsCite, "Citation");

  const wbArrayBuffer: ArrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const bytes = new Uint8Array(wbArrayBuffer);
  const outFilename =
    options?.filename ||
    (count === 1
      ? `${sanitizeFileSegment(String(selectedPublications[0].title || "Publication").slice(0, 45))}_Report.xlsx`
      : `PSU_Selected_${count}_Publications_${yearSuffix}.xlsx`);

  triggerBlobDownload(
    bytes,
    outFilename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  return {
    success: true,
    count,
    exportedFiles: 1,
    departments: [],
    isZip: false,
    mode: "single",
    filename: outFilename,
  };
}

/**
 * Exports a single publication (with its 'Publication' and merged 'Citation' sheets)
 * directly as an .xlsx file.
 */
export function exportSinglePublicationToExcel(publication: any): void {
  exportSelectedPublicationsToExcel([publication]);
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
