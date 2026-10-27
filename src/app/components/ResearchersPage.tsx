import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  ChevronRight,
  User,
  FileText,
  Quote,
  ArrowUpDown,
  Shield,
  RefreshCw,
  GraduationCap,
  Users,
  Building,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { DEPARTMENT_COLORS, type Department } from "../utils/chartUtils";
import { getFacultyPhoto } from "../utils/facultyUtils";
import { apiService } from "../services/api.service";
import { PageHeader, StatusBadge, EmptyState } from "./common";

type SortOption = "citations" | "publications" | "name";
type ViewMode = "grid" | "by-department";

export function ResearchersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("citations");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Faculty Researchers"
        description="Scholarly directory of registered faculty researchers across Pangasinan State University - Asingan"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchResearchers}
            disabled={loading}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        }
      />

      {/* 2. Filter & Sort Toolbar */}
      <Card className="bg-card border-border/70 shadow-2xs">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search faculty by name or department..."
                className="pl-9 h-8 text-xs bg-background"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter and Mode Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Department Dropdown */}
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept} className="text-xs">
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort By Dropdown */}
              <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="citations" className="text-xs">Most Citations</SelectItem>
                  <SelectItem value="publications" className="text-xs">Most Papers</SelectItem>
                  <SelectItem value="name" className="text-xs">Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex items-center p-0.5 rounded-lg bg-muted/50 border border-border/60 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-card text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("by-department")}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    viewMode === "by-department"
                      ? "bg-card text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  By Dept
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Researchers Grid: Standard View */}
      {viewMode === "grid" && (
        <>
          {filteredAndSortedResearchers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Faculty Researchers Found"
              description="No registered researchers matched your query. Adjust your search or clear filters."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredAndSortedResearchers.map((researcher) => {
                const photo = getFacultyPhoto(researcher.name) || (researcher as any).photoUrl;
                const deptColor = DEPARTMENT_COLORS[researcher.department as Department] || "#6b7280";

                return (
                  <Card
                    key={researcher.id}
                    onClick={() => navigate(`/dashboard/researcher/${researcher.id}`)}
                    className="p-4 bg-card border-border/70 shadow-2xs hover:border-brand/40 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Profile Header */}
                      <div className="flex items-start gap-3">
                        {photo ? (
                          <img
                            src={photo}
                            alt={researcher.name}
                            className="w-11 h-11 rounded-xl object-cover border border-border/70 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-muted/60 border border-border/70 flex items-center justify-center font-bold text-sm text-foreground shrink-0">
                            {researcher.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-foreground group-hover:text-brand transition-colors truncate">
                            {researcher.name}
                          </h3>

                          {/* Department Indicator */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: deptColor }}
                            />
                            <span className="text-xs text-muted-foreground truncate">
                              {researcher.department}
                            </span>
                          </div>

                          {researcher.scholarUrl && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-brand font-medium mt-1">
                              <GraduationCap className="w-3 h-3" /> Scholar Linked
                            </span>
                          )}
                        </div>

                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-brand group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </div>
                    </div>

                    {/* Neutral Metrics Footer */}
                    <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-border/60">
                      <div className="p-2 rounded-lg bg-muted/20 border border-border/40 text-center">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Publications
                        </span>
                        <span className="text-base font-bold text-foreground font-mono">
                          {researcher.totalPublications || 0}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-muted/20 border border-border/40 text-center">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Citations
                        </span>
                        <span className="text-base font-bold text-brand font-mono">
                          {researcher.totalCitations || 0}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 4. Researchers Grid: By Department View */}
      {viewMode === "by-department" && (
        <div className="space-y-6">
          {Object.entries(researchersByDepartment).map(([dept, deptResearchers]) => {
            const deptColor = DEPARTMENT_COLORS[dept as Department] || "#6b7280";

            return (
              <div key={dept} className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-border/60">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: deptColor }}
                  />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    {dept}
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-mono ml-1">
                    {deptResearchers.length} faculty
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {deptResearchers.map((researcher) => {
                    const photo = getFacultyPhoto(researcher.name) || (researcher as any).photoUrl;

                    return (
                      <Card
                        key={researcher.id}
                        onClick={() => navigate(`/dashboard/researcher/${researcher.id}`)}
                        className="p-3.5 bg-card border-border/70 hover:border-brand/40 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {photo ? (
                            <img
                              src={photo}
                              alt={researcher.name}
                              className="w-9 h-9 rounded-lg object-cover border border-border/70 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-muted/60 border border-border/70 flex items-center justify-center font-bold text-xs text-foreground shrink-0">
                              {researcher.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-brand">
                              {researcher.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              {researcher.totalPublications || 0} papers • {researcher.totalCitations || 0} citations
                            </p>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-brand shrink-0" />
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
