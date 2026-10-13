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
  X
} from "lucide-react";
import { toast } from "sonner";

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
    // Load research stats for this user
    async function loadStats() {
      try {
        const pubs = await apiService.getPublications();
        const userPubs = (pubs as any[]).filter(p => {
          const ownerId = (p.ownerId || p.owner_id || "").trim().toLowerCase();
          const instId = (currentUser.instructorId || "").trim().toLowerCase();
          const username = (currentUser.username || "").trim().toLowerCase();
          const name = (currentUser.name || "").trim().toLowerCase();
          return ownerId === instId || ownerId === username || (p.authors || []).some((a: string) => a.toLowerCase().includes(name));
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
      // Local fallback
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
      {/* Profile Header Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <Avatar className="w-20 h-20 sm:w-24 sm:h-24 ring-4 ring-white/20 shadow-lg">
              {currentUser.photoUrl ? (
                <AvatarImage src={currentUser.photoUrl} alt={currentUser.name} />
              ) : null}
              <AvatarFallback className="bg-white/10 text-white font-bold text-2xl backdrop-blur-xs">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{currentUser.name}</h1>
                <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none capitalize text-xs">
                  {currentUser.role}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-blue-100/90 font-medium">
                <span className="flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-blue-200" />
                  {currentUser.department || "Faculty Department"}
                </span>
                {currentUser.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-blue-200" />
                    {currentUser.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-200" />
                  ID: {currentUser.instructorId || currentUser.username || "PSU-FACULTY"}
                </span>
              </div>
            </div>
          </div>

          <div className="sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenEdit}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-xs transition-all"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </div>
        </div>

        {/* Decorative ambient background circle */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/5 pointer-events-none blur-2xl" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="dark:border-gray-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total Publications</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalPublications}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:border-gray-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Quote className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total Citations</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalCitations}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-1 dark:border-gray-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Campus Affiliation</p>
              <p className="text-sm font-semibold text-foreground">PSU Asingan Campus</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile Overview Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Details Card */}
        <Card className="dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Account Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between py-2 border-b dark:border-gray-800 text-sm">
              <span className="text-muted-foreground">Username / ID</span>
              <span className="font-semibold text-foreground">{currentUser.username || currentUser.instructorId || "N/A"}</span>
            </div>
            <div className="flex justify-between py-2 border-b dark:border-gray-800 text-sm">
              <span className="text-muted-foreground">Department</span>
              <span className="font-semibold text-foreground">{currentUser.department || "General Faculty"}</span>
            </div>
            <div className="flex justify-between py-2 border-b dark:border-gray-800 text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-semibold text-foreground">{currentUser.email || "No email provided"}</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span className="text-muted-foreground">Account Role</span>
              <Badge variant="outline" className="capitalize text-xs">
                {currentUser.role}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Google Scholar Card */}
        <Card className="dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Google Scholar Profile
            </CardTitle>
            <CardDescription className="text-muted-foreground">Linked profile for citation tracking and publication discovery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentUser.scholarUrl || currentUser.googleScholarId ? (
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 space-y-2">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Scholar ID / URL:</p>
                <p className="text-sm font-mono font-semibold text-foreground break-all">
                  {currentUser.googleScholarId || currentUser.scholarUrl}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  onClick={() => {
                    const url = currentUser.scholarUrl || `https://scholar.google.com/citations?user=${currentUser.googleScholarId}`;
                    window.open(url, "_blank");
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Google Scholar
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground space-y-2">
                <p className="text-sm">No Google Scholar profile linked yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenEdit}
                  className="text-xs text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800"
                >
                  Add Scholar Link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile Popup Modal with Blurred Backdrop */}
      {isEditing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Profile Information</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Update personal details and academic profile links</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(false)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prof-name">Full Name</Label>
                  <Input
                    id="prof-name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="dark:border-gray-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prof-email">Email Address</Label>
                  <Input
                    id="prof-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="dark:border-gray-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prof-dept">Department</Label>
                  <Input
                    id="prof-dept"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="dark:border-gray-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prof-photo">Photo URL (Optional)</Label>
                  <Input
                    id="prof-photo"
                    placeholder="https://example.com/photo.jpg"
                    value={formData.photoUrl}
                    onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                    className="dark:border-gray-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prof-scholar-url">Google Scholar Profile URL</Label>
                  <Input
                    id="prof-scholar-url"
                    placeholder="https://scholar.google.com/citations?user=..."
                    value={formData.scholarUrl}
                    onChange={(e) => setFormData({ ...formData, scholarUrl: e.target.value })}
                    className="dark:border-gray-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prof-scholar-id">Google Scholar User ID</Label>
                  <Input
                    id="prof-scholar-id"
                    placeholder="e.g. jPzK12sAAAAJ"
                    value={formData.googleScholarId}
                    onChange={(e) => setFormData({ ...formData, googleScholarId: e.target.value })}
                    className="dark:border-gray-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-800">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="dark:border-gray-700">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
