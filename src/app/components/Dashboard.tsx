import { useState, useEffect } from "react";
import { Users, FileText, Quote, TrendingUp, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getLastNYears, DEPARTMENT_COLORS, DEPARTMENTS } from "../utils/chartUtils";
import { DepartmentLegend } from "./DepartmentLegend";
import { Button } from "./ui/button";
import { apiService, type DashboardStatsResponse } from "../services/api.service";
import { useTheme } from "../utils/themeContext";

type TopResearchTab = "overall" | "by-department";

export function Dashboard() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [yearRange, setYearRange] = useState(() => {
    const lastYears = getLastNYears(5);
    return { start: lastYears[0], end: lastYears[lastYears.length - 1] };
  });
  const [topResearchTab, setTopResearchTab] = useState<TopResearchTab>("overall");
  const [isLoading, setIsLoading] = useState(false);

  // Real Database Stats (Starts at 0!)
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

  const stats = [
    {
      id: "total-researchers",
      title: "Total Researchers",
      value: dashboardData.totalResearchers,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      id: "total-publications",
      title: "Total Publications",
      value: dashboardData.totalPublications,
      icon: FileText,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      id: "total-citations",
      title: "Total Citations",
      value: dashboardData.totalCitations.toLocaleString(),
      icon: Quote,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/40",
    },
    {
      id: "avg-impact",
      title: "Avg. Impact Score",
      value: dashboardData.averageImpactScore.toFixed(1),
      icon: TrendingUp,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-950/40",
    },
  ];

  // Build department-year chart data from database records
  const chartYears = [];
  for (let y = yearRange.start; y <= yearRange.end; y++) {
    chartYears.push(y);
  }

  const citationDataByYear = chartYears.map((year) => {
    const row: any = { year, key: `cite-${year}` };
    DEPARTMENTS.forEach((dept) => {
      const match = dashboardData.deptYearStats.find((s) => s.year === year && s.department === dept);
      row[dept] = match ? match.citations : 0;
    });
    return row;
  });

  const publicationDataByYear = chartYears.map((year) => {
    const row: any = { year, key: `pub-${year}` };
    DEPARTMENTS.forEach((dept) => {
      const match = dashboardData.deptYearStats.find((s) => s.year === year && s.department === dept);
      row[dept] = match ? match.publications : 0;
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
    const deptList = dashboardData.topResearchers.filter((r) => r.department === dept).slice(0, 3);
    return {
      department: dept,
      researchers: deptList,
    };
  }).filter((d) => d.researchers.length > 0);

  const hasChartData = dashboardData.totalPublications > 0 || dashboardData.deptYearStats.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Real-time research analytics from SQLite database</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading} className="self-start dark:border-gray-700">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => (
          <Card key={stat.id} className="dark:border-gray-800">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium">{stat.title}</p>
                  <p className="text-3xl text-gray-900 dark:text-gray-100 font-bold">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} ${stat.color} p-3 rounded-xl`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Citation Growth by Department */}
        <Card className="dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-900 dark:text-gray-100">Citation Growth by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasChartData ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 bg-gray-50 dark:bg-muted/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                <AlertCircle className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No citation data yet</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                  Citations will automatically be tracked as researchers add or claim publications.
                </p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={citationDataByYear} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.08)" : "#f0f0f0"} />
                    <XAxis dataKey="year" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                    <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? "#18181b" : "#ffffff",
                        border: isDark ? "1px solid #27272a" : "1px solid #e5e7eb",
                        borderRadius: '8px',
                        color: isDark ? "#f4f4f5" : "#111827",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)"
                      }}
                      itemStyle={{
                        color: isDark ? "#e4e4e7" : "#18181b"
                      }}
                    />
                    {DEPARTMENTS.map((dept) => (
                      <Line
                        key={`line-cite-${dept}`}
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

        {/* Publications by Department */}
        <Card className="dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-900 dark:text-gray-100">Publications by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasChartData ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 bg-gray-50 dark:bg-muted/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                <FileText className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No publication data yet</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                  Publications will appear here once faculty members add approved research.
                </p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={publicationDataByYear} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.08)" : "#f0f0f0"} />
                    <XAxis dataKey="year" stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                    <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? "#18181b" : "#ffffff",
                        border: isDark ? "1px solid #27272a" : "1px solid #e5e7eb",
                        borderRadius: '8px',
                        color: isDark ? "#f4f4f5" : "#111827",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)"
                      }}
                      itemStyle={{
                        color: isDark ? "#e4e4e7" : "#18181b"
                      }}
                    />
                    {DEPARTMENTS.map((dept) => (
                      <Bar
                        key={`bar-pub-${dept}`}
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

      {/* Top Research Section with Tabs */}
      <Card className="dark:border-gray-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-gray-900 dark:text-gray-100">Top Research</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={topResearchTab === "overall" ? "default" : "outline"}
                size="sm"
                onClick={() => setTopResearchTab("overall")}
                className={topResearchTab === "overall" ? "bg-blue-600 text-white" : "dark:border-gray-700 text-foreground"}
              >
                Overall
              </Button>
              <Button
                variant={topResearchTab === "by-department" ? "default" : "outline"}
                size="sm"
                onClick={() => setTopResearchTab("by-department")}
                className={topResearchTab === "by-department" ? "bg-blue-600 text-white" : "dark:border-gray-700 text-foreground"}
              >
                By Department
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {topResearchersOverall.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-base font-medium">No researcher metrics recorded yet.</p>
              <p className="text-sm mt-1 text-gray-400 dark:text-gray-500">Add researchers in the Admin Panel to display performance rankings.</p>
            </div>
          ) : topResearchTab === "overall" ? (
            <div className="space-y-4">
              {topResearchersOverall.map((researcher, index) => (
                <div key={researcher.id} className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">{researcher.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{researcher.department}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{researcher.citations} citations</span>
                    <div className="w-24 sm:w-32 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                        style={{ width: `${(researcher.citations / maxCitations) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {topResearchersByDepartment.map((deptData) => (
                <div key={deptData.department}>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{
                        backgroundColor: DEPARTMENT_COLORS[deptData.department as keyof typeof DEPARTMENT_COLORS],
                        border: deptData.department === "BIT" ? "1px solid #9CA3AF" : "none",
                      }}
                    />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{deptData.department}</h3>
                  </div>
                  <div className="space-y-3">
                    {deptData.researchers.map((researcher, index) => (
                      <div key={researcher.id} className="flex items-center gap-3 pl-6">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">{researcher.name}</p>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{researcher.citations} citations</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
