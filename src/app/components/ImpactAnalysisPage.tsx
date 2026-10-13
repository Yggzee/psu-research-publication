import { useState, useEffect } from "react";
import { TrendingUp, FileText, ChevronLeft, ChevronRight, Users, Calendar, AlertCircle, RefreshCw, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getLastNYears, DEPARTMENT_COLORS, DEPARTMENTS } from "../utils/chartUtils";
import { DepartmentLegend } from "./DepartmentLegend";
import { Button } from "./ui/button";
import { apiService, type DashboardStatsResponse } from "../services/api.service";
import { useTheme } from "../utils/themeContext";

export function ImpactAnalysisPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [yearRange, setYearRange] = useState(() => {
    const lastYears = getLastNYears(5);
    return { start: lastYears[0], end: lastYears[lastYears.length - 1] };
  });
  const [isLoading, setIsLoading] = useState(false);

  // Real Database Stats (starts empty)
  const [data, setData] = useState<DashboardStatsResponse>({
    totalResearchers: 0,
    totalPublications: 0,
    totalCitations: 0,
    averageImpactScore: 0.0,
    topResearchers: [],
    deptYearStats: [],
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const stats = await apiService.getDashboardStats();
      if (stats) {
        setData(stats);
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

  // Build citation data by year from database records
  const citationDataByYear = chartYears.map((year) => {
    const row: any = { year, key: `impact-cite-${year}` };
    DEPARTMENTS.forEach((dept) => {
      const match = data.deptYearStats.find((s) => s.year === year && s.department === dept);
      row[dept] = match ? match.citations : 0;
    });
    return row;
  });

  // Build publication data by year from database records
  const publicationDataByYear = chartYears.map((year) => {
    const row: any = { year, key: `impact-pub-${year}` };
    DEPARTMENTS.forEach((dept) => {
      const match = data.deptYearStats.find((s) => s.year === year && s.department === dept);
      row[dept] = match ? match.publications : 0;
    });
    return row;
  });

  // Top researchers by citations
  const topResearchers = data.topResearchers.slice(0, 5).map(r => ({
    name: r.name.split(' ').map(n => n[0]).join(''),
    citations: r.citations,
    fullName: r.name,
  }));

  const hasData = data.totalPublications > 0 || data.deptYearStats.length > 0;
  const safeTotalPubs = Math.max(data.totalPublications, 1);
  const safeYearsCount = Math.max(chartYears.length, 1);

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

  const EmptyChartPlaceholder = ({ icon: Icon, label }: { icon: LucideIcon; label: string }) => (
    <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 bg-gray-50 dark:bg-muted/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
      <Icon className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
        Data will appear here once researchers add approved publications.
      </p>
    </div>
  );

  const tooltipStyle = {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    border: isDark ? "1px solid #27272a" : "1px solid #e5e7eb",
    borderRadius: "8px",
    color: isDark ? "#f4f4f5" : "#111827",
    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Impact Analysis</h1>
          <p className="text-gray-600 dark:text-gray-300">Comprehensive research impact metrics from database</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading} className="self-start dark:border-gray-700">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="dark:border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-700 dark:text-gray-300 font-semibold">Total Citations</CardTitle>
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{data.totalCitations.toLocaleString()}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">All researchers</p>
          </CardContent>
        </Card>

        <Card className="dark:border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-700 dark:text-gray-300 font-semibold">Total Publications</CardTitle>
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{data.totalPublications}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Across all departments</p>
          </CardContent>
        </Card>
      </div>

      {/* Year Range Controls */}
      <Card className="bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-sm text-gray-700 dark:text-gray-200">
              Showing data for years: <strong className="text-gray-900 dark:text-gray-100">{yearRange.start} - {yearRange.end}</strong>
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleYearBack}
                disabled={yearRange.start <= 2015}
                className="bg-white dark:bg-card dark:border-gray-700 text-foreground"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleYearForward}
                disabled={yearRange.end >= new Date().getFullYear()}
                className="bg-white dark:bg-card dark:border-gray-700 text-foreground"
              >
                Forward
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Citations Over Time by Department */}
        <Card className="dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-900 dark:text-gray-100">Citations Over Time by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <EmptyChartPlaceholder icon={AlertCircle} label="No citation data yet" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={citationDataByYear} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid key="grid-impact-cite-time" strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"} />
                    <XAxis key="xaxis-impact-cite-time" dataKey="year" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                    <YAxis key="yaxis-impact-cite-time" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                    <Tooltip
                      key="tooltip-impact-cite-time"
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: isDark ? "#e4e4e7" : "#18181b" }}
                    />
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
                <DepartmentLegend />
              </>
            )}
          </CardContent>
        </Card>

        {/* Top Researchers */}
        <Card className="dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-900 dark:text-gray-100">Top Researchers by Citations</CardTitle>
          </CardHeader>
          <CardContent>
            {topResearchers.length === 0 ? (
              <EmptyChartPlaceholder icon={Users} label="No researcher data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topResearchers}>
                  <CartesianGrid key="grid-impact-top-res" strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"} />
                  <XAxis key="xaxis-impact-top-res" dataKey="name" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                  <YAxis key="yaxis-impact-top-res" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                  <Tooltip
                    key="tooltip-impact-top-res"
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-card p-3 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg">
                            <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">{payload[0].payload.fullName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{payload[0].value} citations</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar key="bar-impact-top-res" dataKey="citations" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Publications Per Year by Department */}
        <Card className="dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-900 dark:text-gray-100">Publications Per Year by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <EmptyChartPlaceholder icon={FileText} label="No publication data yet" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={publicationDataByYear} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid key="grid-impact-pub-year" strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"} />
                    <XAxis key="xaxis-impact-pub-year" dataKey="year" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                    <YAxis key="yaxis-impact-pub-year" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                    <Tooltip
                      key="tooltip-impact-pub-year"
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: isDark ? "#e4e4e7" : "#18181b" }}
                    />
                    {DEPARTMENTS.map((dept) => (
                      <Bar
                        key={`bar-impact-pub-${dept}`}
                        dataKey={dept}
                        fill={DEPARTMENT_COLORS[dept]}
                        radius={[4, 4, 0, 0]}
                        name={dept}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <DepartmentLegend />
              </>
            )}
          </CardContent>
        </Card>

        {/* Citations by Department */}
        <Card className="dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-900 dark:text-gray-100">Citations by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <EmptyChartPlaceholder icon={AlertCircle} label="No citation data yet" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={citationDataByYear} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid key="grid-impact-cite-dept" strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"} />
                    <XAxis key="xaxis-impact-cite-dept" dataKey="year" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                    <YAxis key="yaxis-impact-cite-dept" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                    <Tooltip
                      key="tooltip-impact-cite-dept"
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: isDark ? "#e4e4e7" : "#18181b" }}
                    />
                    {DEPARTMENTS.map((dept) => (
                      <Bar
                        key={`bar-impact-cite-dept-${dept}`}
                        dataKey={dept}
                        fill={DEPARTMENT_COLORS[dept]}
                        radius={[4, 4, 0, 0]}
                        name={dept}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <DepartmentLegend />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Research Quality Indicators */}
      <Card className="dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-gray-100">Research Quality Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Citations/Publication</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {(data.totalCitations / safeTotalPubs).toFixed(1)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Average citation impact per publication</p>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Active Researchers</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.totalResearchers}</p>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Faculty members with research output</p>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Publications/Year</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {(data.totalPublications / safeYearsCount).toFixed(1)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Average annual publication rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
