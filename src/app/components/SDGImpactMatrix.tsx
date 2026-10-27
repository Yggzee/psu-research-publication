import { useState, useEffect, useMemo } from "react";
import {
  Target,
  Sparkles,
  BarChart3,
  Award,
  Layers,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Search,
  BookOpen,
  Quote,
  FileText,
  ChevronDown,
  Info,
  ArrowRight,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { apiService, type SDGStatsResponse, type SDGPaperItem } from "../services/api.service";
import { PublicationInspectorDrawer, type InspectedPublication } from "./PublicationInspectorDrawer";
import { toast } from "sonner";
import { useTheme } from "../utils/themeContext";
import { PageHeader, StatCard, PageTabs } from "./common";

// Official UN SDG Color Palette
const SDG_COLORS: Record<string, string> = {
  "SDG 1": "#E5243B",
  "SDG 2": "#DDA63A",
  "SDG 3": "#4C9F38",
  "SDG 4": "#C5192D",
  "SDG 5": "#FF3A21",
  "SDG 6": "#26BDE2",
  "SDG 7": "#FCC30B",
  "SDG 8": "#A21942",
  "SDG 9": "#FD6925",
  "SDG 10": "#DD1367",
  "SDG 11": "#FD9D24",
  "SDG 12": "#BF8B2E",
  "SDG 13": "#3F7E44",
  "SDG 14": "#0A97D9",
  "SDG 15": "#56C02B",
  "SDG 16": "#00689D",
  "SDG 17": "#19486A",
};

export function SDGImpactMatrix() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<SDGStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [selectedSDG, setSelectedSDG] = useState<string>("SDG 4: Quality Education");
  const [paperSearchQuery, setPaperSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"focused" | "all-goals">("focused");
  const [selectedPublication, setSelectedPublication] = useState<InspectedPublication | null>(null);

  const extractSDGNum = (str: string | undefined | null) => {
    if (!str) return null;
    const m = String(str).match(/\bSDG\s*(\d{1,2})\b/i);
    return m ? parseInt(m[1], 10) : null;
  };

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getSDGStats();
      setStats(data);
      if (data?.radarData && data.radarData.length > 0) {
        const currentNum = extractSDGNum(selectedSDG);
        const currentGoal = data.radarData.find(
          (r) => extractSDGNum(r.sdg) === currentNum || extractSDGNum(r.fullLabel) === currentNum
        );
        if (!currentGoal || currentGoal.count === 0) {
          const top = [...data.radarData].sort((a, b) => b.count - a.count)[0];
          if (top && top.count > 0) {
            setSelectedSDG(top.fullLabel);
          }
        }
      }
    } catch (err: any) {
      toast.error(`Failed to load SDG matrix data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleBatchClassify = async () => {
    setIsBatchRunning(true);
    toast.loading("Re-analyzing campus publications with Gemini Flash...", { id: "sdg-batch" });
    try {
      const res = await apiService.batchClassifySDG();
      toast.success(`Successfully classified ${res.processed} publications into UN SDGs!`, { id: "sdg-batch" });
      await fetchStats();
    } catch (err: any) {
      toast.error(`Classification error: ${err.message}`, { id: "sdg-batch" });
    } finally {
      setIsBatchRunning(false);
    }
  };

  const radarData = stats?.radarData || [];
  const topSdgs = useMemo(() => {
    return [...radarData].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [radarData]);

  // Current active SDG item from radarData
  const activeSDGItem = useMemo(() => {
    const targetNum = extractSDGNum(selectedSDG);

    return (
      radarData.find((r) => {
        if (r.fullLabel === selectedSDG || r.sdg === selectedSDG) return true;
        if (targetNum !== null) {
          return extractNumSafe(r.sdg) === targetNum || extractNumSafe(r.fullLabel) === targetNum;
        }
        return false;
      }) ||
      radarData.find((r) => r.count > 0) ||
      radarData[0] ||
      null
    );
  }, [radarData, selectedSDG]);

  function extractNumSafe(str: string | undefined | null) {
    if (!str) return null;
    const m = String(str).match(/\bSDG\s*(\d{1,2})\b/i);
    return m ? parseInt(m[1], 10) : null;
  }

  const getDisplayRationale = (paper: SDGPaperItem, activeSDG: string | undefined) => {
    if (paper.sdgRationales && activeSDG) {
      const targetNum = extractNumSafe(activeSDG);
      for (const [k, v] of Object.entries(paper.sdgRationales)) {
        if (k === activeSDG || k.toLowerCase() === activeSDG.toLowerCase()) return v;
        const kNum = extractNumSafe(k);
        if (targetNum !== null && kNum !== null && targetNum === kNum) return v;
      }
    }
    if (paper.sdgRationale) {
      try {
        const parsed = JSON.parse(paper.sdgRationale);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && activeSDG) {
          const targetNum = extractNumSafe(activeSDG);
          for (const [k, v] of Object.entries(parsed as Record<string, string>)) {
            if (k === activeSDG || k.toLowerCase() === activeSDG.toLowerCase()) return v;
            const kNum = extractNumSafe(k);
            if (targetNum !== null && kNum !== null && targetNum === kNum) return v;
          }
        }
      } catch {}
      return paper.sdgRationale;
    }
    return null;
  };

  // All SDGs that currently have at least 1 mapped paper
  const sdgsWithPapers = useMemo(() => {
    return radarData.filter((r) => r.papers && r.papers.length > 0);
  }, [radarData]);

  // Filter papers within active SDG
  const activeGoalPapers = useMemo(() => {
    if (!activeSDGItem?.papers) return [];
    if (!paperSearchQuery.trim()) return activeSDGItem.papers;

    const q = paperSearchQuery.toLowerCase().trim();
    return activeSDGItem.papers.filter((p) => {
      const authStr = Array.isArray(p.authors) ? p.authors.join(", ") : p.authors;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.journal && p.journal.toLowerCase().includes(q)) ||
        authStr.toLowerCase().includes(q) ||
        (p.sdgRationale && p.sdgRationale.toLowerCase().includes(q))
      );
    });
  }, [activeSDGItem, paperSearchQuery]);

  const toInspectedPub = (paper: SDGPaperItem): InspectedPublication => ({
    id: paper.id,
    title: paper.title,
    authors: paper.authors,
    journal: paper.journal,
    year: paper.year,
    citations: paper.citations,
    abstract: paper.abstract,
    url: paper.url,
    sdg_tags: paper.sdgTags,
    sdg_rationale: paper.sdgRationale,
    journal_indexing: paper.journalIndexing,
    nbc461_points: paper.nbc461Points,
    ched_priority: paper.chedPriority,
    owner_name: paper.ownerName,
  });

  const tabs = [
    { id: "overview", label: "Impact Footprint & Agendas", icon: Target },
    { id: "directory", label: "17 UN Goals Directory", count: 17, icon: Layers },
    { id: "evidence", label: "Evidence Explorer", count: activeSDGItem?.count || 0, icon: BookOpen },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <PageHeader
        title="UN Sustainable Development Goals (SDG) Matrix"
        description="Institutional alignment with the 17 UN Goals for AACCUP accreditation, SUC Leveling, and THE Impact Rankings"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStats}
              disabled={isLoading}
              className="text-xs h-8 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={handleBatchClassify}
              disabled={isBatchRunning}
              className="text-xs h-8 gap-1.5 bg-ai hover:bg-ai/90 text-white shadow-2xs"
            >
              <Sparkles className={`h-3.5 w-3.5 ${isBatchRunning ? "animate-spin" : ""}`} />
              <span>{isBatchRunning ? "Classifying..." : "Auto-Tag with Gemini"}</span>
            </Button>
          </div>
        }
      />

      {/* 2. Key Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Verified Outputs"
          value={stats?.totalClassified || 0}
          subtitle="100% Granular Mapping"
          icon={CheckCircle2}
        />
        <StatCard
          label="Active Goals"
          value={`${sdgsWithPapers.length} / 17`}
          subtitle="Goals with research evidence"
          icon={Target}
        />
        <StatCard
          label="Leading Research Pillar"
          value={topSdgs[0]?.sdg || "SDG 4"}
          subtitle={`${topSdgs[0]?.count || 0} publications mapped`}
          icon={BarChart3}
        />
        <StatCard
          label="Accreditation Readiness"
          value="Level III / IV"
          subtitle="SUC Leveling Key Result Area 3"
          icon={Award}
        />
      </div>

      {/* 3. Navigation Tabs */}
      <PageTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* 4. Tab 1: Overview & Footprint */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Radar Chart (7 cols) */}
            <Card className="lg:col-span-7 border-border/60 shadow-xs flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Institutional SDG Footprint (Radar)</CardTitle>
                  <Badge variant="outline" className="text-[10px] font-mono">17 UN Vectors</Badge>
                </div>
                <CardDescription className="text-xs">
                  Radial spread of campus research outputs across sustainable development vectors
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center p-2 min-h-[340px]">
                <ResponsiveContainer width="100%" height={340}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke={isDark ? "#374151" : "#e5e7eb"} />
                    <PolarAngleAxis
                      dataKey="sdg"
                      tick={{ fill: isDark ? "#9ca3af" : "#4b5563", fontSize: 10, fontWeight: 600 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, "auto"]}
                      tick={{ fill: isDark ? "#6b7280" : "#9ca3af", fontSize: 9 }}
                    />
                    <Radar
                      name="Publications"
                      dataKey="count"
                      stroke="#0038A8"
                      fill="#0038A8"
                      fillOpacity={0.25}
                    />
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload || !payload[0]) return null;
                        const item = payload[0].payload;
                        return (
                          <div className="p-3 bg-card border border-border rounded-xl shadow-lg text-xs space-y-1">
                            <p className="font-semibold text-foreground">{item.fullLabel}</p>
                            <p className="text-brand font-mono font-bold">{item.count} Publications</p>
                            <p className="text-[10px] text-muted-foreground">Select in Directory to view papers</p>
                          </div>
                        );
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top SDGs Bar Chart & CHED Priorities (5 cols) */}
            <div className="lg:col-span-5 space-y-6 flex flex-col">
              <Card className="border-border/60 shadow-xs flex-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Top Contributing Goals</CardTitle>
                  <CardDescription className="text-xs">Highest volume research goals</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={topSdgs} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? "#374151" : "#e5e7eb"} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="sdg" tick={{ fontSize: 10, fontWeight: 600 }} width={55} />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="#0038A8"
                        radius={[0, 4, 4, 0]}
                        className="cursor-pointer hover:opacity-80"
                        onClick={(entry: any) => {
                          if (entry?.fullLabel) {
                            setSelectedSDG(entry.fullLabel);
                            setActiveTab("evidence");
                          }
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* CHED Priority Agendas */}
              <Card className="border-border/60 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Philippine CHED / DOST Priorities</CardTitle>
                  <CardDescription className="text-xs">National higher education research agendas</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {stats?.chedPriorities?.map((item) => (
                    <div
                      key={item.priority}
                      className="p-2 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-foreground">{item.priority}</span>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {item.count} papers
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab 2: 17 UN Goals Directory */}
      {activeTab === "directory" && (
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand" />
                  <span>17 UN Sustainable Goals Directory</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Select any goal to inspect publication evidence, citations, and Gemini AI alignment rationales
                </CardDescription>
              </div>

              {/* Quick jump */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-muted-foreground mr-1">Active:</span>
                {sdgsWithPapers.map((g) => {
                  const color = SDG_COLORS[g.sdg] || "#0038A8";
                  const isSelected =
                    selectedSDG === g.fullLabel ||
                    selectedSDG === g.sdg ||
                    (extractSDGNum(selectedSDG) !== null && extractSDGNum(selectedSDG) === extractSDGNum(g.sdg));
                  return (
                    <button
                      key={g.sdg}
                      onClick={() => {
                        setSelectedSDG(g.fullLabel);
                        setActiveTab("evidence");
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all border ${
                        isSelected
                          ? "bg-foreground text-background border-foreground shadow-2xs"
                          : "bg-muted/40 hover:bg-muted text-foreground border-border/60"
                      }`}
                    >
                      <span style={{ color: isSelected ? undefined : color }}>{g.sdg}</span> ({g.count})
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {radarData.map((goal) => {
                const isSelected =
                  selectedSDG === goal.fullLabel ||
                  selectedSDG === goal.sdg ||
                  (extractSDGNum(selectedSDG) !== null && extractSDGNum(selectedSDG) === extractSDGNum(goal.sdg));
                const hasPapers = goal.count > 0;
                const sdgColor = SDG_COLORS[goal.sdg] || "#0038A8";

                return (
                  <button
                    key={goal.sdg}
                    onClick={() => {
                      setSelectedSDG(goal.fullLabel);
                      setActiveTab("evidence");
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-28 relative overflow-hidden group cursor-pointer ${
                      isSelected
                        ? "border-brand bg-brand-soft ring-2 ring-brand/20 shadow-xs"
                        : hasPapers
                        ? "border-border/80 bg-card hover:border-brand/60 hover:shadow-2xs"
                        : "border-border/40 bg-muted/10 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: sdgColor }}
                    />

                    <div className="flex items-center justify-between w-full pt-1">
                      <span
                        className="text-xs font-black font-mono"
                        style={{ color: sdgColor }}
                      >
                        {goal.sdg}
                      </span>
                      <Badge
                        variant={hasPapers ? "default" : "outline"}
                        className={`text-[10px] font-mono px-1.5 py-0 h-4 ${
                          hasPapers
                            ? "bg-brand text-white font-bold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {goal.count}
                      </Badge>
                    </div>

                    <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">
                      {goal.fullName}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                      <span>{hasPapers ? "View papers" : "No outputs"}</span>
                      {isSelected && (
                        <span className="text-brand font-bold">Active</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Tab 3: Evidence Explorer */}
      {activeTab === "evidence" && (
        <Card className="border-border/60 shadow-xs overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-2xs"
                  style={{
                    backgroundColor: activeSDGItem ? SDG_COLORS[activeSDGItem.sdg] || "#0038A8" : "#0038A8",
                  }}
                >
                  {activeSDGItem?.sdg.replace("SDG ", "") || "1"}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base font-bold text-foreground">
                      {activeSDGItem?.fullLabel || "SDG 1: No Poverty"}
                    </CardTitle>
                    <Badge
                      className="text-xs font-mono font-bold text-white"
                      style={{
                        backgroundColor: activeSDGItem ? SDG_COLORS[activeSDGItem.sdg] || "#0038A8" : "#0038A8",
                      }}
                    >
                      {activeSDGItem?.count || 0} Publication{(activeSDGItem?.count || 0) !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Faculty evidence, citations, and Gemini AI alignment rationale
                  </CardDescription>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search in this goal..."
                    value={paperSearchQuery}
                    onChange={(e) => setPaperSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                <div className="flex items-center rounded-lg border border-border/70 p-0.5 bg-card">
                  <Button
                    variant={viewMode === "focused" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("focused")}
                    className={`text-xs h-7 px-2.5 ${viewMode === "focused" ? "bg-brand text-white" : ""}`}
                  >
                    Selected ({activeSDGItem?.count || 0})
                  </Button>
                  <Button
                    variant={viewMode === "all-goals" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("all-goals")}
                    className={`text-xs h-7 px-2.5 ${viewMode === "all-goals" ? "bg-brand text-white" : ""}`}
                  >
                    All Active ({sdgsWithPapers.length})
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5">
            {viewMode === "focused" && (
              <div className="space-y-3.5">
                {activeGoalPapers.length > 0 ? (
                  activeGoalPapers.map((paper, index) => {
                    const authorsList = Array.isArray(paper.authors) ? paper.authors : [paper.authors];
                    return (
                      <div
                        key={paper.id || index}
                        className="p-4 rounded-xl border border-border/80 bg-card hover:border-brand/40 hover:shadow-2xs transition-all space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <h3
                              onClick={() => setSelectedPublication(toInspectedPub(paper))}
                              className="text-sm font-semibold text-foreground hover:text-brand cursor-pointer transition-colors leading-snug"
                            >
                              {paper.title}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span className="font-medium text-foreground">
                                {authorsList.join(", ")}
                              </span>
                              <span>•</span>
                              <span>{paper.journal || "PSU Asingan Archive"}</span>
                              <span>•</span>
                              <span className="font-mono font-semibold">{paper.year}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-xs font-mono flex items-center gap-1">
                              <Quote className="w-3 h-3 text-brand" />
                              {paper.citations} citations
                            </Badge>
                            {paper.nbc461Points && (
                              <Badge variant="secondary" className="text-xs font-mono">
                                NBC 461: {paper.nbc461Points} pts
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Gemini Rationale */}
                        {(() => {
                          const rationaleText = getDisplayRationale(paper, activeSDGItem?.sdg);
                          if (!rationaleText) return null;
                          return (
                            <div className="p-3 rounded-lg bg-ai-soft border border-ai-border text-xs">
                              <div className="flex items-center gap-1.5 font-semibold text-ai mb-1">
                                <Sparkles className="w-3.5 h-3.5 text-ai" />
                                <span>Why this aligns with {activeSDGItem?.sdg}:</span>
                              </div>
                              <p className="text-foreground/90 leading-relaxed text-xs">
                                "{rationaleText}"
                              </p>
                            </div>
                          );
                        })()}

                        {/* Footer tags */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-muted-foreground font-medium">Mapped Goals:</span>
                            {paper.sdgTags?.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px] font-mono">
                                {tag}
                              </Badge>
                            ))}
                            {paper.chedPriority && (
                              <Badge variant="secondary" className="text-[10px]">
                                CHED: {paper.chedPriority}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {paper.url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(paper.url, "_blank")}
                                className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Paper URL
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPublication(toInspectedPub(paper))}
                              className="text-xs h-7 gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Inspect
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center border border-dashed border-border/80 rounded-xl p-8 space-y-3">
                    <div className="p-2.5 rounded-full bg-muted/40 w-10 h-10 flex items-center justify-center mx-auto text-muted-foreground">
                      <Info className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">
                        No publications mapped to {activeSDGItem?.fullLabel}
                      </h4>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                        Pangasinan State University does not currently have verified faculty research under this goal.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === "all-goals" && (
              <div className="space-y-4">
                {sdgsWithPapers.map((goal) => {
                  const color = SDG_COLORS[goal.sdg] || "#0038A8";
                  return (
                    <div
                      key={goal.sdg}
                      className="border border-border/80 rounded-xl overflow-hidden bg-card shadow-2xs"
                    >
                      <div
                        className="p-3 px-4 flex items-center justify-between border-b border-border/60"
                        style={{ borderLeft: `5px solid ${color}` }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-black font-mono text-xs" style={{ color }}>
                            {goal.sdg}
                          </span>
                          <span className="font-semibold text-foreground text-xs">
                            {goal.fullName}
                          </span>
                        </div>
                        <Badge
                          className="text-[10px] font-mono text-white font-bold"
                          style={{ backgroundColor: color }}
                        >
                          {goal.papers.length} paper{goal.papers.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>

                      <div className="p-3 space-y-2 bg-muted/10 divide-y divide-border/40">
                        {goal.papers.map((paper, idx) => {
                          const authorsStr = Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors;
                          return (
                            <div
                              key={paper.id || idx}
                              className="pt-2 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5 flex-1">
                                <p
                                  onClick={() => setSelectedPublication(toInspectedPub(paper))}
                                  className="text-xs font-semibold text-foreground hover:text-brand cursor-pointer transition-colors"
                                >
                                  {paper.title}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {authorsStr} ({paper.year}) • {paper.journal}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {paper.citations} cites
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedPublication(toInspectedPub(paper))}
                                  className="text-xs h-6 px-2 gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  Inspect
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Inspector Drawer */}
      <PublicationInspectorDrawer
        publication={selectedPublication}
        isOpen={Boolean(selectedPublication)}
        onClose={() => setSelectedPublication(null)}
      />
    </div>
  );
}
