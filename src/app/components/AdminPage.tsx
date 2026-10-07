import { useMemo, useState } from "react";
import { Check, Edit2, KeyRound, Plus, Save, Shield, Trash2, Upload, UserCheck, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  FACULTY_DATA_KEY,
  getDefaultManagedResearchers,
  getManagedResearchers,
  getResearchRecords,
  updateResearchRecord,
  type ManagedResearcher,
  type StoredPublication,
} from "../utils/researchStore";

const DEPARTMENTS = ["BSIT", "BSBA", "BSE", "BEE", "BTLED", "BIT", "Non Teaching"];
const FACULTY_LIST_KEY = "psu_faculty_members";

const emptyForm = {
  lastName: "",
  firstName: "",
  instructorId: "",
  password: "",
  department: "BSIT",
  isFaculty: true,
  photoUrl: "",
};

export function AdminPage() {
  const [researchers, setResearchers] = useState<ManagedResearcher[]>(getManagedResearchers);
  const [claims, setClaims] = useState<StoredPublication[]>(
    () => getResearchRecords().filter((record) => record.source === "claim"),
  );
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const pendingClaims = useMemo(
    () => claims.filter((claim) => claim.approvalStatus === "pending"),
    [claims],
  );

  const saveResearchers = (nextResearchers: ManagedResearcher[]) => {
    setResearchers(nextResearchers);
    localStorage.setItem(FACULTY_DATA_KEY, JSON.stringify(nextResearchers));
    localStorage.setItem(
      FACULTY_LIST_KEY,
      JSON.stringify(nextResearchers.filter((member) => member.isFaculty).map((member) => member.name)),
    );
    window.dispatchEvent(new Event("storage"));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setIsAdding(false);
  };

  const validateForm = () => {
    if (!form.lastName.trim() || !form.firstName.trim() || !form.instructorId.trim() || !form.password) {
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

  const saveForm = () => {
    if (!validateForm()) return;
    const member: ManagedResearcher = {
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      instructorId: form.instructorId.trim(),
      department: form.isFaculty ? form.department : "Non Teaching",
      name: `${form.firstName.trim()} ${form.lastName.trim()}`,
      photoUrl: form.photoUrl || undefined,
    };

    saveResearchers(
      editingId
        ? researchers.map((researcher) => researcher.instructorId === editingId ? member : researcher)
        : [...researchers, member],
    );
    resetForm();
  };

  const editResearcher = (researcher: ManagedResearcher) => {
    setForm({
      lastName: researcher.lastName,
      firstName: researcher.firstName,
      instructorId: researcher.instructorId,
      password: researcher.password,
      department: researcher.department,
      isFaculty: researcher.isFaculty,
      photoUrl: researcher.photoUrl || "",
    });
    setEditingId(researcher.instructorId);
    setIsAdding(true);
    setFormError("");
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setForm((current) => ({ ...current, photoUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const reviewClaim = (claimId: string, approvalStatus: "approved" | "rejected") => {
    updateResearchRecord(claimId, { approvalStatus });
    setClaims(
      getResearchRecords().filter((record) => record.source === "claim"),
    );
  };

  const facultyCount = researchers.filter((member) => member.isFaculty).length;
  const nonTeachingCount = researchers.length - facultyCount;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl text-gray-900">Admin Panel</h1>
        </div>
        <p className="text-gray-600">Manage researcher accounts and review publication claims.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Faculty</CardTitle>
            <UserCheck className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent><div className="text-2xl">{facultyCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Non-Teaching Personnel</CardTitle>
            <UserCheck className="h-5 w-5 text-gray-500" />
          </CardHeader>
          <CardContent><div className="text-2xl">{nonTeachingCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Pending Claims</CardTitle>
            <KeyRound className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent><div className="text-2xl">{pendingClaims.length}</div></CardContent>
        </Card>
      </div>

      <Card className={pendingClaims.length ? "border-amber-200" : ""}>
        <CardHeader>
          <CardTitle>Research Claims ({pendingClaims.length} pending)</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingClaims.length === 0 ? (
            <p className="py-6 text-center text-gray-500">No research claims need review.</p>
          ) : (
            <div className="space-y-3">
              {pendingClaims.map((claim) => (
                <div key={claim.id} className="flex items-center justify-between gap-6 rounded-lg border border-gray-200 p-4">
                  <div>
                    <p className="font-medium text-gray-900">{claim.title}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      Claimed by {claim.ownerName} • {claim.journal} • {claim.year}
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

      {isAdding && (
        <Card className="border-2 border-blue-300">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Researcher" : "Add Researcher"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name *</Label>
                <Input id="last-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-name">First Name *</Label>
                <Input id="first-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructor-id">Instructor ID *</Label>
                <Input id="instructor-id" value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-password">Password *</Label>
                <Input id="account-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
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
                  {form.photoUrl && <img src={form.photoUrl} alt="Profile preview" className="h-16 w-16 rounded-full object-cover" />}
                  <Input id="profile-photo" type="file" accept="image/*" onChange={handlePhotoUpload} />
                </div>
              </div>
              {formError && <p className="text-sm text-red-600 md:col-span-2">{formError}</p>}
              <div className="flex gap-2 md:col-span-2">
                <Button onClick={saveForm} className="bg-green-600 hover:bg-green-700">
                  <Save className="mr-2 h-4 w-4" /> {editingId ? "Update" : "Add"} Researcher
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
          <Button variant="outline" onClick={() => saveResearchers(getDefaultManagedResearchers())}>
            Reset to Default
          </Button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Researcher Accounts ({researchers.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {researchers.map((researcher) => (
              <div key={researcher.instructorId} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-4">
                  {researcher.photoUrl ? (
                    <img src={researcher.photoUrl} alt={researcher.name} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                      <UserCheck className="h-6 w-6 text-blue-600" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{researcher.name}</p>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                        {researcher.isFaculty ? "Faculty" : "Non-Teaching Personnel"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{researcher.instructorId} • {researcher.department}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => editResearcher(researcher)}><Edit2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => saveResearchers(researchers.filter((member) => member.instructorId !== researcher.instructorId))} className="text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="flex items-start gap-3 py-4">
          <Upload className="mt-0.5 h-5 w-5 text-blue-600" />
          <p className="text-sm text-blue-900">
            Instructor IDs and passwords created here can be used on the main login page. Profile photos and account data are stored locally for this prototype.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
