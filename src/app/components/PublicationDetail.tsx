import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { apiService } from "../services/api.service";
import { getResearchRecords } from "../utils/researchStore";
import { findAuthorFacultyProfile } from "../utils/facultyUtils";
import { exportSinglePublicationToExcel } from "../utils/excelExportUtils";
import {
  ArrowLeft,
  BookOpen,
  Users,
  Calendar,
  Quote,
  Award,
  ExternalLink,
  Share2,
  TrendingUp,
  UserCheck,
  User,
  Loader2,
  FileSpreadsheet,
  RefreshCw,
  Target,
  Sparkles,
  Copy,
  Check,
  Edit3,
  Save,
  X,
  Search,
  Globe,
  Hash,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

function parseAuthorsList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((a) => String(a || "").trim()).filter(Boolean);
  }
  const str = String(raw).trim();
  if (!str) return [];
  if (str.startsWith("[")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map((a) => String(a || "").trim()).filter(Boolean);
      }
    } catch {
      // fall through
    }
  }
  return str
    .split(/,|;|\band\b/i)
    .map((a) => a.trim())
    .filter(Boolean);
}

export function PublicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [publication, setPublication] = useState<any | null>(null);
  const [researchers, setResearchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [citingSearch, setCitingSearch] = useState("");
  const [citingPage, setCitingPage] = useState(1);
  const CITATIONS_PER_PAGE = 10;

  type CiteSortColumn = "index" | "authors" | "title" | "journal" | "vol" | "year" | "quarter";
  type CiteSortDirection = "asc" | "desc";
  const [citeSortColumn, setCiteSortColumn] = useState<CiteSortColumn>("year");
  const [citeSortDirection, setCiteSortDirection] = useState<CiteSortDirection>("desc");

  const handleCiteSort = (col: CiteSortColumn) => {
    if (citeSortColumn === col) {
      setCiteSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setCiteSortColumn(col);
      setCiteSortDirection(col === "year" ? "desc" : "asc");
    }
    setCitingPage(1);
  };

  // Inline Edit Mode for Excel Metadata fields
  const [isEditingExcel, setIsEditingExcel] = useState(false);
  const [savingExcel, setSavingExcel] = useState(false);
  const [editForm, setEditForm] = useState({
    journal: "",
    publication_date: "",
    volume_issue: "",
    issn_isbn: "",
    journal_indexing: "",
    keywords: "",
    publication_level: "International",
    url: "",
  });

  const loadData = async (isRefresh = false) => {
    if (!id) return;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const decodedId = decodeURIComponent(id);
      const [resData, pubData] = await Promise.all([
        apiService.getResearchers().catch(() => []),
        apiService.getPublicationById(decodedId, isRefresh).catch(() => null),
      ]);

      setResearchers(resData || []);

      if (pubData) {
        setPublication(pubData);
        setEditForm({
          journal: pubData.journal || "",
          publication_date: pubData.publication_date || pubData.publicationDate || String(pubData.year || ""),
          volume_issue: pubData.volume_issue || pubData.volumeIssue || "",
          issn_isbn: pubData.issn_isbn || pubData.issnIsbn || pubData.doi || "",
          journal_indexing: pubData.journal_indexing || pubData.journalIndexing || "Google Scholar",
          keywords: pubData.keywords || "",
          publication_level: pubData.publication_level || pubData.publicationLevel || "International",
          url: pubData.url || "",
        });
        if (isRefresh) {
          toast.success("Publication metadata & citations refreshed!");
        }
      } else {
        const fallback = getResearchRecords().find((p: any) => p.id === decodedId);
        setPublication(fallback || null);
      }
    } catch (err) {
      console.error("Failed to load publication details:", err);
      const decodedId = id ? decodeURIComponent(id) : "";
      const fallback = getResearchRecords().find((p: any) => p.id === decodedId);
      setPublication(fallback || null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setCitingPage(1);
    loadData(false);
  }, [id]);

  const handleSaveExcelFields = async () => {
    if (!publication?.id) return;
    setSavingExcel(true);
    try {
      await apiService.updatePublication(publication.id, editForm);
      setPublication((prev: any) => ({
        ...prev,
        ...editForm,
      }));
      setIsEditingExcel(false);
      toast.success("Excel publication metadata saved!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update publication metadata");
    } finally {
      setSavingExcel(false);
    }
  };

  const handleReclassifySDG = async () => {
    if (!publication) return;
    setIsClassifying(true);
    toast.loading("Analyzing paper with AI SDG Classifier...", { id: "reclassify-detail" });
    try {
      const res = await apiService.classifyPublicationSDG({
        publicationId: publication.id,
        title: publication.title,
        abstract: publication.abstract,
        journal: publication.journal,
      });

      if (res?.success) {
        toast.success("SDG Check updated via AI Evaluation!", { id: "reclassify-detail" });
        setPublication((prev: any) => ({
          ...prev,
          sdg_tags: [res.sdg.primarySDG, res.sdg.secondarySDG].filter(Boolean),
          sdg_rationale: res.sdg.rationale,
          ched_priority: res.sdg.chedPriority,
          journal_indexing: res.audit?.indexing || prev.journal_indexing,
        }));
      }
    } catch (err: any) {
      toast.error(`Classification error: ${err.message}`, { id: "reclassify-detail" });
    } finally {
      setIsClassifying(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        <p className="text-gray-500 text-sm">
          Loading full publication record, CrossRef metadata, and citing papers...
        </p>
      </div>
    );
  }

  if (!publication) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Publication not found</p>
        <Button onClick={() => navigate("/dashboard/publications")} className="mt-4">
          Back to Publications
        </Button>
      </div>
    );
  }

  const authorsList = parseAuthorsList(publication.authors);
  const authorsString = authorsList.join(", ");
  const assignedResearcherName = publication.owner_name || publication.ownerName;
  const assignedResearcherId = publication.owner_id || publication.ownerId;

  const citationTrendData = Array.isArray(publication.citationTrend)
    ? publication.citationTrend
    : [];
  const citingPapers: any[] = Array.isArray(publication.citingPapers)
    ? publication.citingPapers
    : [];
  const yearsActive = Math.max(1, new Date().getFullYear() - (Number(publication.year) || new Date().getFullYear()) + 1);

  // Format SDGs
  const rawSdgTags = publication.sdg_tags || publication.sdgTags;
  const sdgList: string[] = Array.isArray(rawSdgTags)
    ? rawSdgTags
    : typeof rawSdgTags === "string"
    ? (() => {
        try {
          const parsed = JSON.parse(rawSdgTags);
          return Array.isArray(parsed) ? parsed : [rawSdgTags];
        } catch {
          return [rawSdgTags];
        }
      })()
    : ["SDG 4: Quality Education"];

  const rawRationale = publication.sdg_rationale || publication.sdgRationale;
  let rationalesMap: Record<string, string> | null = null;
  if (rawRationale) {
    try {
      const parsed = JSON.parse(rawRationale);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        rationalesMap = parsed;
      }
    } catch {
      // ignore
    }
  }

  const getRationaleForSDG = (sdgName: string) => {
    if (!rationalesMap) return null;
    const extractNum = (str: string) => {
      const m = str.match(/\bSDG\s*(\d{1,2})\b/i);
      return m ? parseInt(m[1], 10) : null;
    };
    const targetNum = extractNum(sdgName);
    for (const [k, v] of Object.entries(rationalesMap)) {
      if (k === sdgName || k.toLowerCase() === sdgName.toLowerCase()) return v;
      const kNum = extractNum(k);
      if (targetNum !== null && kNum !== null && targetNum === kNum) return v;
    }
    return null;
  };

  // Excel field values
  const pubDateStr =
    publication.publication_date ||
    publication.publicationDate ||
    String(publication.year || "—");
  const volIssueStr = publication.volume_issue || publication.volumeIssue || "—";
  const issnDoiStr =
    publication.issn_isbn || publication.issnIsbn || publication.doi || "—";
  const indexingStr =
    publication.journal_indexing || publication.journalIndexing || "Google Scholar";
  const levelStr =
    publication.publication_level || publication.publicationLevel || "International";
  const keywordsStr =
    publication.keywords ||
    (sdgList.length > 0 ? sdgList.join("; ") : "—");
  const citedByUrl = publication.citedByLink || publication.cited_by_link;

  // Citations formatters
  const apaCitation = `${authorsString} (${publication.year}). ${publication.title}. ${
    publication.journal || "Pangasinan State University Research Archive"
  }.`;
  const bibtexCitation = `@article{psu_${publication.id || "paper"},
  title = {${publication.title}},
  author = {${authorsList.join(" and ")}},
  journal = {${publication.journal || "PSU Asingan Research Archive"}},
  year = {${publication.year}},
  publisher = {Pangasinan State University}
}`;

  const copyToClipboard = (text: string, format: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    toast.success(`Copied ${format} citation to clipboard!`);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: publication.title,
        text: `Check out this publication: ${publication.title}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Page link copied to clipboard!");
    }
  };

  const handleExportSingleExcel = () => {
    try {
      exportSinglePublicationToExcel(publication);
      toast.success("Exported official 2-Sheet Excel report (Publication Sheet + Citation Sheet)!");
    } catch (err: any) {
      toast.error(`Excel export failed: ${err?.message || "Unknown error"}`);
    }
  };

  const filteredCitingPapers = useMemo(() => {
    const list = citingPapers.filter((cp) => {
      if (!citingSearch.trim()) return true;
      const q = citingSearch.toLowerCase();
      const cTitle = String(cp.title || "").toLowerCase();
      const cAuthors = Array.isArray(cp.authors)
        ? cp.authors.join(", ").toLowerCase()
        : String(cp.authors || "").toLowerCase();
      const cJournal = String(cp.journal || "").toLowerCase();
      return cTitle.includes(q) || cAuthors.includes(q) || cJournal.includes(q);
    });

    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (citeSortColumn) {
        case "year": {
          const aYr = Number(a.year) || 0;
          const bYr = Number(b.year) || 0;
          comparison = aYr - bYr;
          break;
        }
        case "title": {
          comparison = String(a.title || "").localeCompare(String(b.title || ""));
          break;
        }
        case "authors": {
          const aAuth = Array.isArray(a.authors) ? a.authors.join(", ") : String(a.authors || "");
          const bAuth = Array.isArray(b.authors) ? b.authors.join(", ") : String(b.authors || "");
          comparison = aAuth.localeCompare(bAuth);
          break;
        }
        case "journal": {
          comparison = String(a.journal || "").localeCompare(String(b.journal || ""));
          break;
        }
        case "vol": {
          comparison = String(a.volume_issue || "").localeCompare(String(b.volume_issue || ""));
          break;
        }
        case "quarter": {
          comparison = String(a.quarter || "").localeCompare(String(b.quarter || ""));
          break;
        }
        case "index":
        default:
          return 0;
      }
      return citeSortDirection === "asc" ? comparison : -comparison;
    });
  }, [citingPapers, citingSearch, citeSortColumn, citeSortDirection]);

  const totalFilteredCitations = filteredCitingPapers.length;
  const totalCitingPages = Math.max(
    1,
    Math.ceil(totalFilteredCitations / CITATIONS_PER_PAGE)
  );
  const safeCitingPage = Math.min(citingPage, totalCitingPages);
  const startCiteIndex = (safeCitingPage - 1) * CITATIONS_PER_PAGE;
  const paginatedCitingPapers = filteredCitingPapers.slice(
    startCiteIndex,
    startCiteIndex + CITATIONS_PER_PAGE
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar: Navigation & Export / Enrich Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() =>
            window.history.length > 1
              ? navigate(-1)
              : navigate("/dashboard/publications")
          }
          className="w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Publications
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Enriching Metadata & Citations..." : "Refresh & Enrich Data"}
          </Button>

          <Button
            size="sm"
            onClick={handleExportSingleExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Paper Excel (.xlsx)
          </Button>
        </div>
      </div>

      {/* Main Publication Header Card */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1 space-y-4">
              {/* Top Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">
                  {publication.year}
                </Badge>
                <Badge className="bg-emerald-600 text-white text-xs">
                  {publication.citations || 0} Total Citations
                </Badge>
                <Badge variant="secondary" className="text-xs font-mono">
                  {indexingStr}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                >
                  <Globe className="w-3 h-3 mr-1" />
                  {levelStr}
                </Badge>
                {assignedResearcherName && (
                  <Badge
                    variant="outline"
                    className="text-xs border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                  >
                    <User className="w-3 h-3 mr-1" />
                    Assigned: {assignedResearcherName}
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-snug">
                {publication.title}
              </h1>

              {/* Authors Section (Lead Researcher & Co-Researchers) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>
                    Authors — Lead Researcher & Co-Researchers ({authorsList.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {authorsList.map((authorName: string, index: number) => {
                    const matchedFaculty = findAuthorFacultyProfile(
                      authorName,
                      researchers
                    );
                    const isLead = index === 0;

                    if (matchedFaculty) {
                      return (
                        <Link
                          key={index}
                          to={`/dashboard/faculty/${matchedFaculty.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors text-xs font-medium"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{authorName}</span>
                          <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 ml-0.5">
                            {isLead ? "Lead • PSU" : "Co-Author • PSU"}
                          </Badge>
                        </Link>
                      );
                    }

                    return (
                      <div
                        key={index}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border border-border text-foreground text-xs"
                      >
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{authorName}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 ml-0.5 text-muted-foreground"
                        >
                          {isLead ? "Lead Researcher" : "Co-Researcher"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Quick Action Buttons */}
            <div className="flex flex-row lg:flex-col gap-2 shrink-0 flex-wrap">
              {publication.url && (
                <Button
                  variant="default"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                  onClick={() => window.open(publication.url, "_blank")}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Link of Evidence
                </Button>
              )}
              {citedByUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => window.open(citedByUrl, "_blank")}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Indexed Citations
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={handleShare}
              >
                <Share2 className="w-3.5 h-3.5" />
                Share Paper
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 1: OFFICIAL EXCEL PUBLICATION SHEET DATA */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="bg-blue-950/5 dark:bg-blue-950/20 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-base font-bold">
                Official Excel Report Data — Publication Sheet & Citation Columns 1–8
              </CardTitle>
            </div>
            <CardDescription className="text-xs mt-0.5">
              Complete bibliographic and indexing fields used when generating the researcher's official PSU RDO Excel workbook
            </CardDescription>
          </div>
          {!isEditingExcel ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingExcel(true)}
              className="text-xs h-8 gap-1.5 shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Excel Fields
            </Button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingExcel(false)}
                disabled={savingExcel}
                className="text-xs h-8 gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveExcelFields}
                disabled={savingExcel}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5"
              >
                {savingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-6">
          {!isEditingExcel ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 md:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  1. Article / Title of Research Output
                </span>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {publication.title}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 md:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  2. Author(s) (Lead Researcher & Co-Researchers)
                </span>
                <p className="text-sm font-medium text-foreground leading-snug">
                  {authorsString || "—"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  3. Date of Publication
                </span>
                <p className="text-sm font-mono font-semibold text-foreground">
                  {pubDateStr}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  4. Title of Journal or Publication
                </span>
                <p className="text-sm font-medium text-foreground">
                  {publication.journal || "—"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  5. Vol. No. & Issue No.
                </span>
                <p className="text-sm font-mono font-medium text-foreground">
                  {volIssueStr}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  6. ISSN / ISBN / DOI
                </span>
                <p className="text-sm font-mono font-medium text-foreground break-all">
                  {issnDoiStr}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  7. Index (Scopus / WoS / Google Scholar)
                </span>
                <Badge className="bg-emerald-600 text-white text-xs font-mono mt-0.5">
                  {indexingStr}
                </Badge>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  8. Level (International / National)
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {levelStr}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  9. Keywords
                </span>
                <p className="text-xs font-medium text-foreground leading-relaxed">
                  {keywordsStr}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  10. Link of Evidence
                </span>
                {publication.url ? (
                  <a
                    href={publication.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline break-all inline-flex items-center gap-1"
                  >
                    <span>{publication.url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Title of Journal or Publication
                </label>
                <Input
                  value={editForm.journal}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, journal: e.target.value }))
                  }
                  placeholder="e.g., Asian Journal of Multidisciplinary Studies"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Date of Publication
                </label>
                <Input
                  value={editForm.publication_date}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      publication_date: e.target.value,
                    }))
                  }
                  placeholder="e.g., October 2020 or 2020"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Vol. No. & Issue No.
                </label>
                <Input
                  value={editForm.volume_issue}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      volume_issue: e.target.value,
                    }))
                  }
                  placeholder="e.g., Vol. 3, No. 2, pp. 42-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  ISSN / ISBN / DOI
                </label>
                <Input
                  value={editForm.issn_isbn}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, issn_isbn: e.target.value }))
                  }
                  placeholder="e.g., 2651-6691 or 10.1109/..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Index (Scopus / WoS / Google Scholar)
                </label>
                <Input
                  value={editForm.journal_indexing}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      journal_indexing: e.target.value,
                    }))
                  }
                  placeholder="e.g., Google Scholar, Scopus"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Level (International / National)
                </label>
                <select
                  value={editForm.publication_level}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      publication_level: e.target.value,
                    }))
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="International">International</option>
                  <option value="National">National</option>
                  <option value="Regional">Regional</option>
                  <option value="Institutional">Institutional</option>
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-foreground">
                  Keywords (semicolon or comma separated)
                </label>
                <Input
                  value={editForm.keywords}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, keywords: e.target.value }))
                  }
                  placeholder="e.g., Contextualized teaching; Basic statistics; Education"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Link of Evidence (URL)
                </label>
                <Input
                  value={editForm.url}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: COMPLETE CITATION SHEET TABLE (ALL CITING PAPERS & CO-AUTHORS) */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="bg-teal-950/5 dark:bg-teal-950/20 border-b border-border/60 py-3 px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Quote className="w-4 h-4 text-teal-600" />
                <CardTitle className="text-sm font-bold flex items-center gap-2 flex-wrap">
                  <span>Official Citation Sheet — Papers Citing This Research ({citingPapers.length} Recorded / {publication.citations || 0} Total)</span>
                  {citingPapers.length < (publication.citations || 0) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                      onClick={() => loadData(true)}
                      disabled={refreshing}
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                      Sync Remaining Citations ({publication.citations - citingPapers.length} pending)
                    </Button>
                  )}
                </CardTitle>
              </div>
              <CardDescription className="text-[11px] mt-0.5">
                Lists every citing article along with all citing authors (lead researcher and co-researchers), journal title, volume/issue/page, year published, quarter, and evidence link
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {citingPapers.length > 0 && (
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    value={citingSearch}
                    onChange={(e) => {
                      setCitingSearch(e.target.value);
                      setCitingPage(1);
                    }}
                    placeholder="Filter citing authors or titles..."
                    className="pl-8 h-7 text-xs"
                  />
                </div>
              )}
              {citedByUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7 px-2.5 gap-1.5 shrink-0"
                  onClick={() => window.open(citedByUrl, "_blank")}
                >
                  <ExternalLink className="w-3 h-3" />
                  Cited-By Source
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredCitingPapers.length > 0 ? (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-teal-900/90 text-white uppercase tracking-wider text-[9px] font-bold">
                    <tr>
                      <th className="py-2 px-2 w-10 text-center border-r border-teal-800">#</th>
                      <th
                        className="py-2 px-2.5 min-w-[210px] max-w-[280px] border-r border-teal-800 cursor-pointer select-none hover:bg-teal-800/60 transition-colors"
                        onClick={() => handleCiteSort("authors")}
                        title="Click to sort by Citing Authors"
                      >
                        <div className="flex items-center justify-between">
                          <span>Author(s) Who Cited the Research Output</span>
                          <span className="text-[10px] ml-1 font-mono text-teal-300">
                            {citeSortColumn === "authors" ? (citeSortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                        <span className="block text-[8px] font-normal text-teal-200 normal-case">
                          Lead Researcher & All Co-Researchers
                        </span>
                      </th>
                      <th
                        className="py-2 px-2.5 min-w-[240px] border-r border-teal-800 cursor-pointer select-none hover:bg-teal-800/60 transition-colors"
                        onClick={() => handleCiteSort("title")}
                        title="Click to sort by Article Title"
                      >
                        <div className="flex items-center justify-between">
                          <span>Title of Article Where the Research Output Was Cited</span>
                          <span className="text-[10px] ml-1 font-mono text-teal-300">
                            {citeSortColumn === "title" ? (citeSortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th
                        className="py-2 px-2.5 min-w-[150px] border-r border-teal-800 cursor-pointer select-none hover:bg-teal-800/60 transition-colors"
                        onClick={() => handleCiteSort("journal")}
                        title="Click to sort by Journal Title"
                      >
                        <div className="flex items-center justify-between">
                          <span>Title of Journal</span>
                          <span className="text-[10px] ml-1 font-mono text-teal-300">
                            {citeSortColumn === "journal" ? (citeSortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th
                        className="py-2 px-2 min-w-[100px] text-center border-r border-teal-800 cursor-pointer select-none hover:bg-teal-800/60 transition-colors"
                        onClick={() => handleCiteSort("vol")}
                        title="Click to sort by Volume / Issue / Page"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Vol. / Issue / Page</span>
                          <span className="text-[10px] font-mono text-teal-300">
                            {citeSortColumn === "vol" ? (citeSortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th
                        className="py-2 px-2 w-20 text-center border-r border-teal-800 cursor-pointer select-none hover:bg-teal-800/60 transition-colors"
                        onClick={() => handleCiteSort("year")}
                        title="Click to sort by Year"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Year</span>
                          <span className="text-[10px] font-mono text-teal-300">
                            {citeSortColumn === "year" ? (citeSortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th
                        className="py-2 px-2 w-20 text-center border-r border-teal-800 cursor-pointer select-none hover:bg-teal-800/60 transition-colors"
                        onClick={() => handleCiteSort("quarter")}
                        title="Click to sort by Quarter"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Quarter</span>
                          <span className="text-[10px] font-mono text-teal-300">
                            {citeSortColumn === "quarter" ? (citeSortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th className="py-2 px-2 w-24 text-center">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {paginatedCitingPapers.map((citingPaper: any, idx: number) => {
                      const globalIndex = startCiteIndex + idx + 1;
                      const citingAuthors = parseAuthorsList(citingPaper.authors);
                      const citingJournal =
                        citingPaper.journal || "Academic Publication";
                      const citingVolIssue = citingPaper.volume_issue || "—";
                      const citingYear = citingPaper.year
                        ? String(citingPaper.year)
                        : "—";
                      const citingQuarter = citingPaper.quarter || "First";

                      return (
                        <tr
                          key={citingPaper.id || globalIndex}
                          className="hover:bg-muted/30 transition-colors align-middle"
                        >
                          <td className="py-1.5 px-2 text-center font-mono text-[11px] font-bold text-muted-foreground border-r border-border/50">
                            {globalIndex}
                          </td>
                          <td
                            className="py-1.5 px-2.5 border-r border-border/50 max-w-[280px]"
                            title={citingAuthors.join(", ")}
                          >
                            {citingAuthors.length > 0 ? (
                              <div className="leading-snug text-[11px]">
                                <span className="inline-flex items-center px-1 py-0.2 mr-1 rounded text-[9px] font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                                  Lead: {citingAuthors[0]}
                                </span>
                                {citingAuthors.length > 1 && (
                                  <span className="text-foreground/90 font-medium">
                                    , {citingAuthors.slice(1).join(", ")}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[10px]">
                                Author metadata pending
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 font-semibold text-foreground leading-snug border-r border-border/50">
                            <span className="line-clamp-2" title={citingPaper.title}>
                              {citingPaper.title}
                            </span>
                            {citingPaper.doi_issn && (
                              <span className="block text-[9px] font-mono font-normal text-muted-foreground mt-0.5 truncate">
                                {citingPaper.doi_issn}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 text-foreground/90 font-medium border-r border-border/50">
                            <span className="line-clamp-2" title={citingJournal}>
                              {citingJournal}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono text-[10px] text-muted-foreground border-r border-border/50">
                            {citingVolIssue}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono font-semibold text-foreground border-r border-border/50">
                            {citingYear}
                          </td>
                          <td className="py-1.5 px-2 text-center font-medium text-muted-foreground border-r border-border/50">
                            {citingQuarter}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {citingPaper.link ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => window.open(citingPaper.link, "_blank")}
                              >
                                <span>View</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls (10 per page) */}
              {totalFilteredCitations > CITATIONS_PER_PAGE && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-muted/20 border-t border-border/60 text-xs">
                  <div className="text-[11px] text-muted-foreground">
                    Showing{" "}
                    <span className="font-semibold text-foreground">
                      {startCiteIndex + 1}
                    </span>
                    –
                    <span className="font-semibold text-foreground">
                      {Math.min(
                        startCiteIndex + CITATIONS_PER_PAGE,
                        totalFilteredCitations
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-foreground">
                      {totalFilteredCitations}
                    </span>{" "}
                    citations (Page {safeCitingPage} of {totalCitingPages})
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] gap-1"
                      disabled={safeCitingPage <= 1}
                      onClick={() =>
                        setCitingPage((p) => Math.max(1, p - 1))
                      }
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Prev
                    </Button>

                    {(() => {
                      const pages: (number | string)[] = [];
                      if (totalCitingPages <= 7) {
                        for (let i = 1; i <= totalCitingPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        if (safeCitingPage > 3) pages.push("...");
                        const start = Math.max(2, safeCitingPage - 1);
                        const end = Math.min(
                          totalCitingPages - 1,
                          safeCitingPage + 1
                        );
                        for (let i = start; i <= end; i++) pages.push(i);
                        if (safeCitingPage < totalCitingPages - 2)
                          pages.push("...");
                        pages.push(totalCitingPages);
                      }

                      return pages.map((pageItem, pIdx) =>
                        pageItem === "..." ? (
                          <span
                            key={`ellipsis-${pIdx}`}
                            className="px-1.5 text-[11px] text-muted-foreground"
                          >
                            …
                          </span>
                        ) : (
                          <Button
                            key={pageItem}
                            variant={
                              safeCitingPage === pageItem ? "default" : "outline"
                            }
                            size="sm"
                            className={`h-7 min-w-[28px] px-2 text-[11px] font-mono ${
                              safeCitingPage === pageItem
                                ? "bg-teal-700 hover:bg-teal-800 text-white"
                                : ""
                            }`}
                            onClick={() => setCitingPage(Number(pageItem))}
                          >
                            {pageItem}
                          </Button>
                        )
                      );
                    })()}

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] gap-1"
                      disabled={safeCitingPage >= totalCitingPages}
                      onClick={() =>
                        setCitingPage((p) =>
                          Math.min(totalCitingPages, p + 1)
                        )
                      }
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>

                    {totalCitingPages > 7 && (
                      <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border/60">
                        <span className="text-[10px] text-muted-foreground">
                          Go to:
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={totalCitingPages}
                          defaultValue={safeCitingPage}
                          key={safeCitingPage}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = parseInt(
                                (e.target as HTMLInputElement).value,
                                10
                              );
                              if (!Number.isNaN(val)) {
                                setCitingPage(
                                  Math.max(1, Math.min(totalCitingPages, val))
                                );
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!Number.isNaN(val)) {
                              setCitingPage(
                                Math.max(1, Math.min(totalCitingPages, val))
                              );
                            }
                          }}
                          className="h-7 w-14 rounded border border-input bg-background px-1.5 text-center font-mono text-[11px]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-10 text-center space-y-3">
              <Quote className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {publication.citations > 0
                    ? `This publication has ${publication.citations} recorded citation(s).`
                    : "No citing papers recorded yet for this publication."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {publication.citations > 0
                    ? 'Click "Refresh & Enrich Data" above or view external source to inspect citing articles.'
                    : "When external researchers cite this paper in indexed journals, their full author list and article details will appear here automatically."}
                </p>
              </div>
              {citedByUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(citedByUrl, "_blank")}
                  className="mt-2 gap-1.5 text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View External Citing Papers
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 3: ABSTRACT & SDG CHECK SIDE-BY-SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Abstract & Instant Citation Formats */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              Abstract & Citation Formats
            </CardTitle>
            <CardDescription className="text-xs">
              Full abstract and standardized reference strings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-sm text-foreground/90 leading-relaxed">
              {publication.abstract ||
                "No abstract on file for this publication. Stored in institutional registry."}
            </div>

            <div className="space-y-2.5 pt-2 border-t border-border/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Quote className="w-3.5 h-3.5" />
                Copy Standardized Citation
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(apaCitation, "APA 7th")}
                  className="justify-start gap-2 h-9 text-xs"
                >
                  {copiedFormat === "APA 7th" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copy APA 7th Format
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(bibtexCitation, "BibTeX")}
                  className="justify-start gap-2 h-9 text-xs font-mono"
                >
                  {copiedFormat === "BibTeX" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copy BibTeX Entry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* UN SDG Check */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" />
                <CardTitle className="text-base font-bold">
                  UN SDG Check & CHED Alignment
                </CardTitle>
              </div>
              <CardDescription className="text-xs mt-0.5">
                AI Sustainable Development Goals evaluation
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReclassifySDG}
              disabled={isClassifying}
              className="text-xs h-8 gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              {isClassifying ? "Analyzing..." : "Re-evaluate AI"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {sdgList.map((sdg, idx) => {
                const tailoredWhy = getRationaleForSDG(sdg);
                return (
                  <div
                    key={sdg}
                    className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                          idx === 0 ? "bg-emerald-600" : "bg-blue-600"
                        }`}
                      >
                        {idx === 0 ? "Primary SDG" : "Secondary SDG"}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {sdg}
                      </span>
                    </div>
                    {tailoredWhy ? (
                      <p className="text-xs text-muted-foreground leading-relaxed italic">
                        "{tailoredWhy}"
                      </p>
                    ) : (
                      rawRationale &&
                      !rawRationale.startsWith("{") &&
                      idx === 0 && (
                        <p className="text-xs text-muted-foreground leading-relaxed italic">
                          "{rawRationale}"
                        </p>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-border/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Philippine CHED / DOST Priority Area
              </span>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-800 dark:text-blue-300">
                {publication.ched_priority ||
                  publication.chedPriority ||
                  "Smart Education and Pedagogical Advancement"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 4: CITATION VELOCITY CHART (If trend data exists) */}
      {citationTrendData.length > 0 && (
        <Card className="border-border/70 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              Citations Over Time
            </CardTitle>
            <CardDescription className="text-xs">
              Annual citation trajectory for this publication ({ (publication.citations / yearsActive).toFixed(1) } avg citations/year)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={citationTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="year" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="citations"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  name="Citations"
                  dot={{ fill: "#2563eb", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
