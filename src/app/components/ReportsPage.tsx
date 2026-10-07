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

  const handleDownload = () => {
    const rows = publicationsList
      .filter((pub: any) => exportYear === "all" || pub.year?.toString() === exportYear)
      .filter((pub: any) => {
        if (exportDepartment === "all") return true;
        const researcher = researchersList.find(
          (r: any) => r.instructorId === pub.owner_id || r.instructorId === pub.ownerId
        );
        return researcher?.department === exportDepartment;
      })
      .map((pub: any) => {
        const researcher = researchersList.find(
          (r: any) => r.instructorId === pub.owner_id || r.instructorId === pub.ownerId
        );
        return {
          title: pub.title,
          authors: Array.isArray(pub.authors) ? pub.authors.join(", ") : pub.authors,
          researcher: pub.owner_name || pub.ownerName || researcher?.name || "Unknown",
          department: researcher?.department || "Unassigned",
          journal: pub.journal || "",
          year: pub.year,
          citations: pub.citations || 0,
        };
      });

    const escapeCell = (value: string | number) =>
      String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const tableRows = rows.map((row) => `
      <tr>
        <td>${escapeCell(row.title)}</td>
        <td>${escapeCell(row.authors)}</td>
        <td>${escapeCell(row.researcher)}</td>
        <td>${escapeCell(row.department)}</td>
        <td>${escapeCell(row.journal)}</td>
        <td>${row.year}</td>
        <td>${row.citations}</td>
      </tr>`).join("");
    const workbook = `
      <html><head><meta charset="UTF-8"></head><body>
        <table>
          <thead><tr><th>Title</th><th>Authors</th><th>Researcher</th><th>Department</th><th>Journal</th><th>Year</th><th>Citations</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body></html>`;
    const blob = new Blob([workbook], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `psu-research-${exportDepartment}-${exportYear}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl text-gray-900 mb-2">Reports</h1>
          <p className="text-gray-600">Generate and export research performance reports from database</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="self-start">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Download Excel Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="export-year">Filter by year</Label>
              <Select value={exportYear} onValueChange={setExportYear}>
                <SelectTrigger id="export-year"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((year) => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-department">Filter by department</Label>
              <Select value={exportDepartment} onValueChange={setExportDepartment}>
                <SelectTrigger id="export-department"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departmentOrder.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 mr-2" />
              Download Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Type Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700">Report Type:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedReport === "summary" ? "default" : "outline"}
                onClick={() => setSelectedReport("summary")}
                className={selectedReport === "summary" ? "bg-blue-600" : ""}
              >
                Summary
              </Button>
              <Button
                variant={selectedReport === "researcher" ? "default" : "outline"}
                onClick={() => setSelectedReport("researcher")}
                className={selectedReport === "researcher" ? "bg-blue-600" : ""}
              >
                By Researcher
              </Button>
              <Button
                variant={selectedReport === "department" ? "default" : "outline"}
                onClick={() => setSelectedReport("department")}
                className={selectedReport === "department" ? "bg-blue-600" : ""}
              >
                By Department
              </Button>
              <Button
                variant={selectedReport === "yearly" ? "default" : "outline"}
                onClick={() => setSelectedReport("yearly")}
                className={selectedReport === "yearly" ? "bg-blue-600" : ""}
              >
                Yearly Trends
              </Button>
            </div>
            {selectedReport === "yearly" && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="ml-auto px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50"
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">Total Researchers</CardTitle>
                <Users className="w-5 h-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-gray-900">{totalResearchers}</div>
                <p className="text-xs text-gray-600 mt-1">Active faculty members</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">Total Publications</CardTitle>
                <FileText className="w-5 h-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-gray-900">{totalPublications}</div>
                <p className="text-xs text-gray-600 mt-1">Across all departments</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">Total Citations</CardTitle>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-gray-900">{totalCitations.toLocaleString()}</div>
                <p className="text-xs text-gray-600 mt-1">Combined impact</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overall Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-700">Average Citations per Researcher</span>
                  <span className="text-gray-900 font-medium">
                    {(totalCitations / safeResearchers).toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-700">Average Publications per Researcher</span>
                  <span className="text-gray-900 font-medium">
                    {(totalPublications / safeResearchers).toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-700">Average Citations per Publication</span>
                  <span className="text-gray-900 font-medium">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Researcher Performance Report</CardTitle>
          </CardHeader>
          <CardContent>
            {researchersList.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <Users className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm">No researchers in the database yet.</p>
                <p className="text-xs text-gray-400 mt-1">Add researchers from the Admin Panel.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm text-gray-700">Researcher</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-700">Department</th>
                      <th className="text-center py-3 px-4 text-sm text-gray-700">Publications</th>
                      <th className="text-center py-3 px-4 text-sm text-gray-700">Citations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {researchersList.map((researcher: any) => (
                      <tr key={researcher.id || researcher.instructorId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">{researcher.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{researcher.department}</td>
                        <td className="text-center py-3 px-4 text-sm text-gray-900">
                          {researcher.totalPublications || 0}
                        </td>
                        <td className="text-center py-3 px-4 text-sm text-gray-900">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Department Performance Report</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(deptStats).length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <FileBarChart className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm">No department data yet.</p>
                <p className="text-xs text-gray-400 mt-1">Data will appear once researchers are added.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm text-gray-700">Department</th>
                      <th className="text-center py-3 px-4 text-sm text-gray-700">Researchers</th>
                      <th className="text-center py-3 px-4 text-sm text-gray-700">Publications</th>
                      <th className="text-center py-3 px-4 text-sm text-gray-700">Citations</th>
                      <th className="text-center py-3 px-4 text-sm text-gray-700">Avg Citations</th>
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
                        <tr key={dept} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900">{dept}</td>
                          <td className="text-center py-3 px-4 text-sm text-gray-900">
                            {stats.researchers}
                          </td>
                          <td className="text-center py-3 px-4 text-sm text-gray-900">
                            {stats.publications}
                          </td>
                          <td className="text-center py-3 px-4 text-sm text-gray-900">
                            {stats.citations}
                          </td>
                          <td className="text-center py-3 px-4 text-sm text-gray-900">
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
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <Calendar className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm">No publications to generate yearly trends.</p>
                <p className="text-xs text-gray-400 mt-1">Publications will appear as researchers add their work.</p>
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
                <Card key={year}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{year} Research Output</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {year}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <span className="text-sm text-gray-600">Publications</span>
                        </div>
                        <p className="text-2xl text-gray-900">{yearPubs.length}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                          <span className="text-sm text-gray-600">Total Citations</span>
                        </div>
                        <p className="text-2xl text-gray-900">{yearCitations}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Award className="w-5 h-5 text-blue-600" />
                          <span className="text-sm text-gray-600">Avg Citations/Pub</span>
                        </div>
                        <p className="text-2xl text-gray-900">
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
