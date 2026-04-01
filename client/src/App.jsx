import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { ProjectProvider } from './context/ProjectContext.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import TasksPage from './pages/TasksPage.jsx';
import ReviewsPage from './pages/ReviewsPage.jsx';
import ContractsPage from './pages/ContractsPage.jsx';
import KpiPage from './pages/KpiPage.jsx';
import KpiV2Page from './pages/KpiV2Page.jsx';
import CompetitorsPage from './pages/CompetitorsPage.jsx';
import PlanMilestonePage from './pages/PlanMilestonePage.jsx';
import TimeLogsPage from './pages/TimeLogsPage.jsx';
import WorkloadPage from './pages/WorkloadPage.jsx';
import ApiConfigsPage from './pages/ApiConfigsPage.jsx';
import MeetingMinutesPage from './pages/MeetingMinutesPage.jsx';
import KnowledgePage from './pages/KnowledgePage.jsx';
import ContractsRagPage from './pages/ContractsRagPage.jsx';
import CompetitorsRagPage from './pages/CompetitorsRagPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function Protected({ children }) {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <ProjectProvider>{children}</ProjectProvider>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="plan" element={<PlanMilestonePage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="kpi" element={<KpiPage />} />
        <Route path="kpi-v2" element={<KpiV2Page />} />
        <Route path="time-logs" element={<TimeLogsPage />} />
        <Route path="workload" element={<WorkloadPage />} />
        <Route path="competitors" element={<CompetitorsPage />} />
        <Route path="api-configs" element={<ApiConfigsPage />} />
        <Route path="meeting-minutes" element={<MeetingMinutesPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="contracts-rag" element={<ContractsRagPage />} />
        <Route path="competitors-rag" element={<CompetitorsRagPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
