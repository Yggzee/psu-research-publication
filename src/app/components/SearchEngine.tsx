import { useState, useEffect, type FormEvent } from "react";
import { Search, User, FileText, Quote, Shield, AlertCircle, CheckCircle2, Eye, Save, Hand, Database, Sparkles } from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { isPSUPaper, getFacultyList } from "../utils/facultyUtils";
import { getCurrentUser, getResearchRecords, addResearchRecord } from "../utils/researchStore";
import { apiService, type ScholarSearchResult } from "../services/api.service";

export function SearchEngine() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ScholarSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [facultyCount, setFacultyCount] = useState(0);
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [requiresApify, setRequiresApify] = useState(false);

  const currentUser = getCurrentUser();
  const isInstructor = currentUser.role === "instructor";

  useEffect(() => {
    const updateFacultyCount = () => {
      setFacultyCount(getFacultyList().length);
    };
    updateFacultyCount();

    setClaimedIds(
      getResearchRecords()
        .filter((record) => record.ownerId === currentUser.instructorId && record.source === "claim")
        .map((record) => record.id.replace(/^claim-/, ""))
    );

    window.addEventListener("storage", updateFacultyCount);
    return () => window.removeEventListener("storage", updateFacultyCount);
  }, [currentUser.instructorId]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setHasSearched(true);
    setIsSearching(true);
    setCacheNotice(null);
    setRequiresApify(false);

    try {
      // Calls SQLite Search API - checks cached scraped table first!
      const data = await apiService.searchGoogleScholar(searchQuery.trim());
      setSearchResults(data.results || []);
      setIsFromCache(Boolean(data.fromCache));
      setRequiresApify(Boolean(data.requiresApify));
      setCacheNotice(data.message || (data.fromCache ? "Loaded from database cache" : ""));
    } catch (err: any) {
      console.warn("API Search failed:", err);
      setSearchResults([]);
      setRequiresApify(false);
      setCacheNotice("Could not contact search service. Please check network.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSavePublication = async (result: ScholarSearchResult) => {
    if (isPSUPaper(result.authors)) {
      const record = {
        id: `admin-${result.id}`,
        title: result.title,
        authors: result.authors,
        journal: result.journal,
        year: result.year,
        citations: result.citations,
        abstract: result.abstract,
        url: result.url,
        ownerId: "admin",
        ownerName: result.authors[0] || "PSU Researcher",
        source: "admin" as const,
        approvalStatus: "approved" as const,
        researchStatus: "Published" as const,
        isPublic: true,
        createdAt: new Date().toISOString(),
      };

      addResearchRecord(record);
      await apiService.createPublication(record).catch(() => {});
      alert(`✓ Publication saved!\n\n"${result.title}"\n\nThis PSU paper has been added to the system.`);
    } else {
      alert(`✗ Cannot save this publication.\n\nThis is a Non-PSU paper (no faculty authors). You can view it but cannot save it to the system.`);
    }
  };

  const handleClaimPublication = async (result: ScholarSearchResult) => {
    const claimRecord = {
      id: `claim-${result.id}`,
      title: result.title,
      authors: result.authors,
      journal: result.journal,
      year: result.year,
      citations: result.citations,
      abstract: result.abstract,
      url: result.url,
      ownerId: currentUser.instructorId || "",
      ownerName: currentUser.name,
      source: "claim" as const,
      approvalStatus: "pending" as const,
      researchStatus: "Published" as const,
      isPublic: true,
      createdAt: new Date().toISOString(),
    };

    addResearchRecord(claimRecord);
    await apiService.createPublication(claimRecord).catch(() => {});
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
      <div className="text-center mb-6">
        <h1 className="text-3xl text-gray-900 mb-2">Google Scholar Search Engine</h1>
        <p className="text-gray-600">
          Search research publications with intelligent local database caching
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
            <Database className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm text-blue-900">
              <p className="font-medium mb-1">Persistent Database Scraper</p>
              <ul className="space-y-1 text-blue-800 text-xs sm:text-sm">
                <li>• All scraped research is <strong>permanently saved to SQLite</strong> — no repeated scraper calls.</li>
                <li>• <span className="inline-flex items-center bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-300">PSU</span> papers have at least one registered faculty author.</li>
                <li>• Instructors can submit research claims for Administrator review.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <form onSubmit={handleSearch}>
        <Card className="shadow-md">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search topic or researcher (e.g. data mining, agriculture, education)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-base"
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

      {/* Apify Not Connected Notice */}
      {requiresApify && searchResults.length === 0 && !isSearching && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-amber-900">Apify Google Scholar Scraper Not Connected</h4>
                <p className="text-sm text-amber-800">
                  {cacheNotice || "Configure your APIFY_TOKEN in .env to enable live scraping from Google Scholar."}
                </p>
                <p className="text-xs text-amber-700 mt-2">
                  Once connected with an Apify API token, searched papers will automatically scrape and be permanently cached in your SQLite database so you never need to call the scraper again for the same research.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cache Status Badge */}
      {cacheNotice && !requiresApify && searchResults.length > 0 && (
        <div className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
          isFromCache ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-blue-50 text-blue-800 border-blue-200"
        }`}>
          {isFromCache ? <Database className="w-4 h-4 text-emerald-600" /> : <Sparkles className="w-4 h-4 text-blue-600" />}
          <span>{cacheNotice}</span>
        </div>
      )}

      {/* Search Results */}
      {hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl text-gray-900">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
            </h2>
            {searchResults.length > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  {searchResults.filter((r) => isPSUPaper(r.authors)).length} PSU papers
                </span>
              </div>
            )}
          </div>

          {searchResults.map((result) => {
            const isPSU = isPSUPaper(result.authors);
            return (
              <Card
                key={result.id}
                className={`hover:shadow-md transition-shadow ${
                  isPSU ? "border-l-4 border-l-green-500" : "border-l-4 border-l-orange-500"
                }`}
              >
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <h3 className="text-lg text-gray-900 font-medium">{result.title}</h3>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded border text-sm font-medium self-start ${getPaperTypeColor(result.authors)}`}>
                        {isPSU ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {getPaperType(result.authors)}
                      </span>
                    </div>

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

                    <p className="text-sm text-gray-600">
                      {result.journal} • {result.year}
                    </p>

                    {result.abstract && (
                      <p className="text-sm text-gray-700 line-clamp-2">{result.abstract}</p>
                    )}

                    <div className="flex items-center gap-6 text-sm pt-1">
                      <div className="flex items-center gap-1">
                        <Quote className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-700">{result.citations} citations</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                      {result.url && (
                        <Button variant="outline" size="sm" onClick={() => window.open(result.url, "_blank")}>
                          <Eye className="w-4 h-4 mr-2" /> View Paper
                        </Button>
                      )}
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
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {searchResults.length === 0 && !isSearching && !requiresApify && (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No publications found</p>
                <p className="text-xs text-gray-400 mt-1">Try other search terms or researcher names</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!hasSearched && (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="py-12 text-center text-gray-500">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium">Search Google Scholar</p>
            <p className="text-sm text-gray-400 mt-1">Results will be automatically stored in the SQLite database.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
