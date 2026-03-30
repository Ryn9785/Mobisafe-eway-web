import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import EwayAuthPage from './pages/EwayAuthPage';
import StateCodesPage from './pages/StateCodesPage';
import FetchBillsPage from './pages/FetchBillsPage';
import UserManagementPage from './pages/UserManagementPage';
import { Box, CircularProgress } from '@mui/material';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<FetchBillsPage />} />
          <Route path="eway-auth" element={<EwayAuthPage />} />
          <Route path="state-codes" element={<StateCodesPage />} />
          <Route path="fetch-bills" element={<FetchBillsPage />} />
          <Route path="users" element={<UserManagementPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
