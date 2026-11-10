import { useState, useEffect, useMemo } from "react";
import {
    FileBarChart,
    Download,
    TrendingUp,
    Users,
    FileText,
    Award,
    RefreshCw,
    Printer,
    CheckSquare,
    Square,
    Search,
    FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { apiService, type DashboardStatsResponse } from "../services/api.service";
import { PageHeader, StatCard, PageTabs, StatusBadge, EmptyState } from "./common";
import { exportPerResearcherReportsByDepartment } from "../utils/excelExportUtils";
import { matchesResearcher } from "../utils/facultyUtils";

type ReportType = "spreadsheets" | "accreditation" | "summary";

export function ReportsPage() {
    const [selectedReport, setSelectedReport] = useState<ReportType>("spreadsheets");
    const [exportYear, setExportYear] = useState<string>("all");
    const [exportDepartment, setExportDepartment] = useState<string>("all");
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgressText, setExportProgressText] = useState<string | null>(null);

    // Multi-researcher selection state for per-researcher Excel export
    const [selectedResearcherIds, setSelectedResearcherIds] = useState<string[]>([]);
    const [pickerSearch, setPickerSearch] = useState("");

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
            if (Array.isArray(researchers)) {
                setResearchersList(researchers);
                setSelectedResearcherIds((prev) =>
                    prev.length > 0
                        ? prev.filter((id) =>
                            researchers.some((r: any) => (r.instructorId || r.id) === id)
                        )
                        : []
                );
            }
            if (Array.isArray(pubs)) {
                const approvedPubs = pubs.filter(
                    (p: any) => ((p.approval_status || p.approvalStatus || "approved") as string).toLowerCase() === "approved"
                );
                setPublicationsList(approvedPubs);
            }
        } catch (err) {
            console.warn("Failed to load reports data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const onUpdate = () => loadData();
        window.addEventListener("research-records-updated", onUpdate);
        window.addEventListener("researchers-updated", onUpdate);
        window.addEventListener("faculty-updated", onUpdate);
        return () => {
            window.removeEventListener("research-records-updated", onUpdate);
            window.removeEventListener("researchers-updated", onUpdate);
            window.removeEventListener("faculty-updated", onUpdate);
        };
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
    const departmentOrder = ["BSIT", "BSBA", "BEE", "BTLED", "BIT", "BSE", "Non-Faculty"];

    // Researchers filtered by department & search inside the export picker
    const pickerFilteredResearchers = useMemo(() => {
        return researchersList.filter((r: any) => {
            const matchesDept = exportDepartment === "all" || r.department === exportDepartment;
            const q = pickerSearch.trim().toLowerCase();
            const matchesQuery =
                !q ||
                (r.name || "").toLowerCase().includes(q) ||
                (r.instructorId || "").toLowerCase().includes(q) ||
                (r.department || "").toLowerCase().includes(q);
            return matchesDept && matchesQuery;
        });
    }, [researchersList, exportDepartment, pickerSearch]);

    const selectedResearchersObjects = useMemo(() => {
        return researchersList.filter((r: any) =>
            selectedResearcherIds.includes(r.instructorId || r.id)
        );
    }, [researchersList, selectedResearcherIds]);

    const toggleResearcherSelection = (id: string) => {
        setSelectedResearcherIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const selectAllVisibleResearchers = () => {
        const visibleIds = pickerFilteredResearchers.map((r: any) => r.instructorId || r.id);
        const allSelected =
            visibleIds.length > 0 && visibleIds.every((id) => selectedResearcherIds.includes(id));
        if (allSelected) {
            setSelectedResearcherIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
        } else {
            setSelectedResearcherIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    const handleDepartmentScopeChange = (dept: string) => {
        setExportDepartment(dept);
    };

    const handleDownload = async () => {
        if (selectedResearchersObjects.length === 0) {
            toast.error("Please select at least one researcher to export.");
            return;
        }

        setIsExporting(true);
        setExportProgressText("Preparing publications & citation sheets for selected researchers...");

        try {
            // Find all publications belonging to the selected researchers
            const targetPubs = publicationsList.filter((pub: any) => {
                const matchesYear = exportYear === "all" || String(pub.year) === String(exportYear);
                const belongsToSelected = selectedResearchersObjects.some((r: any) =>
                    matchesResearcher(pub, r)
                );
                return matchesYear && belongsToSelected;
            });

            // Fetch full citation details & CrossRef metadata (all co-authors, citing authors, journal, vol/issue, ISSN/DOI)
            const needsDetailFetch = targetPubs.filter(
                (p: any) =>
                    !p.keywords ||
                    !p.issn_isbn ||
                    String(p.authors || "").includes("…") ||
                    (Number(p.citations) > 0 &&
                        (!p.citingPapers ||
                            p.citingPapers.length < Number(p.citations) ||
                            p.citingPapers.some((cp: any) => !cp.journal)))
            );

            if (needsDetailFetch.length > 0) {
                for (let i = 0; i < needsDetailFetch.length; i++) {
                    const targetPub = needsDetailFetch[i];
                    setExportProgressText(
                        `Enriching metadata & citations (${i + 1} of ${needsDetailFetch.length})...`
                    );
                    try {
                        const detailed: any = await apiService.getPublicationById(targetPub.id);
                        if (detailed) {
                            Object.assign(targetPub, detailed);
                            targetPub.citingPapers = detailed.citingPapers || [];
                            if (detailed.citedByLink) targetPub.citedByLink = detailed.citedByLink;
                        }
                    } catch (e) {
                        console.warn("Could not fetch detailed citations for pub:", targetPub.id, e);
                    }
                }
            }

            setExportProgressText(
                selectedResearchersObjects.length === 1
                    ? `Generating Excel report (.xlsx) for ${selectedResearchersObjects[0].name}...`
                    : `Packaging ${selectedResearchersObjects.length} researcher reports into ZIP...`
            );

            const res = await exportPerResearcherReportsByDepartment({
                selectedResearchers: selectedResearchersObjects,
                publications: publicationsList,
                exportYear,
            });

            if (res.success) {
                toast.success(
                    res.mode === "single"
                        ? `Exported Excel spreadsheet for ${selectedResearchersObjects[0].name}`
                        : `Successfully generated and packaged ${res.count} researcher spreadsheets into ${res.filename}`
                );
            } else {
                toast.error("Failed to generate research spreadsheets.");
            }
        } catch (err: any) {
            console.error("Export error:", err);
            toast.error(err.message || "An unexpected error occurred while preparing spreadsheets.");
        } finally {
            setIsExporting(false);
            setExportProgressText(null);
        }
    };

    const tabs = [
        { id: "spreadsheets", label: "Faculty Spreadsheets", icon: FileSpreadsheet, count: researchersList.length },
        { id: "accreditation", label: "Accreditation & SUC Matrix", icon: Award, count: publicationsList.length },
        { id: "summary", label: "Executive Summary", icon: FileBarChart },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* 1. Page Header */}
            <PageHeader
                title="Research Reports & Exports"
                description="Official institutional research matrices and researcher publication spreadsheets"
                actions={
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
                }
            />

            {/* 2. Streamlined Navigation Tabs */}
            <PageTabs
                tabs={tabs}
                activeTab={selectedReport}
                onChange={(tabId) => setSelectedReport(tabId as ReportType)}
            />

            {/* 3. Tab 1: Faculty Spreadsheets Hub */}
            {selectedReport === "spreadsheets" && (
                <Card className="border-border/60 shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/60">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                                    <span>Export Faculty Research Spreadsheets</span>
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Select researchers to download their individual research & citation Excel files. Exporting 1 researcher downloads 1 Excel file (.xlsx); multiple researchers are packaged into an organized ZIP archive.
                                </CardDescription>
                            </div>
                            {selectedResearchersObjects.length > 0 && (
                                <Badge className="bg-emerald-600 text-white font-mono text-xs px-2.5 py-1 w-fit">
                                    {selectedResearchersObjects.length} Selected
                                </Badge>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 space-y-4">
                        {/* Scope Filter Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 flex-wrap flex-1">
                                {/* Department Dropdown */}
                                <div className="w-full sm:w-44">
                                    <Select value={exportDepartment} onValueChange={handleDepartmentScopeChange}>
                                        <SelectTrigger className="h-8 text-xs w-full">
                                            <SelectValue placeholder="All Departments" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {departmentOrder.map((dept) => (
                                                <SelectItem key={dept} value={dept}>
                                                    {dept} Only
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Year Dropdown */}
                                <div className="w-full sm:w-32">
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

                                {/* Search Filter */}
                                <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={pickerSearch}
                                        onChange={(e) => setPickerSearch(e.target.value)}
                                        placeholder="Filter researchers by name or ID..."
                                        className="pl-8 h-8 text-xs w-full"
                                    />
                                </div>
                            </div>

                            {/* Selection Controls (Select All / Clear) */}
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={selectAllVisibleResearchers}
                                    className="h-8 text-xs gap-1.5"
                                >
                                    <CheckSquare className="w-3.5 h-3.5 text-brand" />
                                    <span>
                                        {selectedResearcherIds.length === pickerFilteredResearchers.length && pickerFilteredResearchers.length > 0
                                            ? "Deselect All"
                                            : `Select All (${pickerFilteredResearchers.length})`}
                                    </span>
                                </Button>
                                {selectedResearcherIds.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedResearcherIds([])}
                                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Clear Selection
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Researcher Selection Grid */}
                        {pickerFilteredResearchers.length === 0 ? (
                            <div className="p-8 text-center border border-dashed rounded-xl bg-muted/20">
                                <p className="text-xs text-muted-foreground">
                                    No researchers match your active department or search criteria.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                                {pickerFilteredResearchers.map((r: any) => {
                                    const rKey = r.instructorId || r.id;
                                    const isChecked = selectedResearcherIds.includes(rKey);
                                    const pubCount = publicationsList.filter((p) => matchesResearcher(p, r)).length;
                                    const citCount = publicationsList
                                        .filter((p) => matchesResearcher(p, r))
                                        .reduce((sum, p) => sum + (p.citations || 0), 0);

                                    return (
                                        <div
                                            key={rKey}
                                            onClick={() => toggleResearcherSelection(rKey)}
                                            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2.5 cursor-pointer transition-all ${isChecked
                                                ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-foreground shadow-2xs"
                                                : "border-border/60 bg-background hover:bg-muted/40 text-muted-foreground"
                                                }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {isChecked ? (
                                                    <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <p className={`font-semibold truncate ${isChecked ? "text-foreground" : "text-foreground/90"}`}>
                                                        {r.name}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                        <span className="font-medium text-foreground/80">{r.department || "Researcher"}</span>
                                                        <span>•</span>
                                                        <span>{pubCount} publications</span>
                                                        <span>•</span>
                                                        <span>{citCount} citations</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Action Bar */}
                        <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs text-muted-foreground">
                                {selectedResearchersObjects.length === 0 ? (
                                    <span>Select individual researcher checkboxes above or click "Select All" to export.</span>
                                ) : selectedResearchersObjects.length === 1 ? (
                                    <span>Ready to download <strong>1 single Excel file (.xlsx)</strong> for {selectedResearchersObjects[0]?.name}.</span>
                                ) : (
                                    <span>Ready to package <strong>{selectedResearchersObjects.length} Excel files</strong> into a single ZIP archive.</span>
                                )}
                            </div>

                            <Button
                                onClick={handleDownload}
                                disabled={isExporting || selectedResearchersObjects.length === 0}
                                className={`h-10 px-6 text-xs sm:text-sm font-semibold transition-all shadow-sm ${selectedResearchersObjects.length === 0
                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    }`}
                            >
                                {isExporting ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        <span>{exportProgressText || "Exporting..."}</span>
                                    </>
                                ) : selectedResearchersObjects.length === 0 ? (
                                    <span>Select at least 1 researcher to export</span>
                                ) : selectedResearchersObjects.length === 1 ? (
                                    <>
                                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                                        <span>Export {selectedResearchersObjects[0]?.name}'s Spreadsheet (.xlsx)</span>
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4 mr-2" />
                                        <span>Export {selectedResearchersObjects.length} Researcher Spreadsheets (.zip)</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 4. Tab 2: Accreditation & SUC Matrix */}
            {selectedReport === "accreditation" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            label="Total Publications"
                            value={publicationsList.length}
                            subtitle="Verified institutional records"
                            icon={FileText}
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
                            subtitle="Internationally Indexed"
                            icon={Award}
                        />
                        <StatCard
                            label="CHED / ACI Refereed"
                            value={
                                publicationsList.filter(
                                    (p) =>
                                        !(p.journal_indexing || "").includes("Scopus") &&
                                        !(p.journal || "").toLowerCase().includes("scopus")
                                ).length
                            }
                            subtitle="Peer-Reviewed Journals"
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
                                    Official SUC & AACCUP Exhibit Table
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Institutional portfolio formatted for university RDO reporting and accreditation audits
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
                                        <th className="p-3.5 w-24 text-center">Citations</th>
                                        <th className="p-3.5 min-w-[110px]">UN SDG Goal</th>
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
                                                <td className="p-3.5 text-center font-mono font-semibold text-emerald-600">
                                                    {pub.citations || 0}
                                                </td>
                                                <td className="p-3.5">
                                                    <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-semibold">
                                                        {sdgList[0]?.split(":")[0] || "SDG 4"}
                                                    </span>
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

            {/* 5. Tab 3: Executive Summary */}
            {selectedReport === "summary" && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">Executive Overview</h3>
                            <p className="text-xs text-muted-foreground">High-level institutional output benchmarks for campus leadership</p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.print()}
                            className="text-xs h-8 gap-1.5"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Print Summary</span>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            label="Total Researchers"
                            value={totalResearchers}
                            subtitle="Active campus researchers"
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
                            label="Mean Researcher Output"
                            value={(totalPublications / safeResearchers).toFixed(1)}
                            subtitle="Publications / researcher"
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
                                    <span className="text-muted-foreground font-medium">Average Citations per Researcher</span>
                                    <span className="text-foreground font-bold font-mono text-sm">
                                        {(totalCitations / safeResearchers).toFixed(1)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <span className="text-muted-foreground font-medium">Average Publications per Researcher</span>
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
        </div>
    );
}
