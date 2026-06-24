import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./auth/AuthContext";
import { Icon } from "./components/ui";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import ErrorBrowser from "./pages/ErrorBrowser";
import Applications from "./pages/Applications";
import Alerts from "./pages/Alerts";
import Teams from "./pages/Teams";
import NotificationGroups from "./pages/NotificationGroups";
import Thresholds from "./pages/Thresholds";
import Escalations from "./pages/Escalations";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Docs from "./pages/Docs";
import Support from "./pages/Support";

export default function App() {
  const { user, loading, needsSetup } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Icon name="progress_activity" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (needsSetup) return <Setup />;
  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/errors" element={<ErrorBrowser />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/notification-groups" element={<NotificationGroups />} />
        <Route path="/thresholds" element={<Thresholds />} />
        <Route path="/escalations" element={<Escalations />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/support" element={<Support />} />
        {user.role === "admin" && <Route path="/users" element={<Users />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
