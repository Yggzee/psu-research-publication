import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { User, FileText, Quote, ChevronRight, Search, Shield } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { mockResearchers } from "../data/mockData";
import { DEPARTMENTS, DEPARTMENT_COLORS, type Department } from "../utils/chartUtils";
import { filterFacultyResearchers, getFacultyList, getFacultyPhoto } from "../utils/facultyUtils";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";

type SortOption = "citations" | "publications";
type ViewMode = "all" | "by-department";

export function ResearchersPage() {
  const navigate = useNavigate();
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("citations");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [facultyCount, setFacultyCount] = useState(0);

  // Update faculty count when component mounts or when returning from admin page
  useEffect(() => {
    const updateFacultyCount = () => {
      setFacultyCount(getFacultyList().length);
    };
    updateFacultyCount();

    // Listen for storage changes (when admin updates faculty list)
    window.addEventListener('storage', updateFacultyCount);
    window.addEventListener('focus', updateFacultyCount);

    return () => {
      window.removeEventListener('storage', updateFacultyCount);
      window.removeEventListener('focus', updateFacultyCount);
    };
  }, []);

  // Filter and sort researchers
  const filteredAndSortedResearchers = useMemo(() => {
    // Apply faculty filter first
    let filtered = filterFacultyResearchers(mockResearchers);

    // Filter by department
    if (selectedDepartment !== "all") {
      filtered = filtered.filter((r) => r.department === selectedDepartment);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "citations") {
        return b.totalCitations - a.totalCitations;
      } else {
        return b.totalPublications - a.totalPublications;
      }
    });

    return sorted;
  }, [selectedDepartment, searchQuery, sortBy]);

  // Group by department for "by-department" view
  const researchersByDepartment = useMemo(() => {
    const grouped: Record<string, typeof mockResearchers> = {};

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
      <div className="mb-8">
        <h1 className="text-3xl text-gray-900 mb-2">PSU Asingan Researchers</h1>
        <p className="text-gray-600">
          Browse faculty members and their research contributions
        </p>
        {facultyCount > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-blue-600">
              Filtered by faculty members ({facultyCount} active)
            </p>
          </div>
        )}
      </div>

      {/* Filter Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Bar */}
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

            {/* Department Filter */}
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

            {/* Sort By */}
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

          {/* View Mode Toggle */}
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

      {/* Results Count */}
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
                {/* Researcher Header */}
                <div className="flex items-start gap-4 mb-6">
                  {getFacultyPhoto(researcher.name) ? (
                    <img
                      src={getFacultyPhoto(researcher.name)}
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
                          backgroundColor: DEPARTMENT_COLORS[researcher.department as Department],
                          border: researcher.department === "BIT" ? "1px solid #9CA3AF" : "none",
                        }}
                      />
                      <p className="text-sm text-gray-600">{researcher.department}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <p className="text-xs text-gray-600">Publications</p>
                    </div>
                    <p className="text-2xl text-gray-900">
                      {researcher.totalPublications}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Quote className="w-4 h-4 text-gray-500" />
                      <p className="text-xs text-gray-600">Citations</p>
                    </div>
                    <p className="text-2xl text-gray-900">
                      {researcher.totalCitations}
                    </p>
                  </div>
                </div>

                {/* Recent Publication Preview */}
                {researcher.publications.length > 0 && (
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
          {Object.entries(researchersByDepartment).map(([dept, researchers]) => (
            <div key={dept}>
              {/* Department Header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-6 h-6 rounded"
                  style={{
                    backgroundColor: DEPARTMENT_COLORS[dept as Department],
                    border: dept === "BIT" ? "1px solid #9CA3AF" : "none",
                  }}
                />
                <h2 className="text-2xl text-gray-900">{dept}</h2>
                <span className="text-sm text-gray-600">({researchers.length} researchers)</span>
              </div>

              {/* Department Researchers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {researchers.map((researcher) => (
                  <Card
                    key={researcher.id}
                    className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-300"
                    onClick={() => navigate(`/dashboard/researcher/${researcher.id}`)}
                  >
                    <CardContent className="p-6">
                      {/* Researcher Header */}
                      <div className="flex items-start gap-4 mb-6">
                        {getFacultyPhoto(researcher.name) ? (
                          <img
                            src={getFacultyPhoto(researcher.name)}
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
                          <p className="text-sm text-gray-600">{researcher.affiliation}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <p className="text-xs text-gray-600">Publications</p>
                          </div>
                          <p className="text-2xl text-gray-900">
                            {researcher.totalPublications}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Quote className="w-4 h-4 text-gray-500" />
                            <p className="text-xs text-gray-600">Citations</p>
                          </div>
                          <p className="text-2xl text-gray-900">
                            {researcher.totalCitations}
                          </p>
                        </div>
                      </div>

                      {/* Recent Publication Preview */}
                      {researcher.publications.length > 0 && (
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
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {filteredAndSortedResearchers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">No researchers found matching your filters.</p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-100 mt-8">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 rounded-full p-2">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm text-blue-900 mb-1">About This Directory</h3>
              <p className="text-sm text-blue-800">
                This directory showcases faculty members at Pangasinan State University - Asingan Campus.
                Click on any researcher card to view their complete publication list, citation metrics,
                and detailed impact analysis.
              </p>
              <p className="text-xs text-blue-700 mt-3">
                Note: Data is synchronized with Google Scholar to provide up-to-date research metrics.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
