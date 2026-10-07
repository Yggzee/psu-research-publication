import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Check, Edit2, KeyRound, Plus, Save, Shield, Trash2, Upload, UserCheck, X, RefreshCw } from "lucide-react";
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
};

export function AdminPage() {
  const [researchers, setResearchers] = useState<ManagedResearcher[]>(getManagedResearchers);
  const [claims, setClaims] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load from SQLite database on mount
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [resData, claimsData] = await Promise.all([
        apiService.getResearchers().catch(() => []),
        apiService.getClaims().catch(() => []),
      ]);

      if (Array.isArray(resData)) {
        const mapped: ManagedResearcher[] = resData.map((r: any) => ({
          id: r.id,
          name: r.name,
          firstName: r.firstName || r.name.split(" ")[0],
          lastName: r.lastName || r.name.split(" ").slice(1).join(" "),
          instructorId: r.instructorId,
          department: r.department,
          isFaculty: r.isFaculty ?? true,
          photoUrl: r.photoUrl,
          totalPublications: r.totalPublications || 0,
          totalCitations: r.totalCitations || 0,
        }));
        setResearchers(mapped);
        saveManagedResearchers(mapped);
      }

      if (Array.isArray(claimsData)) {
        setClaims(claimsData);
      }
    } catch (err) {
      console.warn("Error loading from database:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingClaims = useMemo(
    () => claims.filter((claim) => claim.approval_status === "pending" || claim.approvalStatus === "pending"),
    [claims],
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setIsAdding(false);
  };

  const validateForm = () => {
    if (!form.lastName.trim() || !form.firstName.trim() || !form.instructorId.trim() || (!editingId && !form.password)) {
      setFormError("Last name, first name, instructor ID, and password are required.");
      return false;
    }
    if (
      researchers.some(
        (member) =>
          member.instructorId.toLowerCase() === form.instructorId.trim().toLowerCase() &&
          member.instructorId !== editingId,
      )
    ) {
      setFormError("That instructor ID is already in use.");
      return false;
    }
    return true;
  };

  const saveForm = async () => {
    if (!validateForm()) return;

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      instructorId: form.instructorId.trim(),
      password: form.password,
      email: form.email.trim() || `${form.instructorId.trim().toLowerCase()}@psu.edu.ph`,
      department: form.isFaculty ? form.department : "Non Teaching",
      isFaculty: form.isFaculty,
      photoUrl: form.photoUrl || undefined,
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
      console.error("Save researcher error:", err);
      setFormError(err.message || "Failed to save researcher to database.");
    }
  };

  const editResearcher = (researcher: ManagedResearcher) => {
    setForm({
      lastName: researcher.lastName,
      firstName: researcher.firstName,
      instructorId: researcher.instructorId,
      password: researcher.password || "",
      department: researcher.department,
      isFaculty: researcher.isFaculty,
      photoUrl: researcher.photoUrl || "",
      email: researcher.email || "",
    });
    setEditingId(researcher.instructorId);
    setIsAdding(true);
    setFormError("");
  };

  const deleteResearcher = async (instructorId: string) => {
    if (!confirm(`Are you sure you want to remove researcher ${instructorId}?`)) return;
    try {
      await apiService.deleteResearcher(instructorId);
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
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl text-gray-900">Admin Panel</h1>
          </div>
          <p className="text-gray-600">
            Manage researcher accounts in the database and review publication claims.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="self-start">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Sync Database
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Faculty Members</CardTitle>
            <UserCheck className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold">{facultyCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Non-Teaching Personnel</CardTitle>
            <UserCheck className="h-5 w-5 text-gray-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold">{nonTeachingCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Pending Claims</CardTitle>
            <KeyRound className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold">{pendingClaims.length}</div></CardContent>
        </Card>
      </div>

      {/* Claims Review */}
      <Card className={pendingClaims.length ? "border-amber-200" : ""}>
        <CardHeader>
          <CardTitle>Research Claims ({pendingClaims.length} pending)</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingClaims.length === 0 ? (
            <p className="py-6 text-center text-gray-500">No research claims awaiting review.</p>
          ) : (
            <div className="space-y-3">
              {pendingClaims.map((claim) => (
                <div key={claim.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-gray-200 p-4">
                  <div>
                    <p className="font-medium text-gray-900">{claim.title}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      Claimed by {claim.owner_name || claim.ownerName} • {claim.journal} • {claim.year}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => reviewClaim(claim.id, "approved")} className="bg-green-600 hover:bg-green-700">
                      <Check className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reviewClaim(claim.id, "rejected")} className="text-red-600">
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

      {/* Add / Edit Form */}
      {isAdding && (
        <Card className="border-2 border-blue-300">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Researcher" : "Add New Researcher"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name *</Label>
                <Input id="last-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="e.g. Santos" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-name">First Name *</Label>
                <Input id="first-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="e.g. Maria" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructor-id">Instructor ID / Username *</Label>
                <Input id="instructor-id" value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })} placeholder="e.g. PSU-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-password">Login Password *</Label>
                <Input id="account-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-email">Email Address</Label>
                <Input id="account-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. msantos@psu.edu.ph" />
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
                  <SelectTrigger id="researcher-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="non-teaching">Non-Teaching Personnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="researcher-department">Department *</Label>
                <Select value={form.isFaculty ? form.department : "Non Teaching"} disabled={!form.isFaculty} onValueChange={(department) => setForm({ ...form, department })}>
                  <SelectTrigger id="researcher-department"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="profile-photo">Profile Photo</Label>
                <div className="flex items-center gap-4">
                  {form.photoUrl && <img src={form.photoUrl} alt="Profile preview" className="h-16 w-16 rounded-full object-cover border" />}
                  <Input id="profile-photo" type="file" accept="image/*" onChange={handlePhotoUpload} />
                </div>
              </div>
              {formError && <p className="text-sm text-red-600 md:col-span-2">{formError}</p>}
              <div className="flex gap-2 md:col-span-2">
                <Button onClick={saveForm} className="bg-green-600 hover:bg-green-700">
                  <Save className="mr-2 h-4 w-4" /> {editingId ? "Update" : "Save Researcher"}
                </Button>
                <Button variant="outline" onClick={resetForm}><X className="mr-2 h-4 w-4" /> Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isAdding && (
        <div className="flex gap-2">
          <Button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" /> Add New Researcher
          </Button>
        </div>
      )}

      {/* Researcher Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Researchers ({researchers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {researchers.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <UserCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p className="text-base font-medium">No researchers in the database yet.</p>
              <p className="text-sm mt-1">Click "Add New Researcher" above to create researcher accounts with login credentials.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {researchers.map((researcher) => (
                <div key={researcher.instructorId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-4">
                    {researcher.photoUrl ? (
                      <img src={researcher.photoUrl} alt={researcher.name} className="h-12 w-12 rounded-full object-cover border" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold">
                        {researcher.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{researcher.name}</p>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          {researcher.isFaculty ? "Faculty" : "Non-Teaching"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">ID: {researcher.instructorId} • {researcher.department}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-center">
                    <Button variant="ghost" size="sm" onClick={() => editResearcher(researcher)}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteResearcher(researcher.instructorId)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="flex items-start gap-3 py-4">
          <Upload className="mt-0.5 h-5 w-5 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-900">
            <strong>Direct Credential Generation</strong>: When you add a researcher here, their account is saved to the SQLite database. They can immediately log into the system with their Instructor ID and password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
