import { useState } from "react";
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
} from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import psuLogo from "figma:asset/0f3e65de85ff26584e9a3039d47bcf17ff6e6368.png";
import { clearCurrentUser, getCurrentUser } from "../utils/researchStore";
import { useTheme } from "../utils/themeContext";
import { ConfirmModal } from "./ConfirmModal";

const adminPrimaryNavigation = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, exact: true },
  { name: "Search", path: "/dashboard/search-engine", icon: Search, exact: false },
  { name: "Researchers", path: "/dashboard/researchers", icon: Users, exact: false },
  { name: "Publications", path: "/dashboard/publications", icon: FileText, exact: false },
  { name: "Impact Analysis", path: "/dashboard/impact", icon: TrendingUp, exact: false },
  { name: "Reports", path: "/dashboard/reports", icon: FileBarChart, exact: false },
  { name: "Admin", path: "/dashboard/admin", icon: Shield, exact: false },
];

const instructorPrimaryNavigation = [
  { name: "Search", path: "/dashboard/search-engine", icon: Search, exact: false },
  { name: "Researchers", path: "/dashboard/researchers", icon: Users, exact: false },
  { name: "Publications", path: "/dashboard/publications", icon: FileText, exact: false },
];

const bottomUtilityNavigation = [
  { name: "My Profile", path: "/dashboard/profile", icon: User, exact: false },
  { name: "Settings", path: "/dashboard/settings", icon: Settings, exact: false },
];

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUser();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const primaryNavigation =
    currentUser.role === "instructor" ? instructorPrimaryNavigation : adminPrimaryNavigation;

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-foreground transition-colors duration-200">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white dark:bg-card border-r border-gray-200 dark:border-gray-800 flex-col z-20">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <img 
              src={psuLogo} 
              alt="PSU Logo" 
              className="w-12 h-12 object-contain"
            />
            <div>
              <h2 className="text-sm font-bold text-foreground">Research Portal</h2>
              <p className="text-xs text-muted-foreground">PSU Asingan</p>
            </div>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {primaryNavigation.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-accent"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section: My Profile, Settings & Compact Logout */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
          {bottomUtilityNavigation.map((item) => {
            const isActive =
              location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-accent"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.name}
              </button>
            );
          })}

          <div className="pt-2.5 mt-1 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between px-2">
            <span className="text-xs text-muted-foreground truncate max-w-[110px]" title={currentUser.name}>
              {currentUser.role === "admin" ? "Admin" : currentUser.instructorId || "Instructor"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLogoutConfirm(true)}
              className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors gap-1.5"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-over menu */}
          <div className="relative flex flex-col w-72 max-w-[80vw] bg-white dark:bg-card border-r border-gray-200 dark:border-gray-800 z-10 shadow-2xl">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={psuLogo} alt="PSU Logo" className="w-10 h-10 object-contain" />
                <div>
                  <h2 className="text-sm font-bold text-foreground">Research Portal</h2>
                  <p className="text-xs text-muted-foreground">PSU Asingan</p>
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

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {primaryNavigation.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      navigate(item.path);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-accent"
                    }`}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {item.name}
                  </button>
                );
              })}
            </nav>

            {/* Mobile Bottom Utility Navigation */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
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
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm transition-all ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-accent"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.name}
                  </button>
                );
              })}

              <div className="pt-2.5 mt-1 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between px-2">
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
                  className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="bg-white/90 dark:bg-card/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 transition-colors">
          <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            {/* Left: Mobile Hamburger & Title */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden h-9 w-9 text-foreground"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </Button>

              <div className="lg:hidden flex items-center gap-2">
                <img src={psuLogo} alt="PSU Logo" className="w-7 h-7 object-contain" />
                <span className="font-semibold text-sm text-foreground">PSU Research</span>
              </div>
            </div>

            {/* Right: Theme Toggle & User Info */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Quick Theme Toggle Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleTheme}
                title={`Current theme: ${theme}. Click to change.`}
                className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-full"
              >
                {resolvedTheme === "dark" ? (
                  <Moon className="w-4 h-4 text-blue-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
              </Button>

              {/* User Avatar & Name (Clickable -> Profile) */}
              <div 
                onClick={() => navigate("/dashboard/profile")}
                className="flex items-center gap-3 cursor-pointer group hover:opacity-90 transition-opacity"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {currentUser.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentUser.role === "admin" ? "Administrator" : `${currentUser.department || "Faculty"} Instructor`}
                  </p>
                </div>
                <Avatar className="h-9 w-9 ring-2 ring-transparent group-hover:ring-blue-500/50 transition-all">
                  {currentUser.photoUrl ? (
                    <AvatarImage src={currentUser.photoUrl} alt={currentUser.name} />
                  ) : null}
                  <AvatarFallback className="bg-blue-600 text-white font-semibold text-sm">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
        </header>

        {/* Page Main Content with responsive padding */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Logout Confirmation Dialog with Blur Background */}
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
    </div>
  );
}
