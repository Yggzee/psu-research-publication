import { useState, useEffect } from "react";
import { FileBarChart, Download, Calendar, TrendingUp, Users, FileText, Award, Filter, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { apiService, type DashboardStatsResponse } from "../services/api.service";

type ReportType = "summary" | "researcher" | "department" | "yearly";

export function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>("summary");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [exportYear, setExportYear] = useState<string>("all");
  const [exportDepartment, setExportDepartment] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState<string | null>(null);

  // Database state
  const [researchersList, setResearchersList] = useState<any[]>([]);
  const [publicationsList, setPublicationsList] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardStatsResponse>({
    totalResearchers: 0,
    totalPublications: 0,
    totalCitations: 0,
    averageImpactScore: 0.0,
    topResearchers: [],
    deptYearStats: [],
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stats, researchers, pubs] = await Promise.all([
        apiService.getDashboardStats().catch(() => null),
        apiService.getResearchers().catch(() => []),
        apiService.getPublications().catch(() => []),
      ]);

      if (stats) setDashboardData(stats);
      if (Array.isArray(researchers)) setResearchersList(researchers);
      if (Array.isArray(pubs)) setPublicationsList(pubs);
    } catch (err) {
      console.warn("Failed to load reports data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate metrics from real data
  const totalCitations = dashboardData.totalCitations;
  const totalPublications = dashboardData.totalPublications;
  const totalResearchers = dashboardData.totalResearchers;
  const safeResearchers = Math.max(totalResearchers, 1);
  const safePubs = Math.max(totalPublications, 1);

  // Get unique years from publications
  const publicationYears = publicationsList.map((p: any) => p.year).filter(Boolean);
  const currentYear = new Date().getFullYear();
  const earliestYear = publicationYears.length > 0 ? Math.min(...publicationYears) : currentYear - 5;
  const latestYear = Math.max(currentYear, ...publicationYears);
  const years = Array.from(
    { length: latestYear - earliestYear + 1 },
    (_, index) => latestYear - index,
  );

  // Department order
  const departmentOrder = ["BSIT", "BSBA", "BEE", "BTLED", "BIT", "BSE", "Non Teaching"];

  // Department stats from researchers list
  const deptStats: { [key: string]: { researchers: number; citations: number; publications: number } } = {};
  researchersList.forEach((r: any) => {
    const dept = r.department || "Unassigned";
    if (!deptStats[dept]) {
      deptStats[dept] = { researchers: 0, citations: 0, publications: 0 };
    }
    deptStats[dept].researchers += 1;
    deptStats[dept].citations += r.totalCitations || 0;
    deptStats[dept].publications += r.totalPublications || 0;
  });

  const handleDownload = async () => {
    setIsExporting(true);
    setExportProgressText("Preparing publications for export...");

    const escapeCell = (value: string | number | undefined | null) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const escapeAttr = (value: string | number | undefined | null) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Filter publications to be exported
    const filteredToExport = publicationsList
      .filter((pub: any) => exportYear === "all" || pub.year?.toString() === exportYear)
      .filter((pub: any) => {
        if (exportDepartment === "all") return true;
        const researcher = researchersList.find(
          (r: any) => r.instructorId === pub.owner_id || r.instructorId === pub.ownerId
        );
        return researcher?.department === exportDepartment;
      });

    // Check publications that need citing papers fetched from server (e.g. if cached count is less than total citations)
    const needsCitingFetch = filteredToExport.filter(
      (p: any) => Number(p.citations) > 0 && (!p.citingPapers || p.citingPapers.length < Number(p.citations))
    );

    if (needsCitingFetch.length > 0) {
      for (let i = 0; i < needsCitingFetch.length; i++) {
        const targetPub = needsCitingFetch[i];
        setExportProgressText(`Fetching complete citation links (${i + 1} of ${needsCitingFetch.length})...`);
        try {
          const detailed = await apiService.getPublicationById(targetPub.id);
          if (detailed) {
            targetPub.citingPapers = (detailed as any).citingPapers || [];
            if ((detailed as any).citedByLink) targetPub.citedByLink = (detailed as any).citedByLink;
          }
        } catch (e) {
          console.warn("Could not fetch detailed citations for pub:", targetPub.id, e);
        }
      }
    }

    setExportProgressText("Generating Excel document...");

    const formatCitationsCell = (row: {
      citations: number;
      citedByLink?: string;
      citingPapers?: Array<{
        title: string;
        authors?: string;
        year?: number;
        link?: string;
      }>;
    }) => {
      const citing = Array.isArray(row.citingPapers) ? row.citingPapers : [];
      const totalCitations = Number(row.citations) || 0;
      const citedByLink = row.citedByLink || "";

      if (citing.length === 0 && !citedByLink && totalCitations === 0) {
        return `<span style="color: #64748b; font-size: 9pt;">0 citations</span>`;
      }

      const items: string[] = [];

      // Top count header in cell
      items.push(`
        <div style="font-weight: bold; color: #1e3a8a; font-size: 9.5pt; margin-bottom: 4px; padding-bottom: 2px; border-bottom: 1px solid #cbd5e1;">
          Total Citations: ${totalCitations}
        </div>
      `);

      if (citing.length > 0) {
        citing.forEach((cp, idx) => {
          const num = idx + 1;
          const title = cp.title || `Citing Paper #${num}`;
          const yearStr = cp.year ? ` (${cp.year})` : "";
          let paperLink = cp.link || "";
          if (!paperLink && citedByLink) {
            paperLink = citedByLink;
          }

          const titlePart = paperLink
            ? `<a href="${escapeAttr(paperLink)}" target="_blank" style="color: #1a0dab; text-decoration: underline; font-weight: 500;">${escapeCell(title)}</a>`
            : `<span style="color: #0f172a; font-weight: 500;">${escapeCell(title)}</span>`;

          const linkPart = paperLink
            ? ` &mdash; <a href="${escapeAttr(paperLink)}" target="_blank" style="color: #047857; font-size: 8.5pt; text-decoration: underline;">${escapeCell(paperLink)}</a>`
            : "";

          const itemHtml = `<div style="font-size: 8.5pt; line-height: 1.3; margin-bottom: 2px; font-family: Segoe UI, Calibri, sans-serif;"><strong>[${num}] </strong>${titlePart}${escapeCell(yearStr)}${linkPart}</div>`;
          items.push(itemHtml);
        });

        // Provide every remaining citation number from citing.length + 1 up to totalCitations
        if (totalCitations > citing.length && citedByLink) {
          const citesMatch = citedByLink.match(/cites=(\d+)/);
          const citesId = citesMatch ? citesMatch[1] : "";
          for (let rem = citing.length + 1; rem <= totalCitations; rem++) {
            const pageStart = Math.floor((rem - 1) / 10) * 10;
            const entryUrl = citesId
              ? `https://scholar.google.com/scholar?cites=${citesId}&hl=en&start=${pageStart}`
              : citedByLink;

            const itemHtml = `<div style="font-size: 8.5pt; line-height: 1.3; margin-bottom: 2px; font-family: Segoe UI, Calibri, sans-serif;"><strong>[${rem}] </strong><a href="${escapeAttr(entryUrl)}" target="_blank" style="color: #1a0dab; text-decoration: underline; font-weight: 500;">Google Scholar Citation Index Entry #${rem}</a> &mdash; <a href="${escapeAttr(entryUrl)}" target="_blank" style="color: #047857; font-size: 8.5pt; text-decoration: underline;">${escapeCell(entryUrl)}</a></div>`;
            items.push(itemHtml);
          }
        }
      } else if (citedByLink) {
        // If citing array is empty, generate numbered links for every single citation up to totalCitations
        const citesMatch = citedByLink.match(/cites=(\d+)/);
        const citesId = citesMatch ? citesMatch[1] : "";
        for (let rem = 1; rem <= Math.max(totalCitations, 1); rem++) {
          const pageStart = Math.floor((rem - 1) / 10) * 10;
          const entryUrl = citesId
            ? `https://scholar.google.com/scholar?cites=${citesId}&hl=en&start=${pageStart}`
            : citedByLink;

          const itemHtml = `<div style="font-size: 8.5pt; line-height: 1.3; margin-bottom: 2px; font-family: Segoe UI, Calibri, sans-serif;"><strong>[${rem}] </strong><a href="${escapeAttr(entryUrl)}" target="_blank" style="color: #1a0dab; text-decoration: underline; font-weight: 500;">Google Scholar Citation Link #${rem}</a> &mdash; <a href="${escapeAttr(entryUrl)}" target="_blank" style="color: #047857; font-size: 8.5pt; text-decoration: underline;">${escapeCell(entryUrl)}</a></div>`;
          items.push(itemHtml);
        }
      } else {
        items.push(`<span style="font-size: 9.5pt; color: #334155;">${totalCitations} citation${totalCitations === 1 ? "" : "s"}</span>`);
      }

      return items.join("");
    };

    const rows = filteredToExport.map((pub: any) => {
      const researcher = researchersList.find(
        (r: any) => r.instructorId === pub.owner_id || r.instructorId === pub.ownerId
      );
      return {
        title: pub.title,
        url: pub.url || "",
        authors: Array.isArray(pub.authors) ? pub.authors.join(", ") : pub.authors,
        researcher: pub.owner_name || pub.ownerName || researcher?.name || "Unknown",
        department: researcher?.department || "Unassigned",
        journal: pub.journal || "",
        year: pub.year,
        citations: pub.citations || 0,
        citedByLink: pub.citedByLink || pub.cited_by_link || "",
        citingPapers: pub.citingPapers || [],
      };
    });

    const tableRows = rows.map((row) => `
      <tr>
        <td>${row.url ? `<a href="${escapeAttr(row.url)}" target="_blank" style="color: #1a0dab; text-decoration: underline; font-weight: 500;">${escapeCell(row.title)}</a>` : escapeCell(row.title)}</td>
        <td>${escapeCell(row.authors)}</td>
        <td>${escapeCell(row.researcher)}</td>
        <td>${escapeCell(row.department)}</td>
        <td>${escapeCell(row.journal)}</td>
        <td class="year-col">${escapeCell(row.year)}</td>
        <td class="citation-cell">${formatCitationsCell(row)}</td>
      </tr>`).join("");

    const workbook = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Research Publications</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          table { border-collapse: collapse; width: 100%; }
          th {
            background-color: #1e40af;
            color: #ffffff;
            font-weight: bold;
            border: 1px solid #94a3b8;
            padding: 10px 12px;
            text-align: left;
            vertical-align: middle;
            font-size: 11pt;
          }
          td {
            border: 1px solid #cbd5e1;
            padding: 10px 12px;
            vertical-align: top;
            font-size: 10.5pt;
            mso-number-format: "\\@";
          }
          .year-col {
            text-align: center;
            mso-number-format: "0";
          }
          .citation-cell {
            vertical-align: top;
          }
          a {
            color: #1d4ed8;
            text-decoration: underline;
          }
          br {
            mso-data-placement: same-cell;
          }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th style="min-width: 250px;">Title</th>
              <th style="min-width: 180px;">Authors</th>
              <th style="min-width: 160px;">Researcher</th>
              <th style="min-width: 110px;">Department</th>
              <th style="min-width: 160px;">Journal</th>
              <th style="min-width: 70px; text-align: center;">Year</th>
              <th style="min-width: 380px;">Citations / Cited Papers</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>`;

    const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `psu-research-${exportDepartment}-${exportYear}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
    setExportProgressText(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Reports</h1>
          <p className="text-gray-600 dark:text-gray-300">Generate and export research performance reports from database</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="self-start dark:border-gray-700">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-blue-200 dark:border-blue-900/60 dark:bg-card">
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-gray-100 font-semibold">Download Excel Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="export-year" className="text-gray-700 dark:text-gray-300">Filter by year</Label>
              <Select value={exportYear} onValueChange={setExportYear}>
                <SelectTrigger id="export-year" className="dark:border-gray-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((year) => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-department" className="text-gray-700 dark:text-gray-300">Filter by department</Label>
              <Select value={exportDepartment} onValueChange={setExportDepartment}>
                <SelectTrigger id="export-department" className="dark:border-gray-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departmentOrder.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleDownload} disabled={isExporting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {exportProgressText || "Exporting..."}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download Excel
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Type Selector */}
      <Card className="dark:border-gray-800">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Report Type:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedReport === "summary" ? "default" : "outline"}
                onClick={() => setSelectedReport("summary")}
                className={selectedReport === "summary" ? "bg-blue-600 text-white" : "dark:border-gray-700 text-foreground"}
              >
                Summary
              </Button>
              <Button
                variant={selectedReport === "researcher" ? "default" : "outline"}
                onClick={() => setSelectedReport("researcher")}
                className={selectedReport === "researcher" ? "bg-blue-600 text-white" : "dark:border-gray-700 text-foreground"}
              >
                By Researcher
              </Button>
              <Button
                variant={selectedReport === "department" ? "default" : "outline"}
                onClick={() => setSelectedReport("department")}
                className={selectedReport === "department" ? "bg-blue-600 text-white" : "dark:border-gray-700 text-foreground"}
              >
                By Department
              </Button>
              <Button
                variant={selectedReport === "yearly" ? "default" : "outline"}
                onClick={() => setSelectedReport("yearly")}
                className={selectedReport === "yearly" ? "bg-blue-600 text-white" : "dark:border-gray-700 text-foreground"}
              >
                Yearly Trends
              </Button>
            </div>
            {selectedReport === "yearly" && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="ml-auto px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-accent"
              >
                <option value="all">All Years</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Report */}
      {selectedReport === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="dark:border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-gray-700 dark:text-gray-300 font-semibold">Total Researchers</CardTitle>
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalResearchers}</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Active faculty members</p>
              </CardContent>
            </Card>

            <Card className="dark:border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-gray-700 dark:text-gray-300 font-semibold">Total Publications</CardTitle>
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalPublications}</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Across all departments</p>
              </CardContent>
            </Card>

            <Card className="dark:border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-gray-700 dark:text-gray-300 font-semibold">Total Citations</CardTitle>
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalCitations.toLocaleString()}</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Combined impact</p>
              </CardContent>
            </Card>
          </div>

          <Card className="dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-base text-gray-900 dark:text-gray-100 font-semibold">Overall Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-700 dark:text-gray-300">Average Citations per Researcher</span>
                  <span className="text-gray-900 dark:text-gray-100 font-bold">
                    {(totalCitations / safeResearchers).toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-700 dark:text-gray-300">Average Publications per Researcher</span>
                  <span className="text-gray-900 dark:text-gray-100 font-bold">
                    {(totalPublications / safeResearchers).toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-700 dark:text-gray-300">Average Citations per Publication</span>
                  <span className="text-gray-900 dark:text-gray-100 font-bold">
                    {(totalCitations / safePubs).toFixed(1)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Researcher Report */}
      {selectedReport === "researcher" && (
        <Card className="dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-900 dark:text-gray-100 font-semibold">Researcher Performance Report</CardTitle>
          </CardHeader>
          <CardContent>
            {researchersList.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                <Users className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm">No researchers in the database yet.</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add researchers from the Admin Panel.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Researcher</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Department</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Publications</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Citations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {researchersList.map((researcher: any) => (
                      <tr key={researcher.id || researcher.instructorId} className="border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 font-medium">{researcher.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{researcher.department}</td>
                        <td className="text-center py-3 px-4 text-sm text-gray-900 dark:text-gray-100 font-semibold">
                          {researcher.totalPublications || 0}
                        </td>
                        <td className="text-center py-3 px-4 text-sm text-gray-900 dark:text-gray-100 font-semibold">
                          {researcher.totalCitations || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Department Report */}
      {selectedReport === "department" && (
        <Card className="dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-900 dark:text-gray-100 font-semibold">Department Performance Report</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(deptStats).length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                <FileBarChart className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm">No department data yet.</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Data will appear once researchers are added.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Department</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Researchers</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Publications</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Citations</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Avg Citations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(deptStats)
                      .sort((a, b) => {
                        const indexA = departmentOrder.indexOf(a[0]);
                        const indexB = departmentOrder.indexOf(b[0]);
                        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                      })
                      .map(([dept, stats]) => (
                        <tr key={dept} className="border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 font-medium">{dept}</td>
                          <td className="text-center py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                            {stats.researchers}
                          </td>
                          <td className="text-center py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                            {stats.publications}
                          </td>
                          <td className="text-center py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                            {stats.citations}
                          </td>
                          <td className="text-center py-3 px-4 text-sm text-gray-900 dark:text-gray-100 font-semibold">
                            {(stats.citations / Math.max(stats.researchers, 1)).toFixed(0)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Yearly Trends Report */}
      {selectedReport === "yearly" && (
        <div className="space-y-4">
          {publicationsList.length === 0 ? (
            <Card className="dark:border-gray-800">
              <CardContent className="py-8 text-center text-gray-500 dark:text-gray-400">
                <Calendar className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm">No publications to generate yearly trends.</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Publications will appear as researchers add their work.</p>
              </CardContent>
            </Card>
          ) : (
            years.map((year) => {
              const yearPubs = publicationsList.filter((pub: any) => pub.year === year);
              const yearCitations = yearPubs.reduce((sum: number, pub: any) => sum + (pub.citations || 0), 0);

              if (selectedYear !== "all" && selectedYear !== year.toString()) {
                return null;
              }

              if (yearPubs.length === 0 && selectedYear === "all") {
                return null;
              }

              return (
                <Card key={year} className="dark:border-gray-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-gray-900 dark:text-gray-100">{year} Research Output</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {year}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Publications</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{yearPubs.length}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total Citations</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{yearCitations}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Avg Citations/Pub</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {yearPubs.length > 0 ? (yearCitations / yearPubs.length).toFixed(1) : 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
