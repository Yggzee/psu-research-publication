import { createBrowserRouter, Navigate } from "react-router";
import { SplashScreen } from "./components/SplashScreen";
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
import { getCurrentUser } from "./utils/researchStore";

function RoleAwarePublications() {
  return getCurrentUser().role === "instructor"
    ? <InstructorPublicationsPage />
    : <PublicationsPage />;
}

function ErrorBoundary() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl text-gray-900 mb-2">Oops! Something went wrong</h1>
        <p className="text-gray-600 mb-4">Please try refreshing the page</p>
        <a href="/dashboard" className="text-blue-600 hover:underline">
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <SplashScreen />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/login",
    element: <LoginScreen />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/dashboard",
    element: <DashboardLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Dashboard />,
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
        path: "reports",
        element: <ReportsPage />,
      },
      {
        path: "admin",
        element: <AdminPage />,
      },
      {
        path: "researcher/:id",
        element: <ResearcherProfile />,
      },
      {
        path: "publication/:id",
        element: <PublicationDetail />,
      },
    ],
  },
]);
