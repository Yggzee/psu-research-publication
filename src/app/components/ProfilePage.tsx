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
  Sparkles
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
        const userPubs = pubs.filter(p => {
          const ownerId = (p.ownerId || "").trim().toLowerCase();
          const instId = (currentUser.instructorId || "").trim().toLowerCase();
          const username = (currentUser.username || "").trim().toLowerCase();
          const name = (currentUser.name || "").trim().toLowerCase();
          return ownerId === instId || ownerId === username || (p.authors || []).some(a => a.toLowerCase().includes(name));
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-linear-to-r from-blue-700 via-indigo-700 to-blue-900 p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-4 border-white/20 shadow-xl bg-white/10 text-white">
            {formData.photoUrl ? (
              <AvatarImage src={formData.photoUrl} alt={currentUser.name} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-blue-800 text-white text-3xl font-bold">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{currentUser.name}</h1>
              <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
                {currentUser.role === "admin" ? (
                  <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Administrator</span>
                ) : (
                  <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> Faculty Instructor</span>
                )}
              </Badge>
            </div>

            <p className="text-blue-100 text-sm flex items-center justify-center sm:justify-start gap-2">
              <Building className="w-4 h-4 text-blue-200" />
              {currentUser.department || "Pangasinan State University - Asingan Campus"}
            </p>

            {currentUser.email && (
              <p className="text-blue-200 text-xs flex items-center justify-center sm:justify-start gap-2">
                <Mail className="w-3.5 h-3.5" />
                {currentUser.email}
              </p>
            )}
          </div>

          <div className="sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-xs transition-all"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              {isEditing ? "Cancel Edit" : "Edit Profile"}
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

      {/* Edit Profile Form or Profile Details */}
      {isEditing ? (
        <Card className="dark:border-gray-800">
          <CardHeader>
            <CardTitle>Edit Profile Information</CardTitle>
            <CardDescription>Update your personal information and Google Scholar identifiers.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prof-name">Full Name</Label>
                  <Input
                    id="prof-name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prof-email">Email Address</Label>
                  <Input
                    id="prof-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prof-dept">Department</Label>
                  <Input
                    id="prof-dept"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prof-photo">Photo URL (Optional)</Label>
                  <Input
                    id="prof-photo"
                    placeholder="https://example.com/photo.jpg"
                    value={formData.photoUrl}
                    onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prof-scholar-url">Google Scholar Profile URL</Label>
                  <Input
                    id="prof-scholar-url"
                    placeholder="https://scholar.google.com/citations?user=..."
                    value={formData.scholarUrl}
                    onChange={(e) => setFormData({ ...formData, scholarUrl: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prof-scholar-id">Google Scholar User ID</Label>
                  <Input
                    id="prof-scholar-id"
                    placeholder="e.g. jPzK12sAAAAJ"
                    value={formData.googleScholarId}
                    onChange={(e) => setFormData({ ...formData, googleScholarId: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-800">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
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
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account Details Card */}
          <Card className="dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
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
                <GraduationCap className="w-4 h-4 text-blue-600" />
                Google Scholar Profile
              </CardTitle>
              <CardDescription>Linked profile for citation tracking and publication discovery.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentUser.scholarUrl || currentUser.googleScholarId ? (
                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 space-y-2">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Scholar ID:</p>
                  <p className="text-sm font-mono font-semibold text-foreground break-all">
                    {currentUser.googleScholarId || currentUser.scholarUrl}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-blue-600 border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40"
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
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-blue-600 border-blue-300"
                  >
                    Add Scholar Link
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
