import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

// Role hierarchy mirrored from the backend (src/middleware/auth.js) so the
// UI can hide/disable actions the API would reject anyway.
const ROLE_RANK = { subscriber: 0, author: 1, editor: 2, admin: 3 };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('educms_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem('educms_user', JSON.stringify(user));
    else localStorage.removeItem('educms_user');
  }, [user]);

  async function login(email, password) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('educms_token', data.data.token);
      setUser(data.data.user);
      return data.data.user;
    } finally {
      setLoading(false);
    }
  }

  async function register(name, email, password) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      localStorage.setItem('educms_token', data.data.token);
      setUser(data.data.user);
      return data.data.user;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('educms_token');
    setUser(null);
  }

  function hasRole(minRole) {
    if (!user) return false;
    return (ROLE_RANK[user.role] ?? -1) >= (ROLE_RANK[minRole] ?? Infinity);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
