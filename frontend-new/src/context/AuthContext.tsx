import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import type { User } from '../types';
import { authAPI } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          localStorage.setItem('access_token', token);
          await refreshUser();
        } catch (error) {
          console.error("Error fetching user data:", error);
          localStorage.removeItem('access_token');
          setUser(null);
        }
      } else {
        localStorage.removeItem('access_token');
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data);
      return response.data;
    } catch (err) {
      localStorage.removeItem('access_token');
      setUser(null);
      throw err;
    }
  };

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    localStorage.setItem('access_token', token);
    await refreshUser();
  };

  const register = async (email: string, password: string, fullName: string) => {
    // 1. Create user in Firebase
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    localStorage.setItem('access_token', token);
    
    // 2. Create user in PostgreSQL application database
    try {
      await authAPI.register({
        email,
        full_name: fullName,
        role: 'citizen'
      });
    } catch (error) {
      // If backend registration fails, we might want to cleanup the Firebase user or log it
      console.error("Backend registration failed:", error);
      throw error;
    }
    
    // 3. Load user context
    await refreshUser();
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('access_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}