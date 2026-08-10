import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('aaa_token');
    if (!token) { setLoading(false); return; }
    api.me().then((r) => setUser(r.user)).catch(() => localStorage.removeItem('aaa_token')).finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { token, user } = await api.login(email, password);
    localStorage.setItem('aaa_token', token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem('aaa_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
