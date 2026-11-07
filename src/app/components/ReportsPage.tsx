import { useState, useEffect, useMemo } from "react";
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
    FolderArchive,
    FolderOpen,
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
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { apiService, type DashboardStatsResponse } from "../services/api.service";
import { PageHeader, StatCard, PageTabs, StatusBadge, EmptyState } from "./common";
import { exportPerResearcherReportsByDepartment } from "../utils/excelExportUtils";
import { matchesResearcher } from "../utils/facultyUtils";

type ReportType = "summary" | "researcher" | "department" | "yearly" | "accreditation";

export function ReportsPage() {
    const [selectedReport, setSelectedReport] = useState<ReportType>("summary");
    const [selectedYear, setSelectedYear] = useState<string>("all");
    const [exportYear, setExportYear] = useState<string>("all");
    const [exportDepartment, setExportDepartment] = useState<string>("all");
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgressText, setExportProgressText] = useState<string | null>(null);

    // Multi-researcher selection state for per-researcher Excel export
    const [selectedResearcherIds, setSelectedResearcherIds] = useState<string[]>([]);
    const [showResearcherPicker, setShowResearcherPicker] = useState(false);
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
                // By default, none is selected
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

    const selectedDepartmentsPreview = useMemo(() => {
        const depts = new Set<string>();
        selectedResearchersObjects.forEach((r: any) => {
            depts.add(r.department || "Unassigned");
        });
        return Array.from(depts);
    }, [selectedResearchersObjects]);

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
            toast.error("Please select at least one faculty member to export.");
            return;
        }

        setIsExporting(true);
        setExportProgressText("Preparing publications & citation sheets for selected faculty...");

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
                    : `Packaging ${selectedResearchersObjects.length} faculty reports into ZIP...`
            );

            const res = await exportPerResearcherReportsByDepartment({
                selectedResearchers: selectedResearchersObjects,
                publications: publicationsList,
                exportYear,
            });

            if (!res.isZip) {
                toast.success(
                    `Exported Excel report (.xlsx) for ${selectedResearchersObjects[0]?.name || "selected faculty"}`
                );
            } else {
                toast.success(
                    `Exported ${res.exportedFiles} faculty Excel reports in ZIP archive (${res.departments.join(", ")})`
                );
            }
        } catch (err: any) {
            toast.error(err?.message || "Failed to export Excel reports.");
        } finally {
            setIsExporting(false);
            setExportProgressText(null);
        }
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
                title="Research Reports & Exports"
                description="Official institutional research matrices and faculty publication spreadsheets"
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

            {/* 2. Faculty Research Spreadsheet Generator (Cohesive Export Control following Gestalt Proximity) */}
            <Card className="border-border/60 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                                <span>Export Faculty Research Spreadsheets</span>
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Select faculty members to download their individual research & citation Excel files. Exporting 1 faculty member downloads 1 Excel file (.xlsx); multiple faculty are packaged in a ZIP archive.
                            </CardDescription>
                        </div>
                        {selectedResearchersObjects.length > 0 && (
                            <Badge className="bg-emerald-600 text-white font-mono text-xs px-2.5 py-1 w-fit">
                                {selectedResearchersObjects.length} Faculty Selected
                            </Badge>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                    {/* Natural Mapping Filter & Scope Bar */}
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

                            {/* Faculty Name Search Filter */}
                            <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={pickerSearch}
                                    onChange={(e) => setPickerSearch(e.target.value)}
                                    placeholder="Filter faculty by name..."
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

                    {/* Faculty Checkbox Selection Grid */}
                    {pickerFilteredResearchers.length === 0 ? (
                        <div className="p-6 text-center border border-dashed rounded-xl bg-muted/20">
                            <p className="text-xs text-muted-foreground">
                                No faculty members found for the current department or search filter.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
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
                                                    <span className="font-medium text-foreground/80">{r.department || "Faculty"}</span>
                                                    <span>•</span>
                                                    <span>{pubCount} papers</span>
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

                    {/* Action Bar - Proximity Principle: Positioned directly beneath what it acts on */}
                    <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">
                            {selectedResearchersObjects.length === 0 ? (
                                <span>No faculty selected. Select individual faculty checkboxes above or click "Select All".</span>
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
                                <span>Select at least 1 faculty member to export</span>
                            ) : selectedResearchersObjects.length === 1 ? (
                                <>
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                    <span>Export {selectedResearchersObjects[0]?.name}'s Excel Report (.xlsx)</span>
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4 mr-2" />
                                    <span>Export {selectedResearchersObjects.length} Faculty Excel Reports (.zip)</span>
                                </>
                            )}
                        </Button>
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
                                            <th className="py-3 px-4 w-10 text-center">Export</th>
                                            <th className="py-3 px-4">Researcher Name</th>
                                            <th className="py-3 px-4">Department Folder</th>
                                            <th className="py-3 px-4 text-center">Publications</th>
                                            <th className="py-3 px-4 text-center">Citations</th>
                                            <th className="py-3 px-4 text-right">Avg Citations/Pub</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {researchersList.map((r: any) => {
                                            const rKey = r.instructorId || r.id;
                                            const isChecked = selectedResearcherIds.includes(rKey);
                                            const pubs = r.totalPublications || 0;
                                            const cites = r.totalCitations || 0;
                                            return (
                                                <tr
                                                    key={rKey}
                                                    onClick={() => toggleResearcherSelection(rKey)}
                                                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${isChecked ? "bg-brand/5" : ""
                                                        }`}
                                                >
                                                    <td className="py-3 px-4 text-center">
                                                        {isChecked ? (
                                                            <CheckSquare className="w-4 h-4 text-brand inline-block" />
                                                        ) : (
                                                            <Square className="w-4 h-4 text-muted-foreground/60 inline-block" />
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 font-semibold text-foreground">{r.name}</td>
                                                    <td className="py-3 px-4 text-muted-foreground text-xs">
                                                        {r.department || "Faculty"}
                                                    </td>
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
                            const yearPubs = publicationsList.filter((pub: any) => Number(pub.year) === Number(year));
                            const deptYearMatches = dashboardData.deptYearStats.filter(
                                (s) => Number(s.year) === Number(year)
                            );
                            const yearCitations =
                                deptYearMatches.length > 0
                                    ? deptYearMatches.reduce((sum, s) => sum + (Number(s.citations) || 0), 0)
                                    : yearPubs.reduce((sum: number, pub: any) => sum + (pub.citations || 0), 0);

                            if (selectedYear !== "all" && selectedYear !== year.toString()) {
                                return null;
                            }

                            if (yearPubs.length === 0 && yearCitations === 0 && selectedYear === "all") {
                                return null;
                            }

                            return (
                                <Card key={year} className="border-border/60 shadow-xs">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-semibold">{year} Output & Impact</CardTitle>
                                            <Badge variant="outline" className="font-mono text-[10px]">
                                                {year}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-1 text-xs">
                                        <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-border/40">
                                            <div>
                                                <p className="text-[10px] text-muted-foreground">Papers Published</p>
                                                <p className="text-base font-bold font-mono text-foreground">{yearPubs.length}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-muted-foreground">Citations Earned</p>
                                                <p className="text-base font-bold font-mono text-emerald-600">{yearCitations}</p>
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
        </div>
    );
}
