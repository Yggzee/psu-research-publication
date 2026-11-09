import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { getCurrentUser, updateCurrentUser, SessionUser } from "../utils/researchStore";
import { apiService } from "../services/api.service";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  getFacultyPhoto,
  isPSUPaper,
  hasExternalCollaborators,
  categorizeAuthors,
} from "../utils/facultyUtils";
import {
  User,
  Mail,
  Building,
  GraduationCap,
  BookOpen,
  Quote,
  ExternalLink,
  Edit3,
  Loader2,
  ShieldCheck,
  Save,
  X,
  Award,
  FileText,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, StatusBadge, EmptyState } from "./common";

type SortOption = "year" | "citations" | "journal";

export function ProfilePage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUserState] = useState<SessionUser>(() => {
    const user = getCurrentUser();
    if (!user) return { role: "instructor", name: "Researcher" };
    if (user.role === "admin") {
      return {
        ...user,
        name: user.name && !user.name.toLowerCase().includes("admin") ? user.name : "Sir Rodelio M. Garin",
        email: user.email && !user.email.includes("admin@") ? user.email : "rodeliogarin@gmail.com",
        department: user.department && !user.department.includes("Information Technology") ? user.department : "Campus Research Unit / BSIT",
        scholarUrl: user.scholarUrl || "https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en",
        googleScholarId: user.googleScholarId || "x6PdtN8AAAAJ",
        instructorId: user.instructorId && user.instructorId !== "admin" ? user.instructorId : "PSU-002",
      };
    }
    return user;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publications, setPublications] = useState<any[]>([]);
  const [loadingPubs, setLoadingPubs] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("year");
  const [stats, setStats] = useState({ totalPublications: 0, totalCitations: 0 });

  const [formData, setFormData] = useState({
    name: currentUser.name || "",
    email: currentUser.email || "",
    department: currentUser.department || "Campus Research Unit / BSIT",
    photoUrl: currentUser.photoUrl || "",
    scholarUrl: currentUser.scholarUrl || "",
    googleScholarId: currentUser.googleScholarId || "",
  });

  // Load user details and their publications
  const loadProfileAndPublications = async () => {
    setLoadingPubs(true);
    try {
      const activeUser = getCurrentUser() || currentUser;
      const isCoordinator =
        activeUser.role === "admin" ||
        (activeUser.name && activeUser.name.toLowerCase().includes("garin")) ||
        activeUser.instructorId === "PSU-002";

      // If Research Coordinator, guarantee default scholar credentials if missing
      const resolvedUser: SessionUser = isCoordinator
        ? {
            ...activeUser,
            name: activeUser.name && !activeUser.name.toLowerCase().includes("admin") ? activeUser.name : "Sir Rodelio M. Garin",
            email: activeUser.email && !activeUser.email.includes("admin@") ? activeUser.email : "rodeliogarin@gmail.com",
            department: activeUser.department && !activeUser.department.includes("Information Technology") ? activeUser.department : "Campus Research Unit / BSIT",
            scholarUrl: activeUser.scholarUrl || "https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en",
            googleScholarId: activeUser.googleScholarId || "x6PdtN8AAAAJ",
            instructorId: activeUser.instructorId && activeUser.instructorId !== "admin" ? activeUser.instructorId : "PSU-002",
          }
        : activeUser;

      setCurrentUserState(resolvedUser);

      // Fetch all publications from repository
      const allPubs = await apiService.getPublications();
      const userPubs = (allPubs as any[]).filter((p) => {
        const ownerId = (p.ownerId || p.owner_id || "").trim().toLowerCase();
        const ownerName = (p.ownerName || p.owner_name || "").trim().toLowerCase();
        const targetInstId = (resolvedUser.instructorId || (isCoordinator ? "psu-002" : "")).toLowerCase();
        const targetUsername = (resolvedUser.username || "").toLowerCase();
        const targetId = (resolvedUser.id || "").toLowerCase();

        // 1. Explicit ID matches
        if (ownerId && (ownerId === targetInstId || ownerId === targetUsername || ownerId === targetId)) {
          return true;
        }

        // 2. Research Coordinator specific attribution
        if (isCoordinator) {
          if (ownerId === "psu-002" || ownerName.includes("garin")) return true;
          const authors = Array.isArray(p.authors) ? p.authors : [];
          return authors.some((a: string) => a.toLowerCase().includes("garin"));
        }

        // 3. Exact or token author match
        const myName = (resolvedUser.name || "").toLowerCase();
        if (ownerName && myName && ownerName === myName) return true;
        const authors = Array.isArray(p.authors) ? p.authors : [];
        return authors.some((a: string) => a.toLowerCase().includes(myName));
      });

      setPublications(userPubs);
      const totalPubs = userPubs.length;
      const totalCits = userPubs.reduce((sum, p) => sum + (p.citations || 0), 0);
      setStats({ totalPublications: totalPubs, totalCitations: totalCits });
    } catch (err) {
      console.warn("Failed to load user publications:", err);
    } finally {
      setLoadingPubs(false);
    }
  };

  useEffect(() => {
    loadProfileAndPublications();
  }, []);

  const handleOpenEdit = () => {
    setFormData({
      name: currentUser.name || "",
      email: currentUser.email || "",
      department: currentUser.department || "Campus Research Unit / BSIT",
      photoUrl: currentUser.photoUrl || "",
      scholarUrl: currentUser.scholarUrl || "",
      googleScholarId: currentUser.googleScholarId || "",
    });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiService.updateProfile({
        userId: currentUser.id,
        username: currentUser.username,
        name: formData.name,
        email: formData.email,
        department: formData.department,
        photoUrl: formData.photoUrl,
        scholarUrl: formData.scholarUrl,
        googleScholarId: formData.googleScholarId,
      });

      if (res.success && res.user) {
        const updated = updateCurrentUser({
          name: res.user.name,
          email: res.user.email,
          department: res.user.department,
          photoUrl: res.user.photoUrl,
          scholarUrl: res.user.scholarUrl,
          googleScholarId: res.user.googleScholarId,
        });
        if (updated) setCurrentUserState(updated);
        setIsEditing(false);
        toast.success("Profile updated successfully!");
        loadProfileAndPublications();
      } else {
        toast.error("Failed to update profile.");
      }
    } catch {
      const updated = updateCurrentUser({
        name: formData.name,
        email: formData.email,
        department: formData.department,
        photoUrl: formData.photoUrl,
        scholarUrl: formData.scholarUrl,
        googleScholarId: formData.googleScholarId,
      });
      if (updated) setCurrentUserState(updated);
      setIsEditing(false);
      toast.success("Profile saved locally!");
      loadProfileAndPublications();
    } finally {
      setSaving(false);
    }
  };

  const sortedPublications = useMemo(() => {
    return [...publications].sort((a, b) => {
      if (sortBy === "year") {
        return (b.year || 0) - (a.year || 0);
      } else if (sortBy === "citations") {
        return (b.citations || 0) - (a.citations || 0);
      } else {
        return (a.journal || "").localeCompare(b.journal || "");
      }
    });
  }, [publications, sortBy]);

  // Reliable Google Scholar Link Resolution
  const isCoordinator =
    currentUser.role === "admin" ||
    (currentUser.name && currentUser.name.toLowerCase().includes("garin")) ||
    currentUser.instructorId === "PSU-002";

  const effectiveScholarUrl =
    currentUser.scholarUrl && currentUser.scholarUrl.trim()
      ? currentUser.scholarUrl.startsWith("http")
        ? currentUser.scholarUrl
        : `https://scholar.google.com/citations?user=${currentUser.scholarUrl}&hl=en`
      : isCoordinator
      ? "https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en"
      : undefined;

  const effectiveScholarId =
    currentUser.googleScholarId ||
    (effectiveScholarUrl && effectiveScholarUrl.includes("user=")
      ? effectiveScholarUrl.split("user=")[1]?.split("&")[0]
      : isCoordinator
      ? "x6PdtN8AAAAJ"
      : undefined);

  const effectiveName = isCoordinator ? "Sir Rodelio M. Garin" : currentUser.name;
  const facultyPhoto = getFacultyPhoto(effectiveName) || currentUser.photoUrl;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title={isCoordinator ? "Research Coordinator Profile & Credentials" : "Researcher Profile & Credentials"}
        description={
          isCoordinator
            ? "Institutional research coordinator dossier, department affiliation, and Google Scholar index synchronization"
            : "Personal researcher profile, department affiliation, and Google Scholar index synchronization"
        }
        actions={
          <div className="flex items-center gap-2">
            {effectiveScholarUrl && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs h-9 gap-1.5 border-brand/30 text-brand hover:bg-brand-soft"
              >
                <a
                  href={effectiveScholarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open live Google Scholar Citations profile"
                >
                  <GraduationCap className="h-3.5 w-3.5 text-brand" />
                  <span>Google Scholar</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </Button>
            )}

            <Button
              size="sm"
              onClick={isEditing ? () => setIsEditing(false) : handleOpenEdit}
              className="text-xs h-9 gap-1.5 bg-brand hover:bg-brand/90 text-white shadow-2xs"
            >
              {isEditing ? <X className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
              <span>{isEditing ? "Cancel" : "Edit Profile"}</span>
            </Button>
          </div>
        }
      />

      {/* 2. Hero Profile Card (Matching Institutional Researcher Design) */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0">
              {facultyPhoto ? (
                <img
                  src={facultyPhoto}
                  alt={effectiveName}
                  className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover border border-border shadow-xs shrink-0"
                />
              ) : (
                <Avatar className="w-20 h-20 sm:w-22 sm:h-22 ring-2 ring-border shadow-xs rounded-2xl">
                  {currentUser.photoUrl ? (
                    <AvatarImage src={currentUser.photoUrl} alt={effectiveName} />
                  ) : null}
                  <AvatarFallback className="bg-brand text-white font-bold text-2xl rounded-2xl">
                    {effectiveName ? effectiveName.charAt(0).toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                    {effectiveName}
                  </h2>
                  {isCoordinator ? (
                    <StatusBadge status="admin" label="Research Coordinator" />
                  ) : (
                    <StatusBadge
                      status={currentUser.isFaculty === false ? "non-faculty" : "faculty"}
                      label={currentUser.isFaculty === false ? "Non-Faculty" : `Faculty (${currentUser.department || "BSIT"})`}
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-brand" />
                    <span>{currentUser.department || (isCoordinator ? "Campus Research Unit / BSIT" : "BSIT")}</span>
                  </span>
                  {(currentUser.email || isCoordinator) && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-brand" />
                      <span>{currentUser.email || (isCoordinator ? "rodeliogarin@gmail.com" : "")}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                    <span className="font-mono">
                      Instructor ID: {currentUser.instructorId || (isCoordinator ? "PSU-002" : "ASIN-00000")}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {effectiveScholarUrl && (
              <div className="self-start sm:self-center shrink-0">
                <Button variant="outline" size="sm" asChild className="text-xs h-8 gap-1.5 border-brand/30 text-brand hover:bg-brand-soft">
                  <a href={effectiveScholarUrl} target="_blank" rel="noopener noreferrer">
                    <GraduationCap className="h-3.5 w-3.5 text-brand" />
                    <span>Google Scholar</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Inline Edit Form */}
      {isEditing && (
        <Card className="border-brand/40 shadow-xs">
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-5">
              <h3 className="text-sm font-semibold text-foreground">Edit Profile Information</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="h-7 w-7 p-0 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="prof-name" className="text-xs font-medium">Full Legal / Academic Name *</Label>
                <Input
                  id="prof-name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-email" className="text-xs font-medium">Email Address *</Label>
                <Input
                  id="prof-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-dept" className="text-xs font-medium">Academic Department *</Label>
                <Input
                  id="prof-dept"
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-photo" className="text-xs font-medium">Photo URL</Label>
                <Input
                  id="prof-photo"
                  type="url"
                  placeholder="https://..."
                  value={formData.photoUrl}
                  onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-scholar-url" className="text-xs font-medium">Google Scholar Profile URL</Label>
                <Input
                  id="prof-scholar-url"
                  placeholder="https://scholar.google.com/citations?user=..."
                  value={formData.scholarUrl}
                  onChange={(e) => setFormData({ ...formData, scholarUrl: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-scholar-id" className="text-xs font-medium">Google Scholar User ID</Label>
                <Input
                  id="prof-scholar-id"
                  placeholder="e.g. x6PdtN8AAAAJ"
                  value={formData.googleScholarId}
                  onChange={(e) => setFormData({ ...formData, googleScholarId: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 md:col-span-2 pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  size="sm"
                  className="bg-brand hover:bg-brand/90 text-white text-xs gap-1.5"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 4. Metric Stats Row (Matching Researcher Profile) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Publications"
          value={stats.totalPublications}
          subtitle="Indexed campus publications"
          icon={BookOpen}
        />
        <StatCard
          label="Total Citations"
          value={stats.totalCitations}
          subtitle="Google Scholar citations"
          icon={Quote}
        />
        <StatCard
          label="Citation Density"
          value={stats.totalPublications > 0 ? (stats.totalCitations / stats.totalPublications).toFixed(1) : "0.0"}
          subtitle="Average citations / publication"
          icon={BarChart3}
        />
      </div>

      {/* 5. Account Details & Google Scholar Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-brand" />
              <span>Institutional Account Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-border/60">
              <span className="text-muted-foreground">Username / System ID</span>
              <span className="font-semibold text-foreground font-mono">
                {isCoordinator ? "psuac-rc" : currentUser.username || currentUser.instructorId || "N/A"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/60">
              <span className="text-muted-foreground">Department</span>
              <span className="font-semibold text-foreground">
                {currentUser.department || (isCoordinator ? "Campus Research Unit / BSIT" : "General Faculty")}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/60">
              <span className="text-muted-foreground">Email</span>
              <span className="font-semibold text-foreground">
                {currentUser.email || (isCoordinator ? "rodeliogarin@gmail.com" : "No email registered")}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Role Clearance</span>
              <StatusBadge
                status={isCoordinator ? "admin" : currentUser.role}
                label={isCoordinator ? "Research Coordinator" : undefined}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-brand" />
              <span>Google Scholar Integration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-border/60">
              <span className="text-muted-foreground">Profile Link</span>
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {effectiveScholarUrl ? (
                  <a
                    href={effectiveScholarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>Connected Profile</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground/60 italic">Not connected</span>
                )}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/60">
              <span className="text-muted-foreground">Scholar User ID</span>
              <span className="font-semibold font-mono text-foreground">
                {effectiveScholarId || "None"}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Sync Status</span>
              <StatusBadge status={effectiveScholarUrl ? "active" : "pending"} label={effectiveScholarUrl ? "Active" : "Unconnected"} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6. Publications List Section (Matching Researcher Profile Layout) */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Publications ({sortedPublications.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              All published research attributed to {effectiveName}
            </p>
          </div>

          {sortedPublications.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort:</span>
              <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">Newest Year</SelectItem>
                  <SelectItem value="citations">Most Citations</SelectItem>
                  <SelectItem value="journal">Journal Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* List of Publications */}
        {loadingPubs ? (
          <Card className="border-border/60">
            <CardContent className="p-8 text-center text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 text-brand" />
              <p>Loading attributed publications...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedPublications.map((pub: any) => {
              const hasCollab = Array.isArray(pub.authors) && hasExternalCollaborators(pub.authors);
              const isPsu = Array.isArray(pub.authors) && isPSUPaper(pub.authors);

              return (
                <Card
                  key={pub.id}
                  className="border-border/60 hover:border-brand/40 transition-colors shadow-2xs"
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {pub.year}
                          </Badge>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {pub.citations || 0} citations
                          </Badge>
                          {hasCollab ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-warning-soft text-warning border border-warning-border">
                              PSU + External
                            </span>
                          ) : isPsu ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-success-soft text-success border border-success-border">
                              Pure PSU
                            </span>
                          ) : null}
                        </div>

                        <h4
                          onClick={() => navigate(`/dashboard/publication/${pub.id}`)}
                          className="text-sm font-semibold text-foreground hover:text-brand cursor-pointer transition-colors leading-snug"
                        >
                          {pub.title}
                        </h4>

                        {/* Author pills */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {Array.isArray(pub.authors) ? (
                            categorizeAuthors(pub.authors).map((cat, aIdx) => (
                              <span
                                key={aIdx}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 ${
                                  cat.isPsu
                                    ? "bg-success-soft text-success border border-success-border"
                                    : "bg-muted text-muted-foreground border border-border"
                                }`}
                              >
                                <span
                                  className={`w-1 h-1 rounded-full ${
                                    cat.isPsu ? "bg-success" : "bg-muted-foreground"
                                  }`}
                                />
                                {cat.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">{pub.authors}</span>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground truncate">
                          {pub.journal || "PSU Archive"}
                        </div>
                      </div>

                      <div className="self-end sm:self-center shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/dashboard/publication/${pub.id}`)}
                          className="text-xs h-7 gap-1"
                        >
                          <span>Details</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {sortedPublications.length === 0 && (
              <EmptyState
                icon={FileText}
                title="No publications recorded"
                description={`No publications are currently attributed to ${effectiveName}.`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
