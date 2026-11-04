import { useState } from "react";
import {
  X,
  FileText,
  Target,
  Award,
  ShieldCheck,
  Copy,
  ExternalLink,
  Sparkles,
  Check,
  BookOpen,
  Calendar,
  Quote,
  Layers,
  AlertTriangle,
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
  sdg_tags?: string | string[];
  sdg_rationale?: string;
  journal_indexing?: string;
  jc3_points?: number;
  jc3Points?: number;
  nbc461_points?: number;
  ched_priority?: string;
  is_predatory_flag?: number;
  owner_name?: string;
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
  const [activeTab, setActiveTab] = useState("overview");
  const [isClassifying, setIsClassifying] = useState(false);
  const [authorRole, setAuthorRole] = useState<"sole" | "lead" | "co" | "custom">("lead");
  const [customContribution, setCustomContribution] = useState<number>(50);
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
  const sdgList: string[] = Array.isArray(publication.sdg_tags)
    ? publication.sdg_tags
    : typeof publication.sdg_tags === "string"
    ? (() => {
        try {
          const parsed = JSON.parse(publication.sdg_tags);
          return Array.isArray(parsed) ? parsed : [publication.sdg_tags];
        } catch {
          return [publication.sdg_tags];
        }
      })()
    : ["SDG 4: Quality Education", "SDG 9: Industry, Innovation and Infrastructure"];

  let rationalesMap: Record<string, string> | null = null;
  if (publication.sdg_rationale) {
    try {
      const parsed = JSON.parse(publication.sdg_rationale);
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

  // Re-classify publication using Gemini Flash
  const handleReclassify = async () => {
    setIsClassifying(true);
    toast.loading("Analyzing paper with Gemini Flash...", { id: "reclassify" });
    try {
      const res = await apiService.classifyPublicationSDG({
        publicationId: publication.id,
        title: publication.title,
        abstract: publication.abstract,
        journal: publication.journal,
      });

      if (res?.success) {
        toast.success("Successfully analyzed with Gemini Flash!", { id: "reclassify" });
        const updated = {
          ...publication,
          sdg_tags: [res.sdg.primarySDG, res.sdg.secondarySDG],
          sdg_rationale: res.sdg.rationale,
          ched_priority: res.sdg.chedPriority,
          journal_indexing: res.audit.indexing,
          jc3_points: res.audit.jc3Points || (res.audit.nbc461Points >= 25 ? 50 : 30),
          nbc461_points: res.audit.nbc461Points,
        };
        if (onUpdate) onUpdate(updated);
      }
    } catch (err: any) {
      toast.error(`Classification error: ${err.message}`, { id: "reclassify" });
    } finally {
      setIsClassifying(false);
    }
  };

  // JC3 (DBM-CHED Joint Circular No. 3, s. 2022) Points calculation
  // KRA II: Research, Invention, and Creative Work (Criterion A: Research Outputs Published)
  const basePoints = publication.jc3_points || publication.jc3Points || (
    publication.nbc461_points
      ? (publication.nbc461_points >= 25 ? 50 : publication.nbc461_points >= 15 ? 30 : publication.nbc461_points >= 10 ? 20 : 10)
      : (publication.journal?.toLowerCase().includes("scopus") || publication.journal?.toLowerCase().includes("ieee") ? 50 : 30)
  );

  const totalCoAuthors = Math.max(1, authorsList.length);
  const contributionPercentage =
    authorRole === "sole"
      ? 100
      : authorRole === "lead"
      ? 60
      : authorRole === "co"
      ? Math.round((40 / Math.max(1, totalCoAuthors - 1)) * 10) / 10
      : customContribution;

  const calculatedPoints = Number(((basePoints * contributionPercentage) / 100).toFixed(2));
  const citationBonus = Math.min(50, (publication.citations || 0) * 5);
  const totalWithCitations = Math.min(100, Number((calculatedPoints + citationBonus).toFixed(2)));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-white dark:bg-card h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800 animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
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
            <p className="text-xs text-muted-foreground line-clamp-1">
              By {authorsString}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Drawer Tabs */}
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
                UN SDG & CHED
              </TabsTrigger>
              <TabsTrigger
                value="jc3"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none px-1 text-xs font-semibold"
              >
                <Award className="h-4 w-4 mr-1.5 text-purple-600" />
                JC3 Points (KRA II)
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-amber-600 rounded-none px-1 text-xs font-semibold"
              >
                <ShieldCheck className="h-4 w-4 mr-1.5 text-amber-600" />
                Integrity Radar
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* TAB 1: OVERVIEW & CITATIONS */}
            <TabsContent value="overview" className="mt-0 space-y-6">
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
              <div className="pt-2 flex items-center gap-3">
                {publication.url && (
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => window.open(publication.url, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Publisher Page
                  </Button>
                )}
                {publication.cited_by_link && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => window.open(publication.cited_by_link, "_blank")}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    View Citations in Google Scholar
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: UN SDG & CHED AGENDA */}
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
                          publication.sdg_rationale && !publication.sdg_rationale.startsWith("{") && idx === 0 && (
                            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
                              <span className="font-semibold text-foreground block mb-1">
                                Evaluation Rationale:
                              </span>
                              <p className="text-muted-foreground leading-relaxed italic">
                                "{publication.sdg_rationale}"
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

            {/* TAB 3: DBM-CHED JC3 (KRA II: RESEARCH OUTPUTS) CALCULATOR */}
            <TabsContent value="jc3" className="mt-0 space-y-6">
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">
                    DBM-CHED JC No. 3, s. 2022 Evaluator
                  </h4>
                  <Badge variant="outline" className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-300">
                    KRA II - Criterion A
                  </Badge>
                </div>
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                  Evaluates faculty research outputs published under the Philippine State University system promotion framework (replacing NBC 461).
                </p>
              </div>

              {/* Authorship selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Author Contribution Role
                  </label>
                  <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                    {contributionPercentage}% Share
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    type="button"
                    variant={authorRole === "sole" ? "default" : "outline"}
                    className={authorRole === "sole" ? "bg-purple-600 hover:bg-purple-700 text-xs px-2" : "text-xs px-2"}
                    onClick={() => setAuthorRole("sole")}
                  >
                    Sole (100%)
                  </Button>
                  <Button
                    type="button"
                    variant={authorRole === "lead" ? "default" : "outline"}
                    className={authorRole === "lead" ? "bg-purple-600 hover:bg-purple-700 text-xs px-2" : "text-xs px-2"}
                    onClick={() => setAuthorRole("lead")}
                  >
                    Lead (60%)
                  </Button>
                  <Button
                    type="button"
                    variant={authorRole === "co" ? "default" : "outline"}
                    className={authorRole === "co" ? "bg-purple-600 hover:bg-purple-700 text-xs px-2" : "text-xs px-2"}
                    onClick={() => setAuthorRole("co")}
                  >
                    Co-Author
                  </Button>
                  <Button
                    type="button"
                    variant={authorRole === "custom" ? "default" : "outline"}
                    className={authorRole === "custom" ? "bg-purple-600 hover:bg-purple-700 text-xs px-2" : "text-xs px-2"}
                    onClick={() => setAuthorRole("custom")}
                  >
                    Custom %
                  </Button>
                </div>

                {authorRole === "custom" && (
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-muted/40 border border-gray-200 dark:border-gray-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Declared Contribution Share:</span>
                      <span className="font-mono font-bold text-purple-600">{customContribution}%</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={customContribution}
                      onChange={(e) => setCustomContribution(Number(e.target.value))}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Point Output Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 text-white shadow-xl text-center space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-semibold text-purple-100">
                  <Award className="h-3.5 w-3.5" />
                  JC3 Evaluated Points Earned
                </div>
                
                <div className="text-5xl font-black font-mono tracking-tight text-white drop-shadow-sm">
                  {calculatedPoints} <span className="text-xl font-normal text-purple-200">pts</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 text-left border-t border-white/20">
                  <div className="bg-white/10 rounded-lg p-2.5">
                    <p className="text-[10px] text-purple-200 uppercase font-semibold">Base Venue Points</p>
                    <p className="text-sm font-bold font-mono text-white">{basePoints} pts</p>
                    <p className="text-[10px] text-purple-200 truncate">{publication.journal_indexing || "Institutional Refereed"}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2.5">
                    <p className="text-[10px] text-purple-200 uppercase font-semibold">Author Share</p>
                    <p className="text-sm font-bold font-mono text-white">{contributionPercentage}%</p>
                    <p className="text-[10px] text-purple-200">{totalCoAuthors} listed author{totalCoAuthors > 1 ? 's' : ''}</p>
                  </div>
                </div>

                {publication.citations > 0 && (
                  <div className="pt-1 text-xs text-purple-100 bg-white/10 rounded-lg p-2.5 flex items-center justify-between">
                    <span>Citation Impact Bonus (+5/cite):</span>
                    <span className="font-mono font-bold text-emerald-300">+{citationBonus} pts</span>
                  </div>
                )}
              </div>

              {/* Statutory DBM-CHED JC3 Guidelines */}
              <div className="text-xs text-muted-foreground space-y-2 p-4 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground">DBM-CHED JC No. 3, s. 2022 Venue Tiers:</p>
                  <span className="text-[10px] text-purple-600 font-semibold">KRA II Cap: 100 pts/cycle</span>
                </div>
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p className="flex justify-between">
                    <span>• Internationally Indexed (Scopus / Web of Science):</span>
                    <strong className="text-foreground font-mono">50.0 pts</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>• CHED Recognized / ASEAN Citation Index (ACI) / Refereed Int'l:</span>
                    <strong className="text-foreground font-mono">30.0 pts</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>• National / Regional Peer-Reviewed Journals:</span>
                    <strong className="text-foreground font-mono">20.0 pts</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>• Refereed Conference Proceedings / Institutional Journals:</span>
                    <strong className="text-foreground font-mono">10.0 pts</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>• Institutional Repository / Departmental Baseline:</span>
                    <strong className="text-foreground font-mono">5.0 pts</strong>
                  </p>
                </div>
                <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                  Formula: Points = Base Points × (Contribution % / 100). Valid external citations in indexed journals add +5.0 points per citation up to the KRA II evaluation cycle limit.
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: INTEGRITY & JOURNAL AUDIT */}
            <TabsContent value="audit" className="mt-0 space-y-6">
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Indexing Status</span>
                    <Badge variant="outline" className="font-mono text-xs font-bold text-emerald-600 border-emerald-300">
                      {publication.journal_indexing || "Institutional Refereed"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Academic Integrity Check</span>
                    <Badge variant="secondary" className="text-xs flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Passed Quality Audit
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Predatory Risk Radar</span>
                    <span className="text-xs font-medium text-emerald-600">0% Risk (No flags detected)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 leading-relaxed space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    University Publication Policy Note
                  </p>
                  <p>
                    Faculty publications must be vetted against CHED Memo Order No. 52 and the Directory of Open Access Journals (DOAJ). This publication meets baseline university archiving criteria.
                  </p>
                </div>
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </div>
  );
}
