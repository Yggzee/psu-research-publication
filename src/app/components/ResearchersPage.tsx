import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { User, FileText, Quote, ChevronRight, Search, Shield, RefreshCw } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { DEPARTMENTS, DEPARTMENT_COLORS, type Department } from "../utils/chartUtils";
import { filterFacultyResearchers, getFacultyPhoto } from "../utils/facultyUtils";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { useResearchers } from "../hooks/useResearchers";

type SortOption = "citations" | "publications";
type ViewMode = "all" | "by-department";

export function ResearchersPage() {
  const navigate = useNavigate();
  const { researchers: dbResearchers, loading, refresh } = useResearchers();

  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("citations");
  const [viewMode, setViewMode] = useState<ViewMode>("all");

  const facultyCount = dbResearchers.filter((r) => (r as any).isFaculty !== false).length;

  // Filter and sort researchers
  const filteredAndSortedResearchers = useMemo(() => {
    let filtered = filterFacultyResearchers(dbResearchers);

    if (selectedDepartment !== "all") {
      filtered = filtered.filter((r) => r.department === selectedDepartment);
    }

    if (searchQuery) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "citations") {
        return (b.totalCitations || 0) - (a.totalCitations || 0);
      } else {
        return (b.totalPublications || 0) - (a.totalPublications || 0);
      }
    });

    return sorted;
  }, [dbResearchers, selectedDepartment, searchQuery, sortBy]);

  const researchersByDepartment = useMemo(() => {
    const grouped: Record<string, typeof dbResearchers> = {};
    DEPARTMENTS.forEach((dept) => {
      const deptResearchers = filteredAndSortedResearchers.filter(
        (r) => r.department === dept
      );
      if (deptResearchers.length > 0) {
        grouped[dept] = deptResearchers;
      }
    });
    return grouped;
  }, [filteredAndSortedResearchers]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl text-gray-900 mb-1">PSU Asingan Researchers</h1>
          <p className="text-gray-600">
            Registered faculty members in the SQLite institutional repository
          </p>
          {facultyCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-blue-600">
                Filtered by active faculty members ({facultyCount} active)
              </p>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="self-start">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by researcher name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="citations">Top Citation Count</SelectItem>
                  <SelectItem value="publications">Most Published Research</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              variant={viewMode === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("all")}
              className={viewMode === "all" ? "bg-blue-600" : ""}
            >
              All Researchers
            </Button>
            <Button
              variant={viewMode === "by-department" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("by-department")}
              className={viewMode === "by-department" ? "bg-blue-600" : ""}
            >
              Per Department
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-gray-600">
        Showing {filteredAndSortedResearchers.length} researcher(s)
      </div>

      {/* Researchers Grid - All View */}
      {viewMode === "all" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAndSortedResearchers.map((researcher) => (
            <Card
              key={researcher.id}
              className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-300"
              onClick={() => navigate(`/dashboard/researcher/${researcher.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  {getFacultyPhoto(researcher.name) || (researcher as any).photoUrl ? (
                    <img
                      src={getFacultyPhoto(researcher.name) || (researcher as any).photoUrl}
                      alt={researcher.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-blue-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="bg-blue-100 rounded-full p-4 flex-shrink-0">
                      <User className="w-8 h-8 text-blue-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl text-gray-900 mb-1">
                      {researcher.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{
                          backgroundColor: DEPARTMENT_COLORS[researcher.department as Department] || "#6b7280",
                          border: researcher.department === "BIT" ? "1px solid #9CA3AF" : "none",
                        }}
                      />
                      <p className="text-sm text-gray-600">{researcher.department}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <p className="text-xs text-gray-600">Publications</p>
                    </div>
                    <p className="text-2xl text-gray-900">
                      {researcher.totalPublications || 0}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Quote className="w-4 h-4 text-gray-500" />
                      <p className="text-xs text-gray-600">Citations</p>
                    </div>
                    <p className="text-2xl text-gray-900">
                      {researcher.totalCitations || 0}
                    </p>
                  </div>
                </div>

                {researcher.publications && researcher.publications.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">Most Recent Publication</p>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {researcher.publications[0].title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {researcher.publications[0].year} • {researcher.publications[0].citations} citations
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Researchers Grid - By Department View */}
      {viewMode === "by-department" && (
        <div className="space-y-8">
          {Object.entries(researchersByDepartment).map(([dept, deptResearchers]) => (
            <div key={dept}>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-6 h-6 rounded"
                  style={{
                    backgroundColor: DEPARTMENT_COLORS[dept as Department] || "#6b7280",
                    border: dept === "BIT" ? "1px solid #9CA3AF" : "none",
                  }}
                />
                <h2 className="text-2xl text-gray-900">{dept}</h2>
                <span className="text-sm text-gray-600">({deptResearchers.length} researchers)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {deptResearchers.map((researcher) => (
                  <Card
                    key={researcher.id}
                    className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-300"
                    onClick={() => navigate(`/dashboard/researcher/${researcher.id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4 mb-6">
                        {getFacultyPhoto(researcher.name) || (researcher as any).photoUrl ? (
                          <img
                            src={getFacultyPhoto(researcher.name) || (researcher as any).photoUrl}
                            alt={researcher.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-blue-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="bg-blue-100 rounded-full p-4 flex-shrink-0">
                            <User className="w-8 h-8 text-blue-600" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-xl text-gray-900 mb-1">{researcher.name}</h3>
                          <p className="text-sm text-gray-600">{researcher.affiliation || "PSU Asingan"}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-600">Publications</p>
                          <p className="text-2xl text-gray-900">{researcher.totalPublications || 0}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-600">Citations</p>
                          <p className="text-2xl text-gray-900">{researcher.totalCitations || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredAndSortedResearchers.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <User className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-base font-medium">No registered researchers found</p>
            <p className="text-sm mt-1 text-gray-400">
              The administrator can register researchers via the Admin Panel.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
