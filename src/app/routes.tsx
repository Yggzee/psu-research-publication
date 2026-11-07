import { createBrowserRouter, Navigate, useLocation, Outlet, useRouteError } from "react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { SplashScreen } from "./components/SplashScreen";
import { PublicRepositoryPortal } from "./components/PublicRepositoryPortal";
import { LoginScreen } from "./components/LoginScreen";
import { DashboardLayout } from "./components/DashboardLayout";
import { Dashboard } from "./components/Dashboard";
import { SearchEngine } from "./components/SearchEngine";
import { ResearchersPage } from "./components/ResearchersPage";
import { ResearcherProfile } from "./components/ResearcherProfile";
import { PublicationDetail } from "./components/PublicationDetail";
import { PublicationsPage } from "./components/PublicationsPage";
import { ImpactAnalysisPage } from "./components/ImpactAnalysisPage";
import { ReportsPage } from "./components/ReportsPage";
import { AdminPage } from "./components/AdminPage";
import { InstructorPublicationsPage } from "./components/InstructorPublicationsPage";
import { ProfilePage } from "./components/ProfilePage";
import { SettingsPage } from "./components/SettingsPage";
import { SDGImpactMatrix } from "./components/SDGImpactMatrix";
import { CampusAIChatHistory } from "./components/CampusAIChatHistory";
import { getCurrentUser, isAuthenticated } from "./utils/researchStore";
import { VerifyInvitationPage } from "./components/VerifyInvitationPage";
import { VerifyEmailPage } from "./components/VerifyEmailPage";
import { SystemGuidePage } from "./components/SystemGuidePage";

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const authenticated = isAuthenticated();

  if (!authenticated) {
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectUrl}`} replace state={{ from: location.pathname }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

function ForbiddenRedirect() {
  useEffect(() => {
    toast.error("Access Denied: Institutional Admin Controls require administrator privileges.", {
      id: "admin-access-denied",
    });
  }, []);

  return <Navigate to="/dashboard/publications" replace state={{ forbidden: true }} />;
}

export function RequireAdmin({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const user = getCurrentUser();

  if (!user) {
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectUrl}`} replace state={{ from: location.pathname }} />;
  }

  if (user.role !== "admin") {
    return <ForbiddenRedirect />;
  }

  return children ? <>{children}</> : <Outlet />;
}

function RoleAwareDashboard() {
  const user = getCurrentUser();
  if (user?.role === "instructor") {
    return <Navigate to="/dashboard/publications" replace />;
  }
  return <Dashboard />;
}

function RoleAwarePublications() {
  const user = getCurrentUser();
  return user?.role === "instructor"
    ? <InstructorPublicationsPage />
    : <PublicationsPage />;
}

function ErrorBoundary() {
  const error: any = useRouteError();
  console.error("ErrorBoundary caught an unhandled error:", error);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-lg bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h1 className="text-2xl text-gray-900 font-bold mb-2">Oops! Something went wrong</h1>
        <p className="text-gray-600 mb-4">Please try refreshing the page</p>
        {error && (
          <div className="text-left bg-red-50 text-red-700 p-3 rounded-lg text-xs font-mono mb-4 overflow-auto max-h-40">
            {error?.stack || error?.message || String(error)}
          </div>
        )}
        <div className="flex items-center justify-center gap-3">
          <a href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">
            Go to Dashboard
          </a>
          <a href="/login" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200">
            Return to Sign In
          </a>
        </div>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicRepositoryPortal />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/repository",
    element: <PublicRepositoryPortal />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/guide",
    element: <SystemGuidePage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/about",
    element: <SystemGuidePage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/splash",
    element: <SplashScreen />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/login",
    element: <LoginScreen />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/verify-invitation",
    element: <VerifyInvitationPage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/verify-email",
    element: <VerifyEmailPage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <RoleAwareDashboard />,
      },
      {
        path: "search",
        element: <Navigate to="/dashboard/researchers" replace />,
      },
      {
        path: "search-engine",
        element: <SearchEngine />,
      },
      {
        path: "researchers",
        element: <ResearchersPage />,
      },
      {
        path: "publications",
        element: <RoleAwarePublications />,
      },
      {
        path: "impact",
        element: <ImpactAnalysisPage />,
      },
      {
        path: "sdg-matrix",
        element: <SDGImpactMatrix />,
      },
      {
        path: "network-graph",
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "ask-ai",
        element: <CampusAIChatHistory />,
      },
      {
        path: "ai-history",
        element: <CampusAIChatHistory />,
      },
      {
        path: "reports",
        element: <ReportsPage />,
      },
      {
        path: "admin",
        element: (
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        ),
      },
      {
        path: "researcher/:id",
        element: <ResearcherProfile />,
      },
      {
        path: "publication/:id",
        element: <PublicationDetail />,
      },
      {
        path: "profile",
        element: <ProfilePage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);
