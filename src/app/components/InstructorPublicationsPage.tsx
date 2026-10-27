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
  status: "In Progress" as ResearchStatus,
  fileName: "",
};

export function InstructorPublicationsPage() {
  const user = getCurrentUser();
  const [publications, setPublications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("mine");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [inspectedPub, setInspectedPub] = useState<InspectedPublication | null>(null);

  const loadPublications = async () => {
    setLoading(true);
    try {
      const data = await apiService.getPublications();
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
      p.owner_id === user.instructorId ||
      p.ownerId === user.instructorId ||
      (Array.isArray(p.authors) ? p.authors.includes(user.name) : String(p.authors).includes(user.name))
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const coAuthors = form.coAuthors.split(",").map((a) => a.trim()).filter(Boolean);
    const authors = [user.name, ...coAuthors];

    const newRecord = {
      id: `manual-${Date.now()}`,
      title: form.title.trim(),
      authors,
      journal: form.journal.trim() || "Research in progress",
      year: Number(form.year),
      citations: 0,
      abstract: form.abstract.trim(),
      url: form.url.trim() || undefined,
      ownerId: user.instructorId || "",
      ownerName: user.name,
      source: "manual",
      approvalStatus: "approved",
      researchStatus: form.status,
      isPublic: false,
      fileName: form.fileName || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      toast.loading("Saving publication & analyzing UN SDGs with Gemini Flash...", { id: "save-pub" });
      await apiService.createPublication(newRecord);

      // Auto-classify with Gemini Flash in background
      apiService.classifyPublicationSDG({
        publicationId: newRecord.id,
        title: newRecord.title,
        abstract: newRecord.abstract,
        journal: newRecord.journal,
      }).then(() => {
        loadPublications();
      }).catch(() => {});

      toast.success("Publication registered successfully!", { id: "save-pub" });
      await loadPublications();
      setForm(emptyForm);
      setShowForm(false);
    } catch (err: any) {
      toast.error(`Failed to save publication: ${err.message}`, { id: "save-pub" });
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
    { id: "mine", label: "My Research", count: ownPublications.length, icon: FileText },
    { id: "public", label: "Institutional Repository", count: publicPublications.length, icon: BookOpen },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <PageHeader
        title="Faculty Research & Publications"
        description="Manage your research outputs, track citations, and register new scholarly work"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadPublications}
              disabled={loading}
              className="text-xs h-9 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setShowForm((open) => !open)}
              className="text-xs h-9 gap-1.5 bg-brand hover:bg-brand/90 text-white shadow-2xs"
            >
              {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{showForm ? "Close Form" : "Add Research"}</span>
            </Button>
          </div>
        }
      />

      {/* 2. Collapsible Add Research Form */}
      {showForm && (
        <Card className="border-brand/40 shadow-xs">
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Register New Scholarly Output</h3>
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

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="research-title" className="text-xs font-medium">Research Title *</Label>
                <Input
                  id="research-title"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Full title of paper or study"
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
                <Label htmlFor="research-status" className="text-xs font-medium">Status *</Label>
                <Select
                  value={form.status}
                  onValueChange={(status) => setForm({ ...form, status: status as ResearchStatus })}
                >
                  <SelectTrigger id="research-status" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Unpublished">Unpublished</SelectItem>
                    <SelectItem value="Published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="journal" className="text-xs font-medium">Journal or Venue</Label>
                <Input
                  id="journal"
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
                <Label htmlFor="research-link" className="text-xs font-medium">Research URL / DOI</Label>
                <Input
                  id="research-link"
                  type="url"
                  placeholder="https://doi.org/..."
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="research-file" className="text-xs font-medium">Document / PDF Filename</Label>
                <Input
                  id="research-file"
                  type="text"
                  placeholder="manuscript_draft.pdf"
                  value={form.fileName}
                  onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="research-abstract" className="text-xs font-medium">Abstract or Summary</Label>
                <Textarea
                  id="research-abstract"
                  rows={3}
                  value={form.abstract}
                  onChange={(e) => setForm({ ...form, abstract: e.target.value })}
                  placeholder="Paste abstract or research objectives here..."
                  className="text-xs"
                />
              </div>

              <div className="flex items-center gap-2 md:col-span-2 pt-2">
                <Button type="submit" size="sm" className="bg-brand hover:bg-brand/90 text-white text-xs gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Save Research Output</span>
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
      {activeTab === "mine" ? (
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
                          {publication.journal || "Faculty Portfolio"}
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
                          <span>Inspect & NBC 461 Points</span>
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {ownPublications.length === 0 && !loading && (
            <EmptyState
              icon={FileText}
              title="No personal publications recorded"
              description="Register your papers, articles, or ongoing research projects to track citations and generate reports."
              actionLabel="Add Research"
              onAction={() => setShowForm(true)}
            />
          )}
        </div>
      ) : (
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
