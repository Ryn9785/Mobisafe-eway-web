import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ewayAdminRoleId, setEwayAdminRoleId] = useState(null);
  const [isEwayAdminMember, setIsEwayAdminMember] = useState(false);
  const navigate = useNavigate();

  const probeEwayAdmin = useCallback(async (u) => {
    if (!u || u.administrator) {
      setIsEwayAdminMember(false);
      return;
    }
    try {
      const roles = await api.listRoles({ silent: true });
      const ewayAdmin = (roles || []).find((r) => r.name === 'EWAY_ADMIN');
      if (!ewayAdmin) {
        setEwayAdminRoleId(null);
        setIsEwayAdminMember(false);
        return;
      }
      setEwayAdminRoleId(ewayAdmin.id);
      try {
        const members = await api.listRoleMembers(ewayAdmin.id, { silent: true });
        setIsEwayAdminMember((members || []).some((m) => m.id === u.id));
      } catch {
        setIsEwayAdminMember(false);
      }
    } catch {
      // Sub-users lack role:list — treat as non-admin member.
      setEwayAdminRoleId(null);
      setIsEwayAdminMember(false);
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const u = await api.getSession();
      setUser(u);
      probeEwayAdmin(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [probeEwayAdmin]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [navigate]);

  const login = async (email, password) => {
    const u = await api.login(email, password);
    setUser(u);
    probeEwayAdmin(u);
    return u;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    navigate('/login', { replace: true });
  };

  const refreshUser = async (updatedUser) => {
    if (updatedUser) {
      setUser(updatedUser);
      return updatedUser;
    }
    const u = await api.getSession();
    setUser(u);
    return u;
  };

  const isEwayAdmin = !!user && (user.administrator || isEwayAdminMember);
  const isManager = !!user && (user.administrator || user.userLimit !== 0 || isEwayAdminMember);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        isManager,
        isEwayAdmin,
        ewayAdminRoleId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
