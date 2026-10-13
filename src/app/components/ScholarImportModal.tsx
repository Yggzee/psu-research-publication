import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Loader2,
  Search,
  Shield,
  UserCheck,
  Users,
  X,
  AlertCircle,
  Building,
} from "lucide-react";
import {
  apiService,
  type ScholarProfileData,
  type ScholarProfilePublication,
} from "../services/api.service";

import { type ManagedResearcher } from "../utils/researchStore";

interface ScholarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  instructorId: string;
  researcherName: string;
  initialScholarUrl?: string;
  onImportSuccess: (count: number) => void;
  researcherDetails?: Partial<ManagedResearcher>;
}

export function ScholarImportModal({
  isOpen,
  onClose,
  instructorId,
  researcherName,
  initialScholarUrl = "",
  onImportSuccess,
  researcherDetails,
}: ScholarImportModalProps) {
  const [scholarUrl, setScholarUrl] = useState(initialScholarUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ScholarProfileData | null>(null);
  const [publications, setPublications] = useState<ScholarProfilePublication[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "psu" | "collab">("all");
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [useScholarPhoto, setUseScholarPhoto] = useState(true);

  // Sync initial URL when modal opens
  useEffect(() => {
    if (isOpen) {
      setScholarUrl(initialScholarUrl || "");
      setError(null);
      setImportStatus(null);
      if (initialScholarUrl && !profile) {
        handleFetchProfile(initialScholarUrl);
      }
    }
  }, [isOpen, initialScholarUrl]);

  const handleFetchProfile = async (urlToFetch?: string) => {
    const targetUrl = (urlToFetch || scholarUrl).trim();
    if (!targetUrl) {
      setError("Please provide a valid Google Scholar profile URL or user ID.");
      return;
    }

    setLoading(true);
    setError(null);
    setImportStatus(null);

    try {
      const res = await apiService.fetchScholarProfile(targetUrl);
      if (!res.success || !res.profile) {
        throw new Error(res.error || "Failed to parse Google Scholar profile.");
      }

      setProfile(res.profile);
      setPublications(res.publications || []);
      // Pre-select all fetched publications by default (Option B)
      const allIds = new Set((res.publications || []).map((p) => p.id));
      setSelectedIds(allIds);
    } catch (err: any) {
      console.error("Fetch scholar profile error:", err);
      setError(err.message || "Failed to load profile. Please verify the URL or try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(publications.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Filtered publications
  const filteredPublications = useMemo(() => {
    return publications.filter((pub) => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        pub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pub.journal.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pub.authors.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Type filter
      if (filterType === "psu") {
        return pub.isPsuPaper;
      }
      if (filterType === "collab") {
        return pub.hasCollaborators;
      }
      return true;
    });
  }, [publications, searchQuery, filterType]);

  const psuPapersCount = publications.filter((p) => p.isPsuPaper).length;
  const collabPapersCount = publications.filter((p) => p.hasCollaborators).length;

  const handleImport = async () => {
    if (!profile || selectedIds.size === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      const selectedPubs = publications.filter((p) => selectedIds.has(p.id));

      const res = await apiService.importScholarPublications({
        instructorId,
        researcherName,
        scholarUrl: profile.scholarUrl,
        scholarId: profile.userId,
        photoUrl: useScholarPhoto && profile.photoUrl ? profile.photoUrl : researcherDetails?.photoUrl,
        publications: selectedPubs,
        firstName: researcherDetails?.firstName,
        lastName: researcherDetails?.lastName,
        department: researcherDetails?.department,
        password: researcherDetails?.password,
        email: researcherDetails?.email,
        isFaculty: researcherDetails?.isFaculty,
      });

      if (!res.success) {
        throw new Error(res.message || "Failed to save publications.");
      }

      setImportStatus(res.message);
      onImportSuccess(res.importedCount);

      // Auto close after brief success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Import publications error:", err);
      setError(err.message || "Failed to save publications to database.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            <DialogTitle className="text-xl">Import from Google Scholar</DialogTitle>
          </div>
          <DialogDescription>
            Fetch and review verified publications for{" "}
            <span className="font-semibold text-gray-900">{researcherName}</span> (ID:{" "}
            {instructorId}). Select publications to permanently record in SQLite.
          </DialogDescription>
        </DialogHeader>

        {/* URL Input & Fetch Row */}
        <div className="space-y-3 pt-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={scholarUrl}
                onChange={(e) => setScholarUrl(e.target.value)}
                placeholder="Paste Google Scholar Profile URL (e.g. https://scholar.google.com/citations?user=...)"
                className="pr-10"
                disabled={loading || isImporting}
              />
              {scholarUrl && (
                <button
                  type="button"
                  onClick={() => setScholarUrl("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              type="button"
              onClick={() => handleFetchProfile()}
              disabled={loading || isImporting || !scholarUrl.trim()}
              className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Fetch Profile
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {importStatus && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span>{importStatus}</span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-12 px-4 text-center space-y-4">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-blue-800 animate-ping opacity-25" />
              <div className="w-14 h-14 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
              <BookOpen className="w-6 h-6 text-blue-600 absolute" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-base text-foreground">Scraping Google Scholar Profile...</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Extracting researcher profile, indexed papers, co-authors, and verified citation counts. This may take 5–15 seconds.
              </p>
            </div>
          </div>
        )}

        {/* Profile Card & Publications List */}
        {!loading && profile && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 mt-2">
            {/* Researcher Profile Summary Card */}
            <div className="p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-slate-900/40 border border-blue-200 dark:border-blue-900/50 rounded-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {profile.photoUrl ? (
                    <img
                      src={profile.photoUrl}
                      alt={profile.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-bold text-xl flex items-center justify-center shadow-sm">
                      {profile.name.charAt(0)}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{profile.name}</h3>
                      {profile.isPsuAffiliated ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                          <Shield className="w-3 h-3 mr-1" /> PSU Affiliated
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-950/40">
                          External / Non-PSU
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      {profile.affiliation || "Academic Researcher"}
                    </p>
                    {profile.verifiedEmail && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{profile.verifiedEmail}</p>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-4 bg-white/80 dark:bg-card/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-blue-100 dark:border-gray-800 shadow-2xs">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Citations</p>
                    <p className="text-base font-bold text-blue-600 dark:text-blue-400">
                      {profile.totalCitations.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">h-index</p>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100">{profile.hIndex}</p>
                  </div>
                  <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">i10-index</p>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100">{profile.i10Index}</p>
                  </div>
                </div>
              </div>

              {profile.photoUrl && (
                <div className="mt-3 pt-3 border-t border-blue-100 dark:border-gray-800 flex items-center gap-2">
                  <Checkbox
                    id="use-photo"
                    checked={useScholarPhoto}
                    onCheckedChange={(c) => setUseScholarPhoto(Boolean(c))}
                  />
                  <label htmlFor="use-photo" className="text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                    Apply Google Scholar profile photo as researcher's account avatar
                  </label>
                </div>
              )}
            </div>

            {/* Filter Bar & Selection Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={selectAll}
                  className="text-xs h-8"
                >
                  <Check className="w-3 h-3 mr-1" /> Select All ({publications.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={deselectAll}
                  className="text-xs h-8 text-gray-500"
                >
                  Deselect None
                </Button>

                <span className="text-xs font-medium text-gray-600 pl-2">
                  {selectedIds.size} of {publications.length} selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search papers..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterType("all")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterType === "all" ? "bg-white font-medium shadow-2xs text-gray-900" : "text-gray-500"
                    }`}
                  >
                    All ({publications.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("psu")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterType === "psu" ? "bg-white font-medium shadow-2xs text-blue-700" : "text-gray-500"
                    }`}
                  >
                    PSU ({psuPapersCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("collab")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterType === "collab" ? "bg-white font-medium shadow-2xs text-amber-700" : "text-gray-500"
                    }`}
                  >
                    Collaborative ({collabPapersCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Publication Cards List */}
            <div className="space-y-2.5">
              {filteredPublications.map((pub) => {
                const isSelected = selectedIds.has(pub.id);

                return (
                  <div
                    key={pub.id}
                    onClick={() => toggleSelect(pub.id)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-300 bg-blue-50/30 shadow-2xs"
                        : "border-gray-200 bg-white hover:border-gray-300 opacity-80"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(pub.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-gray-900 leading-snug">
                            {pub.title}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {pub.citations > 0 && (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                {pub.citations} cited
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {pub.year}
                            </Badge>
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-1 italic">{pub.journal}</p>

                        {/* Authors Breakdown with PSU / Non-PSU Pills */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          <span className="text-[11px] text-gray-400 mr-1 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Authors:
                          </span>
                          {pub.authorDetails && pub.authorDetails.length > 0 ? (
                            pub.authorDetails.map((author, aIdx) => (
                              <span
                                key={aIdx}
                                className={`text-[11px] px-2 py-0.5 rounded-md font-medium flex items-center gap-1 ${
                                  author.isPsu
                                    ? "bg-emerald-100/80 text-emerald-800 border border-emerald-200"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                                title={
                                  author.isPsu
                                    ? "PSU Faculty Member"
                                    : "External / Non-PSU Collaborator"
                                }
                              >
                                {author.isPsu ? (
                                  <UserCheck className="w-2.5 h-2.5 text-emerald-600" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                )}
                                {author.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-600">{pub.authors.join(", ")}</span>
                          )}

                          {pub.url && (
                            <a
                              href={pub.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-blue-600 hover:text-blue-800 ml-auto flex items-center gap-0.5"
                            >
                              View on Scholar <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredPublications.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  <p className="text-sm">No publications match your filter query.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 border-t border-gray-100 flex flex-row items-center justify-between sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isImporting}>
            Cancel
          </Button>

          {profile && (
            <Button
              onClick={handleImport}
              disabled={isImporting || selectedIds.size === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving to Database...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save {selectedIds.size} Publication(s) to Database
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
