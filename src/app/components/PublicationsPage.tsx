import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { FileText, TrendingUp, Calendar, User, Search, Shield, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { filterFacultyPublications, getFacultyList } from "../utils/facultyUtils";
import { apiService } from "../services/api.service";
import type { Publication } from "../data/mockData";

type SortOption = "impact-high" | "impact-low" | "citations-high" | "citations-low" | "year-new" | "year-old";

export function PublicationsPage() {
  const navigate = useNavigate();
  const [publicationsList, setPublicationsList] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("year-new");
  const [facultyCount, setFacultyCount] = useState(0);

  const loadPublications = async () => {
    setLoading(true);
    try {
      const data = await apiService.getPublications();
      setPublicationsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to load publications from database:", err);
      setPublicationsList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublications();
    setFacultyCount(getFacultyList().length);
    window.addEventListener("research-records-updated", loadPublications);
    return () => window.removeEventListener("research-records-updated", loadPublications);
  }, []);

  const allPublications = useMemo(() => {
    return filterFacultyPublications(publicationsList);
  }, [publicationsList]);

  // Compute years based on actual database publications
  const years = useMemo(() => {
    if (allPublications.length === 0) return [];
    const pubYears = allPublications.map((p) => p.year);
    const earliest = Math.min(...pubYears);
    const latest = Math.max(...pubYears, new Date().getFullYear());
    const result = [];
    for (let y = latest; y >= earliest; y--) {
      result.push(y);
    }
    return result;
  }, [allPublications]);

  const filteredAndSortedPublications = useMemo(() => {
    let filtered = allPublications.filter((pub) => {
      const authorText = Array.isArray(pub.authors) ? pub.authors.join(", ") : pub.authors || "";
      const matchesSearch =
        pub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pub.journal.toLowerCase().includes(searchQuery.toLowerCase()) ||
        authorText.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesYear = selectedYear === "all" || pub.year.toString() === selectedYear;
      return matchesSearch && matchesYear;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "impact-high":
          return ((b as any).impact_score || b.impactScore || 0) - ((a as any).impact_score || a.impactScore || 0);
        case "impact-low":
          return ((a as any).impact_score || a.impactScore || 0) - ((b as any).impact_score || b.impactScore || 0);
        case "citations-high":
          return b.citations - a.citations;
        case "citations-low":
          return a.citations - b.citations;
        case "year-new":
          return b.year - a.year;
        case "year-old":
          return a.year - b.year;
        default:
          return 0;
      }
    });

    return sorted;
  }, [allPublications, searchQuery, selectedYear, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl text-gray-900 mb-1">Publications</h1>
          <p className="text-gray-600">Explore research publications registered in the SQLite repository</p>
          {facultyCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-blue-600">
                Filtered by PSU faculty publications ({facultyCount} faculty members)
              </p>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={loadPublications} disabled={loading} className="self-start">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Publications</CardTitle>
            <FileText className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 font-semibold">{allPublications.length}</div>
            <p className="text-xs text-gray-600 mt-1">Across all faculty</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Citations</CardTitle>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 font-semibold">
              {allPublications.reduce((sum, p) => sum + p.citations, 0)}
            </div>
            <p className="text-xs text-gray-600 mt-1">Combined impact</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Active Years</CardTitle>
            <Calendar className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 font-semibold">{years.length}</div>
            <p className="text-xs text-gray-600 mt-1">
              {years.length > 0 ? `${Math.min(...years)} - ${Math.max(...years)}` : "No years active yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Sort Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search publications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year.toString()}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year-new">By Year (Newest First)</SelectItem>
                  <SelectItem value="year-old">By Year (Oldest First)</SelectItem>
                  <SelectItem value="citations-high">Most Citations</SelectItem>
                  <SelectItem value="citations-low">Least Citations</SelectItem>
                  <SelectItem value="impact-high">Most Impactful</SelectItem>
                  <SelectItem value="impact-low">Least Impactful</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Publications List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {filteredAndSortedPublications.length} publication{filteredAndSortedPublications.length !== 1 ? "s" : ""}
          </p>
        </div>

        {filteredAndSortedPublications.map((pub) => (
          <Card
            key={pub.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/dashboard/publication/${pub.id}`)}
          >
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <h3 className="text-gray-900 font-medium mb-2 hover:text-blue-600">
                    {pub.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <User className="w-4 h-4" />
                    <span>{Array.isArray(pub.authors) ? pub.authors.join(", ") : pub.authors}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {pub.journal} • {pub.year}
                  </p>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="text-gray-700">{pub.citations} citations</span>
                    </div>
                    {((pub as any).impact_score || pub.impactScore) && (
                      <div className="bg-green-100 text-green-700 px-3 py-0.5 rounded-full text-xs font-medium">
                        Impact: {(pub as any).impact_score || pub.impactScore}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredAndSortedPublications.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-base font-medium">No publications found</p>
              <p className="text-sm text-gray-400 mt-1">
                Publications added by faculty or saved from Google Scholar will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
