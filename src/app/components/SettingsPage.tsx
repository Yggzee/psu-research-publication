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
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

export function SettingsPage() {
  const currentUser = getCurrentUser();
  const { theme, setTheme, resolvedTheme } = useTheme();

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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings & Preferences</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your interface appearance, update your account security, and configure system preferences.
        </p>
      </div>

      {/* 1. Appearance / Theme */}
      <Card className="dark:border-gray-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <CardTitle>Interface Theme</CardTitle>
          </div>
          <CardDescription>
            Choose how Research Publication Tracking System looks to you. Active mode:{" "}
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
                  ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-card"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
                <Sun className="w-6 h-6" />
              </div>
              <span className="font-semibold text-sm text-foreground">Light Mode</span>
              <span className="text-xs text-muted-foreground mt-1">Clean & bright contrast</span>
              {theme === "light" && (
                <CheckCircle2 className="w-4 h-4 text-blue-600 mt-2" />
              )}
            </button>

            {/* Dark Mode */}
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all cursor-pointer ${
                theme === "dark"
                  ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-card"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 text-blue-400 flex items-center justify-center mb-3">
                <Moon className="w-6 h-6" />
              </div>
              <span className="font-semibold text-sm text-foreground">Dark Mode</span>
              <span className="text-xs text-muted-foreground mt-1">Easy on the eyes at night</span>
              {theme === "dark" && (
                <CheckCircle2 className="w-4 h-4 text-blue-600 mt-2" />
              )}
            </button>

            {/* System Default */}
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all cursor-pointer ${
                theme === "system"
                  ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-card"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                <Laptop className="w-6 h-6" />
              </div>
              <span className="font-semibold text-sm text-foreground">System Default</span>
              <span className="text-xs text-muted-foreground mt-1">Syncs with your device theme</span>
              {theme === "system" && (
                <CheckCircle2 className="w-4 h-4 text-blue-600 mt-2" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Security / Change Password */}
      <Card className="dark:border-gray-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <CardTitle>Account Security & Password</CardTitle>
          </div>
          <CardDescription>
            Change your password to keep your faculty research credentials secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-pw">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-pw"
                  type={showCurrentPw ? "text" : "password"}
                  required
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-pw">New Password</Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showNewPw ? "text" : "password"}
                  required
                  placeholder="At least 4 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <Input
                id="confirm-pw"
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={savingPassword}
              className="bg-blue-600 hover:bg-blue-700 text-white mt-2"
            >
              {savingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Update Password
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 3. System Preferences */}
      <Card className="dark:border-gray-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <CardTitle>Display & Scraping Preferences</CardTitle>
          </div>
          <CardDescription>Configure how records and tables are rendered across the system.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Table Density */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b dark:border-gray-800">
            <div>
              <p className="font-semibold text-sm text-foreground">Table Row Density</p>
              <p className="text-xs text-muted-foreground">Adjust row spacing in publications and researchers lists.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={tableDensity === "compact" ? "default" : "outline"}
                size="sm"
                className={tableDensity === "compact" ? "bg-blue-600 text-white" : ""}
                onClick={() => handleDensityChange("compact")}
              >
                Compact
              </Button>
              <Button
                variant={tableDensity === "standard" ? "default" : "outline"}
                size="sm"
                className={tableDensity === "standard" ? "bg-blue-600 text-white" : ""}
                onClick={() => handleDensityChange("standard")}
              >
                Standard
              </Button>
            </div>
          </div>

          {/* Auto Sync Scholar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm text-foreground">Auto-Fetch Missing Citations</p>
              <p className="text-xs text-muted-foreground">
                Automatically query Google Scholar citing papers when viewing papers with citations.
              </p>
            </div>
            <Button
              variant={autoSyncScholar ? "default" : "outline"}
              size="sm"
              className={autoSyncScholar ? "bg-blue-600 text-white" : ""}
              onClick={() => handleAutoSyncChange(!autoSyncScholar)}
            >
              {autoSyncScholar ? "Enabled" : "Disabled"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. Turso Cloud SQLite Database Status */}
      <TursoDatabaseCard />
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
    <Card className="dark:border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Turso Cloud Database Storage</CardTitle>
              <CardDescription>Persistent cloud storage to prevent Render data wipeouts</CardDescription>
            </div>
          </div>
          {tursoStatus?.isConfigured ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300">
              Cloud Connected
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300">
              Local Mode (No Turso Env)
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tursoStatus?.isConfigured ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              Your application is connected to <strong>Turso Cloud SQLite</strong>. All faculty accounts, publications, and citations are backed up permanently and will not be wiped when Render spins down.
            </p>
            {tursoStatus.databaseUrl && (
              <p className="text-xs font-mono text-muted-foreground bg-muted p-2 rounded">
                Database: {tursoStatus.databaseUrl}
              </p>
            )}
            <Button
              onClick={handleSync}
              disabled={syncing}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing to Cloud...
                </>
              ) : (
                "Sync All Local Tables to Turso Cloud"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Your system is currently using local file SQLite. On Render Free Tier, files are reset after 15 minutes of inactivity.
            </p>
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg text-xs space-y-1 text-foreground">
              <p className="font-semibold text-blue-700 dark:text-blue-300">How to connect free Turso Cloud on Render:</p>
              <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
                <li>Create a free database at <a href="https://turso.tech" target="_blank" rel="noreferrer" className="text-blue-600 underline">turso.tech</a>.</li>
                <li>In Render Dashboard &rarr; Environment Variables, add:</li>
                <li className="font-mono text-blue-600 dark:text-blue-400">TURSO_DATABASE_URL = libsql://your-db.turso.io</li>
                <li className="font-mono text-blue-600 dark:text-blue-400">TURSO_AUTH_TOKEN = your_token_here</li>
              </ol>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
