import { useState, useEffect, useMemo, type FormEvent } from "react";
import {
  Search,
  User,
  FileText,
  Quote,
  Shield,
  AlertCircle,
  CheckCircle2,
  Eye,
  Save,
  Hand,
  Database,
  Sparkles,
  KeyRound,
  X,
  RefreshCw,
  Zap,
  Plus,
  ExternalLink,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { isPSUPaper, getFacultyList, normalizeTitle } from "../utils/facultyUtils";
import { getCurrentUser, getResearchRecords, addResearchRecord, type ManagedResearcher } from "../utils/researchStore";
import { apiService, type ScholarSearchResult, type ApifyTokenUsage } from "../services/api.service";
import { ApifyTokenManager } from "./ApifyTokenManager";
import { toast } from "sonner";
import { PageHeader, StatusBadge, Notice, SectionCard, EmptyState } from "./common";

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
  const [captchaDetected, setCaptchaDetected] = useState(false);
  const [searchSource, setSearchSource] = useState<"cache" | "direct" | "apify" | "none" | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>("");
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [facultyNames, setFacultyNames] = useState<string[]>([]);
  const [registeredResearchers, setRegisteredResearchers] = useState<ManagedResearcher[]>([]);
  const [assignedResearcherMap, setAssignedResearcherMap] = useState<Record<string, string>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [tokenUsage, setTokenUsage] = useState<ApifyTokenUsage | null>(null);
  const [isLoadingTokenUsage, setIsLoadingTokenUsage] = useState(false);
  const [savedPublications, setSavedPublications] = useState<any[]>([]);

  // 10-paper pagination and Scraper Token feedback state
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showMoreConfirmModal, setShowMoreConfirmModal] = useState(false);
  const [skipConfirmThisSession, setSkipConfirmThisSession] = useState(false);
  const [lastUsedToken, setLastUsedToken] = useState<boolean | null>(null);

  const currentUser = getCurrentUser() || { name: "Faculty", instructorId: "", role: "instructor" as const };
  const isInstructor = currentUser.role === "instructor";

  const loadSavedPublications = async () => {
    try {
      const data = await apiService.getPublications();
      setSavedPublications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Could not load repository publications for deduplication:", err);
    }
  };

  const savedTitleMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of savedPublications) {
      const norm = normalizeTitle(p.title);
      if (norm) map.set(norm, p);
    }
    return map;
  }, [savedPublications]);

  const isPublicationAlreadySaved = (title: string): boolean => {
    const norm = normalizeTitle(title);
    if (!norm) return false;
    const existing = savedTitleMap.get(norm);
    return Boolean(existing && (existing.approval_status === "approved" || existing.approvalStatus === "approved"));
  };

  const getExistingPublicationRecord = (title: string): any | null => {
    const norm = normalizeTitle(title);
    return norm ? savedTitleMap.get(norm) || null : null;
  };

  useEffect(() => {
    loadSavedPublications();
    const updateFaculty = async () => {
      try {
        const resList = await apiService.getResearchers().catch(() => []);
        if (Array.isArray(resList)) {
          const mapped: ManagedResearcher[] = resList.map((r: any) => ({
            id: r.id,
            instructorId: r.instructorId || r.instructor_id || r.id || "",
            firstName: r.firstName || "",
            lastName: r.lastName || "",
            name: r.name || "",
            department: r.department || "BSIT",
            isFaculty: r.isFaculty ?? true,
            email: r.email || "",
            photoUrl: r.photoUrl || "",
            scholarUrl: r.scholarUrl || "",
          }));
          setRegisteredResearchers(mapped);
          const names = mapped.filter((r) => r.isFaculty).map((r) => r.name);
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
    window.addEventListener("researchers-updated", updateFaculty);
    window.addEventListener("research-records-updated", loadSavedPublications);
    return () => {
      window.removeEventListener("storage", updateFaculty);
      window.removeEventListener("researchers-updated", updateFaculty);
      window.removeEventListener("research-records-updated", loadSavedPublications);
    };
  }, []);

  const executeSearch = async (queryToSearch: string) => {
    const q = queryToSearch.trim();
    if (!q) return;

    setSearchQuery(q);
    setIsSearching(true);
    setHasSearched(true);
    setCacheNotice(null);
    setRequiresApify(false);
    setCaptchaDetected(false);
    setSearchSource(null);
    setCurrentPage(0);
    setHasMore(false);
    setSearchResults([]);

    const finalQuery = q;

    try {
      const response = await apiService.searchGoogleScholar(finalQuery, { page: 0 });

      if (response.publicScraperDisabled) {
        toast.error(response.message || "Global academic live search is currently restricted.");
        setCacheNotice(response.message || "Global academic live search is restricted.");
        setSearchResults([]);
        return;
      }

      if (response.requiresApify) {
        setRequiresApify(true);
        setCaptchaDetected(true);
        setSearchSource("none");
        setSearchResults([]);
        return;
      }

      setSearchResults(response.results);
      setIsFromCache(Boolean(response.fromCache));
      setSearchSource(response.searchSource || "direct");
      setSourceLabel(response.sourceLabel || "");
      setHasMore(Boolean(response.hasMore ?? (response.results.length >= 5)));
      setCurrentPage(0);
      setLastUsedToken(Boolean(response.usedToken));

      if (response.fromCache) {
        setCacheNotice("Retrieved from local database cache (instant response, 0 credits used).");
      }

      // Refresh token limits in background
      apiService.getActiveTokenUsage().then((res) => {
        if (res?.tokenUsage) setTokenUsage(res.tokenUsage);
      });
    } catch (err: any) {
      console.error("Search error:", err);
      toast.error(err.message || "Search failed. Check your network or Apify connection.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleShowMoreClick = () => {
    if (skipConfirmThisSession) {
      loadMorePapers();
    } else {
      setShowMoreConfirmModal(true);
    }
  };

  const loadMorePapers = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setShowMoreConfirmModal(false);

    const nextPage = currentPage + 1;
    const finalQuery = searchQuery;

    try {
      const response = await apiService.searchGoogleScholar(finalQuery, { page: nextPage });

      if (response.requiresApify) {
        setRequiresApify(true);
        setCaptchaDetected(true);
        toast.error("Direct search challenged by academic index. Connect an Apify token to bypass.");
        setShowTokenManager(true);
        return;
      }

      if (response.results.length === 0) {
        setHasMore(false);
        toast.info("No additional papers found for this query.");
        return;
      }

      // Filter out any duplicates already present
      const existingIds = new Set(searchResults.map((r) => r.id));
      const existingTitles = new Set(searchResults.map((r) => normalizeTitle(r.title)));
      const uniqueNewResults = response.results.filter(
        (r) => !existingIds.has(r.id) && !existingTitles.has(normalizeTitle(r.title))
      );

      if (uniqueNewResults.length === 0) {
        setCurrentPage(nextPage);
        setHasMore(false);
        toast.info("All available papers for this search have now been loaded.");
        return;
      }

      setSearchResults((prev) => [...prev, ...uniqueNewResults]);
      setCurrentPage(nextPage);
      setHasMore(Boolean(response.hasMore));
      setLastUsedToken(Boolean(response.usedToken));
      setSearchSource(response.searchSource || "direct");
      setSourceLabel(response.sourceLabel || "");

      if (response.usedToken) {
        toast.info(
          `Loaded ${uniqueNewResults.length} more papers via Apify Scraper Token (${response.sourceLabel}).`
        );
      } else {
        toast.success(
          `Loaded ${uniqueNewResults.length} more papers directly from academic index (0 scraper tokens used, $0.00).`
        );
      }

      apiService.getActiveTokenUsage().then((res) => {
        if (res?.tokenUsage) setTokenUsage(res.tokenUsage);
      });
    } catch (err: any) {
      console.error("Load more error:", err);
      toast.error(err.message || "Failed to load more papers. Check connection.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };

  const handleSavePublication = async (result: ScholarSearchResult) => {
    const selectedInstructorId = assignedResearcherMap[result.id];
    if (!selectedInstructorId) {
      toast.error("Please assign this publication to a registered researcher before saving to the repository.");
      return;
    }

    const assignedRes = registeredResearchers.find(
      (r) => r.instructorId === selectedInstructorId || r.id === selectedInstructorId
    );
    if (!assignedRes) {
      toast.error("Selected researcher is not registered in the system.");
      return;
    }

    if (isPublicationAlreadySaved(result.title)) {
      toast.info(`Publication already exists in repository.`);
      return;
    }

    setSavingMap((prev) => ({ ...prev, [result.id]: true }));
    try {
      const newRecord = {
        id: result.id,
        title: result.title,
        authors: result.authors,
        journal: result.journal,
        year: result.year,
        citations: result.citations,
        abstract: result.abstract,
        url: result.url,
        citedByLink: result.citedByLink,
        ownerId: assignedRes.instructorId,
        ownerName: assignedRes.name,
        source: "scraped" as const,
        approvalStatus: "approved" as const,
        researchStatus: "Published" as const,
        isPublic: true,
        createdAt: new Date().toISOString(),
      };

      const res: any = await apiService.createPublication(newRecord);
      addResearchRecord(newRecord, false);

      if (res?.isDuplicate) {
        toast.info(res.message || `Publication already exists in repository.`);
      } else {
        toast.success(`"${result.title}" assigned to ${assignedRes.name} and saved to repository!`);
      }
      await loadSavedPublications();
      window.dispatchEvent(new CustomEvent("research-records-updated"));
      window.dispatchEvent(new CustomEvent("researchers-updated"));
    } catch (err: any) {
      toast.error(err.message || "Failed to save publication to repository.");
    } finally {
      setSavingMap((prev) => ({ ...prev, [result.id]: false }));
    }
  };

  const handleClaimPublication = async (result: ScholarSearchResult) => {
    const selectedInstructorId = assignedResearcherMap[result.id];
    if (!selectedInstructorId) {
      toast.error("Please assign this publication to your researcher profile before claiming.");
      return;
    }

    const existing = getExistingPublicationRecord(result.title);
    if (existing && (existing.approval_status === "approved" || existing.approvalStatus === "approved")) {
      toast.info(`Publication is already saved in the repository (assigned to ${existing.owner_name || existing.ownerName}).`);
      return;
    }
    if (existing && (existing.approval_status === "pending" || existing.approvalStatus === "pending")) {
      toast.info(`This publication is already pending approval from the System Administrator.`);
      return;
    }

    setSavingMap((prev) => ({ ...prev, [result.id]: true }));
    try {
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
        ownerId: currentUser.instructorId || selectedInstructorId,
        ownerName: currentUser.name,
        source: "claim" as const,
        approvalStatus: "pending" as const,
        researchStatus: "Published" as const,
        isPublic: true,
        createdAt: new Date().toISOString(),
      };

      const res: any = await apiService.createPublication(claimRecord);
      addResearchRecord(claimRecord, false);

      if (res?.isDuplicate) {
        toast.info(res.message || `Publication already exists in repository.`);
      } else {
        toast.success(
          `Claim submitted! "${result.title}" assigned to ${currentUser.name} and awaiting approval from Sir Rodelio M. Garin.`
        );
      }
      setClaimedIds((ids) => [...ids, result.id]);
      await loadSavedPublications();
      window.dispatchEvent(new CustomEvent("research-records-updated"));
    } catch (err: any) {
      toast.error(err.message || "Failed to submit publication claim.");
    } finally {
      setSavingMap((prev) => ({ ...prev, [result.id]: false }));
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Search"
        description="Find research papers, citations, and authors across academic journals and university repositories to explore institutional works and discover new literature."
        actions={
          <div className="flex items-center gap-2">
            {tokenUsage ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTokenManager(true)}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                title="Apify scraper quota"
              >
                <KeyRound className="w-3.5 h-3.5 text-warning" />
                <span className="font-mono text-xs">${tokenUsage.remainingUsd.toFixed(2)} quota</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTokenManager(true)}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <KeyRound className="w-3.5 h-3.5 text-warning" />
                <span>Scraper Settings</span>
              </Button>
            )}
          </div>
        }
      />

      {/* 2. SEARCH BAR FIRST (Primary User Action) */}
      <Card className="bg-card border-border/70 shadow-2xs">
        <CardContent className="p-3.5 sm:p-5 space-y-3">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search paper title, author name, institution (e.g. Pangasinan State University), or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 sm:h-10 text-xs sm:text-sm bg-background"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search query"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="h-9 sm:h-10 px-3.5 sm:px-6 text-xs sm:text-sm font-semibold bg-brand hover:bg-brand/90 text-white shadow-2xs shrink-0"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 sm:mr-2 animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Search</span>
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 3. DYNAMIC NOTICE SLOT (One slot for all alerts) */}
      {requiresApify && searchResults.length === 0 && !isSearching && (
        <Notice
          variant="warning"
          title="Literature Search Verification Required"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTokenManager(true)}
              className="text-xs h-7 border-warning-border hover:bg-warning-soft"
            >
              Connect Apify Token
            </Button>
          }
        >
          Direct search has encountered an automated query verification challenge. Connect a free backup token ($5 free monthly credits) to activate the proxy failover shield and continue searching.
        </Notice>
      )}

      {isSearching && (
        <Notice variant="info" title="Searching Academic Literature...">
          Searching academic publications and university repositories with live ranking and relevance.
        </Notice>
      )}

      {hasSearched && !isSearching && searchResults.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground px-1 gap-2">
          <span>
            Showing <strong>{searchResults.length}</strong> academic publications for "{searchQuery}"
          </span>
          <div className="flex items-center gap-2">
            {searchSource && (
              <span className="font-medium text-foreground flex items-center gap-1.5 text-[11px] bg-muted/60 px-2.5 py-1 rounded-full border border-border/60">
                {searchSource === "direct" ? (
                  <>
                    <Zap className="w-3.5 h-3.5 text-warning" />
                    <span>Live Academic Index (0 tokens used)</span>
                  </>
                ) : searchSource === "apify" ? (
                  <>
                    <Shield className="w-3.5 h-3.5 text-brand" />
                    <span>Backup Scraper Token Failover</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Local Database Cache</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4. RESULTS SECTION */}
      {hasSearched && !isSearching && searchResults.length === 0 && !requiresApify && (
        <EmptyState
          icon={AlertCircle}
          title="No Publications Found"
          description={`No academic literature matched "${searchQuery}". Try searching with alternate keywords, author surname, or a broader topic.`}
        />
      )}

      {searchResults.length > 0 && (
        <div className="space-y-3">
          {searchResults.map((result) => {
            const isPSU = isPSUPaper(result.authors);
            const existingRecord = getExistingPublicationRecord(result.title);
            const isSaved = Boolean(
              existingRecord &&
                (existingRecord.approval_status === "approved" || existingRecord.approvalStatus === "approved")
            );
            const isClaimed = Boolean(
              (existingRecord &&
                (existingRecord.approval_status === "pending" || existingRecord.approvalStatus === "pending")) ||
                claimedIds.includes(result.id)
            );
            const assignedOwnerName =
              existingRecord?.owner_name ||
              existingRecord?.ownerName ||
              (isClaimed ? currentUser.name : "");
            const selectedResearcherId = assignedResearcherMap[result.id] || "";
            const isSavingThis = Boolean(savingMap[result.id]);

            return (
              <Card
                key={result.id}
                className="bg-card border-border/70 shadow-2xs hover:border-brand/40 transition-colors p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
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
                        </h3>

                        {result.pdfUrl && result.pdfUrl !== result.url && (
                          <a
                            href={result.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] px-2 py-0.5 rounded-md bg-destructive-soft text-destructive font-semibold hover:bg-destructive/20 transition-colors inline-flex items-center gap-1"
                            title="Direct PDF Full Text"
                          >
                            <FileText className="w-3 h-3" />
                            <span>PDF</span>
                          </a>
                        )}

                        {/* 3-Tier Geo Badge */}
                        {result.geo_tier === "psu" || isPSU ? (
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

                        {isSaved && (
                          <StatusBadge
                            status="approved"
                            label={
                              assignedOwnerName
                                ? `In Repository • Assigned to ${assignedOwnerName}`
                                : "In Repository"
                            }
                          />
                        )}
                        {!isSaved && isClaimed && (
                          <StatusBadge
                            status="pending"
                            label={`Pending Admin Approval (Sir Garin) • Assigned to ${assignedOwnerName || currentUser.name}`}
                          />
                        )}
                      </div>

                      {/* SDG Focus Track Badges */}
                      {Array.isArray(result.sdg_tags) && result.sdg_tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            SDG Focus:
                          </span>
                          {result.sdg_tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-[10px] h-5 px-2 bg-brand/10 text-brand border border-brand/20 font-medium flex items-center gap-1"
                              title={result.sdg_rationale || undefined}
                            >
                              <Tag className="w-2.5 h-2.5 text-brand" />
                              <span>{tag}</span>
                            </Badge>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Authors: <span className="text-foreground">{result.authors.join(", ")}</span>
                      </p>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                        <span>Year: {result.year}</span>
                        <span>Journal: {result.journal || "Academic Source"}</span>
                        {result.citations > 0 && (
                          <span className="text-brand font-semibold">
                            Citations: {result.citations}
                          </span>
                        )}
                      </div>

                      {result.abstract && (
                        <p className="text-xs text-muted-foreground pt-1 line-clamp-2 leading-relaxed">
                          {result.abstract}
                        </p>
                      )}
                    </div>

                    {result.citedByLink && (
                      <div className="shrink-0 self-start">
                        <a
                          href={result.citedByLink}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 px-2.5 rounded-lg border border-border/70 hover:bg-muted/50 text-xs text-muted-foreground inline-flex items-center gap-1 transition-colors"
                        >
                          <Quote className="w-3 h-3 text-brand" />
                          <span>Cited by {result.citations}</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Researcher Assignment & Save / Claim Bar */}
                  {!isSaved && !isClaimed && (
                    <div className="pt-3 mt-1 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <User className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="text-xs font-medium text-muted-foreground shrink-0">
                          Assign Researcher:
                        </span>

                        {!isInstructor ? (
                          <select
                            value={selectedResearcherId}
                            onChange={(e) =>
                              setAssignedResearcherMap((prev) => ({
                                ...prev,
                                [result.id]: e.target.value,
                              }))
                            }
                            aria-label="Assign publication to a registered researcher"
                            className="h-8 px-2.5 rounded-lg border border-border/80 bg-background text-xs text-foreground flex-1 max-w-xs focus:outline-none focus:ring-2 focus:ring-brand/40"
                          >
                            <option value="">
                              {registeredResearchers.length === 0
                                ? "-- No Registered Researchers in System --"
                                : "-- Select Registered Researcher (Required) --"}
                            </option>
                            {registeredResearchers.map((r) => (
                              <option key={r.instructorId} value={r.instructorId}>
                                {r.name} ({r.instructorId} • {r.department})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={selectedResearcherId}
                            onChange={(e) =>
                              setAssignedResearcherMap((prev) => ({
                                ...prev,
                                [result.id]: e.target.value,
                              }))
                            }
                            aria-label="Assign publication to yourself"
                            className="h-8 px-2.5 rounded-lg border border-border/80 bg-background text-xs text-foreground flex-1 max-w-xs focus:outline-none focus:ring-2 focus:ring-brand/40"
                          >
                            <option value="">-- Assign to Myself (Required) --</option>
                            <option value={currentUser.instructorId || "self"}>
                              {currentUser.name} ({currentUser.instructorId || "Researcher"}) — Assign to Myself
                            </option>
                          </select>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 justify-end">
                        {/* Save to Repository (Admin: requires assigned registered researcher) */}
                        {!isInstructor && (
                          <Button
                            size="sm"
                            disabled={!selectedResearcherId || isSavingThis}
                            onClick={() => handleSavePublication(result)}
                            title={
                              !selectedResearcherId
                                ? "You must assign this publication to a registered researcher first"
                                : "Save publication tied to the assigned researcher"
                            }
                            className="h-8 text-xs bg-success hover:bg-success/90 disabled:opacity-50 text-white gap-1.5"
                          >
                            {isSavingThis ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {selectedResearcherId
                                ? "Save to Repository"
                                : "Assign Researcher to Save"}
                            </span>
                          </Button>
                        )}

                        {/* Claim Paper (Researcher: assigns to self & requires Admin Sir Garin approval) */}
                        {isInstructor && (
                          <Button
                            size="sm"
                            disabled={!selectedResearcherId || isSavingThis}
                            onClick={() => handleClaimPublication(result)}
                            title={
                              !selectedResearcherId
                                ? "Assign this publication to yourself first before claiming"
                                : "Submit claim to Sir Rodelio M. Garin for repository approval"
                            }
                            className="h-8 text-xs bg-brand hover:bg-brand/90 disabled:opacity-50 text-white gap-1.5"
                          >
                            {isSavingThis ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Hand className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {selectedResearcherId
                                ? "Claim & Request Admin Approval"
                                : "Assign to Self to Claim"}
                            </span>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

          {/* Show More Papers Action Card */}
          {hasMore && (
            <div className="pt-2 pb-1 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-border/70 bg-card/70 shadow-2xs">
              <div className="space-y-0.5 text-center sm:text-left">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 justify-center sm:justify-start">
                  <Zap className="w-3.5 h-3.5 text-warning" />
                  Showing top {searchResults.length} papers
                </p>
                <p className="text-[11px] text-muted-foreground">
                  The academic index has more results for this query. Load 10 more papers with official ranking.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleShowMoreClick}
                disabled={isLoadingMore}
                className="h-9 px-5 text-xs font-semibold bg-brand hover:bg-brand/90 text-white shadow-2xs gap-1.5 shrink-0"
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading Next 10 Papers...</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Show More (+10 Papers)</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {!hasMore && searchResults.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-3">
              All available results for this search have been loaded ({searchResults.length} papers total).
            </p>
          )}
        </div>
      )}

      {/* Show More Scraper Token Confirmation Modal */}
      {showMoreConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowMoreConfirmModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-border/70 bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-brand-soft text-brand rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Scraper Token Usage Feedback</h3>
                  <p className="text-xs text-muted-foreground">Confirm loading next batch of academic papers</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMoreConfirmModal(false)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Target Query Details */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Search Query:</span>
                <span className="font-semibold text-foreground truncate max-w-[240px]">"{searchQuery}"</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Current Results:</span>
                <span className="font-semibold text-foreground">Top {searchResults.length} papers</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Requested Batch:</span>
                <span className="font-semibold text-brand">Papers {searchResults.length + 1} to {searchResults.length + 10}</span>
              </div>
            </div>

            {/* Token Usage Strategy Breakdown */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-warning" /> Scraper Engine & Token Status
              </span>

              {/* Free Direct Scraper Info */}
              <div className="p-3 rounded-xl border border-success/30 bg-success-soft/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-success flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Primary: Live Academic Scraper
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-success-soft text-success border-success/30 font-bold">
                    0 Tokens ($0.00)
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Queries academic literature indexes directly with live ranking. Does not consume any scraper tokens under normal operation.
                </p>
              </div>

              {/* Fallback Token Info */}
              <div className="p-3 rounded-xl border border-border/70 bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-brand" /> Fallback: Apify Scraper Token
                  </span>
                  {tokenUsage ? (
                    <Badge variant="outline" className="text-[10px] bg-brand-soft text-brand border-brand/30 font-mono">
                      ${tokenUsage.remainingUsd.toFixed(2)} Quota Available
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Not Configured
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {tokenUsage
                    ? `Only activated if the academic literature index presents an automated verification challenge. Uses token "${tokenUsage.tokenName}" (${tokenUsage.usedPercentage}% used).`
                    : "No backup token configured. If the academic index presents a verification challenge, direct search will prompt to connect a token."}
                </p>
              </div>
            </div>

            {/* Don't ask again checkbox */}
            <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skipConfirmThisSession}
                onChange={(e) => setSkipConfirmThisSession(e.target.checked)}
                className="rounded border-border text-brand focus:ring-brand w-3.5 h-3.5 cursor-pointer"
              />
              <span>Don't show this confirmation again for this session (load immediately with toast feedback)</span>
            </label>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowMoreConfirmModal(false)}
                className="h-9 px-4 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={loadMorePapers}
                disabled={isLoadingMore}
                className="h-9 px-5 text-xs font-semibold bg-brand hover:bg-brand/90 text-white shadow-2xs gap-1.5"
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Proceed & Load 10 More</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Token Manager Modal */}
      {showTokenManager && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowTokenManager(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/70 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-soft text-brand rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Scraper Token Management</h3>
                  <p className="text-xs text-muted-foreground">Manage backup scraping tokens for literature queries</p>
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
                apiService.getActiveTokenUsage().then((res) => {
                  if (res?.tokenUsage) setTokenUsage(res.tokenUsage);
                });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
