import { useState, useEffect } from "react";
import { getCurrentUser } from "../utils/researchStore";
import { useTheme, ThemeMode } from "../utils/themeContext";
import { apiService } from "../services/api.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Sun,
  Moon,
  Laptop,
  Lock,
  KeyRound,
  Sliders,
  Check,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Palette,
  CheckCircle2,
  Database,
  Server,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageTabs } from "./common";

export function SettingsPage() {
  const currentUser = getCurrentUser();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("appearance");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Preference state
  const [tableDensity, setTableDensity] = useState(() => {
    return localStorage.getItem("psu_pref_density") || "standard";
  });
  const [autoSyncScholar, setAutoSyncScholar] = useState(() => {
    return localStorage.getItem("psu_pref_autosync") !== "false";
  });

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("New password must be at least 4 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await apiService.changePassword({
        userId: currentUser.id,
        username: currentUser.username,
        currentPassword,
        newPassword,
      });

      if (res.success) {
        toast.success("Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(res.message || "Failed to update password.");
      }
    } catch (err: any) {
      toast.error(err.message || "Incorrect current password. Please try again.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDensityChange = (density: string) => {
    setTableDensity(density);
    localStorage.setItem("psu_pref_density", density);
    toast.success(`Display density set to ${density}.`);
  };

  const handleAutoSyncChange = (enabled: boolean) => {
    setAutoSyncScholar(enabled);
    localStorage.setItem("psu_pref_autosync", String(enabled));
    toast.success(enabled ? "Automatic Scholar sync enabled." : "Automatic Scholar sync disabled.");
  };

  const tabs = [
    { id: "appearance", label: "Appearance & Theme", icon: Palette },
    { id: "security", label: "Security & Password", icon: Lock },
    { id: "preferences", label: "Display Preferences", icon: Sliders },
    { id: "database", label: "System & Cloud Storage", icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Page Header */}
      <PageHeader
        title="Settings & System Preferences"
        description="Customize your interface appearance, faculty credentials, and cloud database persistence"
      />

      {/* 2. Navigation Tabs */}
      <PageTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* 3. Tab 1: Appearance */}
      {activeTab === "appearance" && (
        <Card className="border-border/60 shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-brand" />
              <CardTitle className="text-sm font-semibold">Interface Theme</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Choose how the Research Publication Tracking System looks to you. Active mode:{" "}
              <span className="font-semibold capitalize text-foreground">{resolvedTheme}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Light Mode */}
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all cursor-pointer ${
                  theme === "light"
                    ? "border-brand bg-brand-soft shadow-2xs"
                    : "border-border/60 hover:border-border bg-card"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mb-3">
                  <Sun className="w-6 h-6" />
                </div>
                <span className="font-semibold text-sm text-foreground">Light Mode</span>
                <span className="text-xs text-muted-foreground mt-1">Clean & crisp contrast</span>
                {theme === "light" && (
                  <CheckCircle2 className="w-4 h-4 text-brand mt-2" />
                )}
              </button>

              {/* Dark Mode */}
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all cursor-pointer ${
                  theme === "dark"
                    ? "border-brand bg-brand-soft shadow-2xs"
                    : "border-border/60 hover:border-border bg-card"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 text-blue-400 flex items-center justify-center mb-3">
                  <Moon className="w-6 h-6" />
                </div>
                <span className="font-semibold text-sm text-foreground">Dark Mode</span>
                <span className="text-xs text-muted-foreground mt-1">Easy on the eyes</span>
                {theme === "dark" && (
                  <CheckCircle2 className="w-4 h-4 text-brand mt-2" />
                )}
              </button>

              {/* System Default */}
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all cursor-pointer ${
                  theme === "system"
                    ? "border-brand bg-brand-soft shadow-2xs"
                    : "border-border/60 hover:border-border bg-card"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-3">
                  <Laptop className="w-6 h-6" />
                </div>
                <span className="font-semibold text-sm text-foreground">System Default</span>
                <span className="text-xs text-muted-foreground mt-1">Matches device theme</span>
                {theme === "system" && (
                  <CheckCircle2 className="w-4 h-4 text-brand mt-2" />
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Tab 2: Security & Password */}
      {activeTab === "security" && (
        <Card className="border-border/60 shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-brand" />
              <CardTitle className="text-sm font-semibold">Account Security & Password</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Change your password to keep your faculty research credentials secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="current-pw" className="text-xs font-medium">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-pw"
                    type={showCurrentPw ? "text" : "password"}
                    required
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pr-9 h-9 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-pw" className="text-xs font-medium">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-pw"
                    type={showNewPw ? "text" : "password"}
                    required
                    placeholder="At least 4 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-9 h-9 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw" className="text-xs font-medium">Confirm New Password</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <Button
                type="submit"
                disabled={savingPassword}
                size="sm"
                className="bg-brand hover:bg-brand/90 text-white text-xs gap-1.5 mt-2"
              >
                {savingPassword ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Update Password</span>
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 5. Tab 3: Display Preferences */}
      {activeTab === "preferences" && (
        <Card className="border-border/60 shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand" />
              <CardTitle className="text-sm font-semibold">Display & Scraping Preferences</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Configure how records and tables are rendered across the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
              <div>
                <p className="font-semibold text-xs text-foreground">Table Row Density</p>
                <p className="text-[11px] text-muted-foreground">Adjust row spacing in publications and researchers lists.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={tableDensity === "compact" ? "default" : "outline"}
                  size="sm"
                  className={`text-xs h-8 ${tableDensity === "compact" ? "bg-brand text-white" : ""}`}
                  onClick={() => handleDensityChange("compact")}
                >
                  Compact
                </Button>
                <Button
                  variant={tableDensity === "standard" ? "default" : "outline"}
                  size="sm"
                  className={`text-xs h-8 ${tableDensity === "standard" ? "bg-brand text-white" : ""}`}
                  onClick={() => handleDensityChange("standard")}
                >
                  Standard
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-xs text-foreground">Auto-Fetch Missing Citations</p>
                <p className="text-[11px] text-muted-foreground">
                  Automatically query Google Scholar citing papers when viewing papers with citations.
                </p>
              </div>
              <Button
                variant={autoSyncScholar ? "default" : "outline"}
                size="sm"
                className={`text-xs h-8 ${autoSyncScholar ? "bg-brand text-white" : ""}`}
                onClick={() => handleAutoSyncChange(!autoSyncScholar)}
              >
                {autoSyncScholar ? "Enabled" : "Disabled"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Tab 4: System & Cloud Storage */}
      {activeTab === "database" && (
        <TursoDatabaseCard />
      )}
    </div>
  );
}

function TursoDatabaseCard() {
  const [tursoStatus, setTursoStatus] = useState<{ isConfigured: boolean; databaseUrl: string; mode: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    apiService.getTursoStatus().then(setTursoStatus).catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiService.syncToTurso();
      if (res.success) {
        toast.success(res.message || "Database synced to Turso Cloud!");
      } else {
        toast.error("Sync failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to sync to Turso Cloud.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success-soft text-success flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Turso Cloud Database Storage</CardTitle>
              <CardDescription className="text-xs">Persistent cloud storage to prevent deployment data wipeouts</CardDescription>
            </div>
          </div>
          {tursoStatus?.isConfigured ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success-soft text-success border border-success-border">
              Cloud Connected
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-warning-soft text-warning border border-warning-border">
              Local SQLite (WAL Active)
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {tursoStatus?.isConfigured ? (
          <div className="space-y-3">
            <p className="text-xs text-foreground leading-relaxed">
              Your application is connected to <strong>Turso Cloud SQLite</strong>. All faculty accounts, publications, and citations are backed up permanently.
            </p>
            {tursoStatus.databaseUrl && (
              <p className="text-xs font-mono text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/60">
                Database: {tursoStatus.databaseUrl}
              </p>
            )}
            <Button
              onClick={handleSync}
              disabled={syncing}
              size="sm"
              className="bg-brand hover:bg-brand/90 text-white text-xs gap-1.5"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Syncing to Cloud...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Sync Local Tables to Turso Cloud</span>
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-muted-foreground">
            <p className="leading-relaxed">
              Your system is currently using local SQLite with Write-Ahead Logging (WAL mode). Data is safely persisted on this machine across reboots.
            </p>
            <div className="p-3 bg-muted/30 border border-border/70 rounded-xl space-y-1.5">
              <p className="font-semibold text-foreground">Cloud Sync Instructions (Optional for production deployment):</p>
              <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground text-[11px]">
                <li>Create a database at <a href="https://turso.tech" target="_blank" rel="noreferrer" className="text-brand underline">turso.tech</a>.</li>
                <li>Set environment variables:</li>
                <li className="font-mono text-foreground font-semibold">TURSO_DATABASE_URL = libsql://your-db.turso.io</li>
                <li className="font-mono text-foreground font-semibold">TURSO_AUTH_TOKEN = your_token_here</li>
              </ol>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
