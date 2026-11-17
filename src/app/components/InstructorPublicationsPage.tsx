import { useEffect, useState, type FormEvent } from "react";
import {
  BookOpen,
  ExternalLink,
  FileText,
  Plus,
  Upload,
  RefreshCw,
  Sparkles,
  Lock,
  Globe,
  X,
  Trash2,
  Link as LinkIcon,
  Search,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  getCurrentUser,
  type ResearchStatus,
} from "../utils/researchStore";
import { apiService } from "../services/api.service";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { PublicationInspectorDrawer, type InspectedPublication } from "./PublicationInspectorDrawer";
import { PageHeader, EmptyState, StatusBadge, PageTabs } from "./common";
import { toast } from "sonner";

const emptyForm = {
  title: "",
  coAuthors: "",
  journal: "",
  year: String(new Date().getFullYear()),
  abstract: "",
  url: "",
  status: "Published" as ResearchStatus,
  fileName: "",
};

export function InstructorPublicationsPage() {
  const user = getCurrentUser() || { name: "Researcher", instructorId: "", role: "instructor" as const };
  const [publications, setPublications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("mine");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [inspectedPub, setInspectedPub] = useState<InspectedPublication | null>(null);

  const loadPublications = async () => {
    setLoading(true);
    try {
      const data = await apiService.getPublications(true);
      setPublications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to load instructor publications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublications();
  }, []);

  const publicPublications = publications.filter(
    (p) => p.approval_status === "approved" || p.approvalStatus === "approved"
  );

  const ownPublications = publications.filter(
    (p) =>
      (p.approval_status === "approved" || p.approvalStatus === "approved") &&
      (Array.isArray(p.assignedResearcherIds)
        ? p.assignedResearcherIds.some(
            (id: string) => String(id).toLowerCase() === String(user.instructorId || "").toLowerCase()
          )
        : p.owner_id === user.instructorId || p.ownerId === user.instructorId)
  );

  const pendingPublications = publications.filter(
    (p) =>
      (p.approval_status === "pending" || p.approvalStatus === "pending") &&
      (Array.isArray(p.allLinkedResearcherIds)
        ? p.allLinkedResearcherIds.some(
            (id: string) => String(id).toLowerCase() === String(user.instructorId || "").toLowerCase()
          )
        : Array.isArray(p.assignedResearcherIds) && p.assignedResearcherIds.length > 0
        ? p.assignedResearcherIds.some(
            (id: string) => String(id).toLowerCase() === String(user.instructorId || "").toLowerCase()
          )
        : String(p.owner_id || p.ownerId || "").toLowerCase() === String(user.instructorId || "").toLowerCase())
  );

  // R2 Add Mode: 'manual' vs 'doi'
  const [addMode, setAddMode] = useState<"manual" | "doi">("manual");
  const [doiInput, setDoiInput] = useState("");
  const [isResolvingDoi, setIsResolvingDoi] = useState(false);
  const [resolvedDoiData, setResolvedDoiData] = useState<{
    title: string;
    authors: string[];
    journal?: string;
    year: number;
    doi: string;
    abstract?: string;
    citations?: number;
    citedByLink?: string;
    source?: string;
  } | null>(null);

  // R4: Citations reload state
  const [isReloadingCitations, setIsReloadingCitations] = useState(false);
  const handleReloadAllCitations = async () => {
    setIsReloadingCitations(true);
    try {
      toast.loading("Reloading live Google Scholar citations for all repository publications...", { id: "reload-cits" });
      const res = await apiService.reloadAllCitations();
      toast.success(`Successfully reloaded citations for ${res.updatedCount || 0} publication(s).`, { id: "reload-cits" });
      await loadPublications();
    } catch (err: any) {
      toast.error(err.message || "Failed to reload citations.", { id: "reload-cits" });
    } finally {
      setIsReloadingCitations(false);
    }
  };

  // R2: Resolve DOI Link Retrieval
  const handleResolveDoi = async () => {
    const cleanDoi = doiInput.trim();
    if (!cleanDoi) {
      toast.error("Please enter a valid DOI or DOI link.");
      return;
    }
    setIsResolvingDoi(true);
    try {
      toast.loading("Retrieving bibliographic metadata from CrossRef & OpenAlex...", { id: "resolve-doi" });
      const res = await apiService.resolveDoi(cleanDoi);
      setResolvedDoiData(res);
      setForm({
        title: res.title || "",
        coAuthors: (res.authors || []).filter((a: string) => a !== user.name).join(", "),
        journal: res.journal || "",
        year: String(res.year || new Date().getFullYear()),
        abstract: res.abstract || "",
        url: res.doi ? (res.doi.startsWith("http") ? res.doi : `https://doi.org/${res.doi}`) : "",
        researchStatus: "Published",
        fileName: "",
      });
      toast.success("DOI resolved! Bibliographic data populated.", { id: "resolve-doi" });
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve DOI.", { id: "resolve-doi" });
    } finally {
      setIsResolvingDoi(false);
    }
  };

  // R2: Remove Publication (Unassigns researcher)
  const handleRemovePublication = async (publicationId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to remove "${title}" from your publications?`)) return;
    try {
      toast.loading("Removing publication...", { id: "remove-pub" });
      const res = await apiService.unassignPublication(publicationId);
      toast.success(res.message || "Publication removed successfully.", { id: "remove-pub" });
      await loadPublications();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove publication.", { id: "remove-pub" });
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const coAuthors = form.coAuthors.split(",").map((a) => a.trim()).filter(Boolean);
    const authors = [user.name, ...coAuthors];

    if (!form.title.trim() || !form.journal.trim() || !form.year) {
      toast.error("Title, Journal / Venue, and Publication Year are required.");
      return;
    }

    const newRecord = {
      id: `manual-${Date.now()}`,
      title: form.title.trim(),
      authors,
      journal: form.journal.trim(),
      year: Number(form.year),
      citations: resolvedDoiData?.citations || 0,
      citedByLink: resolvedDoiData?.citedByLink || undefined,
      abstract: form.abstract.trim(),
      url: form.url.trim() || (resolvedDoiData?.doi ? (resolvedDoiData.doi.startsWith("http") ? resolvedDoiData.doi : `https://doi.org/${resolvedDoiData.doi}`) : undefined),
      ownerId: user.instructorId || "",
      ownerName: user.name,
      source: addMode === "doi" ? "doi" : "manual",
      approvalStatus: "pending",
      researchStatus: "Published",
      isPublic: false,
      fileName: form.fileName || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      toast.loading("Submitting publication for Research Coordinator verification...", { id: "save-pub" });
      await apiService.createPublication(newRecord);

      // Auto-classify with Gemini Flash in background
      apiService.classifyPublicationSDG({
        publicationId: newRecord.id,
        title: newRecord.title,
        abstract: newRecord.abstract,
        journal: newRecord.journal,
      }).catch(() => {});

      toast.success("Publication submitted! It is now pending Research Coordinator review and will appear once approved.", { id: "save-pub" });
      await loadPublications();
      setForm(emptyForm);
      setResolvedDoiData(null);
      setDoiInput("");
      setShowForm(false);
      setActiveTab("pending");
    } catch (err: any) {
      toast.error(`Failed to submit publication: ${err.message}`, { id: "save-pub" });
    }
  };

  const toggleVisibility = async (id: string, currentPublic: boolean) => {
    try {
      await apiService.updatePublication(id, { isPublic: !currentPublic });
      await loadPublications();
      toast.success(!currentPublic ? "Publication is now public" : "Publication is now private");
    } catch (err) {
      console.error("Failed to update visibility:", err);
      toast.error("Failed to update visibility");
    }
  };

  const tabs = [
    { id: "mine", label: "My Published Research", count: ownPublications.length, icon: FileText },
    { id: "pending", label: "Waiting for Approval", count: pendingPublications.length, icon: Clock },
    { id: "public", label: "Institutional Repository", count: publicPublications.length, icon: BookOpen },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <PageHeader
        title="My Publications"
        description="Manage your published research, track citations, and add new publications"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReloadAllCitations}
              disabled={isReloadingCitations || loading}
              className="text-xs h-9 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isReloadingCitations ? "animate-spin" : ""}`} />
              <span>Reload Citations</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setShowForm((open) => !open)}
              className="text-xs h-9 gap-1.5 bg-brand hover:bg-brand/90 text-white shadow-2xs"
            >
              {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{showForm ? "Close Form" : "Add Publication"}</span>
            </Button>
          </div>
        }
      />

      {/* 2. Collapsible Add Publication Form */}
      {showForm && (
        <Card className="border-brand/40 shadow-xs">
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Add Publication</h3>
                <p className="text-xs text-muted-foreground">
                  Your name ({user.name}) will be automatically registered as lead author.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                className="h-7 w-7 p-0 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-3">
              <Button
                type="button"
                variant={addMode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("manual")}
                className="text-xs h-8 gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Manual Entry</span>
              </Button>
              <Button
                type="button"
                variant={addMode === "doi" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("doi")}
                className="text-xs h-8 gap-1.5"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>DOI Link Retrieval</span>
              </Button>
            </div>

            {addMode === "doi" && (
              <div className="mb-4 p-3.5 rounded-lg border border-brand/30 bg-brand/5 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="doi-input" className="text-xs font-semibold text-foreground">
                    Enter DOI or DOI Link *
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Input a DOI (e.g. 10.1016/j.envsoft.2023.105678 or https://doi.org/...) to retrieve bibliographic metadata from CrossRef/OpenAlex and enrich citations via Google Scholar.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="doi-input"
                    value={doiInput}
                    onChange={(e) => setDoiInput(e.target.value)}
                    placeholder="10.xxxx/xxxxx or https://doi.org/10.xxxx/xxxxx"
                    className="h-8 text-xs font-mono bg-background"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={isResolvingDoi || !doiInput.trim()}
                    onClick={handleResolveDoi}
                    className="h-8 text-xs bg-brand hover:bg-brand/90 text-white shrink-0 gap-1.5"
                  >
                    <Search className={`w-3.5 h-3.5 ${isResolvingDoi ? "animate-spin" : ""}`} />
                    <span>Retrieve Data</span>
                  </Button>
                </div>

                {resolvedDoiData && (
                  <div className="p-2.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Data Successfully Retrieved from {resolvedDoiData.source || "DOI Registry"}</span>
                    </div>
                    <p className="text-foreground font-medium text-xs truncate">{resolvedDoiData.title}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {resolvedDoiData.authors?.join(", ")} • {resolvedDoiData.journal || "Journal"} ({resolvedDoiData.year}) • {resolvedDoiData.citations || 0} citations
                    </p>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="research-title" className="text-xs font-medium">Publication Title *</Label>
                <Input
                  id="research-title"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Full title of published research"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="co-authors" className="text-xs font-medium">Co-Authors</Label>
                <Input
                  id="co-authors"
                  placeholder="Comma-separated (e.g. John Doe, Maria Santos)"
                  value={form.coAuthors}
                  onChange={(e) => setForm({ ...form, coAuthors: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="journal" className="text-xs font-medium">Journal or Venue *</Label>
                <Input
                  id="journal"
                  required
                  value={form.journal}
                  onChange={(e) => setForm({ ...form, journal: e.target.value })}
                  placeholder="e.g. Philippine Journal of Science, IEEE"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="research-year" className="text-xs font-medium">Publication Year *</Label>
                <Input
                  id="research-year"
                  type="number"
                  min="2010"
                  max="2030"
                  required
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="research-link" className="text-xs font-medium">Publication URL / DOI</Label>
                <Input
                  id="research-link"
                  type="url"
                  placeholder="https://doi.org/..."
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="research-file" className="text-xs font-medium">Document / PDF Filename</Label>
                <Input
                  id="research-file"
                  type="text"
                  placeholder="published_paper.pdf"
                  value={form.fileName}
                  onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="research-abstract" className="text-xs font-medium">Abstract</Label>
                <Textarea
                  id="research-abstract"
                  rows={3}
                  value={form.abstract}
                  onChange={(e) => setForm({ ...form, abstract: e.target.value })}
                  placeholder="Paste publication abstract here..."
                  className="text-xs"
                />
              </div>

              <div className="flex items-center gap-2 md:col-span-2 pt-2">
                <Button type="submit" size="sm" className="bg-brand hover:bg-brand/90 text-white text-xs gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Add Publication</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 3. Navigation Tabs */}
      <PageTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* 4. Tab Content */}
      {activeTab === "mine" && (
        <div className="space-y-3">
          {ownPublications.map((publication) => {
            const isPublic = publication.is_public ?? publication.isPublic ?? true;
            const approvalStatus = publication.approval_status || publication.approvalStatus;
            const researchStatus = publication.research_status || publication.researchStatus;
            const authorsList = Array.isArray(publication.authors)
              ? publication.authors.join(", ")
              : publication.authors;

            return (
              <Card
                key={publication.id}
                className="border-border/60 hover:border-brand/40 transition-colors shadow-2xs"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {publication.year}
                        </Badge>
                        {researchStatus && (
                          <StatusBadge status={researchStatus} />
                        )}
                        {approvalStatus && approvalStatus !== "approved" && (
                          <StatusBadge status={approvalStatus} />
                        )}
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {publication.citations || 0} citations
                        </span>
                      </div>

                      <h3
                        onClick={() => setInspectedPub(publication)}
                        className="text-sm font-semibold text-foreground hover:text-brand cursor-pointer transition-colors leading-snug"
                      >
                        {publication.title}
                      </h3>

                      <p className="text-xs text-muted-foreground line-clamp-1">
                        By {authorsList}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                        <span className="text-muted-foreground text-[11px] truncate max-w-xs">
                          {publication.journal || "Researcher Portfolio"}
                        </span>

                        {publication.url && (
                          <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs text-brand">
                            <a href={publication.url} target="_blank" rel="noreferrer" className="flex items-center gap-1">
                              <span>DOI / Link</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectedPub(publication)}
                          className="h-6 text-[11px] px-2 gap-1 text-ai hover:bg-ai-soft"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>Inspect & SDG Check</span>
                        </Button>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {isPublic ? (
                          <span className="inline-flex items-center gap-1 text-success text-[11px] font-medium">
                            <Globe className="h-3 w-3" /> Public
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground text-[11px] font-medium">
                            <Lock className="h-3 w-3" /> Private
                          </span>
                        )}
                        <Switch
                          id={`visibility-${publication.id}`}
                          checked={Boolean(isPublic)}
                          onCheckedChange={() => toggleVisibility(publication.id, Boolean(isPublic))}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePublication(publication.id, publication.title)}
                        className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove Publication</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {ownPublications.length === 0 && !loading && (
            <EmptyState
              icon={FileText}
              title="No publications recorded"
              description="Add your published research to track citations and generate accreditation reports."
              actionLabel="Add Publication"
              onAction={() => setShowForm(true)}
            />
          )}
        </div>
      )}

      {activeTab === "pending" && (
        <div className="space-y-3">
          {pendingPublications.map((publication) => {
            const authorsList = Array.isArray(publication.authors)
              ? publication.authors.join(", ")
              : publication.authors;

            return (
              <Card
                key={publication.id}
                className="border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/5 hover:border-amber-500/60 transition-colors shadow-2xs"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {publication.year}
                        </Badge>
                        <StatusBadge status="pending" label="Waiting for Approval" />
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {publication.citations || 0} citations
                        </span>
                      </div>

                      <h3
                        onClick={() => setInspectedPub(publication)}
                        className="text-sm font-semibold text-foreground hover:text-brand cursor-pointer transition-colors leading-snug"
                      >
                        {publication.title}
                      </h3>

                      <p className="text-xs text-muted-foreground line-clamp-1">
                        By {authorsList}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                        <span className="text-muted-foreground text-[11px] truncate max-w-xs">
                          {publication.journal || "Researcher Portfolio"}
                        </span>

                        {publication.url && (
                          <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs text-brand">
                            <a href={publication.url} target="_blank" rel="noreferrer" className="flex items-center gap-1">
                              <span>DOI / Link</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectedPub(publication)}
                          className="h-6 text-[11px] px-2 gap-1 text-ai hover:bg-ai-soft"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>Inspect & SDG Check</span>
                        </Button>
                      </div>

                      <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs flex items-center gap-2 text-amber-900 dark:text-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="text-[11px]">
                          Awaiting review from Research Coordinator Sir Rodelio M. Garin. Once approved, this publication will automatically move to your published portfolio.
                        </span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePublication(publication.id, publication.title)}
                        className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Withdraw / Remove</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {pendingPublications.length === 0 && !loading && (
            <EmptyState
              icon={Clock}
              title="No publications waiting for approval"
              description="When you add research manually or via DOI retrieval, submissions will appear here while awaiting Research Coordinator approval."
              actionLabel="Add Publication"
              onAction={() => setShowForm(true)}
            />
          )}
        </div>
      )}

      {activeTab === "public" && (
        <div className="space-y-3">
          {publicPublications.map((publication) => {
            const authorsList = Array.isArray(publication.authors)
              ? publication.authors.join(", ")
              : publication.authors;

            return (
              <Card
                key={publication.id}
                className="border-border/60 hover:border-brand/40 transition-colors shadow-2xs"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {publication.year}
                      </Badge>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {publication.citations || 0} citations
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {publication.journal || "PSU Archive"}
                      </span>
                    </div>

                    <h3
                      onClick={() => setInspectedPub(publication)}
                      className="text-sm font-semibold text-foreground hover:text-brand cursor-pointer transition-colors leading-snug"
                    >
                      {publication.title}
                    </h3>

                    <p className="text-xs text-muted-foreground line-clamp-1">
                      By {authorsList}
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      {publication.url && (
                        <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs text-brand">
                          <a href={publication.url} target="_blank" rel="noreferrer" className="flex items-center gap-1">
                            <span>View Source</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInspectedPub(publication)}
                        className="h-6 text-[11px] px-2 gap-1 text-ai hover:bg-ai-soft"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Inspect</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {publicPublications.length === 0 && !loading && (
            <EmptyState
              icon={BookOpen}
              title="No institutional publications found"
              description="Institutional publications will appear here once verified and published by the administration."
            />
          )}
        </div>
      )}

      {/* Inspector Drawer */}
      <PublicationInspectorDrawer
        publication={inspectedPub}
        isOpen={Boolean(inspectedPub)}
        onClose={() => setInspectedPub(null)}
        onUpdate={(updated) => {
          setInspectedPub(updated);
          setPublications((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
          );
        }}
      />
    </div>
  );
}
