import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const checkSession = useCallback(async () => {
    try {
      const u = await api.getSession();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const isManager = !!user && (user.administrator || user.userLimit !== 0);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, isManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
