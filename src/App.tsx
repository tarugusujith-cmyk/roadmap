import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, RequireRole, WorkspaceHome } from './components/Guards';
import Layout from './components/Layout';
import { WorkspaceProvider } from './context/WorkspaceContext';
import Login from './pages/Login';
import WorkspaceSelector from './pages/WorkspaceSelector';
import Dashboard from './pages/Dashboard';
import FeedbackList from './pages/FeedbackList';
import FeedbackDetail from './pages/FeedbackDetail';
import FeedbackForm from './pages/FeedbackForm';
import CategoriesTags from './pages/CategoriesTags';
import RoadmapBoard from './pages/RoadmapBoard';
import PublicRoadmap from './pages/PublicRoadmap';
import ReleaseNotes from './pages/ReleaseNotes';
import Team from './pages/Team';
import Subscription from './pages/Subscription';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/public/:wid/roadmap" element={<PublicRoadmap />} />
      <Route path="/workspaces" element={<ProtectedRoute><WorkspaceSelector /></ProtectedRoute>} />
      <Route path="/w/:wid" element={<ProtectedRoute><WorkspaceProvider><Layout /></WorkspaceProvider></ProtectedRoute>}>
        <Route index element={<WorkspaceHome />} />
        <Route path="dashboard" element={<RequireRole action="dashboard.view"><Dashboard /></RequireRole>} />
        <Route path="feedback" element={<FeedbackList />} />
        <Route path="feedback/new" element={<FeedbackForm />} />
        <Route path="feedback/:id" element={<FeedbackDetail />} />
        <Route path="feedback/:id/edit" element={<FeedbackForm />} />
        <Route path="categories" element={<RequireRole action="category.manage"><CategoriesTags /></RequireRole>} />
        <Route path="roadmap" element={<RoadmapBoard />} />
        <Route path="release-notes" element={<ReleaseNotes />} />
        <Route path="team" element={<RequireRole action="team.manage"><Team /></RequireRole>} />
        <Route path="subscription" element={<RequireRole action="subscription.view"><Subscription /></RequireRole>} />
        <Route path="settings" element={<RequireRole action="workspace.settings"><Settings /></RequireRole>} />
      </Route>
      <Route path="*" element={<Navigate to="/workspaces" replace />} />
    </Routes>
  );
}
