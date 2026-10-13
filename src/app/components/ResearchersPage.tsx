import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { Search, ChevronRight, User, FileText, Quote, ArrowUpDown, Shield, RefreshCw, GraduationCap } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { DEPARTMENT_COLORS, type Department } from "../utils/chartUtils";
import { getFacultyPhoto } from "../utils/facultyUtils";
import { apiService } from "../services/api.service";

type SortOption = "name" | "citations" | "publications";
type ViewMode = "all" | "by-department";

export function ResearchersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("citations");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [researchers, setResearchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchResearchers = async () => {
    setLoading(true);
    try {
      const data = await apiService.getResearchers();
      setResearchers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to fetch researchers list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResearchers();
  }, []);

  const refresh = () => {
    fetchResearchers();
  };

  const departments = useMemo(() => {
    const depts = new Set<string>();
    researchers.forEach((r) => {
      if (r.department) depts.add(r.department);
    });
    return Array.from(depts);
  }, [researchers]);

  const filteredAndSortedResearchers = useMemo(() => {
    let result = [...researchers];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.department.toLowerCase().includes(query)
      );
    }

    if (selectedDepartment !== "all") {
      result = result.filter((r) => r.department === selectedDepartment);
    }

    result.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "citations") {
        return (b.totalCitations || 0) - (a.totalCitations || 0);
      } else {
        return (b.totalPublications || 0) - (a.totalPublications || 0);
      }
    });

    return result;
  }, [researchers, searchQuery, selectedDepartment, sortBy]);

  const researchersByDepartment = useMemo(() => {
    const grouped: { [key: string]: typeof researchers } = {};
    filteredAndSortedResearchers.forEach((r) => {
      if (!grouped[r.department]) {
        grouped[r.department] = [];
      }
      grouped[r.department].push(r);
    });
    return grouped;
  }, [filteredAndSortedResearchers]);

  const facultyCount = researchers.filter((r) => r.isFaculty).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">PSU Asingan Researchers</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Registered faculty members in the SQLite institutional repository
          </p>
          {facultyCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Filtered by active faculty members ({facultyCount} active)
              </p>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="self-start dark:border-gray-700">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter Controls */}
      <Card className="dark:border-gray-800">
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
                  className="pl-10 dark:border-gray-700"
                />
              </div>
            </div>

            <div>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="dark:border-gray-700">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="citations">Most Citations</SelectItem>
                  <SelectItem value="publications">Most Publications</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Showing {filteredAndSortedResearchers.length} of {researchers.length} researchers
            </p>

            <div className="flex gap-2">
              <Button
                variant={viewMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("all")}
                className={viewMode === "all" ? "bg-blue-600 text-white" : "dark:border-gray-700 text-foreground"}
              >
                All Researchers
              </Button>
              <Button
                variant={viewMode === "by-department" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("by-department")}
                className={viewMode === "by-department" ? "bg-blue-600 text-white" : "dark:border-gray-700 text-foreground"}
              >
                By Department
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Researchers Grid - All View */}
      {viewMode === "all" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedResearchers.map((researcher) => (
            <Card
              key={researcher.id}
              className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-300 dark:border-gray-800 dark:hover:border-blue-700"
              onClick={() => navigate(`/dashboard/researcher/${researcher.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  {getFacultyPhoto(researcher.name) || (researcher as any).photoUrl ? (
                    <img
                      src={getFacultyPhoto(researcher.name) || (researcher as any).photoUrl}
                      alt={researcher.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-blue-200 dark:border-blue-900 flex-shrink-0"
                    />
                  ) : (
                    <div className="bg-blue-100 dark:bg-blue-950/40 rounded-full p-4 flex-shrink-0">
                      <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                      {researcher.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className="w-3 h-3 rounded"
                        style={{
                          backgroundColor: DEPARTMENT_COLORS[researcher.department as Department] || "#6b7280",
                          border: researcher.department === "BIT" ? "1px solid #9CA3AF" : "none",
                        }}
                      />
                      <p className="text-sm text-gray-600 dark:text-gray-300">{researcher.department}</p>
                      {researcher.scholarUrl && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/50">
                          <GraduationCap className="w-3 h-3" /> Scholar Linked
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-card/70 border border-gray-100 dark:border-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <p className="text-xs text-gray-600 dark:text-gray-400">Publications</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {researcher.totalPublications || 0}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-card/70 border border-gray-100 dark:border-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Quote className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <p className="text-xs text-gray-600 dark:text-gray-400">Citations</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {researcher.totalCitations || 0}
                    </p>
                  </div>
                </div>

                {researcher.publications && researcher.publications.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Most Recent Publication</p>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 line-clamp-2">
                      {researcher.publications[0].title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{dept}</h2>
                <span className="text-sm text-gray-600 dark:text-gray-300">({deptResearchers.length} researchers)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {deptResearchers.map((researcher) => (
                  <Card
                    key={researcher.id}
                    className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-300 dark:border-gray-800 dark:hover:border-blue-700"
                    onClick={() => navigate(`/dashboard/researcher/${researcher.id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4 mb-6">
                        {getFacultyPhoto(researcher.name) || (researcher as any).photoUrl ? (
                          <img
                            src={getFacultyPhoto(researcher.name) || (researcher as any).photoUrl}
                            alt={researcher.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-blue-200 dark:border-blue-900 flex-shrink-0"
                          />
                        ) : (
                          <div className="bg-blue-100 dark:bg-blue-950/40 rounded-full p-4 flex-shrink-0">
                            <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{researcher.name}</h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-gray-600 dark:text-gray-300">{researcher.affiliation || "PSU Asingan"}</p>
                            {researcher.scholarUrl && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/50">
                                <GraduationCap className="w-3 h-3" /> Scholar Linked
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-card/70 border border-gray-100 dark:border-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-600 dark:text-gray-400">Publications</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{researcher.totalPublications || 0}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-card/70 border border-gray-100 dark:border-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-600 dark:text-gray-400">Citations</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{researcher.totalCitations || 0}</p>
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
        <Card className="dark:border-gray-800">
          <CardContent className="py-12 text-center text-gray-500 dark:text-gray-400">
            <User className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-base font-medium">No registered researchers found</p>
            <p className="text-sm mt-1 text-gray-400 dark:text-gray-500">
              The administrator can register researchers via the Admin Panel.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
