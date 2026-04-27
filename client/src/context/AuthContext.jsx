import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('sf_token');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      setWorkspace(data.workspace);
    } catch {
      localStorage.removeItem('sf_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('sf_token', data.token);
    setUser(data.user);
    setWorkspace(data.workspace);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('sf_token', data.token);
    setUser(data.user);
    setWorkspace(data.workspace);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('sf_token');
    setUser(null);
    setWorkspace(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, workspace, loading, login, register, logout, refresh: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
