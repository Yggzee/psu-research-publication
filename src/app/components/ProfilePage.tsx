import { useState, useEffect } from "react";
import { getCurrentUser, updateCurrentUser, SessionUser } from "../utils/researchStore";
import { apiService } from "../services/api.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  User,
  Mail,
  Building,
  GraduationCap,
  BookOpen,
  Quote,
  ExternalLink,
  Edit3,
  Check,
  Loader2,
  ShieldCheck,
  Save,
  Sparkles,
  X,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, SectionCard, StatusBadge } from "./common";

export function ProfilePage() {
  const [currentUser, setCurrentUserState] = useState<SessionUser>(getCurrentUser());
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ totalPublications: 0, totalCitations: 0 });

  const [formData, setFormData] = useState({
    name: currentUser.name || "",
    email: currentUser.email || "",
    department: currentUser.department || "Information Technology",
    photoUrl: currentUser.photoUrl || "",
    scholarUrl: currentUser.scholarUrl || "",
    googleScholarId: currentUser.googleScholarId || "",
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const pubs = await apiService.getPublications();
        const userPubs = (pubs as any[]).filter((p) => {
          const ownerId = (p.ownerId || p.owner_id || "").trim().toLowerCase();
          const instId = (currentUser.instructorId || "").trim().toLowerCase();
          const username = (currentUser.username || "").trim().toLowerCase();
          const name = (currentUser.name || "").trim().toLowerCase();
          return (
            ownerId === instId ||
            ownerId === username ||
            (p.authors || []).some((a: string) => a.toLowerCase().includes(name))
          );
        });
        const totalPubs = userPubs.length;
        const totalCits = userPubs.reduce((sum, p) => sum + (p.citations || 0), 0);
        setStats({ totalPublications: totalPubs, totalCitations: totalCits });
      } catch (err) {
        console.warn("Failed to load user publications:", err);
      }
    }
    loadStats();
  }, [currentUser]);

  const handleOpenEdit = () => {
    setFormData({
      name: currentUser.name || "",
      email: currentUser.email || "",
      department: currentUser.department || "Information Technology",
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
        setCurrentUserState(updated);
        setIsEditing(false);
        toast.success("Profile updated successfully!");
      } else {
        toast.error("Failed to update profile.");
      }
    } catch (err: any) {
      const updated = updateCurrentUser({
        name: formData.name,
        email: formData.email,
        department: formData.department,
        photoUrl: formData.photoUrl,
        scholarUrl: formData.scholarUrl,
        googleScholarId: formData.googleScholarId,
      });
      setCurrentUserState(updated);
      setIsEditing(false);
      toast.success("Profile saved locally!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* 1. Page Header */}
      <PageHeader
        title="Faculty Profile & Credentials"
        description="Personal scholarly profile, department affiliation, and Google Scholar index synchronization"
        actions={
          <Button
            size="sm"
            onClick={isEditing ? () => setIsEditing(false) : handleOpenEdit}
            className="text-xs h-9 gap-1.5 bg-brand hover:bg-brand/90 text-white shadow-2xs"
          >
            {isEditing ? <X className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
            <span>{isEditing ? "Cancel" : "Edit Profile"}</span>
          </Button>
        }
      />

      {/* 2. Hero Profile Card */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <Avatar className="w-20 h-20 sm:w-22 sm:h-22 ring-2 ring-border shadow-xs">
                {currentUser.photoUrl ? (
                  <AvatarImage src={currentUser.photoUrl} alt={currentUser.name} />
                ) : null}
                <AvatarFallback className="bg-brand text-white font-bold text-2xl">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {currentUser.name}
                  </h2>
                  <StatusBadge status={currentUser.role} />
                </div>

                <div className="flex flex-wrap items-center gap-3.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-brand" />
                    <span>{currentUser.department || "Faculty Department"}</span>
                  </span>
                  {currentUser.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-brand" />
                      <span>{currentUser.email}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                    <span className="font-mono">ID: {currentUser.instructorId || currentUser.username || "PSU-FACULTY"}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:self-center">
              {currentUser.scholarUrl && (
                <Button variant="outline" size="sm" asChild className="text-xs h-8 gap-1.5">
                  <a
                    href={
                      currentUser.scholarUrl.startsWith("http")
                        ? currentUser.scholarUrl
                        : `https://scholar.google.com/citations?user=${currentUser.scholarUrl}&hl=en`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <GraduationCap className="h-3.5 w-3.5 text-brand" />
                    <span>Google Scholar</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Inline Edit Form */}
      {isEditing && (
        <Card className="border-brand/40 shadow-xs">
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-5">
              <h3 className="text-sm font-semibold text-foreground">Edit Scholarly Profile Information</h3>
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
                  placeholder="e.g. jfk83ndAAAAJ"
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

      {/* 4. Stats KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Publications"
          value={stats.totalPublications}
          subtitle="Indexed in database"
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
          subtitle="Citations per publication"
          icon={Award}
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
                {currentUser.username || currentUser.instructorId || "N/A"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/60">
              <span className="text-muted-foreground">Department</span>
              <span className="font-semibold text-foreground">{currentUser.department || "General Faculty"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/60">
              <span className="text-muted-foreground">Email</span>
              <span className="font-semibold text-foreground">{currentUser.email || "No email registered"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Role Clearance</span>
              <StatusBadge status={currentUser.role} />
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
                {currentUser.scholarUrl ? (
                  <a
                    href={
                      currentUser.scholarUrl.startsWith("http")
                        ? currentUser.scholarUrl
                        : `https://scholar.google.com/citations?user=${currentUser.scholarUrl}&hl=en`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline inline-flex items-center gap-1"
                  >
                    <span>Connected</span>
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
                {currentUser.googleScholarId || (currentUser.scholarUrl ? currentUser.scholarUrl.split("user=")[1] || "Active" : "None")}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Sync Status</span>
              <StatusBadge status={currentUser.scholarUrl ? "active" : "pending"} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
