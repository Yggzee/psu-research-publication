import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Search, User, FileText, Quote, Shield, AlertCircle, CheckCircle2, Eye, Save, Hand } from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { mockResearchers } from "../data/mockData";
import { isPSUPaper, getFacultyList } from "../utils/facultyUtils";
import { addResearchRecord, getCurrentUser, getResearchRecords } from "../utils/researchStore";

// Mock Google Scholar search results (includes both PSU and non-PSU papers)
interface SearchResult {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  citations: number;
  abstract?: string;
  url?: string;
}

export function SearchEngine() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [facultyCount, setFacultyCount] = useState(0);
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const currentUser = getCurrentUser();
  const isInstructor = currentUser.role === "instructor";

  // Update faculty count when component mounts
  useEffect(() => {
    const updateFacultyCount = () => {
      setFacultyCount(getFacultyList().length);
    };
    updateFacultyCount();
    setClaimedIds(
      getResearchRecords()
        .filter((record) => record.ownerId === currentUser.instructorId && record.source === "claim")
        .map((record) => record.id.replace(/^claim-/, "")),
    );

    // Listen for storage changes (when admin updates faculty list)
    window.addEventListener('storage', updateFacultyCount);
    window.addEventListener('focus', updateFacultyCount);

    return () => {
      window.removeEventListener('storage', updateFacultyCount);
      window.removeEventListener('focus', updateFacultyCount);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    setIsSearching(true);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Simulate API delay
    setTimeout(() => {
      // Mock Google Scholar search - returns both PSU and non-PSU papers
      const mockResults: SearchResult[] = [
        // PSU Papers (have faculty authors)
        {
          id: "gs1",
          title: "Machine Learning Applications in Agricultural Education: A Systematic Review",
          authors: ["Rodelio M. Garin", "Maria Santos", "John Reyes"],
          journal: "International Journal of Educational Technology",
          year: 2023,
          citations: 45,
          abstract: "This paper presents a comprehensive systematic review of machine learning applications in agricultural education...",
          url: "https://scholar.google.com/sample1",
        },
        {
          id: "gs2",
          title: "Sustainable Agriculture Practices in Northern Luzon",
          authors: ["Wenna Lyn L. Honrado", "Roberto Cruz"],
          journal: "Philippine Journal of Agriculture",
          year: 2023,
          citations: 38,
          abstract: "This study explores sustainable agriculture practices...",
          url: "https://scholar.google.com/sample2",
        },
        // Non-PSU Papers (external collaborators)
        {
          id: "gs3",
          title: "Digital Transformation in Southeast Asian Higher Education",
          authors: ["Maria Santos", "Dr. Lee Chang", "Prof. Tanaka Yuki"],
          journal: "Asian Journal of Education",
          year: 2024,
          citations: 62,
          abstract: "A collaborative study on digital transformation across Southeast Asian universities...",
          url: "https://scholar.google.com/sample3",
        },
        {
          id: "gs4",
          title: "Climate Resilience in Philippine Agriculture",
          authors: ["Dr. Elena Rodriguez", "Dr. Chen Wei", "Prof. Kumar Singh"],
          journal: "Environmental Science Journal",
          year: 2023,
          citations: 71,
          abstract: "International collaboration on climate resilience strategies...",
          url: "https://scholar.google.com/sample4",
        },
        {
          id: "gs5",
          title: "AI-Driven Educational Assessment Systems",
          authors: ["Dr. Sarah Johnson", "Rodelio M. Garin", "Prof. Michael Brown"],
          journal: "Educational Technology & Society",
          year: 2024,
          citations: 28,
          abstract: "Collaborative research on AI-driven assessment systems with PSU faculty contribution...",
          url: "https://scholar.google.com/sample5",
        },
      ];

      // Filter by search query
      const filtered = mockResults.filter((result) =>
        result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.authors.some(a => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
        result.journal.toLowerCase().includes(searchQuery.toLowerCase())
      );

      setSearchResults(filtered);
      setIsSearching(false);
    }, 1000);
  };

  const handleSavePublication = (result: SearchResult) => {
    if (isPSUPaper(result.authors)) {
      addResearchRecord({
        ...result,
        id: `admin-${result.id}`,
        ownerId: "admin",
        ownerName: result.authors[0] || "PSU Researcher",
        source: "admin",
        approvalStatus: "approved",
        researchStatus: "Published",
        isPublic: true,
        createdAt: new Date().toISOString(),
      });
      alert(`✓ Publication saved!\n\n"${result.title}"\n\nThis PSU paper has been added to the system.`);
    } else {
      alert(`✗ Cannot save this publication.\n\nThis is a Non-PSU paper (no faculty authors). You can view it but cannot save it to the system.`);
    }
  };

  const handleClaimPublication = (result: SearchResult) => {
    addResearchRecord({
      ...result,
      id: `claim-${result.id}`,
      ownerId: currentUser.instructorId || "",
      ownerName: currentUser.name,
      source: "claim",
      approvalStatus: "pending",
      researchStatus: "Published",
      isPublic: true,
      createdAt: new Date().toISOString(),
    });
    setClaimedIds((ids) => [...ids, result.id]);
  };

  const getPaperType = (authors: string[]) => {
    return isPSUPaper(authors) ? "PSU" : "Non-PSU";
  };

  const getPaperTypeColor = (authors: string[]) => {
    return isPSUPaper(authors)
      ? "bg-green-100 text-green-700 border-green-300"
      : "bg-orange-100 text-orange-700 border-orange-300";
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl text-gray-900 mb-2">Google Scholar Search Engine</h1>
        <p className="text-gray-600">
          Search for research publications from Google Scholar worldwide
        </p>
        {facultyCount > 0 && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <Shield className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-blue-600">
              {facultyCount} PSU faculty members registered • Papers with faculty authors marked as "PSU"
            </p>
          </div>
        )}
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1 text-sm text-blue-900">
              <p className="font-medium mb-1">How Search Works</p>
              <ul className="space-y-1 text-blue-800">
                <li>• Search <strong>all publications</strong> available on Google Scholar</li>
                <li>• <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs border border-green-300">PSU</span> papers have at least one PSU faculty author</li>
                <li>• <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs border border-orange-300">Non-PSU</span> papers have no PSU faculty authors</li>
                <li>
                  • You can <strong>view any paper</strong>
                  {isInstructor
                    ? " and submit a claim for admin approval"
                    : ", but only save PSU papers to the system"}
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <form onSubmit={handleSearch}>
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search any research (e.g., machine learning, climate change, education technology)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 text-lg"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 px-8"
                disabled={isSearching}
              >
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Search Results */}
      {hasSearched && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl text-gray-900">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
            </h2>
            {searchResults.length > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded border border-green-300 text-xs font-medium">
                    PSU
                  </span>
                  <span className="text-gray-600">
                    {searchResults.filter(r => isPSUPaper(r.authors)).length} papers
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded border border-orange-300 text-xs font-medium">
                    Non-PSU
                  </span>
                  <span className="text-gray-600">
                    {searchResults.filter(r => !isPSUPaper(r.authors)).length} papers
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Results List */}
          {searchResults.map((result) => {
            const isPSU = isPSUPaper(result.authors);
            return (
              <Card
                key={result.id}
                className={`hover:shadow-md transition-shadow ${
                  isPSU ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-orange-500'
                }`}
              >
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {/* Title and Badge */}
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h3 className="text-lg text-gray-900 font-medium mb-2">
                          {result.title}
                        </h3>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded border text-sm font-medium ${getPaperTypeColor(result.authors)}`}>
                        {isPSU ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {getPaperType(result.authors)}
                      </span>
                    </div>

                    {/* Authors */}
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-gray-500 mt-0.5" />
                      <p className="text-sm text-gray-700">
                        {result.authors.map((author, idx) => (
                          <span key={idx}>
                            <span className={isPSUPaper([author]) ? "font-semibold text-blue-600" : ""}>
                              {author}
                            </span>
                            {idx < result.authors.length - 1 && ", "}
                          </span>
                        ))}
                      </p>
                    </div>

                    {/* Journal & Year */}
                    <p className="text-sm text-gray-600">
                      {result.journal} • {result.year}
                    </p>

                    {/* Abstract */}
                    {result.abstract && (
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {result.abstract}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm pt-2">
                      <div className="flex items-center gap-1">
                        <Quote className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-700">{result.citations} citations</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(result.url, '_blank')}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Paper
                      </Button>
                      {isInstructor ? (
                        <Button
                          size="sm"
                          onClick={() => handleClaimPublication(result)}
                          disabled={claimedIds.includes(result.id)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Hand className="w-4 h-4 mr-2" />
                          {claimedIds.includes(result.id) ? "Claim Pending" : "Claim Research"}
                        </Button>
                      ) : (
                        <Button
                          variant={isPSU ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleSavePublication(result)}
                          className={isPSU ? "bg-green-600 hover:bg-green-700" : ""}
                          disabled={!isPSU}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {isPSU ? "Save to System" : "Cannot Save (Non-PSU)"}
                        </Button>
                      )}
                    </div>

                    {/* Non-PSU Info */}
                    {!isPSU && !isInstructor && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-2">
                        <p className="text-xs text-orange-800">
                          <strong>Why can't I save this?</strong> This publication has no PSU faculty authors.
                          You can view it for reference, but it won't be added to the PSU research database.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* No Results */}
          {searchResults.length === 0 && !isSearching && (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No publications found</p>
                <p className="text-sm text-gray-500 mt-1">Try different keywords or author names</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Initial State */}
      {!hasSearched && (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="py-12 text-center">
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg text-gray-900 mb-2">Search Google Scholar</h3>
            <p className="text-gray-600">
              Enter keywords, author names, or research topics to find publications
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
