import { useState, useEffect } from "react";
import {
  FileBarChart,
  Download,
  Calendar,
  TrendingUp,
  Users,
  FileText,
  Award,
  Filter,
  RefreshCw,
  Printer,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { apiService, type DashboardStatsResponse } from "../services/api.service";
import { PageHeader, StatCard, PageTabs, StatusBadge, EmptyState } from "./common";
import { exportResearchMatrixToExcel } from "../utils/excelExportUtils";

type ReportType = "summary" | "researcher" | "department" | "yearly" | "accreditation";

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
    (_, index) => latestYear - index
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

    // Check publications that need citing papers fetched from server
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

    setExportProgressText("Generating styled Excel document with citations & hyperlinks...");

    exportResearchMatrixToExcel({
      publications: filteredToExport,
      researchers: researchersList,
      exportDepartment,
      exportYear,
      departmentOrder,
      filename: `psu-research-${exportDepartment.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${exportYear}.xlsx`
    });

    setIsExporting(false);
    setExportProgressText(null);
  };

  const tabs = [
    { id: "summary", label: "Executive Summary", icon: FileBarChart },
    { id: "researcher", label: "By Researcher", count: researchersList.length, icon: Users },
    { id: "department", label: "By Department", count: Object.keys(deptStats).length, icon: TrendingUp },
    { id: "yearly", label: "Yearly Trends", count: years.length, icon: Calendar },
    { id: "accreditation", label: "SUC & AACCUP Exhibit", icon: Award },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <PageHeader
        title="Institutional Research Reports"
        description="Accreditation-ready audits, department breakdowns, and exportable citation matrices"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="text-xs h-9 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={isExporting}
              className="text-xs h-9 gap-1.5 bg-brand hover:bg-brand/90 text-white shadow-2xs"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>{exportProgressText || "Exporting..."}</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Excel</span>
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* 2. Compact Export Filters Strip */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground font-medium">
              <Filter className="w-3.5 h-3.5 text-brand" />
              <span>Export Scope:</span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap flex-1 sm:justify-end w-full sm:w-auto">
              <div className="flex-1 sm:flex-initial sm:w-36">
                <Select value={exportDepartment} onValueChange={setExportDepartment}>
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departmentOrder.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 sm:flex-initial sm:w-32">
                <Select value={exportYear} onValueChange={setExportYear}>
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-[11px] text-muted-foreground hidden lg:inline">
                Applies to the generated Excel file
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Navigation Tabs */}
      <PageTabs
        tabs={tabs}
        activeTab={selectedReport}
        onChange={(tabId) => setSelectedReport(tabId as ReportType)}
      />

      {/* 4. Tab 1: Executive Summary */}
      {selectedReport === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Faculty"
              value={totalResearchers}
              subtitle="Active researchers"
              icon={Users}
            />
            <StatCard
              label="Total Publications"
              value={totalPublications}
              subtitle="Across all departments"
              icon={FileText}
            />
            <StatCard
              label="Total Citations"
              value={totalCitations.toLocaleString()}
              subtitle="Combined Google Scholar impact"
              icon={TrendingUp}
            />
            <StatCard
              label="Mean Faculty Output"
              value={(totalPublications / safeResearchers).toFixed(1)}
              subtitle="Papers / researcher"
              icon={Award}
            />
          </div>

          <Card className="border-border/60 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Institutional Productivity Benchmarks</CardTitle>
              <CardDescription className="text-xs">
                Key ratio indicators for SUC Leveling and CHED institutional monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/60 text-xs">
                <div className="flex items-center justify-between py-3">
                  <span className="text-muted-foreground font-medium">Average Citations per Faculty Member</span>
                  <span className="text-foreground font-bold font-mono text-sm">
                    {(totalCitations / safeResearchers).toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-muted-foreground font-medium">Average Publications per Faculty Member</span>
                  <span className="text-foreground font-bold font-mono text-sm">
                    {(totalPublications / safeResearchers).toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-muted-foreground font-medium">Average Citation Density per Publication</span>
                  <span className="text-foreground font-bold font-mono text-sm">
                    {(totalCitations / safePubs).toFixed(1)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5. Tab 2: Researcher Performance Report */}
      {selectedReport === "researcher" && (
        <Card className="border-border/60 shadow-xs overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Faculty Researcher Output Roster</CardTitle>
            <CardDescription className="text-xs">
              Individual publication and citation counts tracked in database
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {researchersList.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Users}
                  title="No researchers found"
                  description="Add researchers from the Admin Console or approve pending registrations."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Researcher Name</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4 text-center">Publications</th>
                      <th className="py-3 px-4 text-center">Citations</th>
                      <th className="py-3 px-4 text-right">Avg Citations/Pub</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {researchersList.map((r: any) => {
                      const pubs = r.totalPublications || 0;
                      const cites = r.totalCitations || 0;
                      return (
                        <tr key={r.id || r.instructorId} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">{r.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{r.department || "Faculty"}</td>
                          <td className="py-3 px-4 text-center font-mono font-medium">{pubs}</td>
                          <td className="py-3 px-4 text-center font-mono font-medium">{cites}</td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {pubs > 0 ? (cites / pubs).toFixed(1) : "0.0"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 6. Tab 3: Department Performance Report */}
      {selectedReport === "department" && (
        <Card className="border-border/60 shadow-xs overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Academic Department Performance Report</CardTitle>
            <CardDescription className="text-xs">
              Consolidated research volume by college unit
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {Object.keys(deptStats).length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={FileBarChart}
                  title="No department data available"
                  description="Department statistics will populate as faculty members are registered."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Academic Department</th>
                      <th className="py-3 px-4 text-center">Faculty Count</th>
                      <th className="py-3 px-4 text-center">Publications</th>
                      <th className="py-3 px-4 text-center">Citations</th>
                      <th className="py-3 px-4 text-right">Avg Citations/Faculty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {Object.entries(deptStats)
                      .sort((a, b) => {
                        const indexA = departmentOrder.indexOf(a[0]);
                        const indexB = departmentOrder.indexOf(b[0]);
                        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                      })
                      .map(([dept, s]) => (
                        <tr key={dept} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">{dept}</td>
                          <td className="py-3 px-4 text-center font-mono">{s.researchers}</td>
                          <td className="py-3 px-4 text-center font-mono">{s.publications}</td>
                          <td className="py-3 px-4 text-center font-mono">{s.citations}</td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {(s.citations / Math.max(s.researchers, 1)).toFixed(0)}
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

      {/* 7. Tab 4: Yearly Trends */}
      {selectedReport === "yearly" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Filter by calendar year:</span>
            <div className="w-36">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      Year {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {years.map((year) => {
              const yearPubs = publicationsList.filter((pub: any) => pub.year === year);
              const yearCitations = yearPubs.reduce((sum: number, pub: any) => sum + (pub.citations || 0), 0);

              if (selectedYear !== "all" && selectedYear !== year.toString()) {
                return null;
              }

              if (yearPubs.length === 0 && selectedYear === "all") {
                return null;
              }

              return (
                <Card key={year} className="border-border/60 shadow-xs">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{year} Output</CardTitle>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {year}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-1 text-xs">
                    <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-border/40">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Papers</p>
                        <p className="text-base font-bold font-mono text-foreground">{yearPubs.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Citations</p>
                        <p className="text-base font-bold font-mono text-foreground">{yearCitations}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Avg/Pub</p>
                        <p className="text-base font-bold font-mono text-foreground">
                          {yearPubs.length > 0 ? (yearCitations / yearPubs.length).toFixed(1) : 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. Tab 5: SUC & AACCUP Exhibit Dossier */}
      {selectedReport === "accreditation" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="SUC Leveling Points"
              value={publicationsList
                .reduce(
                  (acc, p) =>
                    acc + (p.nbc461_points || (p.journal?.toLowerCase().includes("scopus") ? 25 : 15)),
                  0
                )
                .toFixed(1)}
              subtitle={`Across ${publicationsList.length} publications`}
              icon={Award}
            />
            <StatCard
              label="Scopus / WoS Papers"
              value={
                publicationsList.filter(
                  (p) =>
                    (p.journal_indexing || "").includes("Scopus") ||
                    (p.journal || "").toLowerCase().includes("scopus")
                ).length
              }
              subtitle="25 points each"
              icon={Award}
            />
            <StatCard
              label="CHED Refereed"
              value={
                publicationsList.filter(
                  (p) =>
                    !(p.journal_indexing || "").includes("Scopus") &&
                    !(p.journal || "").toLowerCase().includes("scopus")
                ).length
              }
              subtitle="15 points each"
              icon={FileText}
            />
            <StatCard
              label="Accreditation Status"
              value="Compliant"
              subtitle="Meets AACCUP Area VI"
              icon={TrendingUp}
            />
          </div>

          <Card className="border-border/60 shadow-xs overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/60">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  Official SUC Leveling & AACCUP Exhibit Table
                </CardTitle>
                <CardDescription className="text-xs">
                  Institutional portfolio formatted for accreditation auditors and faculty promotion audits
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
                className="text-xs h-8 gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Dossier</span>
              </Button>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <tr>
                    <th className="p-3.5 min-w-[260px]">Publication Title</th>
                    <th className="p-3.5 min-w-[150px]">Authors</th>
                    <th className="p-3.5 min-w-[140px]">Journal Venue & Index</th>
                    <th className="p-3.5 w-20 text-center">Year</th>
                    <th className="p-3.5 min-w-[110px]">UN SDG Goal</th>
                    <th className="p-3.5 w-24 text-right">NBC 461 Pts</th>
                    <th className="p-3.5 w-28 text-center">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {publicationsList.map((pub: any) => {
                    const authorsStr = Array.isArray(pub.authors) ? pub.authors.join(", ") : pub.authors;
                    const sdgList: string[] = Array.isArray(pub.sdg_tags)
                      ? pub.sdg_tags
                      : typeof pub.sdg_tags === "string"
                      ? (() => {
                          try {
                            const parsed = JSON.parse(pub.sdg_tags);
                            return Array.isArray(parsed) ? parsed : [pub.sdg_tags];
                          } catch {
                            return [pub.sdg_tags];
                          }
                        })()
                      : [];

                    return (
                      <tr key={pub.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-semibold text-foreground">
                          <div className="line-clamp-2 leading-snug">{pub.title}</div>
                        </td>
                        <td className="p-3.5 text-muted-foreground">{authorsStr}</td>
                        <td className="p-3.5">
                          <div className="line-clamp-1 font-medium">{pub.journal || "PSU Archive"}</div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {pub.journal_indexing || "Refereed"}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono text-muted-foreground">{pub.year}</td>
                        <td className="p-3.5">
                          <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-semibold">
                            {sdgList[0]?.split(":")[0] || "SDG 4"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono font-semibold text-brand">
                          {pub.nbc461_points || (pub.journal?.toLowerCase().includes("scopus") ? 25 : 15)} pts
                        </td>
                        <td className="p-3.5 text-center">
                          <StatusBadge status="verified" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
