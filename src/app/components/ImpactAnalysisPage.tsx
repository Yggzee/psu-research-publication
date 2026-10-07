import { useState } from "react";
import { TrendingUp, FileText, ChevronLeft, ChevronRight, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { researchers, publications, citationsByDepartment, publicationsByDepartment } from "../data/mockData";
import { getLastNYears, DEPARTMENT_COLORS, DEPARTMENTS } from "../utils/chartUtils";
import { DepartmentLegend } from "./DepartmentLegend";
import { Button } from "./ui/button";

export function ImpactAnalysisPage() {
  const [yearRange, setYearRange] = useState(() => {
    const lastYears = getLastNYears(5);
    return { start: lastYears[0], end: lastYears[lastYears.length - 1] };
  });

  // Calculate total metrics
  const totalCitations = researchers.reduce((sum, r) => sum + r.citations, 0);
  const totalPublications = publications.reduce((sum, p) => sum + p.publications.length, 0);

  // Filter data by year range and add unique keys
  const filteredCitationData = citationsByDepartment
    .filter((d) => d.year >= yearRange.start && d.year <= yearRange.end)
    .map((d) => ({ ...d, key: `impact-cite-${d.year}` }));

  const filteredPublicationData = publicationsByDepartment
    .filter((d) => d.year >= yearRange.start && d.year <= yearRange.end)
    .map((d) => ({ ...d, key: `impact-pub-${d.year}` }));

  // Top researchers by citations
  const topResearchers = [...researchers]
    .sort((a, b) => b.citations - a.citations)
    .slice(0, 5)
    .map(r => ({
      name: r.name.split(' ').map(n => n[0]).join(''),
      citations: r.citations,
      fullName: r.name,
    }));

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl text-gray-900 mb-2">Impact Analysis</h1>
        <p className="text-gray-600">Comprehensive research impact metrics and analytics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Citations</CardTitle>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{totalCitations.toLocaleString()}</div>
            <p className="text-xs text-gray-600 mt-1">All researchers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Publications</CardTitle>
            <FileText className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{totalPublications}</div>
            <p className="text-xs text-gray-600 mt-1">Across all departments</p>
          </CardContent>
        </Card>
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

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Citations Over Time by Department (Multi-line) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Citations Over Time by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredCitationData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid key="grid-impact-cite-time" strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis key="xaxis-impact-cite-time" dataKey="year" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis key="yaxis-impact-cite-time" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip
                  key="tooltip-impact-cite-time"
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
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
          </CardContent>
        </Card>

        {/* Top Researchers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Researchers by Citations</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topResearchers}>
                <CartesianGrid key="grid-impact-top-res" strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis key="xaxis-impact-top-res" dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis key="yaxis-impact-top-res" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip
                  key="tooltip-impact-top-res"
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                          <p className="text-sm text-gray-900 font-medium">{payload[0].payload.fullName}</p>
                          <p className="text-sm text-gray-600">{payload[0].value} citations</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar key="bar-impact-top-res" dataKey="citations" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Publications Per Year by Department (Clustered Column) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publications Per Year by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filteredPublicationData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid key="grid-impact-pub-year" strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis key="xaxis-impact-pub-year" dataKey="year" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis key="yaxis-impact-pub-year" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip
                  key="tooltip-impact-pub-year"
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
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
          </CardContent>
        </Card>

        {/* Citations by Department (Clustered Column) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Citations by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filteredCitationData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid key="grid-impact-cite-dept" strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis key="xaxis-impact-cite-dept" dataKey="year" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis key="yaxis-impact-cite-dept" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip
                  key="tooltip-impact-cite-dept"
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
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
          </CardContent>
        </Card>
      </div>

      {/* Research Quality Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Research Quality Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Citations/Publication</p>
                  <p className="text-xl text-gray-900">
                    {(totalCitations / totalPublications).toFixed(1)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-600">Average citation impact per publication</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Researchers</p>
                  <p className="text-xl text-gray-900">{researchers.length}</p>
                </div>
              </div>
              <p className="text-xs text-gray-600">Faculty members with research output</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Publications/Year</p>
                  <p className="text-xl text-gray-900">
                    {(totalPublications / filteredPublicationData.length).toFixed(1)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-600">Average annual publication rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
