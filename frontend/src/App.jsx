import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import JobDetail from './pages/JobDetail';
import PhaseDetail from './pages/PhaseDetail';
import Upload from './pages/Upload';
import UserManagement from './pages/UserManagement';
import SyncLog from './pages/SyncLog';

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/jobs/:id" element={<Protected><JobDetail /></Protected>} />
      <Route path="/jobs/:id/phases/:phaseId" element={<Protected><PhaseDetail /></Protected>} />
      <Route path="/upload" element={<Protected><Upload /></Protected>} />
      <Route path="/settings/users" element={<Protected><UserManagement /></Protected>} />
      <Route path="/settings/sync-log" element={<Protected><SyncLog /></Protected>} />
      <Route path="/jobs/:id/sync-log" element={<Protected><SyncLog /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
