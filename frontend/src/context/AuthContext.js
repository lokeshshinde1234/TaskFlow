import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    try {
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      localStorage.removeItem('user');
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(Boolean(localStorage.getItem('token')));
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession();
      setAuthLoading(false);
    };
    window.addEventListener('taskflow:session-expired', handleSessionExpired);
    return () => window.removeEventListener('taskflow:session-expired', handleSessionExpired);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    const verifyStoredSession = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        if (!cancelled) {
          clearSession();
          setAuthLoading(false);
        }
        return;
      }

      setAuthLoading(true);
      try {
        const response = await authAPI.me();
        if (cancelled) return;
        localStorage.setItem('user', JSON.stringify(response.data));
        setToken(storedToken);
        setUser(response.data);
      } catch (error) {
        if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    verifyStoredSession();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback((authPayload) => {
    localStorage.setItem('token', authPayload.access_token);
    localStorage.setItem('user', JSON.stringify(authPayload.user));
    setToken(authPayload.access_token);
    setUser(authPayload.user);
    setAuthLoading(false);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setAuthLoading(false);
  }, [clearSession]);

  const value = useMemo(
    () => ({
      token,
      user,
      role: user?.role,
      isAuthenticated: Boolean(token),
      authLoading,
      theme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
      login,
      logout,
    }),
    [authLoading, token, user, theme, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
