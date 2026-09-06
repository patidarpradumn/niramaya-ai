import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import type { User, UserRole, AuthState } from '../types';
import { authAPI } from '../services/api/authService';

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, role?: UserRole) => Promise<void>;
  register: (email: string, password: string, fullName: string, role: UserRole) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          localStorage.setItem('access_token', idToken);
          setToken(idToken);
          await refreshUser();
        } catch (error) {
          console.error("Error fetching user data:", error);
          localStorage.removeItem('access_token');
          setUser(null);
          setToken(null);
        }
      } else {
        localStorage.removeItem('access_token');
        setUser(null);
        setToken(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async (): Promise<void> => {
    try {
      const userData = await authAPI.getMe();
      setUser(userData);
    } catch (err) {
      localStorage.removeItem('access_token');
      setUser(null);
      setToken(null);
      throw err;
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      localStorage.setItem('access_token', idToken);
      setToken(idToken);
      await refreshUser();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string, role: UserRole) => {
    setIsLoading(true);
    try {
      // 1. Create user in Firebase
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      
      // 2. We don't set access_token in localStorage yet, because if they are pending, 
      // we shouldn't fully log them in. But we need a token to register in the backend.
      localStorage.setItem('access_token', idToken);
      
      // 3. Create user in PostgreSQL application database
      try {
        await authAPI.register({
          email,
          full_name: fullName,
          role: role,
          firebase_uid: userCredential.user.uid
        });
      } catch (error) {
        // Backend registration failed (or pending), we logout from firebase to prevent unapproved session
        await signOut(auth);
        localStorage.removeItem('access_token');
        throw error;
      }
      
      // 4. Try to load user context
      try {
        await refreshUser();
        setToken(idToken);
      } catch (error) {
        // User was created but login rejected (e.g. 403 Account Pending)
        await signOut(auth);
        localStorage.removeItem('access_token');
        throw error;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      localStorage.removeItem('access_token');
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
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
