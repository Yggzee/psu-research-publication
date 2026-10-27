import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Check,
  Edit2,
  KeyRound,
  Plus,
  Save,
  Shield,
  Trash2,
  Upload,
  UserCheck,
  X,
  RefreshCw,
  GraduationCap,
  ExternalLink,
  BookOpen,
  Mail,
  Copy,
  Clock,
  Send,
  Inbox,
  AlertCircle,
  CheckCircle2,
  Loader2,
  UserX,
  Search,
  Filter,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  FACULTY_DATA_KEY,
  getManagedResearchers,
  saveManagedResearchers,
  type ManagedResearcher,
} from "../utils/researchStore";
import {
  apiService,
  type PendingRegistration,
  type EmailLog,
} from "../services/api.service";
import { ApifyTokenManager } from "./ApifyTokenManager";
import { ScholarImportModal } from "./ScholarImportModal";
import { ConfirmModal } from "./ConfirmModal";
import {
  PageHeader,
  StatCard,
  StatusBadge,
  Notice,
  SectionCard,
  EmptyState,
  PageTabs,
  type TabItem,
} from "./common";

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
  sendInvite: true,
};

export function AdminPage() {
  const [researchers, setResearchers] = useState<ManagedResearcher[]>([]);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<string>("registrations");

  // Roster search & filter
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterDeptFilter, setRosterDeptFilter] = useState("all");

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Invitation creation result feedback banner
  const [inviteResult, setInviteResult] = useState<{
    name: string;
    email: string;
    verificationLink?: string;
    message: string;
  } | null>(null);

  // Action loading indicators
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Email Outbox / Audit Modal
  const [outboxOpen, setOutboxOpen] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loadingOutbox, setLoadingOutbox] = useState(false);

  // Delete Researcher Confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Reject Registration Confirmation
  const [rejectTarget, setRejectTarget] = useState<{ instructorId: string; name: string } | null>(null);

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
      const [researchersData, claimsData, registrationsData] = await Promise.all([
        apiService.getResearchers().catch(() => []),
        apiService.getClaims().catch(() => []),
        apiService.getPendingRegistrations().catch(() => []),
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
      const regs = Array.isArray(registrationsData) ? registrationsData : [];
      setPendingRegistrations(regs);

      // Auto-focus registrations if there are pending, otherwise researchers
      if (regs.length === 0 && activeTab === "registrations") {
        setActiveTab("researchers");
      }
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

    if (!form.email.trim()) {
      setFormError("Email address is required for researcher invitation & account verification.");
      return;
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      instructorId: form.instructorId.trim(),
      password: form.password ? form.password.trim() : undefined,
      department: form.isFaculty ? form.department : "Non Teaching",
      email: form.email.trim(),
      isFaculty: form.isFaculty,
      photoUrl: form.photoUrl,
      scholarUrl: form.scholarUrl.trim(),
      sendInvite: form.sendInvite,
    };

    try {
      if (editingId) {
        await apiService.updateResearcher(editingId, payload);
      } else {
        const res = await apiService.createResearcher(payload);
        if (res.verificationLink) {
          setInviteResult({
            name: `${payload.firstName} ${payload.lastName}`,
            email: payload.email,
            verificationLink: res.verificationLink,
            message: res.message,
          });
        }
      }
      await loadData();
      resetForm();
      window.dispatchEvent(new CustomEvent("researchers-updated"));
      window.dispatchEvent(new CustomEvent("faculty-updated"));
      window.dispatchEvent(new CustomEvent("research-records-updated"));
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
      sendInvite: false,
    });
    setEditingId(researcher.instructorId);
    setIsAdding(true);
    setActiveTab("researchers");
    setFormError("");
  };

  const confirmDeleteResearcher = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    try {
      await apiService.deleteResearcher(id);
      await loadData();
      window.dispatchEvent(new CustomEvent("researchers-updated"));
      window.dispatchEvent(new CustomEvent("faculty-updated"));
      window.dispatchEvent(new CustomEvent("research-records-updated"));
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

  const handleAdmitRegistration = async (instructorId: string, name: string) => {
    setActionLoadingId(instructorId);
    setActionSuccessMsg(null);
    try {
      const res = await apiService.admitRegistration(instructorId);
      setActionSuccessMsg(res.message || `${name} was officially admitted to the system.`);
      await loadData();
      window.dispatchEvent(new CustomEvent("researchers-updated"));
      window.dispatchEvent(new CustomEvent("faculty-updated"));
    } catch (err: any) {
      alert(err.message || "Failed to admit researcher.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmRejectRegistration = async () => {
    if (!rejectTarget) return;
    const { instructorId, name } = rejectTarget;
    setRejectTarget(null);
    setActionLoadingId(instructorId);
    try {
      await apiService.rejectRegistration(instructorId);
      setActionSuccessMsg(`Registration for ${name} was rejected.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to reject registration.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResendInvite = async (instructorId: string, email: string) => {
    setActionLoadingId(instructorId);
    try {
      const res = await apiService.resendInvite(instructorId);
      if (res.verificationLink) {
        setInviteResult({
          name: instructorId,
          email,
          verificationLink: res.verificationLink,
          message: res.message,
        });
      }
      setActionSuccessMsg(`Verification email successfully resent to ${email}.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to resend invite.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyLink = (tokenOrLink: string, id: string) => {
    const fullLink = tokenOrLink.startsWith("http")
      ? tokenOrLink
      : `${window.location.origin}/verify-invitation?token=${encodeURIComponent(tokenOrLink)}`;
    navigator.clipboard.writeText(fullLink);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const openOutboxModal = async () => {
    setOutboxOpen(true);
    setLoadingOutbox(true);
    try {
      const logs = await apiService.getEmailLogs();
      setEmailLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      console.warn("Failed to load email logs:", err);
    } finally {
      setLoadingOutbox(false);
    }
  };

  const facultyCount = researchers.filter((member) => member.isFaculty).length;
  const nonTeachingCount = researchers.length - facultyCount;

  // Filtered Roster
  const filteredResearchers = useMemo(() => {
    return researchers.filter((r) => {
      const matchesSearch =
        !rosterSearch.trim() ||
        r.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        r.instructorId.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        (r.email && r.email.toLowerCase().includes(rosterSearch.toLowerCase()));

      const matchesDept =
        rosterDeptFilter === "all" || r.department === rosterDeptFilter;

      return matchesSearch && matchesDept;
    });
  }, [researchers, rosterSearch, rosterDeptFilter]);

  // Tab definitions
  const adminTabs: TabItem[] = [
    {
      id: "registrations",
      label: "Registrations & Invites",
      count: pendingRegistrations.length,
      icon: UserCheck,
      badge: pendingRegistrations.length > 0 ? "Pending" : undefined,
    },
    {
      id: "researchers",
      label: "Faculty Roster",
      count: researchers.length,
      icon: GraduationCap,
    },
    {
      id: "claims",
      label: "Publication Claims",
      count: pendingClaims.length,
      icon: KeyRound,
      badge: pendingClaims.length > 0 ? "Action Needed" : undefined,
    },
    {
      id: "integrations",
      label: "Integrations & Tokens",
      icon: Send,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Admin Console"
        description="Manage faculty researcher profiles, review registration queues, and configure scraping tokens"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={openOutboxModal}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="Audit verification emails"
            >
              <Inbox className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Email Outbox</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sync Database</span>
            </Button>

            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setIsAdding(true);
                setActiveTab("researchers");
              }}
              className="h-8 gap-1.5 text-xs font-semibold bg-brand hover:bg-brand/90 text-white shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Invite Researcher</span>
            </Button>
          </div>
        }
      />

      {/* 2. Feedback Banners */}
      {actionSuccessMsg && (
        <Notice variant="success" onDismiss={() => setActionSuccessMsg(null)}>
          {actionSuccessMsg}
        </Notice>
      )}

      {inviteResult && (
        <Notice
          variant="info"
          title="Verification & Invitation Dispatched"
          onDismiss={() => setInviteResult(null)}
        >
          <p className="leading-relaxed">
            {inviteResult.message} The researcher ({inviteResult.name} • <strong>{inviteResult.email}</strong>) will click the verification link to choose their preferred password.
          </p>
          {inviteResult.verificationLink && (
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-muted-foreground">Direct Link:</span>
              <code className="text-xs font-mono bg-background px-2 py-0.5 rounded border border-border select-all max-w-full overflow-hidden text-ellipsis">
                {inviteResult.verificationLink}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopyLink(inviteResult.verificationLink!, "banner-link")}
                className="h-6 text-[11px] px-2 gap-1"
              >
                {copiedId === "banner-link" ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                {copiedId === "banner-link" ? "Copied" : "Copy Link"}
              </Button>
            </div>
          )}
        </Notice>
      )}

      {/* 3. Neutral StatCards Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Active Faculty"
          value={facultyCount}
          subtitle="Teaching instructors"
          icon={UserCheck}
        />
        <StatCard
          label="Non-Teaching Staff"
          value={nonTeachingCount}
          subtitle="Support & administrative"
          icon={Users}
        />
        <StatCard
          label="Pending Registrations"
          value={pendingRegistrations.length}
          subtitle="Awaiting admin approval"
          icon={Clock}
          trend={
            pendingRegistrations.length > 0
              ? { value: "Action Needed", isPositive: false }
              : undefined
          }
        />
        <StatCard
          label="Pending Claims"
          value={pendingClaims.length}
          subtitle="Paper authorship claims"
          icon={KeyRound}
          trend={
            pendingClaims.length > 0
              ? { value: "Review Required", isPositive: false }
              : undefined
          }
        />
      </div>

      {/* 4. Tab Strip */}
      <PageTabs tabs={adminTabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ===================================================================== */}
      {/* TAB 1: PENDING REGISTRATIONS & INVITATIONS                             */}
      {/* ===================================================================== */}
      {activeTab === "registrations" && (
        <SectionCard
          title="Registration & Invitation Queue"
          description="Researchers who self-registered or were invited by Admin. Once email is verified, admit them to officially recognize their profile."
          action={
            <Badge variant="outline" className="font-mono text-xs">
              {pendingRegistrations.length} pending
            </Badge>
          }
        >
          {pendingRegistrations.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All Registrations Up to Date"
              description="New sign-ups from the login page or invited faculty awaiting activation will appear in this queue."
            />
          ) : (
            <div className="divide-y divide-border/60">
              {pendingRegistrations.map((item) => (
                <div
                  key={item.instructorId || item.id}
                  className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground">{item.name}</p>
                      
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {item.registrationType === "self_registration" ? "Self-Registered" : "Admin Invited"}
                      </Badge>

                      <span className="text-xs text-muted-foreground font-medium">
                        {item.department} • {item.isFaculty ? "Faculty" : "Non-Teaching"}
                      </span>

                      {item.isEmailVerified ? (
                        <StatusBadge status="verified" label="Email Verified" />
                      ) : (
                        <StatusBadge status="pending" label="Pending Email Verification" />
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>ID: <strong className="text-foreground">{item.instructorId}</strong></span>
                      <span>Email: <strong className="text-foreground">{item.email}</strong></span>
                      <span>Registered: {new Date(item.createdAt).toLocaleDateString()}</span>
                    </p>

                    {item.scholarUrl && (
                      <div className="pt-1 flex items-center gap-2">
                        <a
                          href={item.scholarUrl.startsWith("http") ? item.scholarUrl : `https://scholar.google.com/citations?user=${item.scholarUrl}&hl=en`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline font-medium"
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>Google Scholar Profile</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-0 border-border/40">
                    {/* Admit Button */}
                    <Button
                      size="sm"
                      onClick={() => handleAdmitRegistration(item.instructorId, item.name)}
                      disabled={actionLoadingId === item.instructorId}
                      className="bg-success text-white hover:bg-success/90 text-xs h-8 gap-1.5"
                    >
                      {actionLoadingId === item.instructorId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Admit Researcher</span>
                    </Button>

                    {/* Resend Verification */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResendInvite(item.instructorId, item.email)}
                      disabled={actionLoadingId === item.instructorId}
                      className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Resend Verification</span>
                    </Button>

                    {/* Decline */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRejectTarget({ instructorId: item.instructorId, name: item.name })}
                      className="text-xs h-8 text-danger hover:bg-danger-soft hover:text-danger"
                    >
                      <UserX className="w-3.5 h-3.5 mr-1" />
                      <span>Decline</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: FACULTY RESEARCHERS ROSTER                                     */}
      {/* ===================================================================== */}
      {activeTab === "researchers" && (
        <div className="space-y-6">
          {/* Add / Edit Researcher Collapsible Form */}
          {isAdding && (
            <SectionCard
              title={editingId ? `Edit Researcher: ${editingId}` : "Invite & Register New Researcher"}
              description="Provide faculty credentials. An institutional invitation will be dispatched so they can activate their account."
              action={
                <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 text-xs">
                  Cancel
                </Button>
              }
            >
              {formError && (
                <Notice variant="danger" className="mb-4">
                  {formError}
                </Notice>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">First Name *</Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="e.g. Juan"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Last Name *</Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="e.g. Dela Cruz"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Instructor / Employee ID *</Label>
                  <Input
                    value={form.instructorId}
                    onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
                    placeholder="e.g. AS-2024-001"
                    disabled={Boolean(editingId)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Email Address *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="e.g. jdelacruz@psu.edu.ph"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Department</Label>
                  <Select
                    value={form.department}
                    onValueChange={(val) => setForm({ ...form, department: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept} className="text-xs">
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Google Scholar Profile (Optional)</Label>
                  <Input
                    value={form.scholarUrl}
                    onChange={(e) => setForm({ ...form, scholarUrl: e.target.value })}
                    placeholder="User ID or Profile URL"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/60">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={form.isFaculty}
                      onCheckedChange={(checked) => setForm({ ...form, isFaculty: Boolean(checked) })}
                    />
                    <span>Academic Faculty (Teaching)</span>
                  </label>

                  {!editingId && (
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={form.sendInvite}
                        onCheckedChange={(checked) => setForm({ ...form, sendInvite: Boolean(checked) })}
                      />
                      <span>Send email invitation link</span>
                    </label>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={resetForm} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveForm}
                    className="h-8 text-xs font-semibold bg-brand text-white"
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    <span>{editingId ? "Update Researcher" : "Create & Send Invitation"}</span>
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Roster Table Card */}
          <SectionCard
            title="Institutional Faculty Roster"
            description="Active faculty researchers officially recognized in the PSU Asingan tracking system"
            action={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-muted-foreground" />
                  <Input
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search roster..."
                    className="pl-8 h-8 text-xs w-40 sm:w-56 bg-card"
                  />
                </div>

                <Select value={rosterDeptFilter} onValueChange={setRosterDeptFilter}>
                  <SelectTrigger className="h-8 text-xs w-28">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Depts</SelectItem>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept} className="text-xs">
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          >
            {filteredResearchers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No Researchers Found"
                description={
                  rosterSearch || rosterDeptFilter !== "all"
                    ? "No faculty records match your active search filter."
                    : "Add faculty members using the Invite Researcher action above."
                }
              />
            ) : (
              <div className="divide-y divide-border/60">
                {filteredResearchers.map((researcher) => (
                  <div
                    key={researcher.instructorId}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border/70 flex items-center justify-center font-bold text-xs text-foreground shrink-0">
                        {researcher.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {researcher.name}
                          </p>
                          <StatusBadge
                            status={researcher.isFaculty ? "active" : "unpublished"}
                            label={researcher.isFaculty ? "Faculty" : "Non-Teaching"}
                          />
                          {researcher.scholarUrl && (
                            <a
                              href={researcher.scholarUrl.startsWith("http") ? researcher.scholarUrl : `https://scholar.google.com/citations?user=${researcher.scholarUrl}&hl=en`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline font-medium"
                            >
                              <GraduationCap className="w-3 h-3" /> Scholar Linked <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          ID: <strong className="font-mono">{researcher.instructorId}</strong> • {researcher.department} {researcher.email && `• ${researcher.email}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-border/40 justify-start sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openScholarReview(researcher.instructorId, researcher.name, researcher.scholarUrl)}
                        className="h-8 text-xs gap-1.5 text-brand border-brand/30 hover:bg-brand-soft"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>Sync Scholar</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editResearcher(researcher)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="Edit profile"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget({ id: researcher.instructorId, name: researcher.name })}
                        className="h-8 w-8 p-0 text-danger hover:bg-danger-soft hover:text-danger"
                        title="Remove researcher"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PUBLICATION CLAIMS                                             */}
      {/* ===================================================================== */}
      {activeTab === "claims" && (
        <SectionCard
          title="Publication Authorship Claims"
          description="Review papers discovered on Google Scholar that faculty members claimed as their original work"
          action={
            <Badge variant="outline" className="font-mono text-xs">
              {pendingClaims.length} pending
            </Badge>
          }
        >
          {pendingClaims.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No Pending Publication Claims"
              description="When faculty members search Google Scholar and submit a claim for an unassigned paper, it will appear here for review."
            />
          ) : (
            <div className="divide-y divide-border/60">
              {pendingClaims.map((claim) => (
                <div key={claim.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{claim.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Claimed by: <strong className="text-foreground">{claim.ownerName}</strong> ({claim.ownerId})
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      <span>Year: {claim.year}</span>
                      <span>Journal: {claim.journal || "Academic Repository"}</span>
                      <span>Citations: {claim.citations || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => reviewClaim(claim.id, "approved")}
                      className="h-8 text-xs bg-success text-white hover:bg-success/90 gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve Claim</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reviewClaim(claim.id, "rejected")}
                      className="h-8 text-xs text-danger border-danger-border hover:bg-danger-soft gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: INTEGRATIONS & AUDIT OUTBOX                                    */}
      {/* ===================================================================== */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
          <SectionCard
            title="Google Scholar Scraping Tokens"
            description="Manage Apify API token rotation and monthly usage limits for resilient Google Scholar imports"
          >
            <ApifyTokenManager />
          </SectionCard>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS & AUDIT OUTBOX                                                 */}
      {/* ===================================================================== */}

      {/* Email Outbox & Audit Logs Modal */}
      {outboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setOutboxOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border/70 bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-brand" />
                <h3 className="text-base font-bold text-foreground">
                  Email Outbox & Audit Logs ({emailLogs.length})
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOutboxOpen(false)}
                className="h-8 w-8 rounded-full text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Every dispatched or simulated invitation and verification email is audited here. You can copy active verification links directly for local testing.
            </p>

            {loadingOutbox ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 text-brand animate-spin" />
              </div>
            ) : emailLogs.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No emails logged yet.</p>
            ) : (
              <div className="space-y-2.5">
                {emailLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-muted/20 rounded-xl border border-border/60 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {log.subject}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                      <span>To: <strong className="text-foreground">{log.recipient_email}</strong></span>
                      <Badge variant="outline" className="text-[10px]">
                        {log.email_type}
                      </Badge>
                      <StatusBadge
                        status={log.status === "sent" ? "delivered" : "verified"}
                        label={log.status === "sent" ? "Delivered" : "Simulated"}
                      />
                    </div>

                    {log.verification_link && (
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <code className="text-[11px] font-mono text-brand truncate max-w-md bg-background px-2 py-0.5 rounded border border-border">
                          {log.verification_link}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyLink(log.verification_link!, log.id)}
                          className="h-6 text-[10px] px-2 gap-1"
                        >
                          {copiedId === log.id ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                          {copiedId === log.id ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Reject Registration Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(rejectTarget)}
        title="Decline Registration"
        message={`Are you sure you want to decline the researcher registration for ${rejectTarget?.name}? They will not be able to log in.`}
        confirmText="Decline Registration"
        cancelText="Cancel"
        variant="danger"
        icon="trash"
        onConfirm={handleConfirmRejectRegistration}
        onCancel={() => setRejectTarget(null)}
      />

      {/* Scholar Review & Import Modal */}
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
