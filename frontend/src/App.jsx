import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Overview from './pages/Overview';
import Apartments from './pages/Apartments';
import Tenants from './pages/Tenants';
import Billing from './pages/Billing';
import Complaints from './pages/Complaints';
import Notices from './pages/Notices';
import Chat from './pages/Chat';
import Facilities from './pages/Facilities';
import Visitors from './pages/Visitors';
import Community from './pages/Community';
import Analytics from './pages/Analytics';

function Page({ children }) {
  return <ProtectedRoute><Layout>{children}</Layout></ProtectedRoute>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      <Route path="/" element={<Page><Overview /></Page>} />
      <Route path="/apartments" element={<ProtectedRoute staffOnly><Layout><Apartments /></Layout></ProtectedRoute>} />
      <Route path="/tenants" element={<ProtectedRoute staffOnly><Layout><Tenants /></Layout></ProtectedRoute>} />
      <Route path="/billing" element={<Page><Billing /></Page>} />
      <Route path="/complaints" element={<Page><Complaints /></Page>} />
      <Route path="/notices" element={<Page><Notices /></Page>} />
      <Route path="/chat" element={<Page><Chat /></Page>} />
      <Route path="/facilities" element={<Page><Facilities /></Page>} />
      <Route path="/visitors" element={<Page><Visitors /></Page>} />
      <Route path="/community" element={<Page><Community /></Page>} />
      <Route path="/analytics" element={<ProtectedRoute staffOnly><Layout><Analytics /></Layout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
