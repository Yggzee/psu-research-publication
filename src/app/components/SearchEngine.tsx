import { useState, useEffect, type FormEvent } from "react";
import { Search, User, FileText, Quote, Shield, AlertCircle, CheckCircle2, Eye, Save, Hand, Database, Sparkles, KeyRound, X, RefreshCw, Zap, Plus, ExternalLink } from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { isPSUPaper, getFacultyList } from "../utils/facultyUtils";
import { getCurrentUser, getResearchRecords, addResearchRecord } from "../utils/researchStore";
import { apiService, type ScholarSearchResult, type ApifyTokenUsage } from "../services/api.service";
import { ApifyTokenManager } from "./ApifyTokenManager";

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
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [searchMode, setSearchMode] = useState<"smart" | "author">("smart");
  const [facultyNames, setFacultyNames] = useState<string[]>([]);
  const [tokenUsage, setTokenUsage] = useState<ApifyTokenUsage | null>(null);
  const [isLoadingTokenUsage, setIsLoadingTokenUsage] = useState(false);

  const currentUser = getCurrentUser();
  const isInstructor = currentUser.role === "instructor";

  useEffect(() => {
    const updateFaculty = async () => {
      try {
        const resList = await apiService.getResearchers().catch(() => []);
        if (Array.isArray(resList) && resList.length > 0) {
          const names = resList.filter((r) => r.isFaculty).map((r) => r.name);
          setFacultyNames(names);
          setFacultyCount(names.length);
          return;
        }
      } catch {}
      const fallback = getFacultyList();
      setFacultyNames(fallback);
      setFacultyCount(fallback.length);
    };
    updateFaculty();

    setClaimedIds(
      getResearchRecords()
        .filter((record) => record.ownerId === currentUser.instructorId && record.source === "claim")
        .map((record) => record.id.replace(/^claim-/, ""))
    );

    const refreshActiveUsage = async (showLoading = false) => {
      if (showLoading) setIsLoadingTokenUsage(true);
      try {
        const res = await apiService.getActiveTokenUsage();
        if (res?.tokenUsage) {
          setTokenUsage(res.tokenUsage);
        }
      } catch (err) {
        console.warn("Could not load initial token usage:", err);
      } finally {
        if (showLoading) setIsLoadingTokenUsage(false);
      }
    };
    refreshActiveUsage(false);

    window.addEventListener("storage", updateFaculty);
    return () => window.removeEventListener("storage", updateFaculty);
  }, [currentUser.instructorId]);

  const refreshActiveUsage = async (showLoading = true) => {
    if (showLoading) setIsLoadingTokenUsage(true);
    try {
      const res = await apiService.getActiveTokenUsage();
      if (res?.tokenUsage) {
        setTokenUsage(res.tokenUsage);
      }
    } catch (err) {
      console.warn("Could not refresh token usage:", err);
    } finally {
      if (showLoading) setIsLoadingTokenUsage(false);
    }
  };

  const executeSearch = async (textToSearch?: string, modeToUse?: "smart" | "author", forceRefresh = false) => {
    const q = (textToSearch !== undefined ? textToSearch : searchQuery).trim();
    if (!q) return;

    const activeMode = modeToUse || searchMode;
    // If author-specific search mode is active, format with author: prefix
    const finalQuery =
      activeMode === "author" && !q.toLowerCase().startsWith("author:")
        ? `author:${q}`
        : q;

    setSearchQuery(q);
    setHasSearched(true);
    setIsSearching(true);
    setCacheNotice(null);
    setRequiresApify(false);

    try {
      // Calls SQLite Search API - retrieves full list with optional force-refresh
      const data = await apiService.searchGoogleScholar(finalQuery, forceRefresh);
      setSearchResults(data.results || []);
      setIsFromCache(Boolean(data.fromCache));
      setRequiresApify(Boolean(data.requiresApify));
      setCacheNotice(data.message || (data.fromCache ? "Loaded from database cache" : ""));
      if (data.tokenUsage) {
        setTokenUsage(data.tokenUsage);
      }
    } catch (err: any) {
      console.warn("API Search failed:", err);
      setSearchResults([]);
      setRequiresApify(false);
      setCacheNotice("Could not contact search service. Please check network.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    await executeSearch();
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
        citedByLink: result.citedByLink,
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
      citedByLink: result.citedByLink,
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

      {/* Active Apify Scraper Token & Limit Tracker */}
      <Card className="border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/20 shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          {tokenUsage ? (
            <div className="space-y-3.5">
              {/* Header row: Token Identity & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative p-2.5 bg-blue-100/70 text-blue-700 rounded-lg">
                    <KeyRound className="w-4 h-4" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{tokenUsage.tokenName}</span>
                      {tokenUsage.username && (
                        <span className="text-xs text-gray-500 font-mono">@{tokenUsage.username}</span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tokenUsage.plan} Plan (${tokenUsage.limitUsd.toFixed(2)} limit)
                      </span>
                      <span className="text-[11px] text-gray-400 hidden md:inline">
                        • Actor: {tokenUsage.actorId.replace("~", "/")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Active scraper token • Usage limits auto-refresh after every search
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => refreshActiveUsage(true)}
                    disabled={isLoadingTokenUsage}
                    className="h-8 text-xs text-gray-600 hover:text-blue-700 flex items-center gap-1.5"
                    title="Refresh Token Limits from Apify"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTokenUsage ? "animate-spin text-blue-600" : ""}`} />
                    <span>Sync Limits</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTokenManager((prev) => !prev)}
                    className="h-8 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-orange-600" />
                    <span>{showTokenManager ? "Close Settings" : "Switch Token"}</span>
                  </Button>
                </div>
              </div>

              {/* Progress Bar & Breakdown */}
              <div className="space-y-1.5 bg-white/80 border border-slate-100 p-3 rounded-lg shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 font-medium">
                    Credit Used: <strong className="text-gray-900">${tokenUsage.usedUsd.toFixed(3)}</strong> of ${tokenUsage.limitUsd.toFixed(2)} limit
                  </span>
                  <span className="font-semibold text-emerald-700">
                    ${tokenUsage.remainingUsd.toFixed(3)} remaining ({(100 - tokenUsage.usedPercentage).toFixed(1)}% free)
                  </span>
                </div>

                <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      tokenUsage.usedPercentage >= 90
                        ? "bg-rose-500"
                        : tokenUsage.usedPercentage >= 70
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(3, tokenUsage.usedPercentage))}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-gray-500">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <strong>{tokenUsage.searchesCount}</strong> searches made via app
                    </span>
                    {tokenUsage.totalRuns !== null && (
                      <span className="inline-flex items-center gap-1">
                        <Database className="w-3 h-3 text-blue-500" />
                        <strong>{tokenUsage.totalRuns}</strong> total Apify actor runs
                      </span>
                    )}
                  </div>
                  {tokenUsage.cycleEndAt && (
                    <span className="text-slate-500">
                      Cycle resets: {new Date(tokenUsage.cycleEndAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-lg">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">No Active Apify Scraper Token</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Connect a free Apify token ($5 free monthly credits) for live scraping fallback.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowTokenManager(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-xs self-start sm:self-center text-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Connect Apify Token
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {showTokenManager && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setShowTokenManager(false)}
          >
            <div
              className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Connect Apify Token</h3>
                    <p className="text-xs text-muted-foreground">Manage scraper tokens for Google Scholar fallback queries</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowTokenManager(false)}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <ApifyTokenManager
                compact={true}
                onTokenChanged={() => {
                  setRequiresApify(false);
                  refreshActiveUsage(true);
                }}
              />
            </div>
          </div>
        )}

      {/* Search Bar */}
      <form onSubmit={handleSearch}>
        <Card className="shadow-md">
          <CardContent className="p-4 sm:p-6 space-y-3">
            {/* Search Mode Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Mode:</span>
              <button
                type="button"
                onClick={() => setSearchMode("smart")}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  searchMode === "smart"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Smart Search (Topic & Author)
              </button>
              <button
                type="button"
                onClick={() => setSearchMode("author")}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  searchMode === "author"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Author Filter (author:...)
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder={
                    searchMode === "author"
                      ? "Enter author name to find all papers with their name (e.g. Julius Oscar Moreno, Santos)"
                      : "Search researcher name or topic (e.g. Julius Oscar Moreno, data mining)"
                  }
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

            {/* Quick Researcher Search Chips */}
            {facultyNames.length > 0 && (
              <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <User className="w-3 h-3 text-blue-600" /> Quick Search:
                </span>
                {facultyNames.slice(0, 6).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => executeSearch(name)}
                    className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full transition-colors font-medium"
                    title={`Search all publications by ${name}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </form>

      {/* Apify Not Connected Notice */}
      {requiresApify && searchResults.length === 0 && !isSearching && (
        <div className="space-y-4">
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-amber-900">Apify Google Scholar Scraper Not Connected</h4>
                  <p className="text-sm text-amber-800">
                    Connect an Apify API token below to start scraping live research publications from Google Scholar.
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Free accounts receive $5 monthly usage. Once scraped, papers are saved permanently in SQLite so you never re-scrape the same query.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <ApifyTokenManager
            compact
            onTokenChanged={() => {
              setRequiresApify(false);
            }}
          />
        </div>
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

      {/* Loading Progress State */}
      {isSearching && (
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs">
          <CardContent className="py-10 text-center space-y-4">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-blue-800 animate-ping opacity-25" />
              <div className="w-14 h-14 rounded-full border-4 border-blue-600 border-t-transparent animate-spin flex items-center justify-center" />
              <Search className="w-6 h-6 text-blue-600 absolute" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg text-foreground">Searching Google Scholar...</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Connecting to academic indexes, retrieving publication metadata, citations, and matching with PSU faculty authors.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {hasSearched && !isSearching && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl text-gray-900 dark:text-gray-100 font-semibold">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
            </h2>
            <div className="flex items-center gap-3">
              {searchResults.length > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline">
                  {searchResults.filter((r) => isPSUPaper(r.authors)).length} PSU papers
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => executeSearch(undefined, undefined, true)}
                disabled={isSearching}
                className="text-xs flex items-center gap-1.5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? "animate-spin" : ""}`} />
                Live Refresh from Google Scholar
              </Button>
            </div>
          </div>

          {searchResults.map((result) => {
            const isPSU = isPSUPaper(result.authors);
            return (
              <Card
                key={result.id}
                className={`hover:shadow-md transition-shadow dark:border-gray-800 ${
                  isPSU ? "border-l-4 border-l-green-500" : "border-l-4 border-l-orange-500"
                }`}
              >
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <h3 className="text-lg text-gray-900 dark:text-gray-100 font-medium">{result.title}</h3>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded border text-sm font-medium self-start ${getPaperTypeColor(result.authors)}`}>
                        {isPSU ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {getPaperType(result.authors)}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" />
                      <p className="text-sm text-gray-700 dark:text-gray-200">
                        {result.authors.map((author, idx) => (
                          <span key={idx}>
                            <span className={isPSUPaper([author]) ? "font-semibold text-blue-600 dark:text-blue-400" : ""}>
                              {author}
                            </span>
                            {idx < result.authors.length - 1 && ", "}
                          </span>
                        ))}
                      </p>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {result.journal} • {result.year}
                    </p>

                    {result.abstract && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{result.abstract}</p>
                    )}

                    <div className="flex items-center gap-6 text-sm pt-1">
                      <div className="flex items-center gap-1">
                        <Quote className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-gray-700 dark:text-gray-200">{result.citations} citations</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                      {result.url && (
                        <Button variant="outline" size="sm" onClick={() => window.open(result.url, "_blank")} className="dark:border-gray-700">
                          <Eye className="w-4 h-4 mr-2" /> View Paper
                        </Button>
                      )}
                      {isInstructor ? (
                        <Button
                          size="sm"
                          onClick={() => handleClaimPublication(result)}
                          disabled={claimedIds.includes(result.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Hand className="w-4 h-4 mr-2" />
                          {claimedIds.includes(result.id) ? "Claim Pending" : "Claim Research"}
                        </Button>
                      ) : (
                        <Button
                          variant={isPSU ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleSavePublication(result)}
                          className={isPSU ? "bg-green-600 hover:bg-green-700 text-white" : "dark:border-gray-700"}
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
            <Card className="dark:border-gray-800">
              <CardContent className="py-12 text-center text-gray-500 dark:text-gray-400">
                <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p>No publications found</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try other search terms or researcher names</p>
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
