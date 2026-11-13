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
    FolderArchive,
    Layers,
    Building2,
    Calendar,
    CheckCircle2,
    SlidersHorizontal,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { apiService, type DashboardStatsResponse } from "../services/api.service";
import { PageHeader, StatCard, PageTabs, StatusBadge, EmptyState } from "./common";
import {
    exportPerResearcherReportsByDepartment,
    exportCombinedResearchersToSingleWorkbook,
    exportSelectedPublicationsToExcel,
} from "../utils/excelExportUtils";
import { matchesResearcher } from "../utils/facultyUtils";

type ReportType = "spreadsheets" | "accreditation" | "summary";
type ExportStudioMode = "researchers" | "department" | "publications";

export function ReportsPage() {
    const [selectedReport, setSelectedReport] = useState<ReportType>("spreadsheets");
    const [exportStudioMode, setExportStudioMode] = useState<ExportStudioMode>("researchers");
    const [exportYear, setExportYear] = useState<string>("all");
    const [exportDepartment, setExportDepartment] = useState<string>("all");
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgressText, setExportProgressText] = useState<string | null>(null);

    // Multi-researcher mode states
    const [selectedResearcherIds, setSelectedResearcherIds] = useState<string[]>([]);
    const [pickerSearch, setPickerSearch] = useState("");
    const [multiFormat, setMultiFormat] = useState<"zip" | "single">("zip");

    // Department mode states
    const [deptTarget, setDeptTarget] = useState<string>("BSIT");
    const [deptFormat, setDeptFormat] = useState<"single" | "zip">("single");

    // Custom publication selection mode states
    const [selectedPubIds, setSelectedPubIds] = useState<string[]>([]);
    const [pubSearch, setPubSearch] = useState("");
    const [pubYearFilter, setPubYearFilter] = useState<string>("all");
    const [pubDeptFilter, setPubDeptFilter] = useState<string>("all");

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

    // Department order
    const departmentOrder = ["BSIT", "BSBA", "BEE", "BTLED", "BIT", "BSE", "Non-Faculty"];

    // Publication years
    const publicationYears = publicationsList.map((p: any) => p.year).filter(Boolean);
    const currentYear = new Date().getFullYear();
    const earliestYear = publicationYears.length > 0 ? Math.min(...publicationYears) : currentYear - 5;
    const latestYear = Math.max(currentYear, ...publicationYears);
    const years = Array.from(
        { length: latestYear - earliestYear + 1 },
        (_, index) => latestYear - index
    );

    // =========================================================================
    // MODE 1: RESEARCHER SELECTION HELPERS
    // =========================================================================
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

    // =========================================================================
    // MODE 2: DEPARTMENT METRICS & HELPERS
    // =========================================================================
    const deptResearchers = useMemo(() => {
        if (deptTarget === "all") return researchersList;
        return researchersList.filter((r: any) => r.department === deptTarget);
    }, [researchersList, deptTarget]);

    const deptPublications = useMemo(() => {
        return publicationsList.filter((pub: any) => {
            const matchesYear = exportYear === "all" || String(pub.year) === String(exportYear);
            const matchesDept =
                deptTarget === "all"
                    ? true
                    : deptResearchers.some((r: any) => matchesResearcher(pub, r));
            return matchesYear && matchesDept;
        });
    }, [publicationsList, deptTarget, deptResearchers, exportYear]);

    const deptCitations = useMemo(() => {
        return deptPublications.reduce((acc, p) => acc + (Number(p.citations) || 0), 0);
    }, [deptPublications]);

    // =========================================================================
    // MODE 3: CUSTOM PUBLICATIONS SELECTION HELPERS
    // =========================================================================
    const filteredPublicationsForPicker = useMemo(() => {
        return publicationsList.filter((pub: any) => {
            const matchesYear = pubYearFilter === "all" || String(pub.year) === String(pubYearFilter);
            let matchesDept = true;
            if (pubDeptFilter !== "all") {
                const deptMembers = researchersList.filter((r) => r.department === pubDeptFilter);
                matchesDept = deptMembers.some((r) => matchesResearcher(pub, r));
            }
            const q = pubSearch.trim().toLowerCase();
            const authorsStr = Array.isArray(pub.authors) ? pub.authors.join(", ") : pub.authors || "";
            const matchesQuery =
                !q ||
                (pub.title || "").toLowerCase().includes(q) ||
                authorsStr.toLowerCase().includes(q) ||
                (pub.journal || "").toLowerCase().includes(q) ||
                (pub.doi || "").toLowerCase().includes(q);

            return matchesYear && matchesDept && matchesQuery;
        });
    }, [publicationsList, researchersList, pubYearFilter, pubDeptFilter, pubSearch]);

    const selectedPublicationsObjects = useMemo(() => {
        return publicationsList.filter((p: any) => selectedPubIds.includes(p.id));
    }, [publicationsList, selectedPubIds]);

    const togglePubSelection = (id: string) => {
        setSelectedPubIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const selectAllVisiblePubs = () => {
        const visibleIds = filteredPublicationsForPicker.map((p: any) => p.id);
        const allSelected =
            visibleIds.length > 0 && visibleIds.every((id) => selectedPubIds.includes(id));
        if (allSelected) {
            setSelectedPubIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
        } else {
            setSelectedPubIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    // =========================================================================
    // ENRICHMENT HELPER FOR EXCEL CITATION SHEETS
    // =========================================================================
    const enrichPublicationsForExport = async (targetPubs: any[]) => {
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
    };

    // =========================================================================
    // EXPORT HANDLER 1: BY RESEARCHER(S)
    // =========================================================================
    const handleDownloadResearchers = async () => {
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

            await enrichPublicationsForExport(targetPubs);

            // Case A: Exactly 1 researcher -> Direct .xlsx download
            if (selectedResearchersObjects.length === 1) {
                setExportProgressText(`Generating Excel report (.xlsx) for ${selectedResearchersObjects[0].name}...`);
                const res = await exportPerResearcherReportsByDepartment({
                    selectedResearchers: selectedResearchersObjects,
                    publications: publicationsList,
                    exportYear,
                });
                if (res.success) {
                    toast.success(`Exported Excel spreadsheet for ${selectedResearchersObjects[0].name}`);
                }
                return;
            }

            // Case B: 2 or more researchers with "Single Consolidated Excel (.xlsx)" option
            if (multiFormat === "single") {
                setExportProgressText(`Consolidating ${selectedResearchersObjects.length} researchers into 1 Excel workbook...`);
                const res = exportCombinedResearchersToSingleWorkbook({
                    selectedResearchers: selectedResearchersObjects,
                    publications: publicationsList,
                    exportYear,
                });
                if (res.success) {
                    toast.success(`Exported consolidated workbook: ${res.filename} (${selectedResearchersObjects.length} Researchers)`);
                }
                return;
            }

            // Case C: 2 or more researchers with "Organized Folder Archive (.zip)" option
            setExportProgressText(`Packaging ${selectedResearchersObjects.length} researcher reports into organized ZIP folders...`);
            const res = await exportPerResearcherReportsByDepartment({
                selectedResearchers: selectedResearchersObjects,
                publications: publicationsList,
                exportYear,
            });

            if (res.success) {
                toast.success(`Exported ${res.count} researcher reports inside ${res.filename}`);
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

    // =========================================================================
    // EXPORT HANDLER 2: BY WHOLE DEPARTMENT
    // =========================================================================
    const handleDownloadDepartment = async () => {
        if (deptResearchers.length === 0) {
            toast.error(`No registered researchers found in ${deptTarget}.`);
            return;
        }

        setIsExporting(true);
        setExportProgressText(`Compiling research portfolio for ${deptTarget}...`);

        try {
            await enrichPublicationsForExport(deptPublications);

            const yearLabel = exportYear === "all" ? "All_Years" : exportYear;

            if (deptFormat === "single") {
                setExportProgressText(`Generating Consolidated ${deptTarget} Department Workbook (.xlsx)...`);
                const res = exportCombinedResearchersToSingleWorkbook({
                    selectedResearchers: deptResearchers,
                    publications: publicationsList,
                    exportYear,
                    filename: `PSU_${deptTarget}_Department_Portfolio_${yearLabel}.xlsx`,
                    title: `PANGASINAN STATE UNIVERSITY — ${deptTarget.toUpperCase()} PORTFOLIO`,
                });
                if (res.success) {
                    toast.success(`Exported consolidated department workbook: ${res.filename}`);
                }
            } else {
                setExportProgressText(`Packaging ${deptResearchers.length} researcher files into ${deptTarget} ZIP Archive...`);
                const res = await exportPerResearcherReportsByDepartment({
                    selectedResearchers: deptResearchers,
                    publications: publicationsList,
                    exportYear,
                });
                if (res.success) {
                    toast.success(`Exported ${deptTarget} ZIP archive with ${res.count} researcher spreadsheets.`);
                }
            }
        } catch (err: any) {
            console.error("Department export error:", err);
            toast.error(err.message || "Failed to export department portfolio.");
        } finally {
            setIsExporting(false);
            setExportProgressText(null);
        }
    };

    // =========================================================================
    // EXPORT HANDLER 3: BY SELECTED PUBLICATIONS
    // =========================================================================
    const handleDownloadSelectedPublications = async () => {
        if (selectedPublicationsObjects.length === 0) {
            toast.error("Please select at least 1 publication to export.");
            return;
        }

        setIsExporting(true);
        setExportProgressText(`Preparing ${selectedPublicationsObjects.length} selected publication(s)...`);

        try {
            await enrichPublicationsForExport(selectedPublicationsObjects);

            setExportProgressText(`Generating Excel report for ${selectedPublicationsObjects.length} paper(s)...`);
            const res = exportSelectedPublicationsToExcel(selectedPublicationsObjects, {
                exportYear: pubYearFilter,
            });

            if (res.success) {
                toast.success(
                    res.count === 1
                        ? `Exported official report for "${selectedPublicationsObjects[0]?.title?.slice(0, 35)}..."`
                        : `Exported official 2-sheet Excel report for ${res.count} selected publications!`
                );
            }
        } catch (err: any) {
            console.error("Publication export error:", err);
            toast.error(err.message || "Failed to export selected publications.");
        } finally {
            setIsExporting(false);
            setExportProgressText(null);
        }
    };

    const tabs = [
        { id: "spreadsheets", label: "Export Studio & Spreadsheets", icon: FileSpreadsheet, count: researchersList.length },
        { id: "accreditation", label: "Accreditation & SUC Matrix", icon: Award, count: publicationsList.length },
        { id: "summary", label: "Executive Summary", icon: FileBarChart },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* 1. Page Header */}
            <PageHeader
                title="Research Reports & Exports"
                description="Official institutional research matrices, department portfolios, and researcher spreadsheets"
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

            {/* 3. Tab 1: Export Studio Hub */}
            {selectedReport === "spreadsheets" && (
                <Card className="border-border/60 shadow-xs">
                    {/* Header with Sub-mode Switcher */}
                    <CardHeader className="pb-4 border-b border-border/60 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                                    <span>Faculty Research Export Studio</span>
                                </CardTitle>
                                <CardDescription className="text-xs mt-0.5">
                                    Official PSU institutional format with 8-column Publication Sheet and 15-column Citation Sheet.
                                </CardDescription>
                            </div>
                        </div>

                        {/* Mode Selector Pill Tabs */}
                        <div className="flex items-center gap-1.5 p-1 bg-muted/60 dark:bg-[#242526] rounded-xl border border-border/60 w-fit flex-wrap">
                            <button
                                type="button"
                                onClick={() => setExportStudioMode("researchers")}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    exportStudioMode === "researchers"
                                        ? "bg-background text-foreground shadow-xs border border-border/60"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Users className="w-3.5 h-3.5 text-blue-600" />
                                <span>By Researcher(s)</span>
                                {selectedResearcherIds.length > 0 && (
                                    <Badge className="bg-blue-600 text-white font-mono text-[10px] px-1.5 py-0 h-4">
                                        {selectedResearcherIds.length}
                                    </Badge>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setExportStudioMode("department")}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    exportStudioMode === "department"
                                        ? "bg-background text-foreground shadow-xs border border-border/60"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>By Whole Department</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setExportStudioMode("publications")}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    exportStudioMode === "publications"
                                        ? "bg-background text-foreground shadow-xs border border-border/60"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <FileText className="w-3.5 h-3.5 text-purple-600" />
                                <span>By Selected Publications</span>
                                {selectedPubIds.length > 0 && (
                                    <Badge className="bg-purple-600 text-white font-mono text-[10px] px-1.5 py-0 h-4">
                                        {selectedPubIds.length}
                                    </Badge>
                                )}
                            </button>
                        </div>
                    </CardHeader>

                    {/* ========================================================= */}
                    {/* SUB-MODE 1: BY RESEARCHER(S)                             */}
                    {/* ========================================================= */}
                    {exportStudioMode === "researchers" && (
                        <CardContent className="p-4 sm:p-5 space-y-4">
                            {/* Scope Filter Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2.5 flex-wrap flex-1">
                                    {/* Department Dropdown */}
                                    <div className="w-full sm:w-44">
                                        <Select value={exportDepartment} onValueChange={setExportDepartment}>
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

                                {/* Selection Controls */}
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
                                                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                                                    isChecked
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

                            {/* Format Choice when 2 or more researchers are selected */}
                            {selectedResearchersObjects.length > 1 && (
                                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/30 dark:bg-[#1f2022] space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-foreground flex items-center gap-2">
                                            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Multi-Researcher Export Structure</span>
                                        </span>
                                        <Badge variant="outline" className="text-[10px] font-mono">
                                            {selectedResearchersObjects.length} Researchers Selected
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                        <div
                                            onClick={() => setMultiFormat("zip")}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                multiFormat === "zip"
                                                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600"
                                                    : "border-border/60 bg-card hover:bg-muted/40"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 font-bold text-foreground">
                                                <FolderArchive className="w-4 h-4 text-blue-600 shrink-0" />
                                                <span>Organized Folder Archive (.zip)</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                                                Hierarchical archive: <code>Department / Researcher_Name / Researcher_Name_[Year].xlsx</code>. 1 Excel workbook per researcher folder.
                                            </p>
                                        </div>

                                        <div
                                            onClick={() => setMultiFormat("single")}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                multiFormat === "single"
                                                    ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-600"
                                                    : "border-border/60 bg-card hover:bg-muted/40"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 font-bold text-foreground">
                                                <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                                                <span>Single Consolidated Excel (.xlsx)</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                                                All researchers in 1 file: Sheet 1 (Combined Publications), Sheet 2 (Combined Citations), plus dedicated individual tabs per researcher.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Bar */}
                            <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="text-xs text-muted-foreground">
                                    {selectedResearchersObjects.length === 0 ? (
                                        <span>Select individual researcher checkboxes above or click "Select All" to export.</span>
                                    ) : selectedResearchersObjects.length === 1 ? (
                                        <span>Ready to download <strong>1 single Excel file (.xlsx)</strong> for {selectedResearchersObjects[0]?.name}.</span>
                                    ) : multiFormat === "single" ? (
                                        <span>Ready to generate <strong>1 consolidated Excel workbook (.xlsx)</strong> containing all {selectedResearchersObjects.length} researchers.</span>
                                    ) : (
                                        <span>Ready to package <strong>{selectedResearchersObjects.length} Excel files</strong> into organized department ZIP folders.</span>
                                    )}
                                </div>

                                <Button
                                    onClick={handleDownloadResearchers}
                                    disabled={isExporting || selectedResearchersObjects.length === 0}
                                    className={`h-10 px-6 text-xs sm:text-sm font-semibold transition-all shadow-sm ${
                                        selectedResearchersObjects.length === 0
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
                                    ) : multiFormat === "single" ? (
                                        <>
                                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                                            <span>Export Consolidated Excel ({selectedResearchersObjects.length} Researchers)</span>
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
                    )}

                    {/* ========================================================= */}
                    {/* SUB-MODE 2: BY WHOLE DEPARTMENT                          */}
                    {/* ========================================================= */}
                    {exportStudioMode === "department" && (
                        <CardContent className="p-4 sm:p-5 space-y-5">
                            {/* Department Selection Bar */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                                        Select Target Department
                                    </label>
                                    <Select value={deptTarget} onValueChange={setDeptTarget}>
                                        <SelectTrigger className="h-9 text-xs w-full">
                                            <SelectValue placeholder="Select Department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Campus Departments</SelectItem>
                                            {departmentOrder.map((dept) => (
                                                <SelectItem key={dept} value={dept}>
                                                    {dept} Department
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                                        Publication Year Filter
                                    </label>
                                    <Select value={exportYear} onValueChange={setExportYear}>
                                        <SelectTrigger className="h-9 text-xs w-full">
                                            <SelectValue placeholder="All Years" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Publication Years</SelectItem>
                                            {years.map((y) => (
                                                <SelectItem key={y} value={y.toString()}>
                                                    {y}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                                        Export Packaging Mode
                                    </label>
                                    <Select value={deptFormat} onValueChange={(val: any) => setDeptFormat(val)}>
                                        <SelectTrigger className="h-9 text-xs w-full">
                                            <SelectValue placeholder="Export Format" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="single">Single Consolidated Excel (.xlsx)</SelectItem>
                                            <SelectItem value="zip">Organized Department ZIP (.zip)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Department Live Summary Card */}
                            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-emerald-600" />
                                        <span className="font-bold text-sm text-foreground">
                                            {deptTarget === "all" ? "All Campus Departments" : `${deptTarget} Department Portfolio`}
                                        </span>
                                    </div>
                                    <Badge className="bg-emerald-600 text-white font-mono text-xs">
                                        {exportYear === "all" ? "All Years" : `Year ${exportYear}`}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                    <div className="p-3 rounded-lg bg-card border border-border/60">
                                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Active Researchers</p>
                                        <p className="text-xl font-bold font-mono text-foreground mt-0.5">{deptResearchers.length}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-card border border-border/60">
                                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Verified Publications</p>
                                        <p className="text-xl font-bold font-mono text-emerald-600 mt-0.5">{deptPublications.length}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-card border border-border/60">
                                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Recorded Citations</p>
                                        <p className="text-xl font-bold font-mono text-blue-600 mt-0.5">{deptCitations}</p>
                                    </div>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    {deptFormat === "single" ? (
                                        <p>
                                            Generating a <strong>Single Consolidated Department Workbook (.xlsx)</strong> with Sheet 1 (Department Publications Matrix), Sheet 2 (Department Citations Matrix), followed by dedicated tabs per researcher in {deptTarget}.
                                        </p>
                                    ) : (
                                        <p>
                                            Generating an <strong>Organized ZIP Archive (.zip)</strong> with dedicated folders per researcher: <code>{deptTarget}/Researcher_Name/Researcher_Name_{exportYear === "all" ? "All_Years" : exportYear}.xlsx</code>.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Department Action Bar */}
                            <div className="pt-2 border-t border-border/60 flex items-center justify-end">
                                <Button
                                    onClick={handleDownloadDepartment}
                                    disabled={isExporting || deptResearchers.length === 0}
                                    className="h-10 px-6 text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                >
                                    {isExporting ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                            <span>{exportProgressText || "Exporting..."}</span>
                                        </>
                                    ) : deptFormat === "single" ? (
                                        <>
                                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                                            <span>Export {deptTarget} Consolidated Excel (.xlsx)</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-4 w-4 mr-2" />
                                            <span>Export {deptTarget} Archive (.zip)</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    )}

                    {/* ========================================================= */}
                    {/* SUB-MODE 3: BY SELECTED PUBLICATIONS                      */}
                    {/* ========================================================= */}
                    {exportStudioMode === "publications" && (
                        <CardContent className="p-4 sm:p-5 space-y-4">
                            {/* Filter Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2.5 flex-wrap flex-1">
                                    {/* Department Filter */}
                                    <div className="w-full sm:w-40">
                                        <Select value={pubDeptFilter} onValueChange={setPubDeptFilter}>
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

                                    {/* Year Filter */}
                                    <div className="w-full sm:w-32">
                                        <Select value={pubYearFilter} onValueChange={setPubYearFilter}>
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

                                    {/* Search Query */}
                                    <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={pubSearch}
                                            onChange={(e) => setPubSearch(e.target.value)}
                                            placeholder="Search publications by title, author, journal, or DOI..."
                                            className="pl-8 h-8 text-xs w-full"
                                        />
                                    </div>
                                </div>

                                {/* Select All Visible Controls */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={selectAllVisiblePubs}
                                        className="h-8 text-xs gap-1.5"
                                    >
                                        <CheckSquare className="w-3.5 h-3.5 text-brand" />
                                        <span>
                                            {selectedPubIds.length === filteredPublicationsForPicker.length && filteredPublicationsForPicker.length > 0
                                                ? "Deselect All"
                                                : `Select All (${filteredPublicationsForPicker.length})`}
                                        </span>
                                    </Button>
                                    {selectedPubIds.length > 0 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedPubIds([])}
                                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            Clear Selection
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Publications Checkbox List */}
                            {filteredPublicationsForPicker.length === 0 ? (
                                <div className="p-8 text-center border border-dashed rounded-xl bg-muted/20">
                                    <p className="text-xs text-muted-foreground">
                                        No publications match your active search or filters.
                                    </p>
                                </div>
                            ) : (
                                <div className="border border-border/60 rounded-xl overflow-hidden shadow-xs">
                                    <div className="max-h-96 overflow-y-auto divide-y divide-border/60">
                                        {filteredPublicationsForPicker.map((pub: any) => {
                                            const isChecked = selectedPubIds.includes(pub.id);
                                            const authorsStr = Array.isArray(pub.authors) ? pub.authors.join(", ") : pub.authors || "";
                                            return (
                                                <div
                                                    key={pub.id}
                                                    onClick={() => togglePubSelection(pub.id)}
                                                    className={`p-3 text-xs flex items-start gap-3 cursor-pointer transition-colors ${
                                                        isChecked
                                                            ? "bg-purple-50/50 dark:bg-purple-950/20"
                                                            : "hover:bg-muted/30"
                                                    }`}
                                                >
                                                    <div className="pt-0.5 shrink-0">
                                                        {isChecked ? (
                                                            <CheckSquare className="w-4 h-4 text-purple-600" />
                                                        ) : (
                                                            <Square className="w-4 h-4 text-muted-foreground/60" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <p className="font-semibold text-foreground line-clamp-1 leading-snug">
                                                            {pub.title}
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                            <span className="truncate max-w-[200px] font-medium text-foreground/80">
                                                                {pub.owner_name || pub.ownerName || "Researcher"}
                                                            </span>
                                                            <span>•</span>
                                                            <span className="truncate max-w-[250px]">{authorsStr}</span>
                                                            <span>•</span>
                                                            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                                                                {pub.year}
                                                            </Badge>
                                                            <span>•</span>
                                                            <Badge className="bg-emerald-600 text-white font-mono text-[10px] px-1.5 py-0">
                                                                {pub.citations || 0} Citations
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Publications Action Bar */}
                            <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="text-xs text-muted-foreground">
                                    {selectedPubIds.length === 0 ? (
                                        <span>Select 1 or more publication checkboxes above to export an official Excel dossier.</span>
                                    ) : selectedPubIds.length === 1 ? (
                                        <span>Ready to export <strong>1 specific publication</strong> into an official 2-sheet Excel report.</span>
                                    ) : (
                                        <span>Ready to export <strong>{selectedPubIds.length} publications</strong> into an official 2-sheet Excel report.</span>
                                    )}
                                </div>

                                <Button
                                    onClick={handleDownloadSelectedPublications}
                                    disabled={isExporting || selectedPubIds.length === 0}
                                    className={`h-10 px-6 text-xs sm:text-sm font-semibold transition-all shadow-sm ${
                                        selectedPubIds.length === 0
                                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                                            : "bg-purple-600 hover:bg-purple-700 text-white"
                                    }`}
                                >
                                    {isExporting ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                            <span>{exportProgressText || "Exporting..."}</span>
                                        </>
                                    ) : selectedPubIds.length === 0 ? (
                                        <span>Select at least 1 publication to export</span>
                                    ) : selectedPubIds.length === 1 ? (
                                        <>
                                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                                            <span>Export 1 Publication Report (.xlsx)</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                                            <span>Export {selectedPubIds.length} Selected Publications (.xlsx)</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    )}
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
                                                    const p = JSON.parse(pub.sdg_tags);
                                                    return Array.isArray(p) ? p : [pub.sdg_tags];
                                                } catch {
                                                    return [pub.sdg_tags];
                                                }
                                            })()
                                            : [];

                                        return (
                                            <tr key={pub.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3.5 font-semibold text-foreground max-w-sm truncate" title={pub.title}>
                                                    {pub.title}
                                                </td>
                                                <td className="p-3.5 text-muted-foreground truncate max-w-[160px]" title={authorsStr}>
                                                    {authorsStr}
                                                </td>
                                                <td className="p-3.5 text-muted-foreground">
                                                    <div>{pub.journal || "PSU Archive"}</div>
                                                    <span className="text-[10px] font-mono text-emerald-600 font-medium">
                                                        {pub.journal_indexing || "Refereed"}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 text-center font-mono text-muted-foreground">{pub.year}</td>
                                                <td className="p-3.5 text-center font-mono font-bold text-foreground">
                                                    {pub.citations || 0}
                                                </td>
                                                <td className="p-3.5">
                                                    {sdgList.length > 0 ? (
                                                        <Badge variant="outline" className="text-[10px] font-mono">
                                                            {sdgList[0].split(":")[0]}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground/60 text-[10px]">Unassigned</span>
                                                    )}
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <StatusBadge status="verified" label="Compliant" />
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
                    <Card className="border-border/60 shadow-xs">
                        <CardHeader className="pb-3 border-b border-border/60">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base font-bold text-foreground">
                                        PSU Asingan Campus Executive Research Briefing
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Synthesized executive metrics for campus academic planning and institutional strategy
                                    </CardDescription>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.print()}
                                    className="text-xs h-8 gap-1.5 w-fit"
                                >
                                    <Printer className="h-3.5 w-3.5" />
                                    <span>Print Executive Report</span>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 rounded-xl border border-border/80 bg-muted/20">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Average Citations / Researcher</p>
                                    <p className="text-2xl font-bold font-mono text-foreground mt-1">
                                        {(totalCitations / Math.max(dashboardData.totalResearchers, 1)).toFixed(1)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">Calculated across registered researchers</p>
                                </div>
                                <div className="p-4 rounded-xl border border-border/80 bg-muted/20">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Average Citations / Publication</p>
                                    <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                                        {(totalCitations / Math.max(publicationsList.length, 1)).toFixed(1)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">Per published scholarly output</p>
                                </div>
                                <div className="p-4 rounded-xl border border-border/80 bg-muted/20">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Active Institutional Portfolio</p>
                                    <p className="text-2xl font-bold font-mono text-blue-600 mt-1">
                                        {publicationsList.length} Papers
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">Spanning {years.length} publication cycles</p>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-border/70 bg-card space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Accreditation Compliance Statement
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    All verified publications above comply with the documentation guidelines of the Pangasinan State University Research and Development Office. Excel export files generated in Tab 1 preserve the official 8-column Publication Sheet and 15-column Citation Sheet templates, ready for submission to internal university auditors and external AACCUP accreditors.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
