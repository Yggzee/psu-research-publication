import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  TrendingUp,
  FileBarChart,
  LogOut,
  Search,
  User,
  Shield,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  Target,
  Sparkles,
  History,
  ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import psuLogo from "figma:asset/0f3e65de85ff26584e9a3039d47bcf17ff6e6368.png";
import { clearCurrentUser, getCurrentUser } from "../utils/researchStore";
import { useTheme } from "../utils/themeContext";
import { ConfirmModal } from "./ConfirmModal";
import { CommandPalette } from "./CommandPalette";
import { FloatingAskAIBubble } from "./FloatingAskAIBubble";
import { apiService } from "../services/api.service";

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  isAI?: boolean;
  badge?: string | number;
}

interface NavCategory {
  category: string;
  items: NavItem[];
}

const adminNavigationCategories: NavCategory[] = [
  {
    category: "OVERVIEW",
    items: [
      { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    category: "DISCOVER",
    items: [
      { name: "Scholar Search", path: "/dashboard/search-engine", icon: Search },
      { name: "Researchers", path: "/dashboard/researchers", icon: Users },
      { name: "Publications", path: "/dashboard/publications", icon: FileText },
    ],
  },
  {
    category: "ANALYTICS",
    items: [
      { name: "Impact Analysis", path: "/dashboard/impact", icon: TrendingUp },
      { name: "SDG Radar", path: "/dashboard/sdg-matrix", icon: Target },
      { name: "Reports", path: "/dashboard/reports", icon: FileBarChart },
      { name: "Ask Campus AI", path: "/dashboard/ai-history", icon: Sparkles, isAI: true },
    ],
  },
  {
    category: "ADMINISTRATION",
    items: [
      { name: "Admin Console", path: "/dashboard/admin", icon: Shield },
    ],
  },
];

const instructorNavigationCategories: NavCategory[] = [
  {
    category: "MY WORK",
    items: [
      { name: "My Publications", path: "/dashboard/publications", icon: FileText },
      { name: "Scholar Search", path: "/dashboard/search-engine", icon: Search },
    ],
  },
  {
    category: "DISCOVER",
    items: [
      { name: "Researchers", path: "/dashboard/researchers", icon: Users },
    ],
  },
  {
    category: "ANALYTICS",
    items: [
      { name: "SDG Radar", path: "/dashboard/sdg-matrix", icon: Target },
      { name: "Ask Campus AI", path: "/dashboard/ai-history", icon: Sparkles, isAI: true },
    ],
  },
];

const bottomUtilityNavigation = [
  { name: "My Profile", path: "/dashboard/profile", icon: User },
  { name: "Settings", path: "/dashboard/settings", icon: Settings },
];

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUser();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Check pending registrations count for admin
  useEffect(() => {
    if (currentUser.role === "admin") {
      apiService
        .getPendingRegistrations()
        .then((regs) => {
          if (Array.isArray(regs)) setPendingCount(regs.length);
        })
        .catch(() => {});
    }
  }, [currentUser.role, location.pathname]);

  // Spotlight Ctrl+K keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navCategories =
    currentUser.role === "instructor" ? instructorNavigationCategories : adminNavigationCategories;

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    clearCurrentUser();
    navigate("/login");
  };

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  // Compute clean breadcrumb title
  const getPageTitle = (pathname: string): string => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname.startsWith("/dashboard/search-engine")) return "Scholar Search";
    if (pathname.startsWith("/dashboard/researchers")) return "Researchers";
    if (pathname.startsWith("/dashboard/publications")) return "Publications";
    if (pathname.startsWith("/dashboard/impact")) return "Impact Analysis";
    if (pathname.startsWith("/dashboard/sdg-matrix")) return "UN SDG Radar";
    if (pathname.startsWith("/dashboard/reports")) return "Accreditation Reports";
    if (pathname.startsWith("/dashboard/ai-history") || pathname.startsWith("/dashboard/ask-ai"))
      return "Campus AI History";
    if (pathname.startsWith("/dashboard/admin")) return "Admin Console";
    if (pathname.startsWith("/dashboard/profile")) return "My Profile";
    if (pathname.startsWith("/dashboard/settings")) return "Settings";
    if (pathname.startsWith("/dashboard/researcher/")) return "Researcher Profile";
    if (pathname.startsWith("/dashboard/publication/")) return "Publication Details";
    return "Overview";
  };

  const currentTitle = getPageTitle(location.pathname);

  const renderNavLinks = (onNavigate?: () => void) => (
    <div className="space-y-4">
      {navCategories.map((group) => (
        <div key={group.category} className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {group.category}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname === item.path || location.pathname.startsWith(item.path + "/");

              const isPendingAdmin = item.path === "/dashboard/admin" && pendingCount > 0;

              return (
                <button
                  key={item.name}
                  onClick={() => {
                    navigate(item.path);
                    if (onNavigate) onNavigate();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? item.isAI
                        ? "bg-ai-soft text-ai-foreground font-semibold shadow-2xs border border-ai-border"
                        : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold shadow-2xs"
                      : item.isAI
                      ? "text-muted-foreground hover:text-ai hover:bg-ai-soft/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <item.icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? item.isAI
                            ? "text-ai"
                            : "text-blue-600 dark:text-blue-400"
                          : item.isAI
                          ? "text-ai/70"
                          : "text-muted-foreground"
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>

                  {isPendingAdmin && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-warning-soft text-warning-foreground border border-warning-border">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-foreground transition-colors duration-200">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white dark:bg-card border-r border-border/70 flex-col z-20">
        {/* Logo */}
        <div className="p-5 border-b border-border/70">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <img src={psuLogo} alt="PSU Logo" className="w-10 h-10 object-contain" />
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">Research Portal</h2>
              <p className="text-[11px] text-muted-foreground">PSU Asingan Campus</p>
            </div>
          </div>
        </div>

        {/* Categorized Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto space-y-4">
          {renderNavLinks()}
        </nav>

        {/* Bottom Section: My Profile, Settings & Compact Logout */}
        <div className="p-3 border-t border-border/70 space-y-1 bg-muted/10">
          {bottomUtilityNavigation.map((item) => {
            const isActive =
              location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span>{item.name}</span>
              </button>
            );
          })}

          <div className="pt-2 mt-1 border-t border-border/60 flex items-center justify-between px-2">
            <span className="text-[11px] text-muted-foreground truncate max-w-[110px]" title={currentUser.name}>
              {currentUser.role === "admin" ? "Admin" : currentUser.instructorId || "Instructor"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLogoutConfirm(true)}
              className="h-7 px-2 text-xs font-medium text-danger-foreground hover:text-danger hover:bg-danger-soft rounded-lg transition-colors gap-1.5"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5 text-danger" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-over menu */}
          <div className="relative flex flex-col w-72 max-w-[80vw] bg-white dark:bg-card border-r border-border/70 z-10 shadow-2xl">
            <div className="p-5 border-b border-border/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={psuLogo} alt="PSU Logo" className="w-9 h-9 object-contain" />
                <div>
                  <h2 className="text-sm font-bold text-foreground">Research Portal</h2>
                  <p className="text-[11px] text-muted-foreground">PSU Asingan</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="h-8 w-8 text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <nav className="flex-1 p-3 overflow-y-auto">
              {renderNavLinks(() => setMobileMenuOpen(false))}
            </nav>

            <div className="p-3 border-t border-border/70 space-y-1 bg-muted/10">
              {bottomUtilityNavigation.map((item) => {
                const isActive =
                  location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      navigate(item.path);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span>{item.name}</span>
                  </button>
                );
              })}

              <div className="pt-2 mt-1 border-t border-border/60 flex items-center justify-between px-2">
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="h-7 px-2 text-xs font-medium text-danger-foreground hover:text-danger hover:bg-danger-soft rounded-lg transition-colors gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5 text-danger" />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* Calm Top Header */}
        <header className="bg-white/95 dark:bg-card/95 backdrop-blur-md border-b border-border/70 sticky top-0 z-30 transition-colors">
          <div className="px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between">
            {/* Left: Mobile Brand & Desktop Breadcrumb */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Mobile Drawer Trigger with PSU Logo */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden flex items-center gap-2 p-1 -ml-1 rounded-xl hover:bg-muted/60 transition-colors text-left"
                aria-label="Open Navigation Menu"
              >
                <img src={psuLogo} alt="PSU" className="w-8 h-8 object-contain" />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-foreground block leading-tight truncate">
                    PSU Asingan
                  </span>
                  <span className="text-[10px] text-muted-foreground block leading-tight truncate">
                    {currentTitle}
                  </span>
                </div>
              </button>

              <div className="hidden lg:flex items-center gap-2 text-xs font-medium">
                <span className="text-muted-foreground">Portal</span>
                <span className="text-muted-foreground/50">/</span>
                <span className="text-foreground font-semibold">{currentTitle}</span>
              </div>

              {/* Spotlight Command Palette Trigger */}
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-all shadow-2xs ml-1 sm:ml-0"
              >
                <Search className="w-3.5 h-3.5 text-brand" />
                <span className="hidden sm:inline">Search or jump to...</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono text-muted-foreground">
                  Ctrl K
                </kbd>
              </button>
            </div>

            {/* Right: Theme Toggle & User Info */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              {/* Quick Theme Toggle Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleTheme}
                title={`Theme: ${theme}. Click to switch.`}
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
              >
                {resolvedTheme === "dark" ? (
                  <Moon className="w-4 h-4 text-blue-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
              </Button>

              {/* User Avatar & Name */}
              <div
                onClick={() => navigate("/dashboard/profile")}
                className="flex items-center gap-2 cursor-pointer group hover:opacity-90 transition-opacity pl-1 sm:pl-2"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-foreground group-hover:text-brand transition-colors leading-tight">
                    {currentUser.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {currentUser.role === "admin"
                      ? "Administrator"
                      : `${currentUser.department || "Faculty"} Instructor`}
                  </p>
                </div>
                <Avatar className="h-8 w-8 ring-1 ring-border group-hover:ring-brand/50 transition-all">
                  {currentUser.photoUrl ? (
                    <AvatarImage src={currentUser.photoUrl} alt={currentUser.name} />
                  ) : null}
                  <AvatarFallback className="bg-brand text-white font-semibold text-xs">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
        </header>

        {/* Page Main Content with Safe Bottom Padding on Mobile */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar (Modern Premier App Feel) */}
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-card/95 backdrop-blur-md border-t border-border/80 pb-safe px-2 py-1 shadow-lg"
        >
          <div className="flex items-center justify-around max-w-lg mx-auto">
            {/* Primary Tab 1: Overview */}
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                location.pathname === "/dashboard"
                  ? "text-brand font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Overview</span>
              {location.pathname === "/dashboard" && (
                <span className="w-1 h-1 rounded-full bg-brand mt-0.5" />
              )}
            </button>

            {/* Primary Tab 2: Publications / Work */}
            <button
              type="button"
              onClick={() => navigate("/dashboard/publications")}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                location.pathname.startsWith("/dashboard/publications")
                  ? "text-brand font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">
                {currentUser.role === "instructor" ? "My Work" : "Papers"}
              </span>
              {location.pathname.startsWith("/dashboard/publications") && (
                <span className="w-1 h-1 rounded-full bg-brand mt-0.5" />
              )}
            </button>

            {/* Primary Tab 3: Search Engine */}
            <button
              type="button"
              onClick={() => navigate("/dashboard/search-engine")}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                location.pathname.startsWith("/dashboard/search-engine")
                  ? "text-brand font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Search className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Search</span>
              {location.pathname.startsWith("/dashboard/search-engine") && (
                <span className="w-1 h-1 rounded-full bg-brand mt-0.5" />
              )}
            </button>

            {/* Primary Tab 4: Admin Console (for admin) or SDG Radar (for instructor) */}
            {currentUser.role === "admin" ? (
              <button
                type="button"
                onClick={() => navigate("/dashboard/admin")}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative cursor-pointer ${
                  location.pathname.startsWith("/dashboard/admin")
                    ? "text-brand font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="relative">
                  <Shield className="w-5 h-5" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-2 px-1 py-0 text-[8px] font-bold rounded-full bg-warning-soft text-warning-foreground border border-warning-border">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5">Admin</span>
                {location.pathname.startsWith("/dashboard/admin") && (
                  <span className="w-1 h-1 rounded-full bg-brand mt-0.5" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/dashboard/sdg-matrix")}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                  location.pathname.startsWith("/dashboard/sdg-matrix")
                    ? "text-brand font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Target className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">SDG</span>
                {location.pathname.startsWith("/dashboard/sdg-matrix") && (
                  <span className="w-1 h-1 rounded-full bg-brand mt-0.5" />
                )}
              </button>
            )}

            {/* Primary Tab 5: Menu Drawer Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Menu</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Logout Confirmation Dialog */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out of your session? You will need to sign in again to access your account."
        confirmText="Yes, Logout"
        cancelText="Cancel"
        variant="danger"
        icon="logout"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* Floating Ask Campus AI Mascot Bubble (Persistent Help Widget) */}
      <FloatingAskAIBubble />
    </div>
  );
}
