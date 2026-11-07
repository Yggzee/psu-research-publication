import { useState } from "react";
import { useNavigate } from "react-router";
import {
  X,
  FileText,
  Target,
  Copy,
  ExternalLink,
  Sparkles,
  Check,
  BookOpen,
  Quote,
  ArrowUpRight,
  FileSpreadsheet,
  User,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { apiService } from "../services/api.service";
import { toast } from "sonner";

export interface InspectedPublication {
  id: string;
  title: string;
  authors: string | string[];
  journal?: string;
  year: number;
  citations: number;
  abstract?: string;
  url?: string;
  cited_by_link?: string;
  citedByLink?: string;
  sdg_tags?: string | string[];
  sdgTags?: string[];
  sdg_rationale?: string;
  sdgRationale?: string;
  journal_indexing?: string;
  journalIndexing?: string;
  ched_priority?: string;
  owner_name?: string;
  ownerName?: string;
  doi?: string;
  issn_isbn?: string;
  issnIsbn?: string;
  jc3_points?: number;
  jc3Points?: number;
  nbc461_points?: number;
  nbc461Points?: number;
  volume_issue?: string;
  volumeIssue?: string;
  publication_date?: string;
  publicationDate?: string;
  publication_level?: string;
  publicationLevel?: string;
  keywords?: string;
}

interface PublicationInspectorDrawerProps {
  publication: InspectedPublication | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updated: InspectedPublication) => void;
}

export function PublicationInspectorDrawer({
  publication,
  isOpen,
  onClose,
  onUpdate,
}: PublicationInspectorDrawerProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [isClassifying, setIsClassifying] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  if (!isOpen || !publication) return null;

  // Format authors safely
  const authorsList: string[] = Array.isArray(publication.authors)
    ? publication.authors
    : typeof publication.authors === "string"
    ? (() => {
        try {
          const parsed = JSON.parse(publication.authors);
          return Array.isArray(parsed) ? parsed : [publication.authors];
        } catch {
          return publication.authors.split(",").map((a) => a.trim());
        }
      })()
    : [];

  const authorsString = authorsList.join(", ");

  // Format SDGs safely
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
    : ["SDG 4: Quality Education", "SDG 9: Industry, Innovation and Infrastructure"];

  const rawRationale = publication.sdg_rationale || publication.sdgRationale;
  let rationalesMap: Record<string, string> | null = null;
  if (rawRationale) {
    try {
      const parsed = JSON.parse(rawRationale);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        rationalesMap = parsed;
      }
    } catch {}
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

  // Citations formatters
  const apaCitation = `${authorsString} (${publication.year}). ${publication.title}. ${publication.journal || "Pangasinan State University Research Archive"}.`;
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

  // Re-classify publication using AI
  const handleReclassify = async () => {
    setIsClassifying(true);
    toast.loading("Analyzing paper with AI SDG Classifier...", { id: "reclassify" });
    try {
      const res = await apiService.classifyPublicationSDG({
        publicationId: publication.id,
        title: publication.title,
        abstract: publication.abstract,
        journal: publication.journal,
      });

      if (res?.success) {
        toast.success("Successfully analyzed SDG Alignment!", { id: "reclassify" });
        const updated = {
          ...publication,
          sdg_tags: [res.sdg.primarySDG, res.sdg.secondarySDG],
          sdg_rationale: res.sdg.rationale,
          ched_priority: res.sdg.chedPriority,
          journal_indexing: res.audit.indexing,
        };
        if (onUpdate) onUpdate(updated);
      }
    } catch (err: any) {
      toast.error(`Classification error: ${err.message}`, { id: "reclassify" });
    } finally {
      setIsClassifying(false);
    }
  };

  const handleOpenFullPaper = () => {
    onClose();
    navigate(`/dashboard/publication/${encodeURIComponent(publication.id)}`);
  };

  const assignedResearcher = publication.owner_name || publication.ownerName;
  const citedByUrl = publication.cited_by_link || publication.citedByLink;
  const indexingStr = publication.journal_indexing || publication.journalIndexing || "Google Scholar";
  const volIssueStr = publication.volume_issue || publication.volumeIssue || "—";
  const issnDoiStr = publication.issn_isbn || publication.issnIsbn || publication.doi || "—";
  const pubDateStr = publication.publication_date || publication.publicationDate || String(publication.year || "—");

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-white dark:bg-card h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800 animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs font-mono">
                  {publication.year}
                </Badge>
                {publication.journal && (
                  <Badge variant="secondary" className="text-xs max-w-[280px] truncate">
                    {publication.journal}
                  </Badge>
                )}
                <Badge className="bg-emerald-600 text-white text-xs">
                  {publication.citations} Citations
                </Badge>
              </div>
              <h2 className="text-lg font-bold text-foreground leading-snug line-clamp-2">
                {publication.title}
              </h2>
              <p className="text-xs text-muted-foreground line-clamp-2">
                By {authorsString}
              </p>
              {assignedResearcher && (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md mt-1">
                  <User className="w-3 h-3" />
                  <span>Assigned Researcher: {assignedResearcher}</span>
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Primary Action: Open Full Paper & Citation Sheet View */}
          <Button
            onClick={handleOpenFullPaper}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 gap-2 shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>View Full Paper, Citations & Excel Data</span>
            <ArrowUpRight className="h-4 w-4 ml-auto" />
          </Button>
        </div>

        {/* Drawer Tabs (Simplified: Overview & Citations + SDG Check only) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-muted/20">
            <TabsList className="bg-transparent h-12 p-0 gap-6">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-1 text-xs font-semibold"
              >
                <FileText className="h-4 w-4 mr-1.5" />
                Overview & Citations
              </TabsTrigger>
              <TabsTrigger
                value="sdg"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 rounded-none px-1 text-xs font-semibold"
              >
                <Target className="h-4 w-4 mr-1.5 text-emerald-600" />
                SDG Check
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* TAB 1: OVERVIEW & CITATIONS */}
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* Quick Publication Sheet Snapshot */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Publication Sheet Snapshot
                </h4>
                <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-xl bg-gray-50 dark:bg-muted/30 border border-gray-200/80 dark:border-gray-800 text-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                      Date of Publication
                    </span>
                    <span className="font-mono font-medium text-foreground">{pubDateStr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                      Vol. No. & Issue No.
                    </span>
                    <span className="font-mono font-medium text-foreground">{volIssueStr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                      ISSN / ISBN / DOI
                    </span>
                    <span className="font-mono font-medium text-foreground break-all">{issnDoiStr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                      Index (Scopus/WoS/Scholar)
                    </span>
                    <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      {indexingStr}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Abstract</h4>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-muted/40 border border-gray-200/80 dark:border-gray-800 text-sm text-foreground/90 leading-relaxed max-h-60 overflow-y-auto">
                  {publication.abstract || "No abstract on file for this publication. Stored in institutional registry."}
                </div>
              </div>

              {/* Quick Citation Exporter */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Quote className="h-3.5 w-3.5" />
                    Instant Citation Exporter
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(apaCitation, "APA 7th")}
                    className="justify-start gap-2 h-10 text-xs font-medium"
                  >
                    {copiedFormat === "APA 7th" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    Copy APA 7th Format
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(bibtexCitation, "BibTeX")}
                    className="justify-start gap-2 h-10 text-xs font-medium font-mono"
                  >
                    {copiedFormat === "BibTeX" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    Copy BibTeX Entry
                  </Button>
                </div>
              </div>

              {/* External Links */}
              <div className="pt-2 flex items-center gap-3 flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleOpenFullPaper}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Open Full Paper Page
                </Button>
                {publication.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => window.open(publication.url, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Publisher Page
                  </Button>
                )}
                {citedByUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => window.open(citedByUrl, "_blank")}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    View Citations in Google Scholar
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: SDG CHECK */}
            <TabsContent value="sdg" className="mt-0 space-y-6">
              <div className="p-4 rounded-xl bg-ai-soft border border-ai-border flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-ai">
                    AI Sustainable Development Classification
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Evaluated against UN 2030 Agenda and CHED R&D priorities.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReclassify}
                  disabled={isClassifying}
                  className="bg-card border-ai-border text-xs gap-1.5 text-ai hover:bg-ai-soft"
                >
                  <Sparkles className="h-3.5 w-3.5 text-ai animate-pulse" />
                  {isClassifying ? "Analyzing..." : "Re-evaluate AI"}
                </Button>
              </div>

              {/* SDG Badges & Tailored Explanations */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mapped UN Goals & Alignment Explanations</h4>
                <div className="grid grid-cols-1 gap-3">
                  {sdgList.map((sdg, idx) => {
                    const tailoredWhy = getRationaleForSDG(sdg);
                    return (
                      <div
                        key={sdg}
                        className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-card space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 ${idx === 0 ? "bg-emerald-600" : "bg-blue-600"}`}>
                            {idx === 0 ? "1st" : "2nd"}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{sdg}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {idx === 0 ? "Primary Institutional Alignment" : "Secondary Alignment"}
                            </p>
                          </div>
                        </div>

                        {tailoredWhy ? (
                          <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-xs">
                            <span className="font-semibold text-emerald-800 dark:text-emerald-300 block mb-1">
                              Why this research belongs to {sdg.split(":")[0]}:
                            </span>
                            <p className="text-emerald-950/90 dark:text-emerald-100/90 leading-relaxed italic">
                              "{tailoredWhy}"
                            </p>
                          </div>
                        ) : (
                          rawRationale && !rawRationale.startsWith("{") && idx === 0 && (
                            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
                              <span className="font-semibold text-foreground block mb-1">
                                Evaluation Rationale:
                              </span>
                              <p className="text-muted-foreground leading-relaxed italic">
                                "{rawRationale}"
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CHED Priority */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Philippine CHED / DOST Priority</h4>
                <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 text-xs font-medium text-blue-900 dark:text-blue-300">
                  {publication.ched_priority || "Smart Education and Pedagogical Advancement"}
                </div>
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </div>
  );
}
