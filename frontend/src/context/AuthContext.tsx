import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export interface User {
  id: string;
  username: string;
  email: string;
  name?: string;
  bio?: string;
  image?: string;
  xp?: number;
  level?: number;
  currentStreak?: number;
  longestStreak?: number;
  achievements?: Array<{ id: string; name: string; description: string; icon: string; unlockedAt: string }>;
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  preferences?: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (userData: User) => void;
  completeOnboarding: (step?: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
      localStorage.setItem("acnerra_logged_in", "true");
    } catch {
      setUser(null);
      localStorage.removeItem("acnerra_logged_in");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("acnerra_logged_in") === "true") {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem("acnerra_logged_in", "true");
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      localStorage.removeItem("acnerra_logged_in");
      localStorage.removeItem("acnerra_token");
    }
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  const completeOnboarding = async (step: number = 6) => {
    try {
      await api.patch('/profiles/onboarding', { completed: true, step });
      if (user) {
        setUser({ ...user, onboardingCompleted: true, onboardingStep: step });
      }
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
      if (user) {
        setUser({ ...user, onboardingCompleted: true, onboardingStep: step });
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, updateUser, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
