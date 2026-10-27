import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  FileText,
  TrendingUp,
  Calendar,
  User,
  Search,
  Shield,
  RefreshCw,
  Table,
  LayoutGrid,
  Sparkles,
  CheckSquare,
  Square,
  Copy,
  SlidersHorizontal,
  Target,
  Award,
  ExternalLink,
  Quote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { filterFacultyPublications, getFacultyList, matchesResearcher } from "../utils/facultyUtils";
import { apiService } from "../services/api.service";
import { PublicationInspectorDrawer, type InspectedPublication } from "./PublicationInspectorDrawer";
import { PageHeader, EmptyState } from "./common";
import { toast } from "sonner";

type SortOption = "impact-high" | "impact-low" | "citations-high" | "citations-low" | "year-new" | "year-old";
type ViewMode = "table" | "cards";

export function PublicationsPage() {
  const navigate = useNavigate();
  const [publicationsList, setPublicationsList] = useState<any[]>([]);
  const [researchersList, setResearchersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedResearcher, setSelectedResearcher] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("year-new");
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "cards" : "table"
  );
  const [facultyCount, setFacultyCount] = useState(0);

  // Inspector & Selection States
  const [inspectedPub, setInspectedPub] = useState<InspectedPublication | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const loadPublications = async () => {
    setLoading(true);
    try {
      const data = await apiService.getPublications();
      setPublicationsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to load publications from database:", err);
      setPublicationsList([]);
    } finally {
      setLoading(false);
    }
  };

  const loadResearchers = async () => {
    try {
      const data = await apiService.getResearchers();
      setResearchersList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to load researchers for filter dropdown:", err);
      setResearchersList([]);
    }
  };

  useEffect(() => {
    loadPublications();
    loadResearchers();
    setFacultyCount(getFacultyList().length);

    const onUpdate = () => {
      loadPublications();
      loadResearchers();
    };

    window.addEventListener("research-records-updated", onUpdate);
    window.addEventListener("researchers-updated", onUpdate);
    window.addEventListener("faculty-updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener("research-records-updated", onUpdate);
      window.removeEventListener("researchers-updated", onUpdate);
      window.removeEventListener("faculty-updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);

  const allPublications = useMemo(() => {
    return filterFacultyPublications(publicationsList);
  }, [publicationsList]);

  // Compute years based on actual database publications
  const years = useMemo(() => {
    if (allPublications.length === 0) return [];
    const pubYears = allPublications.map((p) => p.year);
    const earliest = Math.min(...pubYears);
    const latest = Math.max(...pubYears, new Date().getFullYear());
    const result = [];
    for (let y = latest; y >= earliest; y--) {
      result.push(y);
    }
    return result;
  }, [allPublications]);

  const filteredAndSortedPublications = useMemo(() => {
    const targetResearcher =
      selectedResearcher !== "all"
        ? researchersList.find(
            (r) =>
              r.id === selectedResearcher ||
              r.instructorId === selectedResearcher ||
              r.instructor_id === selectedResearcher ||
              r.name === selectedResearcher
          )
        : null;

    let filtered = allPublications.filter((pub) => {
      // 1. Search Query
      const authorText = Array.isArray(pub.authors) ? pub.authors.join(", ") : pub.authors || "";
      const matchesSearch =
        pub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pub.journal && pub.journal.toLowerCase().includes(searchQuery.toLowerCase())) ||
        authorText.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Year Filter
      const matchesYear = selectedYear === "all" || pub.year.toString() === selectedYear;

      // 3. Dynamic Researcher / Instructor Filter
      const matchesInstructor = !targetResearcher || matchesResearcher(pub, targetResearcher);

      return matchesSearch && matchesYear && matchesInstructor;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "impact-high":
          return ((b as any).impact_score || b.impactScore || 0) - ((a as any).impact_score || a.impactScore || 0);
        case "impact-low":
          return ((a as any).impact_score || a.impactScore || 0) - ((b as any).impact_score || b.impactScore || 0);
        case "citations-high":
          return (b.citations || 0) - (a.citations || 0);
        case "citations-low":
          return (a.citations || 0) - (b.citations || 0);
        case "year-new":
          return b.year - a.year;
        case "year-old":
          return a.year - b.year;
        default:
          return 0;
      }
    });

    return sorted;
  }, [allPublications, researchersList, searchQuery, selectedYear, selectedResearcher, sortBy]);

  // Selection handlers
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredAndSortedPublications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedPublications.map((p) => p.id));
    }
  };

  // Batch Export APA
  const handleBatchExportAPA = () => {
    const selectedPapers = allPublications.filter((p) => selectedIds.includes(p.id));
    const text = selectedPapers
      .map((p) => {
        const auth = Array.isArray(p.authors) ? p.authors.join(", ") : p.authors;
        return `${auth} (${p.year}). ${p.title}. ${p.journal || "PSU Asingan Archive"}.`;
      })
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${selectedPapers.length} APA citations to clipboard!`);
  };

  // Batch Auto-Tag
  const handleBatchAutoTag = async () => {
    setIsBatchRunning(true);
    toast.loading("Running Gemini Flash Auto-Tagging on selected papers...", { id: "batch-tag" });
    try {
      const res = await apiService.batchClassifySDG();
      toast.success(`Successfully analyzed and classified ${res.processed} papers!`, { id: "batch-tag" });
      await loadPublications();
    } catch (err: any) {
      toast.error(`Classification error: ${err.message}`, { id: "batch-tag" });
    } finally {
      setIsBatchRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <PageHeader
        title="Publications Repository"
        description="Verified institutional publications, UN Sustainable Development Goal alignments, and citations tracking"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border/70 p-0.5 bg-muted/40">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-card text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Table className="h-3.5 w-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-card text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Cards</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchAutoTag}
              disabled={isBatchRunning}
              className="text-xs h-8 gap-1.5 text-ai hover:bg-ai-soft hover:border-ai-border"
              title="Classify unmapped publications into UN SDGs using Gemini Flash"
            >
              <Sparkles className={`h-3.5 w-3.5 ${isBatchRunning ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Auto-Tag SDGs</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={loadPublications}
              disabled={loading}
              className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        }
      />

      {/* Filter Ribbon Card */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search */}
            <div className="md:col-span-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search publications by title, author, or journal venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-xs"
              />
            </div>

            {/* Dynamic Instructor / Researcher Filter Dropdown */}
            <div className="md:col-span-3">
              <Select value={selectedResearcher} onValueChange={setSelectedResearcher}>
                <SelectTrigger className="h-10 text-xs font-medium">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <SelectValue placeholder="All Researchers / Instructors" />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">
                    <div className="flex items-center justify-between w-full gap-2 font-medium">
                      <span>All Researchers ({allPublications.length})</span>
                    </div>
                  </SelectItem>
                  {researchersList.map((res) => {
                    const pubCount = allPublications.filter((p) => matchesResearcher(p, res)).length;
                    return (
                      <SelectItem
                        key={res.id || res.instructorId || res.name}
                        value={res.id || res.instructorId || res.name}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="truncate">{res.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                            {pubCount} {pubCount === 1 ? "paper" : "papers"} • {res.department || "Faculty"}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Year Filter */}
            <div className="md:col-span-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      Year {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Filter */}
            <div className="md:col-span-3">
              <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year-new">Newest First</SelectItem>
                  <SelectItem value="year-old">Oldest First</SelectItem>
                  <SelectItem value="citations-high">Most Citations</SelectItem>
                  <SelectItem value="citations-low">Least Citations</SelectItem>
                  <SelectItem value="impact-high">Highest Impact Score</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result Metrics Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 text-foreground hover:text-blue-600 font-medium transition-colors"
          >
            {selectedIds.length > 0 && selectedIds.length === filteredAndSortedPublications.length ? (
              <CheckSquare className="h-4 w-4 text-blue-600" />
            ) : (
              <Square className="h-4 w-4 text-muted-foreground" />
            )}
            <span>Select All</span>
          </button>
          <span>•</span>
          <span>
            Showing <strong>{filteredAndSortedPublications.length}</strong> of {allPublications.length} papers
          </span>
          {selectedResearcher !== "all" && (
            <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 px-2.5 py-0.5 rounded-full text-[11px] font-medium">
              <User className="w-3 h-3 text-blue-600" />
              <span>
                Filtered: {researchersList.find((r) => r.id === selectedResearcher || r.instructorId === selectedResearcher || r.name === selectedResearcher)?.name || "Instructor"}
              </span>
              <button
                onClick={() => setSelectedResearcher("all")}
                title="Clear instructor filter"
                className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
              >
                ✕
              </button>
            </span>
          )}
        </div>

        <p className="text-[11px]">
          Tip: Click any row to open the <strong>Research Inspector Drawer</strong>
        </p>
      </div>

      {/* VIEW MODE 1: DENSE TABLE */}
      {viewMode === "table" && (
        <Card className="border-border/60 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="p-3.5 w-10 text-center"></th>
                  <th className="p-3.5 min-w-[280px]">Publication Title</th>
                  <th className="p-3.5 min-w-[160px]">Authors</th>
                  <th className="p-3.5 min-w-[140px]">Journal / Index</th>
                  <th className="p-3.5 w-20 text-center">Year</th>
                  <th className="p-3.5 w-24 text-center">Citations</th>
                  <th className="p-3.5 min-w-[120px]">UN SDG Goal</th>
                  <th className="p-3.5 w-24 text-right">NBC 461</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredAndSortedPublications.map((pub) => {
                  const isSelected = selectedIds.includes(pub.id);
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
                    <tr
                      key={pub.id}
                      onClick={() => setInspectedPub(pub)}
                      className={`hover:bg-muted/30 transition-colors cursor-pointer group ${
                        isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      <td className="p-3.5 text-center" onClick={(e) => toggleSelect(pub.id, e)}>
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-blue-600 inline-block" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground/60 inline-block group-hover:text-foreground" />
                        )}
                      </td>
                      <td className="p-3.5 font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        <div className="line-clamp-2 leading-snug">{pub.title}</div>
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        <div className="line-clamp-1">{authorsStr}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="line-clamp-1 text-foreground/80 font-medium">{pub.journal || "Archive"}</div>
                        <Badge variant="outline" className="text-[10px] font-mono mt-0.5 px-1 py-0 border-border/80">
                          {pub.journal_indexing || "Refereed"}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-center font-mono text-muted-foreground">{pub.year}</td>
                      <td className="p-3.5 text-center">
                        <Badge className="bg-emerald-600 text-white font-mono text-[11px] px-2 py-0">
                          {pub.citations || 0}
                        </Badge>
                      </td>
                      <td className="p-3.5">
                        {sdgList.length > 0 ? (
                          <Badge variant="secondary" className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">
                            {sdgList[0].split(":")[0]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60 text-[10px] italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                        {pub.nbc461_points || (pub.journal?.toLowerCase().includes("scopus") ? 25 : 15)} pts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* VIEW MODE 2: CARDS */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAndSortedPublications.map((pub) => {
            const isSelected = selectedIds.includes(pub.id);
            const authorsStr = Array.isArray(pub.authors) ? pub.authors.join(", ") : pub.authors;

            return (
              <Card
                key={pub.id}
                onClick={() => setInspectedPub(pub)}
                className={`cursor-pointer hover:border-blue-500 hover:shadow-md transition-all ${
                  isSelected ? "border-blue-500 ring-2 ring-blue-500/20" : "border-border/60"
                }`}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {pub.year}
                      </Badge>
                      <Badge className="bg-emerald-600 text-white text-xs">
                        {pub.citations || 0} Citations
                      </Badge>
                    </div>
                    <button onClick={(e) => toggleSelect(pub.id, e)}>
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground/60" />
                      )}
                    </button>
                  </div>

                  <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2 hover:text-blue-600 transition-colors">
                    {pub.title}
                  </h3>

                  <p className="text-xs text-muted-foreground line-clamp-1">
                    By {authorsStr}
                  </p>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {pub.journal || "PSU Asingan Archive"}
                    </span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                      {pub.nbc461_points || 15} pts
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredAndSortedPublications.length === 0 && !loading && (
        <EmptyState
          icon={FileText}
          title="No publications matched your search"
          description='Try adjusting your search query, selecting "All Publication Years", or search for new records from Google Scholar.'
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery("");
            setSelectedYear("all");
            setSelectedResearcher("all");
          }}
        />
      )}

      {/* Batch Operations Floating Dock */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-foreground text-background dark:bg-card dark:text-foreground dark:border dark:border-border px-3.5 sm:px-5 py-2 sm:py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 sm:gap-4 animate-in slide-in-from-bottom duration-200 max-w-[calc(100vw-2rem)] flex-wrap justify-center">
          <div className="text-xs font-semibold">
            <span className="font-bold font-mono text-blue-400">{selectedIds.length}</span> papers selected
          </div>

          <div className="h-4 w-px bg-border" />

          <Button
            size="sm"
            variant="secondary"
            onClick={handleBatchExportAPA}
            className="text-xs h-8 gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy APA Citations
          </Button>

          <Button
            size="sm"
            onClick={handleBatchAutoTag}
            disabled={isBatchRunning}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Batch Tag SDGs (Gemini)
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds([])}
            className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Research Inspector Drawer */}
      <PublicationInspectorDrawer
        publication={inspectedPub}
        isOpen={Boolean(inspectedPub)}
        onClose={() => setInspectedPub(null)}
        onUpdate={(updated) => {
          setInspectedPub(updated);
          setPublicationsList((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
          );
        }}
      />
    </div>
  );
}
