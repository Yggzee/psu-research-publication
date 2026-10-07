import { useState } from "react";
import { Users, FileText, Quote, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { dashboardStats, citationsByDepartment, publicationsByDepartment, mockResearchers } from "../data/mockData";
import { getLastNYears, DEPARTMENT_COLORS, DEPARTMENTS } from "../utils/chartUtils";
import { DepartmentLegend } from "./DepartmentLegend";
import { Button } from "./ui/button";

type TopResearchTab = "overall" | "by-department";

export function Dashboard() {
  const [yearRange, setYearRange] = useState(() => {
    const lastYears = getLastNYears(5);
    return { start: lastYears[0], end: lastYears[lastYears.length - 1] };
  });
  const [topResearchTab, setTopResearchTab] = useState<TopResearchTab>("overall");

  const stats = [
    {
      id: "total-researchers",
      title: "Total Researchers",
      value: dashboardStats.totalResearchers,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      id: "total-publications",
      title: "Total Publications",
      value: dashboardStats.totalPublications,
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      id: "total-citations",
      title: "Total Citations",
      value: dashboardStats.totalCitations.toLocaleString(),
      icon: Quote,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      id: "avg-impact",
      title: "Avg. Impact Score",
      value: dashboardStats.averageImpactScore.toFixed(1),
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  // Filter data by year range and add unique keys
  const filteredCitationData = citationsByDepartment
    .filter((d) => d.year >= yearRange.start && d.year <= yearRange.end)
    .map((d) => ({ ...d, key: `cite-${d.year}` }));

  const filteredPublicationData = publicationsByDepartment
    .filter((d) => d.year >= yearRange.start && d.year <= yearRange.end)
    .map((d) => ({ ...d, key: `pub-${d.year}` }));

  const handleYearBack = () => {
    const MIN_YEAR = 2015;
    const RANGE_SIZE = 5;

    // Calculate new end year (shift back by 5)
    const newEnd = yearRange.start - 1;

    // If we can't go back anymore, do nothing
    if (newEnd < MIN_YEAR) return;

    // Calculate new start year (always maintain 5-year range)
    const newStart = Math.max(newEnd - RANGE_SIZE + 1, MIN_YEAR);

    setYearRange({ start: newStart, end: newEnd });
  };

  const handleYearForward = () => {
    const currentYear = new Date().getFullYear();
    const RANGE_SIZE = 5;

    // Calculate new start year (shift forward by 5)
    const newStart = yearRange.end + 1;

    // If we can't go forward anymore, do nothing
    if (newStart > currentYear) return;

    // Calculate new end year (always maintain 5-year range)
    const newEnd = Math.min(newStart + RANGE_SIZE - 1, currentYear);

    setYearRange({ start: newStart, end: newEnd });
  };

  // Calculate top researchers overall
  const topResearchersOverall = mockResearchers
    .map((r) => ({
      name: r.name,
      citations: r.totalCitations,
      department: r.department,
      id: r.id,
    }))
    .sort((a, b) => b.citations - a.citations)
    .slice(0, 5);

  // Calculate top researchers by department
  const topResearchersByDepartment = DEPARTMENTS.map((dept) => {
    const deptResearchers = mockResearchers
      .filter((r) => r.department === dept)
      .map((r) => ({
        name: r.name,
        citations: r.totalCitations,
        department: r.department,
        id: r.id,
      }))
      .sort((a, b) => b.citations - a.citations)
      .slice(0, 3);

    return {
      department: dept,
      researchers: deptResearchers,
    };
  }).filter((d) => d.researchers.length > 0);

  const maxCitations = topResearchersOverall[0]?.citations || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Research publication analytics and insights</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-3xl text-gray-900">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Year Range Controls */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">
              Showing data for years: <strong>{yearRange.start} - {yearRange.end}</strong>
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleYearBack}
                disabled={yearRange.start <= 2015}
                className="bg-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleYearForward}
                disabled={yearRange.end >= new Date().getFullYear()}
                className="bg-white"
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
        {/* Citation Growth by Department (Multi-line) */}
        <Card>
          <CardHeader>
            <CardTitle>Citation Growth by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredCitationData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid key="grid-cite-growth" strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis key="xaxis-cite-growth" dataKey="year" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis key="yaxis-cite-growth" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip
                  key="tooltip-cite-growth"
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
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
          </CardContent>
        </Card>

        {/* Publications by Department (Clustered Column) */}
        <Card>
          <CardHeader>
            <CardTitle>Publications by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filteredPublicationData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid key="grid-pub-dept" strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis key="xaxis-pub-dept" dataKey="year" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis key="yaxis-pub-dept" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip
                  key="tooltip-pub-dept"
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
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
          </CardContent>
        </Card>
      </div>

      {/* Top Research Section with Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Top Research</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={topResearchTab === "overall" ? "default" : "outline"}
                size="sm"
                onClick={() => setTopResearchTab("overall")}
                className={topResearchTab === "overall" ? "bg-blue-600" : ""}
              >
                Overall
              </Button>
              <Button
                variant={topResearchTab === "by-department" ? "default" : "outline"}
                size="sm"
                onClick={() => setTopResearchTab("by-department")}
                className={topResearchTab === "by-department" ? "bg-blue-600" : ""}
              >
                By Department
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {topResearchTab === "overall" ? (
            <div className="space-y-4">
              {topResearchersOverall.map((researcher, index) => (
                <div key={researcher.id} className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">{researcher.name}</p>
                    <p className="text-xs text-gray-600">{researcher.department}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{researcher.citations} citations</span>
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
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
                        backgroundColor: DEPARTMENT_COLORS[deptData.department],
                        border: deptData.department === "BIT" ? "1px solid #9CA3AF" : "none",
                      }}
                    />
                    <h3 className="text-sm font-semibold text-gray-900">{deptData.department}</h3>
                  </div>
                  <div className="space-y-3">
                    {deptData.researchers.map((researcher, index) => (
                      <div key={researcher.id} className="flex items-center gap-3 pl-6">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{researcher.name}</p>
                        </div>
                        <span className="text-sm text-gray-600">{researcher.citations} citations</span>
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
