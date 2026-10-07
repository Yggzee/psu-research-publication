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
  GraduationCap,
  Shield
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback } from "./ui/avatar";
import psuLogo from "figma:asset/0f3e65de85ff26584e9a3039d47bcf17ff6e6368.png";
import { clearCurrentUser, getCurrentUser } from "../utils/researchStore";

const adminNavigation = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, exact: true },
  { name: "Search", path: "/dashboard/search-engine", icon: Search, exact: false },
  { name: "Researchers", path: "/dashboard/researchers", icon: Users, exact: false },
  { name: "Publications", path: "/dashboard/publications", icon: FileText, exact: false },
  { name: "Impact Analysis", path: "/dashboard/impact", icon: TrendingUp, exact: false },
  { name: "Reports", path: "/dashboard/reports", icon: FileBarChart, exact: false },
  { name: "Admin", path: "/dashboard/admin", icon: Shield, exact: false },
];

const instructorNavigation = [
  { name: "Search", path: "/dashboard/search-engine", icon: Search, exact: false },
  { name: "Researchers", path: "/dashboard/researchers", icon: Users, exact: false },
  { name: "Publications", path: "/dashboard/publications", icon: FileText, exact: false },
];

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUser();
  const navigation = currentUser.role === "instructor" ? instructorNavigation : adminNavigation;

  const handleLogout = () => {
    clearCurrentUser();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img 
              src={psuLogo} 
              alt="PSU Logo" 
              className="w-12 h-12 object-contain"
            />
            <div>
              <h2 className="text-sm text-gray-900 font-semibold">Research Portal</h2>
              <p className="text-xs text-gray-600">PSU Asingan</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            let isActive = false;
            if (item.exact) {
              isActive = location.pathname === item.path;
            } else {
              // For non-exact matches, ensure we're checking the right path
              isActive = location.pathname === item.path || 
                         (location.pathname.startsWith(item.path + "/"));
            }
            
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="ml-64">
        {/* Top Navigation Bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-8 py-4 flex items-center justify-end">
            {/* User Profile */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-gray-900">{currentUser.name}</p>
                <p className="text-xs text-gray-600">
                  {currentUser.role === "admin" ? "Administrator" : `${currentUser.department} Instructor`}
                </p>
              </div>
              <Avatar>
                <AvatarFallback className="bg-blue-600 text-white">
                  <User className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
