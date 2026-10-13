import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Check, Edit2, KeyRound, Plus, Save, Shield, Trash2, Upload, UserCheck, X, RefreshCw, GraduationCap, ExternalLink, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  FACULTY_DATA_KEY,
  getManagedResearchers,
  saveManagedResearchers,
  type ManagedResearcher,
} from "../utils/researchStore";
import { apiService } from "../services/api.service";
import { ApifyTokenManager } from "./ApifyTokenManager";
import { ScholarImportModal } from "./ScholarImportModal";
import { ConfirmModal } from "./ConfirmModal";

const DEPARTMENTS = ["BSIT", "BSBA", "BSE", "BEE", "BTLED", "BIT", "Non Teaching"];

const emptyForm = {
  lastName: "",
  firstName: "",
  instructorId: "",
  password: "",
  department: "BSIT",
  isFaculty: true,
  photoUrl: "",
  email: "",
  scholarUrl: "",
};

export function AdminPage() {
  const [researchers, setResearchers] = useState<ManagedResearcher[]>([]);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Delete Researcher Confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Review & Import Google Scholar Modal State
  const [scholarModalOpen, setScholarModalOpen] = useState(false);
  const [modalTargetResearcher, setModalTargetResearcher] = useState<{
    instructorId: string;
    name: string;
    scholarUrl?: string;
    details?: any;
  } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [researchersData, claimsData] = await Promise.all([
        apiService.getResearchers().catch(() => []),
        apiService.getClaims().catch(() => []),
      ]);

      if (Array.isArray(researchersData)) {
        const mapped: ManagedResearcher[] = (researchersData as any[]).map((r) => {
          const parts = (r.name || "").trim().split(" ");
          const firstName = r.firstName || (parts.length > 1 ? parts[0] : r.name || "");
          const lastName = r.lastName || (parts.length > 1 ? parts.slice(1).join(" ") : "");
          return {
            id: r.id,
            instructorId: r.instructorId || r.id || "",
            firstName,
            lastName,
            name: r.name || `${firstName} ${lastName}`.trim(),
            department: r.department || "BSIT",
            isFaculty: r.isFaculty ?? true,
            email: r.email || "",
            photoUrl: r.photoUrl || "",
            scholarUrl: r.scholarUrl || "",
            googleScholarId: r.googleScholarId || "",
            totalPublications: r.publications || r.totalPublications || 0,
            totalCitations: r.citations || r.totalCitations || 0,
          };
        });
        setResearchers(mapped);
        saveManagedResearchers(mapped);
      } else {
        setResearchers(getManagedResearchers());
      }

      setPendingClaims(Array.isArray(claimsData) ? claimsData : []);
    } catch (err) {
      console.warn("Failed to load admin data from API, using local storage:", err);
      setResearchers(getManagedResearchers());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openScholarReview = (
    instructorId: string,
    name: string,
    scholarUrl?: string,
    formDetails?: any
  ) => {
    setModalTargetResearcher({
      instructorId,
      name,
      scholarUrl,
      details: formDetails || null,
    });
    setScholarModalOpen(true);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsAdding(false);
    setFormError("");
  };

  const saveForm = async () => {
    if (!form.lastName.trim() || !form.firstName.trim() || !form.instructorId.trim()) {
      setFormError("Last name, first name, and Instructor ID are required.");
      return;
    }

    if (!editingId && !form.password.trim()) {
      setFormError("Password is required for new accounts.");
      return;
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      instructorId: form.instructorId.trim(),
      password: form.password ? form.password.trim() : "",
      department: form.isFaculty ? form.department : "Non Teaching",
      email: form.email.trim(),
      isFaculty: form.isFaculty,
      photoUrl: form.photoUrl,
      scholarUrl: form.scholarUrl.trim(),
    };

    try {
      if (editingId) {
        await apiService.updateResearcher(editingId, payload);
      } else {
        await apiService.createResearcher(payload);
      }
      await loadData();
      resetForm();
    } catch (err: any) {
      setFormError(err.message || "Failed to save researcher.");
    }
  };

  const editResearcher = (researcher: ManagedResearcher) => {
    const parts = researcher.name.split(" ");
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
    const firstName = parts.length > 1 ? parts[0] : "";

    setForm({
      lastName,
      firstName,
      instructorId: researcher.instructorId,
      password: "",
      department: researcher.department || "BSIT",
      isFaculty: researcher.isFaculty ?? true,
      photoUrl: researcher.photoUrl || "",
      email: researcher.email || "",
      scholarUrl: researcher.scholarUrl || "",
    });
    setEditingId(researcher.instructorId);
    setIsAdding(true);
    setFormError("");
  };

  const confirmDeleteResearcher = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    try {
      await apiService.deleteResearcher(id);
      await loadData();
    } catch (err) {
      console.error("Delete researcher error:", err);
    }
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setForm((current) => ({ ...current, photoUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const reviewClaim = async (claimId: string, status: "approved" | "rejected") => {
    try {
      await apiService.reviewClaim(claimId, status);
      await loadData();
    } catch (err) {
      console.error("Review claim error:", err);
    }
  };

  const facultyCount = researchers.filter((member) => member.isFaculty).length;
  const nonTeachingCount = researchers.length - facultyCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl text-gray-900 dark:text-gray-100 font-bold">Admin Panel</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Manage researcher accounts in the database and review publication claims.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="self-start dark:border-gray-700">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Sync Database
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="dark:border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Faculty Members</CardTitle>
            <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold text-foreground">{facultyCount}</div></CardContent>
        </Card>
        <Card className="dark:border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Non-Teaching Personnel</CardTitle>
            <UserCheck className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold text-foreground">{nonTeachingCount}</div></CardContent>
        </Card>
        <Card className="dark:border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Pending Claims</CardTitle>
            <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold text-foreground">{pendingClaims.length}</div></CardContent>
        </Card>
      </div>

      {/* Claims Review */}
      <Card className={pendingClaims.length ? "border-amber-200 dark:border-amber-900/60" : "dark:border-gray-800"}>
        <CardHeader>
          <CardTitle>Research Claims ({pendingClaims.length} pending)</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingClaims.length === 0 ? (
            <p className="py-6 text-center text-gray-500 dark:text-gray-400">No research claims awaiting review.</p>
          ) : (
            <div className="space-y-3">
              {pendingClaims.map((claim) => (
                <div key={claim.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{claim.title}</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Claimed by {claim.owner_name || claim.ownerName} • {claim.journal} • {claim.year}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => reviewClaim(claim.id, "approved")} className="bg-green-600 hover:bg-green-700 text-white">
                      <Check className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reviewClaim(claim.id, "rejected")} className="text-red-600 dark:text-red-400 dark:border-gray-700">
                      <X className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apify Scraper Multi-Token Integration */}
      <ApifyTokenManager />

      {/* Action Bar for Adding Researcher */}
      <div className="flex items-center justify-between">
        <Button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="mr-2 h-4 w-4" /> Add New Researcher
        </Button>
      </div>

      {/* Add / Edit Form Modal with Blurred Backdrop */}
      {isAdding && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={resetForm}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {editingId ? "Edit Researcher" : "Add New Researcher"}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetForm}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name *</Label>
                <Input id="last-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="e.g. Santos" className="dark:border-gray-700" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-name">First Name *</Label>
                <Input id="first-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="e.g. Maria" className="dark:border-gray-700" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructor-id">Instructor ID / Username *</Label>
                <Input id="instructor-id" value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })} placeholder="e.g. PSU-001" className="dark:border-gray-700" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-password">Login Password {editingId ? "(Leave empty to keep current)" : "*"}</Label>
                <Input id="account-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingId ? "Optional password update" : "Temporary password"} className="dark:border-gray-700" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-email">Email Address</Label>
                <Input id="account-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. msantos@psu.edu.ph" className="dark:border-gray-700" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="researcher-status">Status *</Label>
                <Select
                  value={form.isFaculty ? "faculty" : "non-teaching"}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      isFaculty: value === "faculty",
                      department: value === "faculty" && form.department === "Non Teaching" ? "BSIT" : form.department,
                    })
                  }
                >
                  <SelectTrigger id="researcher-status" className="dark:border-gray-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="non-teaching">Non-Teaching Personnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="researcher-department">Department *</Label>
                <Select value={form.isFaculty ? form.department : "Non Teaching"} disabled={!form.isFaculty} onValueChange={(department) => setForm({ ...form, department })}>
                  <SelectTrigger id="researcher-department" className="dark:border-gray-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="scholar-url" className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Google Scholar Profile URL or User ID (Optional)
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="scholar-url"
                    value={form.scholarUrl}
                    onChange={(e) => setForm({ ...form, scholarUrl: e.target.value })}
                    placeholder="e.g. https://scholar.google.com/citations?user=... or User ID"
                    className="dark:border-gray-700"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!form.instructorId || !form.firstName) {
                        setFormError("Please enter First Name, Last Name, and Instructor ID first.");
                        return;
                      }
                      openScholarReview(
                        form.instructorId,
                        `${form.firstName.trim()} ${form.lastName.trim()}`,
                        form.scholarUrl,
                        {
                          firstName: form.firstName.trim(),
                          lastName: form.lastName.trim(),
                          instructorId: form.instructorId.trim(),
                          password: form.password,
                          department: form.isFaculty ? form.department : "Non Teaching",
                          email: form.email.trim(),
                          isFaculty: form.isFaculty,
                          photoUrl: form.photoUrl,
                        }
                      );
                    }}
                    disabled={!form.scholarUrl.trim()}
                    className="whitespace-nowrap border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  >
                    <BookOpen className="w-4 h-4 mr-1.5" />
                    Fetch & Review Publications
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Import verified publications with automatic PSU faculty vs Non-PSU external collaborator detection.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="profile-photo">Profile Photo</Label>
                <div className="flex items-center gap-4">
                  {form.photoUrl && <img src={form.photoUrl} alt="Profile preview" className="h-16 w-16 rounded-full object-cover border dark:border-gray-700" />}
                  <Input id="profile-photo" type="file" accept="image/*" onChange={handlePhotoUpload} className="dark:border-gray-700" />
                </div>
              </div>
              {formError && <p className="text-sm text-red-600 dark:text-red-400 md:col-span-2">{formError}</p>}
              <div className="flex justify-end gap-2 md:col-span-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={resetForm} className="dark:border-gray-700"><X className="mr-2 h-4 w-4" /> Cancel</Button>
                <Button onClick={saveForm} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Save className="mr-2 h-4 w-4" /> {editingId ? "Update Researcher" : "Save Researcher"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Researcher Accounts List */}
      <Card className="dark:border-gray-800">
        <CardHeader>
          <CardTitle>Registered Researchers ({researchers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {researchers.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              <UserCheck className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-base font-medium">No researchers in the database yet.</p>
              <p className="text-sm mt-1">Click "Add New Researcher" above to create researcher accounts with login credentials.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {researchers.map((researcher) => (
                <div key={researcher.instructorId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-4">
                    {researcher.photoUrl ? (
                      <img src={researcher.photoUrl} alt={researcher.name} className="h-12 w-12 rounded-full object-cover border dark:border-gray-700" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold">
                        {researcher.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{researcher.name}</p>
                        <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                          {researcher.isFaculty ? "Faculty" : "Non-Teaching"}
                        </span>
                        {researcher.scholarUrl && (
                          <a
                            href={researcher.scholarUrl.startsWith("http") ? researcher.scholarUrl : `https://scholar.google.com/citations?user=${researcher.scholarUrl}&hl=en`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/50"
                            title="View Google Scholar Profile"
                          >
                            <GraduationCap className="w-3 h-3" /> Scholar Linked <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">ID: {researcher.instructorId} • {researcher.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openScholarReview(researcher.instructorId, researcher.name, researcher.scholarUrl)}
                      className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs h-8"
                      title="Import & Review publications from Google Scholar"
                    >
                      <GraduationCap className="w-3.5 h-3.5 mr-1" /> Import Scholar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => editResearcher(researcher)} className="dark:text-gray-300 hover:text-foreground"><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ id: researcher.instructorId, name: researcher.name })} className="text-red-600 hover:text-red-700 dark:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50">
        <CardContent className="flex items-start gap-3 py-4">
          <Upload className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Direct Credential Generation</strong>: When you add a researcher here, their account is saved to the SQLite database. They can immediately log into the system with their Instructor ID and password.
          </p>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Remove Researcher"
        message={`Are you sure you want to remove researcher ${deleteTarget?.name || deleteTarget?.id}? Their login credentials and profile associations will be deleted.`}
        confirmText="Remove Researcher"
        cancelText="Cancel"
        variant="danger"
        icon="trash"
        onConfirm={confirmDeleteResearcher}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Option B: Google Scholar Review & Import Modal */}
      {modalTargetResearcher && (
        <ScholarImportModal
          isOpen={scholarModalOpen}
          onClose={() => {
            setScholarModalOpen(false);
            setModalTargetResearcher(null);
          }}
          instructorId={modalTargetResearcher.instructorId}
          researcherName={modalTargetResearcher.name}
          initialScholarUrl={modalTargetResearcher.scholarUrl}
          researcherDetails={modalTargetResearcher.details}
          onImportSuccess={async () => {
            await loadData();
            resetForm();
          }}
        />
      )}
    </div>
  );
}
