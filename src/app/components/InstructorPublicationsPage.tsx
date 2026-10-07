import { useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, FileText, Plus, Upload } from "lucide-react";
import { publications } from "../data/mockData";
import {
  addResearchRecord,
  getCurrentUser,
  getResearchRecords,
  saveResearchRecords,
  type ResearchStatus,
  type StoredPublication,
} from "../utils/researchStore";
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
  const [records, setRecords] = useState<StoredPublication[]>(getResearchRecords);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const refresh = () => setRecords(getResearchRecords());
    window.addEventListener("research-records-updated", refresh);
    return () => window.removeEventListener("research-records-updated", refresh);
  }, []);

  const databasePublications = useMemo(
    () =>
      publications.flatMap((group) =>
        group.publications.map((publication) => ({
          ...publication,
          ownerName: group.authorName,
        })),
      ),
    [],
  );

  const publicRecords = records.filter(
    (record) => record.approvalStatus === "approved" && record.isPublic,
  );
  const ownDatabasePublications = databasePublications.filter((publication) =>
    publication.authors.includes(user.name),
  );
  const ownRecords = records.filter((record) => record.ownerId === user.instructorId);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const coAuthors = form.coAuthors.split(",").map((author) => author.trim()).filter(Boolean);
    addResearchRecord({
      id: `manual-${Date.now()}`,
      title: form.title.trim(),
      authors: [user.name, ...coAuthors],
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
    });
    setRecords(getResearchRecords());
    setForm(emptyForm);
    setShowForm(false);
  };

  const toggleVisibility = (id: string) => {
    const updated = records.map((record) =>
      record.id === id ? { ...record, isPublic: !record.isPublic } : record,
    );
    saveResearchRecords(updated);
    setRecords(updated);
  };

  const PublicationCard = ({
    publication,
    owned = false,
  }: {
    publication: {
      id: string;
      title: string;
      authors: string[];
      journal: string;
      year: number;
      citations: number;
      url?: string;
      researchStatus?: ResearchStatus;
      approvalStatus?: StoredPublication["approvalStatus"];
      isPublic?: boolean;
    };
    owned?: boolean;
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900">{publication.title}</h3>
            <p className="text-sm text-gray-600">{publication.authors.join(", ")}</p>
            <p className="text-sm text-gray-500">
              {publication.journal} • {publication.year} • {publication.citations} citations
            </p>
            <div className="flex items-center gap-2">
              {publication.researchStatus && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                  {publication.researchStatus}
                </span>
              )}
              {publication.approvalStatus === "pending" && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                  Awaiting admin approval
                </span>
              )}
              {publication.url && (
                <Button variant="link" size="sm" asChild>
                  <a href={publication.url} target="_blank" rel="noreferrer">
                    View link <ExternalLink className="ml-1" />
                  </a>
                </Button>
              )}
            </div>
          </div>
          {owned && publication.approvalStatus !== "pending" && (
            <div className="flex items-center gap-3">
              <Label htmlFor={`visibility-${publication.id}`} className="text-sm">
                Public
              </Label>
              <Switch
                id={`visibility-${publication.id}`}
                checked={publication.isPublic}
                onCheckedChange={() => toggleVisibility(publication.id)}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl text-gray-900">Publications</h1>
          <p className="mt-2 text-gray-600">Explore PSU research and manage your own work.</p>
        </div>
        <Button onClick={() => setShowForm((open) => !open)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Research
        </Button>
      </div>

      {showForm && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>Upload or add research</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="research-title">Research title *</Label>
                <Input id="research-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="co-authors">Co-authors</Label>
                <Input id="co-authors" placeholder="Separate names with commas" value={form.coAuthors} onChange={(e) => setForm({ ...form, coAuthors: e.target.value })} />
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
                <Label htmlFor="journal">Journal or venue</Label>
                <Input id="journal" value={form.journal} onChange={(e) => setForm({ ...form, journal: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-year">Year *</Label>
                <Input id="research-year" type="number" min="2015" max="2026" required value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-link">Research link</Label>
                <Input id="research-link" type="url" placeholder="https://" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-file">PDF document</Label>
                <Input id="research-file" type="file" accept=".pdf,application/pdf" onChange={(e) => setForm({ ...form, fileName: e.target.files?.[0]?.name || "" })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="research-abstract">Abstract or progress notes</Label>
                <Textarea id="research-abstract" value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  <Upload className="mr-2 h-4 w-4" /> Save Research
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="public">
        <TabsList className="h-11">
          <TabsTrigger value="public" className="px-6"><BookOpen /> Public Research</TabsTrigger>
          <TabsTrigger value="mine" className="px-6"><FileText /> My Research</TabsTrigger>
        </TabsList>
        <TabsContent value="public" className="mt-4 space-y-4">
          {[...databasePublications, ...publicRecords].map((publication) => (
            <PublicationCard key={`${publication.id}-${"ownerId" in publication ? publication.ownerId : "database"}`} publication={publication} />
          ))}
        </TabsContent>
        <TabsContent value="mine" className="mt-4 space-y-4">
          {[...ownDatabasePublications, ...ownRecords].map((publication) => (
            <PublicationCard key={publication.id} publication={publication} owned={"ownerId" in publication} />
          ))}
          {ownDatabasePublications.length + ownRecords.length === 0 && (
            <Card><CardContent className="py-12 text-center text-gray-600">You have no assigned, claimed, or uploaded research yet.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
