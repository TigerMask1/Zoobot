import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [guilds, setGuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/me', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setGuilds(data.guilds || []);
      } else {
        setUser(null);
        setGuilds([]);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setUser(null);
      setGuilds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = () => {
    window.location.href = '/auth/discord';
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
      setGuilds([]);
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const refreshGuilds = async () => {
    try {
      const response = await fetch('/api/guilds', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setGuilds(data.guilds || []);
      }
    } catch (err) {
      console.error('Failed to refresh guilds:', err);
    }
  };

  const value = {
    user,
    guilds,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser: fetchUser,
    refreshGuilds,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
