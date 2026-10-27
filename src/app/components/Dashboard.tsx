import { useState, useEffect } from "react";
import {
  Users,
  FileText,
  Quote,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  BarChart3,
  LineChart as LineChartIcon,
} from "lucide-react";
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
import { PageHeader, StatCard, SectionCard, EmptyState } from "./common";

type OutputMetric = "citations" | "publications";
type TopResearchTab = "overall" | "by-department";

export function Dashboard() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [yearRange, setYearRange] = useState(() => {
    const lastYears = getLastNYears(5);
    return { start: lastYears[0], end: lastYears[lastYears.length - 1] };
  });
  const [outputMetric, setOutputMetric] = useState<OutputMetric>("citations");
  const [topResearchTab, setTopResearchTab] = useState<TopResearchTab>("overall");
  const [isLoading, setIsLoading] = useState(false);

  // Real Database Stats
  const [dashboardData, setDashboardData] = useState<DashboardStatsResponse>({
    totalResearchers: 0,
    totalPublications: 0,
    totalCitations: 0,
    averageImpactScore: 0.0,
    topResearchers: [],
    deptYearStats: [],
  });

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getDashboardStats();
      if (data) {
        setDashboardData(data);
      }
    } catch (err) {
      console.warn("Failed to fetch dashboard stats from database:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Build department-year chart data
  const chartYears: number[] = [];
  for (let y = yearRange.start; y <= yearRange.end; y++) {
    chartYears.push(y);
  }

  const chartData = chartYears.map((year) => {
    const row: any = { year, key: `metric-${year}` };
    DEPARTMENTS.forEach((dept) => {
      const match = dashboardData.deptYearStats.find(
        (s) => s.year === year && s.department === dept
      );
      row[dept] = match
        ? outputMetric === "citations"
          ? match.citations
          : match.publications
        : 0;
    });
    return row;
  });

  const handleYearBack = () => {
    const MIN_YEAR = 2015;
    const RANGE_SIZE = 5;
    const newEnd = yearRange.start - 1;
    if (newEnd < MIN_YEAR) return;
    const newStart = Math.max(newEnd - RANGE_SIZE + 1, MIN_YEAR);
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

  const topResearchersOverall = dashboardData.topResearchers.slice(0, 5);
  const maxCitations = topResearchersOverall[0]?.citations || 1;

  const topResearchersByDepartment = DEPARTMENTS.map((dept) => {
    const deptList = dashboardData.topResearchers
      .filter((r) => r.department === dept)
      .slice(0, 3);
    return {
      department: dept,
      researchers: deptList,
    };
  }).filter((d) => d.researchers.length > 0);

  const hasChartData =
    dashboardData.totalPublications > 0 || dashboardData.deptYearStats.length > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Dashboard"
        description="Real-time research analytics and scholarly output across PSU Asingan"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        }
      />

      {/* 2. Neutral KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Total Researchers"
          value={dashboardData.totalResearchers}
          subtitle="Registered faculty roster"
          icon={Users}
        />
        <StatCard
          label="Total Publications"
          value={dashboardData.totalPublications}
          subtitle="Approved scholarly papers"
          icon={FileText}
        />
        <StatCard
          label="Total Citations"
          value={dashboardData.totalCitations.toLocaleString()}
          subtitle="Academic citations accrued"
          icon={Quote}
        />
        <StatCard
          label="Avg. Impact Score"
          value={dashboardData.averageImpactScore.toFixed(1)}
          subtitle="Citation / publication ratio"
          icon={TrendingUp}
        />
      </div>

      {/* 3. Unified Research Output Chart (One Card with Metric Toggle & Year Navigator) */}
      <SectionCard
        title="Research Output Trends"
        description={`Displaying department scholarly ${outputMetric} from ${yearRange.start} to ${yearRange.end}`}
        action={
          <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end w-full sm:w-auto">
            {/* Citations vs Publications Toggle */}
            <div className="flex items-center p-0.5 rounded-lg bg-muted/50 border border-border/70 text-xs">
              <button
                type="button"
                onClick={() => setOutputMetric("citations")}
                className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 ${
                  outputMetric === "citations"
                    ? "bg-card text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LineChartIcon className="w-3.5 h-3.5" />
                <span>Citations</span>
              </button>
              <button
                type="button"
                onClick={() => setOutputMetric("publications")}
                className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 ${
                  outputMetric === "publications"
                    ? "bg-card text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Publications</span>
              </button>
            </div>

            {/* Compact Year Range Navigator */}
            <div className="flex items-center gap-1 border border-border/70 rounded-lg p-0.5 bg-card shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleYearBack}
                disabled={yearRange.start <= 2015}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Previous 5 years"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[11px] sm:text-xs font-mono font-medium px-1 sm:px-1.5 text-foreground">
                {yearRange.start}–{yearRange.end}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleYearForward}
                disabled={yearRange.end >= new Date().getFullYear()}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Next 5 years"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        }
      >
        {!hasChartData ? (
          <EmptyState
            icon={AlertCircle}
            title="No Research Trends Data Yet"
            description="Scholarly metrics and citation growth will automatically populate here as faculty members add approved publications."
          />
        ) : (
          <div className="space-y-4">
            <div className="h-64 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
              {outputMetric === "citations" ? (
                <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "#f0f0f0"} />
                  <XAxis dataKey="year" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: "11px" }} />
                  <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: "11px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#18181b" : "#ffffff",
                      border: isDark ? "1px solid #27272a" : "1px solid #e5e7eb",
                      borderRadius: "8px",
                      color: isDark ? "#f4f4f5" : "#111827",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                      fontSize: "12px",
                    }}
                  />
                  {DEPARTMENTS.map((dept) => (
                    <Line
                      key={`line-${dept}`}
                      type="monotone"
                      dataKey={dept}
                      stroke={DEPARTMENT_COLORS[dept]}
                      strokeWidth={2}
                      dot={{ fill: DEPARTMENT_COLORS[dept], r: 3 }}
                      name={dept}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "#f0f0f0"} />
                  <XAxis dataKey="year" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: "11px" }} />
                  <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: "11px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#18181b" : "#ffffff",
                      border: isDark ? "1px solid #27272a" : "1px solid #e5e7eb",
                      borderRadius: "8px",
                      color: isDark ? "#f4f4f5" : "#111827",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                      fontSize: "12px",
                    }}
                  />
                  {DEPARTMENTS.map((dept) => (
                    <Bar
                      key={`bar-${dept}`}
                      dataKey={dept}
                      fill={DEPARTMENT_COLORS[dept]}
                      radius={[4, 4, 0, 0]}
                      name={dept}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
            </div>
            <DepartmentLegend />
          </div>
        )}
      </SectionCard>

      {/* 4. Top Researchers Leaderboard */}
      <SectionCard
        title="Scholarly Leadership"
        description="Top cited campus researchers and departmental contributions"
        action={
          <div className="flex items-center p-0.5 rounded-lg bg-muted/50 border border-border/70 text-xs">
            <button
              type="button"
              onClick={() => setTopResearchTab("overall")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                topResearchTab === "overall"
                  ? "bg-card text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Overall Top 5
            </button>
            <button
              type="button"
              onClick={() => setTopResearchTab("by-department")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                topResearchTab === "by-department"
                  ? "bg-card text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              By Department
            </button>
          </div>
        }
      >
        {topResearchersOverall.length === 0 ? (
          <EmptyState
            title="No Researcher Metrics Recorded"
            description="Add or claim publications to display citation performance rankings."
          />
        ) : topResearchTab === "overall" ? (
          <div className="space-y-2.5 sm:space-y-3.5">
            {topResearchersOverall.map((researcher, index) => (
              <div
                key={researcher.id}
                className="flex items-center gap-2.5 sm:gap-4 p-2 sm:p-2.5 rounded-xl hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-muted/60 text-foreground text-xs font-bold shrink-0">
                  #{index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                    {researcher.name}
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground">{researcher.department}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className="text-[11px] sm:text-xs font-semibold text-foreground font-mono">
                    {researcher.citations.toLocaleString()} <span className="hidden sm:inline">citations</span>
                  </span>
                  <div className="w-14 sm:w-28 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(6, (researcher.citations / maxCitations) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {topResearchersByDepartment.map((deptData) => (
              <div key={deptData.department} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{
                      backgroundColor:
                        DEPARTMENT_COLORS[deptData.department as keyof typeof DEPARTMENT_COLORS],
                      border: deptData.department === "BIT" ? "1px solid #9CA3AF" : "none",
                    }}
                  />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {deptData.department}
                  </h4>
                </div>

                <div className="space-y-1.5 pl-5">
                  {deptData.researchers.map((researcher, index) => (
                    <div
                      key={researcher.id}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {index + 1}.
                        </span>
                        <span className="font-medium text-foreground">{researcher.name}</span>
                      </div>
                      <span className="font-mono text-muted-foreground">
                        {researcher.citations} citations
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
