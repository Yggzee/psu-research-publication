import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { FileText, TrendingUp, Calendar, User, Search, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { publications } from "../data/mockData";
import { filterFacultyPublications, getFacultyList } from "../utils/facultyUtils";

type SortOption = "impact-high" | "impact-low" | "citations-high" | "citations-low" | "year-new" | "year-old";

export function PublicationsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("impact-high");
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

  // Get all publications from all researchers
  const allPublications = useMemo(() => {
    const pubs = publications.flatMap(pub =>
      pub.publications.map(p => ({
        ...p,
        authorName: pub.authorName,
        authorId: pub.authorId,
      }))
    );

    // Apply faculty filter
    return filterFacultyPublications(pubs);
  }, []);

  // Keep the filter current even when a year has no publications yet.
  const earliestYear = Math.min(...allPublications.map((publication) => publication.year));
  const latestYear = Math.max(new Date().getFullYear(), 2026);
  const years = Array.from(
    { length: latestYear - earliestYear + 1 },
    (_, index) => latestYear - index,
  );

  // Filter and sort publications
  const filteredAndSortedPublications = useMemo(() => {
    // Filter
    let filtered = allPublications.filter(pub => {
      const matchesSearch = pub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            pub.journal.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            pub.authorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesYear = selectedYear === "all" || pub.year.toString() === selectedYear;
      return matchesSearch && matchesYear;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "impact-high":
          return (b.impactFactor || 0) - (a.impactFactor || 0);
        case "impact-low":
          return (a.impactFactor || 0) - (b.impactFactor || 0);
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
      <div>
        <h1 className="text-2xl text-gray-900 mb-2">Publications</h1>
        <p className="text-gray-600">Browse and explore research publications from PSU Asingan faculty</p>
        {facultyCount > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-blue-600">
              Showing publications with faculty authors only ({facultyCount} faculty members)
            </p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Publications</CardTitle>
            <FileText className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{allPublications.length}</div>
            <p className="text-xs text-gray-600 mt-1">Across all researchers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Citations</CardTitle>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">
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
            <div className="text-2xl text-gray-900">{years.length}</div>
            <p className="text-xs text-gray-600 mt-1">
              {Math.min(...years)} - {Math.max(...years)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Sort Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search publications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Year Filter */}
            <div>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Years</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="impact-high">Most Impactful</SelectItem>
                  <SelectItem value="impact-low">Least Impactful</SelectItem>
                  <SelectItem value="citations-high">Most Citations</SelectItem>
                  <SelectItem value="citations-low">Least Citations</SelectItem>
                  <SelectItem value="year-new">By Year (Newest First)</SelectItem>
                  <SelectItem value="year-old">By Year (Oldest First)</SelectItem>
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
            Showing {filteredAndSortedPublications.length} publication{filteredAndSortedPublications.length !== 1 ? 's' : ''}
          </p>
        </div>

        {filteredAndSortedPublications.map((pub) => (
          <Card
            key={pub.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
          >
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <h3
                    className="text-gray-900 mb-2 hover:text-blue-600 cursor-pointer"
                    onClick={() => navigate(`/dashboard/publication/${pub.id}`)}
                  >
                    {pub.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <User className="w-4 h-4" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dashboard/researcher/${pub.authorId}`);
                      }}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {pub.authorName}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {pub.journal} • {pub.year}
                  </p>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="text-gray-700">{pub.citations} citations</span>
                    </div>
                    {pub.impactFactor && (
                      <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                        Impact: {pub.impactFactor}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredAndSortedPublications.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No publications found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search criteria</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
