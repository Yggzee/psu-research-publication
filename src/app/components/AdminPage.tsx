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
  Award,
  Sparkles,
  Star,
  Globe,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useNavigate } from "react-router";
import {
  FACULTY_DATA_KEY,
  getManagedResearchers,
  saveManagedResearchers,
  getCurrentUser,
  removeResearcherRecordsFromLocal,
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
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

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

  const [isClassifyingSDG, setIsClassifyingSDG] = useState(false);

  // Public Scraper & Quota Guardrail Settings
  const [publicScraperEnabled, setPublicScraperEnabled] = useState(true);
  const [scraperQuotaThreshold, setScraperQuotaThreshold] = useState("1.00");
  const [publicScraperStatus, setPublicScraperStatus] = useState<any>(null);
  const [isUpdatingScraperSettings, setIsUpdatingScraperSettings] = useState(false);

  const loadScraperSettings = async () => {
    try {
      const [settings, status] = await Promise.all([
        apiService.getAdminSettings().catch(() => ({})),
        apiService.getPublicScraperStatus().catch(() => null),
      ]);
      if (settings?.public_scraper_enabled !== undefined) {
        setPublicScraperEnabled(settings.public_scraper_enabled === "true");
      }
      if (settings?.scraper_quota_threshold_usd) {
        setScraperQuotaThreshold(settings.scraper_quota_threshold_usd);
      }
      if (status) {
        setPublicScraperStatus(status);
      }
    } catch {}
  };

  const handleTogglePublicScraper = async (newVal: boolean) => {
    setIsUpdatingScraperSettings(true);
    setPublicScraperEnabled(newVal);
    try {
      await apiService.updateAdminSettings({
        public_scraper_enabled: String(newVal),
        scraper_quota_threshold_usd: scraperQuotaThreshold,
      });
      toast.success(
        newVal
          ? "✓ Public access to Live Academic Scraper is now ENABLED."
          : "✓ Public access to Live Academic Scraper is now DISABLED (Institutional Repository only)."
      );
      loadScraperSettings();
    } catch (err: any) {
      toast.error(err.message || "Failed to update scraper settings.");
      setPublicScraperEnabled(!newVal);
    } finally {
      setIsUpdatingScraperSettings(false);
    }
  };

  const handleRunSDGClassification = async () => {
    setIsClassifyingSDG(true);
    toast.loading("Running AI UN SDG classifier on campus publications...", { id: "sdg-batch" });
    try {
      const res = await apiService.batchClassifySDG();
      toast.success(`✓ Successfully auto-tagged ${res.processed} campus publications into UN SDGs!`, { id: "sdg-batch" });
      await loadData();
    } catch (err: any) {
      toast.error(`Auto-classification error: ${err.message}`, { id: "sdg-batch" });
    } finally {
      setIsClassifyingSDG(false);
    }
  };

  const coordinatorData = useMemo(() => {
    const found = researchers.find((r) => {
      const id = (r.instructorId || r.id || "").toUpperCase();
      const name = (r.name || "").toLowerCase();
      const email = (r.email || "").toLowerCase();
      return (
        id === "PSU-002" ||
        name.includes("garin") ||
        name.includes("rodelio") ||
        email.includes("rodeliogarin")
      );
    });

    if (found) {
      return {
        name: found.name || "Sir Rodelio M. Garin",
        instructorId: found.instructorId || "PSU-002",
        department: found.department || "BSIT",
        email: found.email || "rodeliogarin@gmail.com",
        scholarUrl: found.scholarUrl || "https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en",
        totalPublications:
          typeof found.totalPublications === "number"
            ? found.totalPublications
            : Array.isArray((found as any).totalPublications)
            ? (found as any).totalPublications.length
            : Number(found.totalPublications) || 0,
        totalCitations:
          typeof found.totalCitations === "number"
            ? found.totalCitations
            : Number(found.totalCitations) || 0,
        photoUrl: found.photoUrl || "https://scholar.google.com/citations/images/avatar_scholar_128.png",
      };
    }

    return {
      name: "Sir Rodelio M. Garin",
      instructorId: "PSU-002",
      department: "BSIT",
      email: "rodeliogarin@gmail.com",
      scholarUrl: "https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en",
      totalPublications: 0,
      totalCitations: 0,
      photoUrl: "https://scholar.google.com/citations/images/avatar_scholar_128.png",
    };
  }, [researchers]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [researchersData, claimsData, registrationsData] = await Promise.all([
        apiService.getResearchers().catch(() => []),
        apiService.getClaims().catch(() => []),
        apiService.getPendingRegistrations().catch(() => []),
        loadScraperSettings().catch(() => null),
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
            totalPublications:
              typeof r.totalPublications === "number"
                ? r.totalPublications
                : Array.isArray(r.publications)
                ? r.publications.length
                : typeof r.publications === "number"
                ? r.publications
                : 0,
            totalCitations:
              typeof r.totalCitations === "number"
                ? r.totalCitations
                : typeof r.citations === "number"
                ? r.citations
                : 0,
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
    const parts = (researcher.name || "").trim().split(" ");
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : parts[0] || "";
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
    const { id, name } = deleteTarget;
    setDeleteTarget(null);
    try {
      const res: any = await apiService.deleteResearcher(id);
      removeResearcherRecordsFromLocal(id, name);
      toast.success(
        res?.message ||
          `Researcher ${name || id} and all their assigned publications have been removed from the system.`
      );
      await loadData();
      window.dispatchEvent(new CustomEvent("researchers-updated"));
      window.dispatchEvent(new CustomEvent("faculty-updated"));
      window.dispatchEvent(new CustomEvent("research-records-updated"));
    } catch (err: any) {
      console.error("Delete researcher error:", err);
      toast.error(err?.message || "Failed to remove researcher.");
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
      const res: any = await apiService.reviewClaim(claimId, status);
      toast.success(
        res?.message ||
          (status === "approved"
            ? "Publication claim approved and saved to the repository!"
            : "Publication claim rejected and removed.")
      );
      await loadData();
      window.dispatchEvent(new CustomEvent("researchers-updated"));
      window.dispatchEvent(new CustomEvent("research-records-updated"));
    } catch (err: any) {
      console.error("Review claim error:", err);
      toast.error(err?.message || "Failed to review publication claim.");
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
    const query = rosterSearch.trim().toLowerCase();
    return researchers.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const id = (r.instructorId || r.id || "").toLowerCase();
      const email = (r.email || "").toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        id.includes(query) ||
        email.includes(query);

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

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-destructive/30 bg-destructive/5 text-center p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Institutional Admin Access Restricted</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You do not have administrative privileges to manage faculty rosters, system credentials, or campus registrations.
            </p>
          </div>
          <Button
            onClick={() => navigate("/dashboard/publications")}
            className="w-full bg-brand text-white hover:bg-brand/90"
          >
            Return to My Publications
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Campus Research Administration & Governance"
        description="Pangasinan State University – Asingan Campus • Office of the Campus Research Coordinator"
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

      {/* 2. Personalized Coordinator Dossier & Command Header */}
      <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-blue-50/50 dark:to-blue-950/20 shadow-xs">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand/5 rounded-full blur-3xl pointer-events-none" />
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Coordinator Identity */}
            <div className="flex items-center gap-3.5 sm:gap-5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-brand/40 shadow-md bg-muted">
                  <img
                    src={coordinatorData.photoUrl || "https://scholar.google.com/citations/images/avatar_scholar_128.png"}
                    alt={coordinatorData.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div
                  className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1.5 shadow-xs border-2 border-card"
                  title="Verified Campus Research Coordinator"
                >
                  <Award className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-xl font-bold text-foreground tracking-tight">
                    Sir Rodelio M. Garin
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                    <Award className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    Campus Research Coordinator
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-muted text-muted-foreground border border-border">
                    PSU-002
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  Pangasinan State University – Asingan Campus • Department of Information Technology (BSIT)
                </p>

                <div className="flex items-center gap-2.5 sm:gap-3 text-xs text-muted-foreground pt-0.5 flex-wrap">
                  <span className="font-medium text-foreground">
                    <strong className="text-brand font-semibold">{coordinatorData.totalPublications}</strong> Publications
                  </span>
                  <span>•</span>
                  <span className="font-medium text-foreground">
                    <strong className="text-brand font-semibold">{coordinatorData.totalCitations}</strong> Citations
                  </span>
                  <span>•</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                    Campus Research Coordinator
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Quick Coordinator Actions */}
            <div className="flex items-center gap-2 flex-wrap lg:justify-end shrink-0 pt-3 lg:pt-0 border-t lg:border-0 border-border/50">
              <a
                href={coordinatorData.scholarUrl || "https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border/80 bg-background hover:bg-muted/60 text-foreground transition-all shadow-2xs"
              >
                <GraduationCap className="w-3.5 h-3.5 text-brand" />
                <span>Google Scholar</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>

              <Button
                size="sm"
                variant="outline"
                onClick={() => openScholarReview("PSU-002", "Sir Rodelio M. Garin", coordinatorData.scholarUrl)}
                className="h-8 text-xs gap-1.5 border-brand/30 text-brand hover:bg-brand-soft"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync My Papers</span>
              </Button>

              <Button
                size="sm"
                onClick={handleRunSDGClassification}
                disabled={isClassifyingSDG}
                className="h-8 text-xs gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                title="Batch auto-tag all campus research with UN SDGs via AI"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isClassifyingSDG ? "animate-spin" : ""}`} />
                <span>Auto-Tag UN SDGs</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
                {filteredResearchers.map((researcher) => {
                  const isCoordinator =
                    (researcher.instructorId || "").toUpperCase() === "PSU-002" ||
                    (researcher.name || "").toLowerCase().includes("garin");
                  const initial = (researcher.name || "R").trim().charAt(0).toUpperCase() || "R";

                  return (
                    <div
                      key={researcher.instructorId || researcher.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden ${
                          isCoordinator
                            ? "ring-2 ring-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40"
                            : "bg-muted/60 border-border/70 text-foreground"
                        }`}>
                          {researcher.photoUrl ? (
                            <img src={researcher.photoUrl} alt={researcher.name || "Researcher"} className="w-full h-full object-cover" />
                          ) : (
                            initial
                          )}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {researcher.name || "Unnamed Faculty"}
                            </p>
                            {isCoordinator && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 inline-flex items-center gap-1 shadow-2xs">
                                <Award className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                Campus Research Coordinator
                              </span>
                            )}
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
                            ID: <strong className="font-mono">{researcher.instructorId || "N/A"}</strong> • {researcher.department || "BSIT"} {researcher.email && `• ${researcher.email}`}
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
                  );
                })}
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
            title="Campus Research Unit Governance"
            description="Official research monitoring & quality assurance authority for PSU Asingan Campus"
          >
            <div className="p-4 sm:p-5 rounded-xl bg-muted/20 border border-border/70 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-border/50">
                <span className="font-semibold text-foreground">Designated Research Coordinator:</span>
                <span className="font-bold text-brand text-sm inline-flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  Sir Rodelio M. Garin
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-muted-foreground pt-1">
                <div>
                  <span className="block text-[11px] font-semibold text-foreground">Office & Campus Unit</span>
                  <span>Office of the Campus Research Coordinator • PSU Asingan</span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-foreground">Faculty & Department</span>
                  <span>PSU-002 • Department of Information Technology (BSIT)</span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-foreground">Reporting Standard</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    PSU RDO Target Apportionments & Citation Matrix
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-foreground">SDG Alignment Model</span>
                  <span>AI Multilabel Classifier (17 UN SDGs)</span>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Academic Index Scraping Tokens"
            description="Manage API token rotation and monthly usage limits for resilient academic literature imports"
          >
            <ApifyTokenManager />
          </SectionCard>

          {/* PUBLIC ACADEMIC SEARCH ACCESS & CIRCUIT BREAKER */}
          <SectionCard
            title="Public Academic Scraper & Quota Guardrail"
            description="Control whether students and external visitors can trigger live external academic searches, and monitor the automated $1.00 quota circuit breaker."
          >
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-muted/20">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-brand" />
                    <Label htmlFor="public-scraper-toggle" className="text-sm font-bold text-foreground">
                      Allow Public Use of Live Academic Scraper
                    </Label>
                    <Badge variant={publicScraperEnabled ? "default" : "secondary"} className="text-[10px]">
                      {publicScraperEnabled ? "Active" : "Disabled (Repository Only)"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    When enabled, unauthenticated visitors and students can search global literature (with 3-Tier ranking and auto SDG tags). When disabled, public visitors can search the institutional repository only.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    id="public-scraper-toggle"
                    type="button"
                    variant={publicScraperEnabled ? "default" : "outline"}
                    size="sm"
                    disabled={isUpdatingScraperSettings}
                    onClick={() => handleTogglePublicScraper(!publicScraperEnabled)}
                    className="font-bold text-xs"
                  >
                    {publicScraperEnabled ? "Disable Public Scraper" : "Enable Public Scraper"}
                  </Button>
                </div>
              </div>

              {/* Automated Circuit Breaker Card */}
              <div className="p-4 rounded-xl border border-border/70 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    Automated Quota Circuit Breaker ($1.00 Threshold Protection)
                  </span>
                  <p className="text-muted-foreground text-[11px]">
                    If remaining external API balance falls to ${scraperQuotaThreshold} or below, the system automatically shuts off public search to protect institutional credit.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-[11px]">
                  {publicScraperStatus?.quotaCircuitBreakerTripped ? (
                    <Badge variant="destructive" className="gap-1 font-bold">
                      Circuit Breaker Tripped (Power-Save Active)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
                      Circuit Breaker Normal (${publicScraperStatus?.remainingBalanceUsd?.toFixed(2) ?? "5.00"} Remaining)
                    </Badge>
                  )}
                </div>
              </div>
            </div>
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
        title="Remove Researcher & Assigned Publications"
        message={`Are you sure you want to remove researcher ${deleteTarget?.name || deleteTarget?.id}? Their login credentials, profile associations, and ALL publications tied to this researcher will be permanently deleted from the repository.`}
        confirmText="Remove Researcher & Publications"
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
