import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  BookOpen,
  GraduationCap,
  ExternalLink,
  LogIn,
  LayoutDashboard,
  Filter,
  Sparkles,
  Globe,
  Building2,
  FileText,
  Calendar,
  User,
  Quote,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Tag,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  HelpCircle,
  Sun,
  Moon,
} from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { getCurrentUser, isAuthenticated } from "../utils/researchStore";
import { apiService, type ScholarSearchResult } from "../services/api.service";
import { useTheme } from "../utils/themeContext";
import { toast } from "sonner";

const SDG_LIST = [
  "SDG 1: No Poverty",
  "SDG 2: Zero Hunger",
  "SDG 3: Good Health and Well-being",
  "SDG 4: Quality Education",
  "SDG 5: Gender Equality",
  "SDG 6: Clean Water and Sanitation",
  "SDG 7: Affordable and Clean Energy",
  "SDG 8: Decent Work and Economic Growth",
  "SDG 9: Industry, Innovation and Infrastructure",
  "SDG 10: Reduced Inequalities",
  "SDG 11: Sustainable Cities and Communities",
  "SDG 12: Responsible Consumption and Production",
  "SDG 13: Climate Action",
  "SDG 14: Life Below Water",
  "SDG 15: Life on Land",
  "SDG 16: Peace, Justice and Strong Institutions",
  "SDG 17: Partnerships for the Goals",
];

export function PublicRepositoryPortal() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const loggedIn = isAuthenticated();
  const { resolvedTheme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  // Search Mode: "repository" (PSU Institutional Repository) vs "global" (Live Academic Scraper)
  const [searchMode, setSearchMode] = useState<"repository" | "global">("repository");

  // Repository Search State
  const [query, setQuery] = useState("");
  const [selectedSdg, setSelectedSdg] = useState<string>("all");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"citations" | "recent" | "title">("citations");

  const [repoResults, setRepoResults] = useState<any[]>([]);
  const [topCitedList, setTopCitedList] = useState<any[]>([]);
  const [repoStats, setRepoStats] = useState({
    totalPublications: 0,
    totalCitations: 0,
    totalResearchers: 0,
  });
  const [totalRepoCount, setTotalRepoCount] = useState(0);
  const [isRepoLoading, setIsRepoLoading] = useState(true);
  const [hasRepoSearched, setHasRepoSearched] = useState(false);

  // Repository Pagination State (Google Scholar Style)
  const [repoPage, setRepoPage] = useState(0);
  const REPO_PAGE_SIZE = 10;
  const repoResultsTopRef = useRef<HTMLDivElement>(null);

  const paginatedRepoResults = useMemo(() => {
    return repoResults.slice(repoPage * REPO_PAGE_SIZE, (repoPage + 1) * REPO_PAGE_SIZE);
  }, [repoResults, repoPage]);

  const totalRepoPages = Math.ceil(repoResults.length / REPO_PAGE_SIZE);

  const handleRepoGoToPage = (newPage: number) => {
    if (newPage < 0 || newPage >= totalRepoPages) return;
    setRepoPage(newPage);
    repoResultsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Global Scraper State
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalResults, setGlobalResults] = useState<ScholarSearchResult[]>([]);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [isLoadingGlobalPage, setIsLoadingGlobalPage] = useState(false);
  const [hasGlobalSearched, setHasGlobalSearched] = useState(false);
  const [globalPage, setGlobalPage] = useState(0);
  const [hasGlobalMore, setHasGlobalMore] = useState(false);
  const [totalGlobalAvailable, setTotalGlobalAvailable] = useState(0);
  const globalResultsTopRef = useRef<HTMLDivElement>(null);

  const [scraperStatus, setScraperStatus] = useState<{
    publicScraperEnabled: boolean;
    quotaCircuitBreakerTripped: boolean;
    remainingBalanceUsd: number;
    thresholdUsd: number;
    isAvailableForPublic: boolean;
  } | null>(null);

  // Load initial repository showcase and scraper status
  useEffect(() => {
    loadRepositoryShowcase();
    apiService.getPublicScraperStatus().then(setScraperStatus).catch(() => null);
  }, []);

  const loadRepositoryShowcase = async () => {
    setIsRepoLoading(true);
    setRepoPage(0);
    try {
      const data = await apiService.getRepositorySearch({ limit: 50, sort: "citations" });
      if (data?.success) {
        setRepoResults(data.results || []);
        setTopCitedList(data.topCited || []);
        setRepoStats(data.stats || { totalPublications: 0, totalCitations: 0, totalResearchers: 0 });
        setTotalRepoCount(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load repository data:", err);
    } finally {
      setIsRepoLoading(false);
    }
  };

  const handleRepositorySearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setIsRepoLoading(true);
    setRepoPage(0);
    setHasRepoSearched(Boolean(query.trim() || selectedSdg !== "all" || selectedDept !== "all" || selectedYear !== "all"));

    try {
      const data = await apiService.getRepositorySearch({
        q: query.trim() || undefined,
        sdg: selectedSdg !== "all" ? selectedSdg : undefined,
        department: selectedDept !== "all" ? selectedDept : undefined,
        year: selectedYear !== "all" ? selectedYear : undefined,
        sort: sortBy,
        limit: 50,
      });

      if (data?.success) {
        setRepoResults(data.results || []);
        setTotalRepoCount(data.total || 0);
      }
    } catch (err: any) {
      toast.error(err.message || "Repository search failed.");
    } finally {
      setIsRepoLoading(false);
    }
  };

  // Re-run repository search when filters or sort change
  useEffect(() => {
    if (hasRepoSearched || selectedSdg !== "all" || selectedDept !== "all" || selectedYear !== "all" || sortBy !== "citations") {
      handleRepositorySearch();
    }
  }, [selectedSdg, selectedDept, selectedYear, sortBy]);

  const handleGlobalSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!globalQuery.trim()) return;

    // Check if public scraper is restricted
    if (!loggedIn && scraperStatus && !scraperStatus.isAvailableForPublic) {
      toast.error(
        scraperStatus.quotaCircuitBreakerTripped
          ? "Global academic live search is in power-save mode ($1.00 or less quota remaining). Please browse our PSU Institutional Repository or sign in."
          : "Global live search is currently restricted by the administrator. Please search our PSU Institutional Repository."
      );
      return;
    }

    setIsGlobalLoading(true);
    setHasGlobalSearched(true);
    setGlobalResults([]);
    setGlobalPage(0);
    setHasGlobalMore(false);
    setTotalGlobalAvailable(0);

    try {
      const res = await apiService.searchGoogleScholar(globalQuery.trim(), { page: 0 });
      if (res.publicScraperDisabled) {
        toast.error(res.message || "Global academic live search is currently restricted.");
        return;
      }
      setGlobalResults(res.results || []);
      setHasGlobalMore(Boolean(res.hasMore));
      setTotalGlobalAvailable(res.totalAvailable || 0);
      if (res.results.length === 0) {
        toast.info("No papers found for this query in the global index.");
      }
    } catch (err: any) {
      toast.error(err.message || "Global academic search failed. Check network.");
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleGlobalGoToPage = async (targetPage: number) => {
    if (targetPage < 0 || isLoadingGlobalPage || isGlobalLoading) return;
    setIsLoadingGlobalPage(true);

    try {
      const res = await apiService.searchGoogleScholar(globalQuery.trim(), { page: targetPage });
      if (res.publicScraperDisabled) {
        toast.error(res.message || "Global academic live search is currently restricted.");
        return;
      }
      setGlobalResults(res.results || []);
      setGlobalPage(targetPage);
      setHasGlobalMore(Boolean(res.hasMore));
      if (res.totalAvailable) setTotalGlobalAvailable(res.totalAvailable);

      // Smooth scroll back to top of global search results container
      globalResultsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err: any) {
      toast.error(err.message || "Failed to load page. Check network.");
    } finally {
      setIsLoadingGlobalPage(false);
    }
  };

  const isScraperLockedForPublic = !loggedIn && scraperStatus && !scraperStatus.isAvailableForPublic;

  return (
    <div className="min-h-screen bg-felt-canvas text-foreground flex flex-col font-sans">
      {/* ---------------------------------------------------- */}
      {/* TOP INSTITUTIONAL NAVIGATION HEADER                  */}
      {/* ---------------------------------------------------- */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          
          {/* TOP-LEFT REPOSITORY METRICS COUNTER + SMALL ? GUIDE BUTTON */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-3 font-mono text-[10px] sm:text-[11px] bg-muted/40 border border-border/60 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg overflow-x-auto no-scrollbar shrink">
              <span className="flex items-center gap-1" title="Verified Publications">
                <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand shrink-0" />
                <strong className="text-foreground">{repoStats.totalPublications}</strong>
                <span className="hidden sm:inline"> Publications</span>
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1" title="Total Global Citations">
                <Quote className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0" />
                <strong className="text-foreground">{repoStats.totalCitations}</strong>
                <span className="hidden sm:inline"> Citations</span>
              </span>
              <span className="text-border hidden sm:inline">•</span>
              <span className="hidden sm:flex items-center gap-1" title="Registered Researchers">
                <GraduationCap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500 shrink-0" />
                <strong className="text-foreground">{repoStats.totalResearchers}</strong>
                <span className="hidden sm:inline"> Researchers</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate("/guide")}
              title="About & System Guide"
              aria-label="Open About and System Guide"
              className="w-6 h-6 rounded-full border border-border/80 bg-muted/50 hover:bg-brand hover:text-white hover:border-brand text-muted-foreground transition-all flex items-center justify-center shrink-0 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TOP-RIGHT THEME TOGGLE + SIGN IN / DASHBOARD BUTTON */}
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              title={resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label={resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="h-8 px-2.5 gap-1.5 text-xs font-medium bg-card border-border/80 text-muted-foreground hover:text-foreground"
            >
              {resolvedTheme === "dark" ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Light</span>
                </>
              )}
            </Button>

            {loggedIn && currentUser ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="gap-2 text-xs font-semibold border-brand/40 bg-brand/5 text-brand hover:bg-brand/10 shadow-2xs h-8"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Go to Dashboard ({currentUser.name.split(" ")[0]})</span>
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate("/login")}
                className="gap-2 text-xs font-bold bg-brand hover:bg-brand/90 text-white shadow-2xs px-3.5 h-8"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* HERO SECTION WITH SEARCH ENGINE SELECTOR             */}
      {/* ---------------------------------------------------- */}
      <section className="relative py-8 md:py-12 px-4 sm:px-6 bg-gradient-to-b from-brand/5 via-background to-background border-b border-border/60">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Explore Institutional Research & Academic Literature
          </h2>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Search verified scholarly publications, faculty studies, and SDG impact contributions from Pangasinan State University, with access to global academic literature.
          </p>

          {/* SEARCH MODE SWITCHER TOGGLE */}
          <div className="inline-flex flex-col sm:flex-row p-1 rounded-xl bg-muted/80 border border-border/80 shadow-2xs max-w-full">
            <button
              type="button"
              onClick={() => setSearchMode("repository")}
              className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all w-full sm:w-auto ${
                searchMode === "repository"
                  ? "bg-background text-brand shadow-2xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span><span className="hidden sm:inline">PSU Institutional </span>Repository</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                {repoStats.totalPublications}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setSearchMode("global")}
              className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all w-full sm:w-auto ${
                searchMode === "global"
                  ? "bg-background text-brand shadow-2xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span><span className="hidden sm:inline">Global </span>Academic Search</span>
              {isScraperLockedForPublic ? (
                <Badge variant="outline" className="text-[9px] h-4 px-1 text-amber-600 border-amber-400">
                  Power Save
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono bg-emerald-500/10 text-emerald-600">
                  Live
                </Badge>
              )}
            </button>
          </div>

          {/* ---------------------------------------------------- */}
          {/* SEARCH INPUT: MODE 1 - REPOSITORY SEARCH             */}
          {/* ---------------------------------------------------- */}
          {searchMode === "repository" && (
            <form onSubmit={handleRepositorySearch} className="max-w-3xl mx-auto space-y-3">
              <div className="relative shadow-sm rounded-2xl">
                <Search className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search PSU researches by title, author, keyword, or SDG track..."
                  className="pl-12 pr-28 h-13 sm:h-14 text-sm sm:text-base rounded-2xl bg-card border-border/80 focus-visible:ring-brand shadow-xs"
                />
                <Button
                  type="submit"
                  disabled={isRepoLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 sm:h-10 px-4 sm:px-6 rounded-xl font-bold bg-brand hover:bg-brand/90 text-white text-xs sm:text-sm"
                >
                  {isRepoLoading ? "Searching..." : "Search"}
                </Button>
              </div>

              {/* QUICK FILTER PILLS */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
                <span className="text-muted-foreground font-medium flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Filters:
                </span>

                {/* Department Filter */}
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  aria-label="Filter researches by department"
                  className="h-7 px-2.5 rounded-lg text-[11px] bg-card dark:bg-[#3a3b3c] border border-border/80 text-foreground"
                >
                  <option value="all">All Departments</option>
                  <option value="BSIT">BSIT (Information Technology)</option>
                  <option value="BSEd">BSEd (Teacher Education)</option>
                  <option value="DAT/BAT">DAT/BAT (Agriculture & Tech)</option>
                </select>

                {/* SDG Filter */}
                <select
                  value={selectedSdg}
                  onChange={(e) => setSelectedSdg(e.target.value)}
                  aria-label="Filter researches by UN Sustainable Development Goal"
                  className="h-7 px-2.5 rounded-lg text-[11px] bg-card dark:bg-[#3a3b3c] border border-border/80 text-foreground max-w-[180px] truncate"
                >
                  <option value="all">All UN SDG Goals</option>
                  {SDG_LIST.map((sdg) => (
                    <option key={sdg} value={sdg}>
                      {sdg}
                    </option>
                  ))}
                </select>

                {/* Sort Order */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  aria-label="Sort research publications order"
                  className="h-7 px-2.5 rounded-lg text-[11px] bg-card dark:bg-[#3a3b3c] border border-border/80 text-foreground"
                >
                  <option value="citations">Highest Citations</option>
                  <option value="recent">Most Recent Year</option>
                  <option value="title">Title (A-Z)</option>
                </select>

                {(query || selectedSdg !== "all" || selectedDept !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setSelectedSdg("all");
                      setSelectedDept("all");
                      setSelectedYear("all");
                      setHasRepoSearched(false);
                      loadRepositoryShowcase();
                    }}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            </form>
          )}

          {/* ---------------------------------------------------- */}
          {/* SEARCH INPUT: MODE 2 - GLOBAL ACADEMIC SCRAPER       */}
          {/* ---------------------------------------------------- */}
          {searchMode === "global" && (
            <div className="max-w-3xl mx-auto space-y-3">
              {isScraperLockedForPublic && (
                <Card className="p-3.5 bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs text-left flex items-start gap-3 rounded-xl">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">
                      Global Live Search is Restricted (Power-Save Mode)
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      External live scraping is temporarily restricted to conserve institutional API quota ($1.00 or less remaining). You can search the PSU Institutional Repository freely, or sign in as faculty/admin to unlock live global search.
                    </p>
                  </div>
                </Card>
              )}

              <form onSubmit={handleGlobalSearch} className="space-y-2">
                <div className="relative shadow-sm rounded-2xl">
                  <Globe className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                  <Input
                    value={globalQuery}
                    onChange={(e) => setGlobalQuery(e.target.value)}
                    placeholder="Search global literature across millions of papers (PSU & PH prioritized)..."
                    disabled={Boolean(isScraperLockedForPublic)}
                    className="pl-12 pr-28 h-13 sm:h-14 text-sm sm:text-base rounded-2xl bg-card border-border/80 focus-visible:ring-brand shadow-xs"
                  />
                  <Button
                    type="submit"
                    disabled={isGlobalLoading || Boolean(isScraperLockedForPublic) || !globalQuery.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-9 sm:h-10 px-4 sm:px-6 rounded-xl font-bold bg-brand hover:bg-brand/90 text-white text-xs sm:text-sm"
                  >
                    {isGlobalLoading ? "Searching..." : "Search"}
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 pt-1">
                  <TrendingUp className="w-3.5 h-3.5 text-brand" />
                  <span>
                    Smart 3-Tier Ranking active: <strong>PSU papers</strong> &rarr; <strong>Philippine studies</strong> &rarr; <strong>International literature</strong>
                  </span>
                </p>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                    */}
      {/* ---------------------------------------------------- */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-10">

        {/* ==================================================== */}
        {/* VIEW 1: REPOSITORY SEARCH RESULTS                    */}
        {/* ==================================================== */}
        {searchMode === "repository" && (
          <div className="space-y-8">
            {/* Top Bar for Results */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand" />
                  <span>
                    {hasRepoSearched ? `Repository Search Results (${totalRepoCount})` : "Featured PSU Researches & Publications"}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {hasRepoSearched
                    ? `Showing verified researches matching your criteria.`
                    : "Showcasing high-impact publications with top citation counts and UN SDG alignment."}
                </p>
              </div>

              {selectedSdg !== "all" && (
                <Badge variant="outline" className="text-xs bg-brand/10 text-brand border-brand/30 self-start sm:self-auto">
                  Focus: {selectedSdg}
                </Badge>
              )}
            </div>

            {/* RESULTS LIST */}
            {isRepoLoading ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-muted-foreground">Searching institutional repository...</p>
              </div>
            ) : repoResults.length > 0 ? (
              <div ref={repoResultsTopRef} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paginatedRepoResults.map((pub) => {
                    const authorsList = Array.isArray(pub.authors) ? pub.authors : [pub.authors];
                    const sdgTags = Array.isArray(pub.sdg_tags) ? pub.sdg_tags : [];

                    return (
                      <Card
                        key={pub.id}
                        className="border border-border/70 hover:border-brand/40 bg-card p-5 rounded-2xl shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3">
                          {/* Tags and Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold gap-1">
                              <Building2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Pangasinan State University</span>
                            </Badge>

                            {pub.citations > 0 && (
                              <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold gap-1 font-mono">
                                <Quote className="w-2.5 h-2.5" />
                                {pub.citations} Citations
                              </Badge>
                            )}

                            {pub.year && (
                              <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                                <Calendar className="w-2.5 h-2.5 mr-1" />
                                {pub.year}
                              </Badge>
                            )}
                          </div>

                          {/* Title */}
                          <h4 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                            {pub.title}
                          </h4>

                          {/* Authors */}
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            <User className="w-3 h-3 inline mr-1 text-brand" />
                            <strong className="text-foreground">Authors:</strong> {authorsList.join(", ")}
                          </p>

                          {/* Journal / Venue */}
                          <p className="text-xs text-muted-foreground line-clamp-1 font-mono">
                            <BookOpen className="w-3 h-3 inline mr-1 text-muted-foreground" />
                            {pub.journal || "Academic Publication"}
                            {pub.volume_issue ? ` • ${pub.volume_issue}` : ""}
                          </p>

                          {/* Abstract */}
                          {pub.abstract && (
                            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed pt-1">
                              {pub.abstract}
                            </p>
                          )}

                          {/* SDG Focus Track Badges */}
                          {sdgTags.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              {sdgTags.map((tag: string) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-[10px] bg-brand/10 text-brand border border-brand/20 font-medium flex items-center gap-1"
                                >
                                  <Tag className="w-2.5 h-2.5 text-brand" />
                                  <span>{tag}</span>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Footer Actions (Direct Links - NO Cite Formatter Button) */}
                        <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {pub.owner_name ? `Recorded under ${pub.owner_name}` : "Verified PSU Output"}
                          </span>

                          <div className="flex items-center gap-2">
                            {pub.doi && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`https://doi.org/${pub.doi.replace(/^https?:\/\/doi\.org\//i, "")}`, "_blank")}
                                className="text-[11px] h-7 px-2.5 gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                DOI
                              </Button>
                            )}
                            {pub.url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(pub.url, "_blank")}
                                className="text-[11px] h-7 px-2.5 gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View Source
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Repository Pagination Bar (Google Scholar Style) */}
                {totalRepoPages > 1 && (
                  <div className="pt-4 pb-2 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground font-mono">
                      Showing {repoPage * REPO_PAGE_SIZE + 1}–{Math.min((repoPage + 1) * REPO_PAGE_SIZE, repoResults.length)} of {repoResults.length} researches (Page {repoPage + 1} of {totalRepoPages})
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={repoPage === 0}
                        onClick={() => handleRepoGoToPage(repoPage - 1)}
                        className="h-8 px-3 text-xs gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Previous</span>
                      </Button>

                      {Array.from({ length: totalRepoPages }).map((_, i) => {
                        const isCurrent = repoPage === i;
                        return (
                          <Button
                            key={i}
                            type="button"
                            variant={isCurrent ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleRepoGoToPage(i)}
                            className={`h-8 w-8 p-0 text-xs font-mono font-medium ${
                              isCurrent ? "bg-brand text-white border-brand hover:bg-brand/90" : "hover:bg-muted"
                            }`}
                          >
                            {i + 1}
                          </Button>
                        );
                      })}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={repoPage >= totalRepoPages - 1}
                        onClick={() => handleRepoGoToPage(repoPage + 1)}
                        className="h-8 px-3.5 text-xs gap-1 font-semibold text-brand hover:text-brand hover:bg-brand/10 border-brand/40"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center space-y-3 bg-muted/20 rounded-2xl border border-dashed border-border p-8">
                <BookOpen className="w-10 h-10 text-muted-foreground/60 mx-auto" />
                <h4 className="text-sm font-bold text-foreground">No Researches Found</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  No repository publications matched your search or filters. Try adjusting keywords or selecting "All UN SDG Goals".
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setSelectedSdg("all");
                    setSelectedDept("all");
                    setHasRepoSearched(false);
                    loadRepositoryShowcase();
                  }}
                  className="text-xs mt-2"
                >
                  Reset Search
                </Button>
              </div>
            )}

            {/* UN SDG QUICK BROWSE SECTION */}
            <div className="pt-6 border-t border-border/60 space-y-4">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Tag className="w-4 h-4 text-brand" />
                <span>Browse PSU Researches by UN Sustainable Development Goal</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {SDG_LIST.map((sdg) => {
                  const isSelected = selectedSdg === sdg;
                  const num = sdg.match(/\d+/)?.[0] || "";
                  return (
                    <button
                      key={sdg}
                      type="button"
                      onClick={() => {
                        setSelectedSdg(isSelected ? "all" : sdg);
                        setHasRepoSearched(true);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all text-xs flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? "bg-brand/10 border-brand text-brand font-bold shadow-2xs"
                          : "bg-card border-border/70 hover:border-brand/40 text-foreground hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">
                          Goal {num}
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-brand" />}
                      </div>
                      <span className="text-[11px] leading-tight line-clamp-2">
                        {sdg.replace(/^SDG\s*\d+:?\s*/i, "")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW 2: GLOBAL ACADEMIC LIVE SEARCH RESULTS          */}
        {/* ==================================================== */}
        {searchMode === "global" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4 text-brand" />
                  <span>
                    {hasGlobalSearched ? `Global Search Results (${globalResults.length})` : "Global Academic Literature Search"}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Academic papers indexed globally with 3-Tier ranking: PSU &rarr; Philippines &rarr; International.
                </p>
              </div>
            </div>

            {isGlobalLoading ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-muted-foreground">Querying global academic indices & classifying SDGs...</p>
              </div>
            ) : globalResults.length > 0 ? (
              <div ref={globalResultsTopRef} className="space-y-6">
                <div className="space-y-3">
                  {globalResults.map((result) => {
                    return (
                      <Card
                        key={result.id}
                        className="border border-border/70 hover:border-brand/40 bg-card p-4 sm:p-5 rounded-2xl shadow-2xs transition-all space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            {/* Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {result.geo_tier === "psu" ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold gap-1">
                                  <Building2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>Pangasinan State University</span>
                                </Badge>
                              ) : result.geo_tier === "philippines" ? (
                                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold gap-1">
                                  <span>Philippines Research</span>
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground border-border/80 font-normal gap-1">
                                  <Globe className="w-3 h-3" />
                                  <span>International Literature</span>
                                </Badge>
                              )}

                              {result.citations > 0 && (
                                <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold font-mono">
                                  Cited by {result.citations}
                                </Badge>
                              )}

                              {result.year && (
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  {result.year}
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <h4 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                              {result.url ? (
                                <a
                                  href={result.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:text-brand hover:underline inline-flex items-center gap-1.5"
                                >
                                  <span>{result.title}</span>
                                  <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                                </a>
                              ) : (
                                result.title
                              )}
                            </h4>

                            {/* Authors */}
                            <p className="text-xs text-muted-foreground">
                              Authors: <span className="text-foreground">{result.authors.join(", ")}</span>
                            </p>

                            {/* Journal */}
                            <p className="text-xs text-muted-foreground font-mono">
                              Journal: {result.journal || "Academic Source"}
                            </p>

                            {/* Abstract */}
                            {result.abstract && (
                              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pt-0.5">
                                {result.abstract}
                              </p>
                            )}

                            {/* Auto-tagged SDG Badges */}
                            {Array.isArray(result.sdg_tags) && result.sdg_tags.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                                  SDG Track:
                                </span>
                                {result.sdg_tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="text-[10px] bg-brand/10 text-brand border border-brand/20 font-medium flex items-center gap-1"
                                    title={result.sdg_rationale || undefined}
                                  >
                                    <Tag className="w-2.5 h-2.5 text-brand" />
                                    <span>{tag}</span>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Citation Link */}
                          {result.citedByLink && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(result.citedByLink, "_blank")}
                              className="text-[11px] h-7 px-2.5 gap-1 shrink-0 self-start"
                            >
                              <Quote className="w-3 h-3 text-brand" />
                              <span>{result.citations} Citations</span>
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Google Scholar Style Pagination Bar */}
                <div className="pt-4 pb-2 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground font-mono">
                    Showing {globalPage * 10 + 1}–{globalPage * 10 + globalResults.length}
                    {totalGlobalAvailable > 0 ? ` of ${totalGlobalAvailable} papers` : ""} (Page {globalPage + 1})
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={globalPage === 0 || isLoadingGlobalPage || isGlobalLoading}
                      onClick={() => handleGlobalGoToPage(globalPage - 1)}
                      className="h-8 px-3 text-xs gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </Button>

                    {/* Numbered page buttons (Google Scholar Style) */}
                    {Array.from({
                      length: Math.min(
                        6,
                        Math.max(globalPage + 2, Math.ceil((totalGlobalAvailable || 30) / 10))
                      ),
                    }).map((_, i) => {
                      const pageIdx = i;
                      const isCurrent = globalPage === pageIdx;
                      return (
                        <Button
                          key={pageIdx}
                          type="button"
                          variant={isCurrent ? "default" : "outline"}
                          size="sm"
                          disabled={isLoadingGlobalPage || isGlobalLoading}
                          onClick={() => handleGlobalGoToPage(pageIdx)}
                          className={`h-8 w-8 p-0 text-xs font-mono font-medium ${
                            isCurrent ? "bg-brand text-white border-brand hover:bg-brand/90" : "hover:bg-muted"
                          }`}
                        >
                          {pageIdx + 1}
                        </Button>
                      );
                    })}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!hasGlobalMore || isLoadingGlobalPage || isGlobalLoading}
                      onClick={() => handleGlobalGoToPage(globalPage + 1)}
                      className="h-8 px-3.5 text-xs gap-1 font-semibold text-brand hover:text-brand hover:bg-brand/10 border-brand/40"
                    >
                      {isLoadingGlobalPage ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : hasGlobalSearched ? (
              <div className="py-16 text-center space-y-3 bg-muted/20 rounded-2xl border border-dashed border-border p-8">
                <Globe className="w-10 h-10 text-muted-foreground/60 mx-auto" />
                <h4 className="text-sm font-bold text-foreground">No Global Papers Found</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  No academic literature was found for "{globalQuery}". Try searching different keywords.
                </p>
              </div>
            ) : (
              <div className="py-16 text-center space-y-3 bg-muted/20 rounded-2xl border border-dashed border-border p-8">
                <Globe className="w-10 h-10 text-muted-foreground/60 mx-auto" />
                <h4 className="text-sm font-bold text-foreground">Global Literature Search</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Type any topic, title, or researcher name above to search live academic papers with automatic PSU and Philippine priority ranking.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ---------------------------------------------------- */}
      {/* FOOTER                                               */}
      {/* ---------------------------------------------------- */}
      <footer className="border-t border-border/60 bg-muted/20 py-8 px-4 sm:px-6 mt-12 text-center text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">
          Pangasinan State University — Institutional Research Repository
        </p>
        <p className="text-[11px] text-muted-foreground">
          Asingan Campus • Commission on Higher Education (CHED) Accredited Repository Standards • United Nations SDGs Aligned
        </p>
        <p className="text-[11px] text-muted-foreground">
          Researchers and the Research Coordinator may sign in using the top-right portal button to access research analytics and management tools.
        </p>
      </footer>
    </div>
  );
}

