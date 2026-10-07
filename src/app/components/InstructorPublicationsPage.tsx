import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, FileText, Plus, Upload, RefreshCw } from "lucide-react";
import {
  getCurrentUser,
  type ResearchStatus,
  type StoredPublication,
} from "../utils/researchStore";
import { apiService } from "../services/api.service";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";

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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

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

  const handleSubmit = async (event: React.FormEvent) => {
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
      await apiService.createPublication(newRecord);
      await loadPublications();
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      console.error("Failed to save publication to database:", err);
    }
  };

  const toggleVisibility = async (id: string, currentPublic: boolean) => {
    try {
      await apiService.updatePublication(id, { isPublic: !currentPublic });
      await loadPublications();
    } catch (err) {
      console.error("Failed to update visibility:", err);
    }
  };

  const PublicationCard = ({
    publication,
    owned = false,
  }: {
    publication: any;
    owned?: boolean;
  }) => {
    const isPublic = publication.is_public ?? publication.isPublic ?? true;
    const approvalStatus = publication.approval_status || publication.approvalStatus;
    const researchStatus = publication.research_status || publication.researchStatus;
    const authorsList = Array.isArray(publication.authors)
      ? publication.authors.join(", ")
      : publication.authors;

    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <h3 className="text-lg font-medium text-gray-900">{publication.title}</h3>
              <p className="text-sm text-gray-600">{authorsList}</p>
              <p className="text-sm text-gray-500">
                {publication.journal} • {publication.year} • {publication.citations || 0} citations
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {researchStatus && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                    {researchStatus}
                  </span>
                )}
                {approvalStatus === "pending" && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                    Awaiting admin approval
                  </span>
                )}
                {publication.url && (
                  <Button variant="link" size="sm" asChild className="p-0 h-auto">
                    <a href={publication.url} target="_blank" rel="noreferrer">
                      View link <ExternalLink className="ml-1 w-3 h-3" />
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {owned && approvalStatus !== "pending" && (
              <div className="flex items-center gap-3 self-end sm:self-center">
                <Label htmlFor={`visibility-${publication.id}`} className="text-sm">
                  {isPublic ? "Public" : "Private"}
                </Label>
                <Switch
                  id={`visibility-${publication.id}`}
                  checked={Boolean(isPublic)}
                  onCheckedChange={() => toggleVisibility(publication.id, Boolean(isPublic))}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-gray-900">Publications Hub</h1>
          <p className="mt-1 text-gray-600">Explore PSU research and manage your personal publications.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadPublications} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowForm((open) => !open)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Research
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>Add Research Publication to Database</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="research-title">Research title *</Label>
                <Input id="research-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Full title of paper" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="co-authors">Co-authors</Label>
                <Input id="co-authors" placeholder="Separate co-authors with commas" value={form.coAuthors} onChange={(e) => setForm({ ...form, coAuthors: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-status">Research status *</Label>
                <Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as ResearchStatus })}>
                  <SelectTrigger id="research-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Unpublished">Unpublished</SelectItem>
                    <SelectItem value="Published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="journal">Journal or publication venue</Label>
                <Input id="journal" value={form.journal} onChange={(e) => setForm({ ...form, journal: e.target.value })} placeholder="e.g. IEEE Transactions" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-year">Year *</Label>
                <Input id="research-year" type="number" min="2015" max="2030" required value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-link">Research link</Label>
                <Input id="research-link" type="url" placeholder="https://" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-file">Document filename</Label>
                <Input id="research-file" type="text" placeholder="paper.pdf" value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="research-abstract">Abstract or summary</Label>
                <Textarea id="research-abstract" value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} placeholder="Brief summary of research..." />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  <Upload className="mr-2 h-4 w-4" /> Save Research to Database
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="public">
        <TabsList className="h-11">
          <TabsTrigger value="public" className="px-6"><BookOpen className="w-4 h-4 mr-2" /> Public Research ({publicPublications.length})</TabsTrigger>
          <TabsTrigger value="mine" className="px-6"><FileText className="w-4 h-4 mr-2" /> My Research ({ownPublications.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="public" className="mt-4 space-y-4">
          {publicPublications.map((publication) => (
            <PublicationCard key={publication.id} publication={publication} />
          ))}
          {publicPublications.length === 0 && !loading && (
            <Card><CardContent className="py-12 text-center text-gray-500">No public research publications found in the database yet.</CardContent></Card>
          )}
        </TabsContent>
        <TabsContent value="mine" className="mt-4 space-y-4">
          {ownPublications.map((publication) => (
            <PublicationCard key={publication.id} publication={publication} owned />
          ))}
          {ownPublications.length === 0 && !loading && (
            <Card><CardContent className="py-12 text-center text-gray-500">You have no assigned, claimed, or uploaded research yet.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
