import { useState, useEffect } from "react";
import {
  TrendingUp,
  FileText,
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  AlertCircle,
  RefreshCw,
  Award,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getLastNYears, DEPARTMENT_COLORS, DEPARTMENTS } from "../utils/chartUtils";
import { DepartmentLegend } from "./DepartmentLegend";
import { Button } from "./ui/button";
import { apiService, type DashboardStatsResponse } from "../services/api.service";
import { useTheme } from "../utils/themeContext";
import { PageHeader, StatCard, PageTabs } from "./common";

export function ImpactAnalysisPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [activeTab, setActiveTab] = useState("citations");
  const [citationMode, setCitationMode] = useState<"annual" | "cumulative">("annual");
  const [yearRange, setYearRange] = useState(() => {
    const lastYears = getLastNYears(10);
    return { start: lastYears[0], end: lastYears[lastYears.length - 1] };
  });
  const [isLoading, setIsLoading] = useState(false);

  // Real Database Stats
  const [data, setData] = useState<DashboardStatsResponse>({
    totalResearchers: 0,
    totalPublications: 0,
    totalCitations: 0,
    averageImpactScore: 0.0,
    topResearchers: [],
    deptYearStats: [],
  });

  const recordedYears = (data.deptYearStats || [])
    .map((s) => Number(s.year))
    .filter((y) => !isNaN(y) && y >= 1990 && y <= new Date().getFullYear());
  const minRecordedYear = recordedYears.length > 0 ? Math.min(...recordedYears) : 2011;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const stats = await apiService.getDashboardStats();
      if (stats) {
        setData(stats);
        const yList = (stats.deptYearStats || [])
          .map((s: any) => Number(s.year))
          .filter((y: number) => !isNaN(y) && y >= 1990 && y <= new Date().getFullYear());
        if (yList.length > 0) {
          const earliest = Math.min(...yList);
          setYearRange((prev) => ({
            start: Math.min(prev.start, earliest),
            end: Math.max(prev.end, new Date().getFullYear()),
          }));
        }
      }
    } catch (err) {
      console.warn("Failed to fetch impact analysis data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Build chart years
  const chartYears: number[] = [];
  for (let y = yearRange.start; y <= yearRange.end; y++) {
    chartYears.push(y);
  }

  // Helper to get annual or cumulative citations for a department & year
  const getDeptCitationsForYear = (dept: string, year: number, mode: "annual" | "cumulative") => {
    if (mode === "annual") {
      const match = data.deptYearStats.find(
        (s) => Number(s.year) === Number(year) && String(s.department || "").toUpperCase() === dept
      );
      return match ? Number(match.citations) || 0 : 0;
    }
    // Cumulative: sum all citations for this department up to and including `year`
    return data.deptYearStats
      .filter(
        (s) => Number(s.year) <= Number(year) && String(s.department || "").toUpperCase() === dept
      )
      .reduce((sum, s) => sum + (Number(s.citations) || 0), 0);
  };

  // Build citation data by year from database records
  const citationDataByYear = chartYears.map((year) => {
    const row: any = { year, key: `impact-cite-${year}` };
    DEPARTMENTS.forEach((dept) => {
      row[dept] = getDeptCitationsForYear(dept, year, citationMode);
    });
    return row;
  });

  // Build publication data by year from database records
  const publicationDataByYear = chartYears.map((year) => {
    const row: any = { year, key: `impact-pub-${year}` };
    DEPARTMENTS.forEach((dept) => {
      const match = data.deptYearStats.find(
        (s) => Number(s.year) === Number(year) && String(s.department || "").toUpperCase() === dept
      );
      row[dept] = match ? Number(match.publications) || 0 : 0;
    });
    return row;
  });

  // Top researchers by citations
  const topResearchers = data.topResearchers.slice(0, 6).map((r) => ({
    name: r.name.split(" ").map((n) => n[0]).join(""),
    citations: r.citations,
    fullName: r.name,
  }));

  const hasData = data.totalPublications > 0 || data.deptYearStats.length > 0;
  const safeTotalPubs = Math.max(data.totalPublications, 1);
  const safeYearsCount = Math.max(chartYears.length, 1);

  const handleYearBack = () => {
    const RANGE_SIZE = 5;
    const newEnd = yearRange.start - 1;
    if (newEnd < minRecordedYear) return;
    const newStart = Math.max(newEnd - RANGE_SIZE + 1, minRecordedYear);
    setYearRange({ start: newStart, end: newEnd });
  };

  const handleYearForward = () => {
    const currentYear = new Date().getFullYear();
    const RANGE_SIZE = 5;
    const newStart = yearRange.end + 1;
    if (newStart > currentYear) return;
    const newEnd = Math.min(newStart + RANGE_SIZE - 1, currentYear);
    setYearRange({ start: newStart, end: newEnd });
  };

  const EmptyChartPlaceholder = ({ icon: Icon, label }: { icon: LucideIcon; label: string }) => (
    <div className="h-[280px] flex flex-col items-center justify-center text-center p-6 bg-muted/20 rounded-xl border border-dashed border-border/80">
      <Icon className="w-8 h-8 text-muted-foreground/60 mb-2" />
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
        Data will appear here automatically as faculty records and publications are claimed.
      </p>
    </div>
  );

  const tooltipStyle = {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    border: isDark ? "1px solid #27272a" : "1px solid #e5e7eb",
    borderRadius: "10px",
    color: isDark ? "#f4f4f5" : "#111827",
    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.15)",
    fontSize: "12px",
  };

  const tabs = [
    { id: "citations", label: "Citations Analysis", icon: TrendingUp },
    { id: "publications", label: "Publications Output", icon: FileText },
    { id: "quality", label: "Quality & Productivity", icon: Award },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <PageHeader
        title="Research Impact Analysis"
        description="Comprehensive metrics, citation velocity, and academic department benchmarks"
      />

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Total Citations"
          value={data.totalCitations.toLocaleString()}
          subtitle="Cumulative verified citations"
          icon={TrendingUp}
        />
        <StatCard
          label="Total Publications"
          value={data.totalPublications}
          subtitle="Across all departments"
          icon={FileText}
        />
        {(() => {
          const density = data.totalCitations / safeTotalPubs;
          const rating =
            density >= 15.0
              ? { text: "Outstanding", isPositive: true, desc: "Outstanding (15+ citations/paper)" }
              : density >= 5.0
              ? { text: "High Impact", isPositive: true, desc: "High Impact (5+ citations/paper)" }
              : density >= 1.0
              ? { text: "Moderate", isPositive: true, desc: "Moderate (1-4 citations/paper)" }
              : { text: "Developing", isPositive: false, desc: "Developing citation density" };

          return (
            <StatCard
              label="Citations / Paper"
              value={density.toFixed(1)}
              trend={{ value: rating.text, isPositive: rating.isPositive }}
              subtitle={rating.desc}
              icon={BarChart3}
            />
          );
        })()}
        <StatCard
          label="Active Faculty"
          value={data.totalResearchers}
          subtitle="Publishing researchers"
          icon={Users}
        />
      </div>

      {/* 2.5 Dedicated Unified Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 rounded-xl bg-card border border-border/70 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 pl-1">
            <Calendar className="w-3.5 h-3.5 text-brand" />
            <span>Time Window:</span>
          </span>

          {/* Quick Window Presets */}
          <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => {
                const yrs = getLastNYears(5);
                setYearRange({ start: yrs[0], end: yrs[yrs.length - 1] });
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                yearRange.end - yearRange.start === 4
                  ? "bg-card text-brand font-bold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              5Y
            </button>
            <button
              type="button"
              onClick={() => {
                const yrs = getLastNYears(10);
                setYearRange({ start: yrs[0], end: yrs[yrs.length - 1] });
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                yearRange.end - yearRange.start === 9
                  ? "bg-card text-brand font-bold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              10Y
            </button>
            <button
              type="button"
              onClick={() => {
                const currentYr = new Date().getFullYear();
                setYearRange({ start: minRecordedYear, end: currentYr });
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                yearRange.start === minRecordedYear && yearRange.end - yearRange.start >= 9
                  ? "bg-card text-brand font-bold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({minRecordedYear}–{new Date().getFullYear()})
            </button>
          </div>

          {/* Stepper Pill */}
          <div className="flex items-center gap-1 bg-muted/40 border border-border/70 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handleYearBack}
              disabled={yearRange.start <= minRecordedYear}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              title="Previous 5 years"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs font-bold font-mono text-foreground">
              {yearRange.start}–{yearRange.end}
            </span>
            <button
              type="button"
              onClick={handleYearForward}
              disabled={yearRange.end >= new Date().getFullYear()}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              title="Next 5 years"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isLoading}
          className="text-xs h-8 gap-1.5 font-medium shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Analytics</span>
        </Button>
      </div>

      {/* 3. Navigation Tabs */}
      <PageTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* 4. Tab 1: Citations Analysis */}
      {activeTab === "citations" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Citations Over Time by Department (7 cols) */}
            <Card className="lg:col-span-7 border-border/60 shadow-xs">
              <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">Citations Over Time by Department</CardTitle>
                  <CardDescription className="text-xs">
                    {citationMode === "annual"
                      ? `Citations received in each citing year (${yearRange.start}–${yearRange.end})`
                      : `Cumulative citation growth over time (${yearRange.start}–{yearRange.end})`}
                  </CardDescription>
                </div>
                <div className="flex items-center p-0.5 rounded-lg bg-muted/50 border border-border/70 text-[11px] shrink-0">
                  <button
                    type="button"
                    onClick={() => setCitationMode("annual")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      citationMode === "annual"
                        ? "bg-card text-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Annual Citations
                  </button>
                  <button
                    type="button"
                    onClick={() => setCitationMode("cumulative")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      citationMode === "cumulative"
                        ? "bg-card text-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Cumulative Growth
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {!hasData ? (
                  <EmptyChartPlaceholder icon={AlertCircle} label="No citation data recorded for this window" />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={citationDataByYear} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"} />
                        <XAxis dataKey="year" stroke={isDark ? "#9ca3af" : "#64748b"} style={{ fontSize: "11px" }} />
                        <YAxis stroke={isDark ? "#9ca3af" : "#64748b"} style={{ fontSize: "11px" }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        {DEPARTMENTS.map((dept) => (
                          <Line
                            key={`line-impact-cite-${dept}`}
                            type="monotone"
                            dataKey={dept}
                            stroke={DEPARTMENT_COLORS[dept]}
                            strokeWidth={2}
                            dot={{ fill: DEPARTMENT_COLORS[dept], r: 3 }}
                            name={dept}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="pt-3">
                      <DepartmentLegend />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Top Researchers by Citations (5 cols) */}
            <Card className="lg:col-span-5 border-border/60 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Leading Faculty by Citations</CardTitle>
                <CardDescription className="text-xs">Most cited researchers across campus</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {topResearchers.length === 0 ? (
                  <EmptyChartPlaceholder icon={Users} label="No researcher records found" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topResearchers} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"} />
                      <XAxis dataKey="name" stroke={isDark ? "#9ca3af" : "#64748b"} style={{ fontSize: "11px" }} />
                      <YAxis stroke={isDark ? "#9ca3af" : "#64748b"} style={{ fontSize: "11px" }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div style={tooltipStyle} className="p-3">
                                <p className="font-semibold text-foreground">{payload[0].payload.fullName}</p>
                                <p className="text-xs text-brand font-mono mt-0.5">{payload[0].value} citations</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="citations" fill="#0038A8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 5. Tab 2: Publications Output */}
      {activeTab === "publications" && (
        <div className="space-y-6">
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Publications Per Year by Academic Department</CardTitle>
              <CardDescription className="text-xs">
                Annual volume of research published by faculty ({yearRange.start}–{yearRange.end})
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {!hasData ? (
                <EmptyChartPlaceholder icon={FileText} label="No publication data recorded for this window" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={publicationDataByYear} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"} />
                      <XAxis dataKey="year" stroke={isDark ? "#9ca3af" : "#64748b"} style={{ fontSize: "11px" }} />
                      <YAxis stroke={isDark ? "#9ca3af" : "#64748b"} style={{ fontSize: "11px" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      {DEPARTMENTS.map((dept) => (
                        <Bar
                          key={`bar-impact-pub-${dept}`}
                          dataKey={dept}
                          fill={DEPARTMENT_COLORS[dept]}
                          radius={[3, 3, 0, 0]}
                          name={dept}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="pt-3">
                    <DepartmentLegend />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 6. Tab 3: Quality & Productivity Indicators */}
      {activeTab === "quality" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-info-soft text-info">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Citation Density</h4>
                  <p className="text-2xl font-bold font-mono text-foreground mt-0.5">
                    {(data.totalCitations / safeTotalPubs).toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Average citations accrued per verified publication across the entire repository.
              </p>
              <div className="text-[11px] text-muted-foreground/80 pt-2 border-t border-border/40 font-mono">
                Formula: Total Citations ({data.totalCitations}) ÷ Total Papers ({data.totalPublications})
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-success-soft text-success">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Faculty Rate</h4>
                  <p className="text-2xl font-bold font-mono text-foreground mt-0.5">
                    {data.totalResearchers}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Faculty members actively engaged in scholarly production and verified via institutional email.
              </p>
              <div className="text-[11px] text-muted-foreground/80 pt-2 border-t border-border/40 font-mono">
                Source: PSU Asingan Verified Faculty Roster
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-ai-soft text-ai">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Annual Velocity</h4>
                  <p className="text-2xl font-bold font-mono text-foreground mt-0.5">
                    {(data.totalPublications / safeYearsCount).toFixed(1)} / yr
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mean publication velocity over the active {chartYears.length}-year reporting window.
              </p>
              <div className="text-[11px] text-muted-foreground/80 pt-2 border-t border-border/40 font-mono">
                Window: {yearRange.start} through {yearRange.end}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
