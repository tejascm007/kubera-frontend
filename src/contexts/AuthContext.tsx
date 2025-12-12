import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  authApi,
  userApi,
  setTokens,
  clearTokens,
  getToken,
  ApiError,
  RegisterStep3Data,
  UserInfo
} from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  email_verified?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  registrationStep: 'idle' | 'email_sent' | 'otp_verified' | 'complete';
  pendingEmail: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  // 3-step registration
  registerStep1: (email: string) => Promise<void>;
  registerStep2: (otp: string) => Promise<void>;
  registerStep3: (data: Omit<RegisterStep3Data, 'email'>) => Promise<void>;
  // Legacy register (combines all steps - for simpler UX if needed)
  register: (data: { name: string; email: string; password: string; username: string }) => Promise<{ success: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearRegistrationState: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getToken());
  const [isLoading, setIsLoading] = useState(true);
  const [registrationStep, setRegistrationStep] = useState<'idle' | 'email_sent' | 'otp_verified' | 'complete'>('idle');
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // Load user on mount if token exists
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getToken();
      if (storedToken) {
        try {
          // Backend returns profile directly, not wrapped in {user: ...}
          const profile = await userApi.getProfile();
          setUser({
            id: profile.user_id,
            email: profile.email,
            name: profile.full_name,
            username: profile.username,
            email_verified: profile.email_verified,
          });
          setToken(storedToken);
        } catch (error) {
          console.error('Failed to load user:', error);
          clearTokens();
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string, rememberMe: boolean = false) => {
    const response = await authApi.login(username, password);

    // Pass rememberMe to setTokens to choose correct storage
    setTokens(response.access_token, response.refresh_token, rememberMe);
    setToken(response.access_token);

    const userData: User = {
      id: response.user.user_id,
      email: response.user.email,
      name: response.user.full_name,
      username: response.user.username,
      email_verified: response.user.email_verified,
    };

    setUser(userData);

    // Store user data in the same storage as tokens
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('kubera-user', JSON.stringify(userData));

    // Clear any pending registration state
    setRegistrationStep('idle');
    setPendingEmail(null);
  };

  // Step 1: Send OTP to email
  const registerStep1 = async (email: string): Promise<void> => {
    await authApi.registerStep1(email);
    setPendingEmail(email);
    setRegistrationStep('email_sent');
  };

  // Step 2: Verify OTP
  const registerStep2 = async (otp: string): Promise<void> => {
    if (!pendingEmail) {
      throw new Error('No pending email for OTP verification');
    }
    await authApi.registerStep2(pendingEmail, otp);
    setRegistrationStep('otp_verified');
  };

  // Step 3: Complete registration with profile data
  const registerStep3 = async (data: Omit<RegisterStep3Data, 'email'>): Promise<void> => {
    if (!pendingEmail) {
      throw new Error('No pending email for registration');
    }

    const response = await authApi.registerStep3({
      ...data,
      email: pendingEmail,
    });

    setTokens(response.access_token, response.refresh_token);
    setToken(response.access_token);

    const userData: User = {
      id: response.user.user_id,
      email: response.user.email,
      name: response.user.full_name,
      username: response.user.username,
      email_verified: response.user.email_verified,
    };

    setUser(userData);
    localStorage.setItem('kubera-user', JSON.stringify(userData));

    setRegistrationStep('complete');
    setPendingEmail(null);
  };

  // Legacy register function - for simpler UX that combines steps
  // Note: This requires backend support for single-step registration or we simulate it
  const register = async (data: { name: string; email: string; password: string; username: string }): Promise<{ success: boolean }> => {
    // Step 1: Send OTP
    await authApi.registerStep1(data.email);
    setPendingEmail(data.email);
    setRegistrationStep('email_sent');

    // Store data for later use after OTP verification
    localStorage.setItem('kubera-pending-registration', JSON.stringify({
      full_name: data.name,
      username: data.username,
      password: data.password,
    }));

    return { success: true };
  };

  const clearRegistrationState = () => {
    setRegistrationStep('idle');
    setPendingEmail(null);
    localStorage.removeItem('kubera-pending-registration');
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    setToken(null);
    setRegistrationStep('idle');
    setPendingEmail(null);
    clearTokens();
  };

  const refreshUser = async () => {
    try {
      // Backend returns profile directly
      const profile = await userApi.getProfile();
      setUser({
        id: profile.user_id,
        email: profile.email,
        name: profile.full_name,
        username: profile.username,
        email_verified: profile.email_verified,
      });
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        registrationStep,
        pendingEmail,
        login,
        registerStep1,
        registerStep2,
        registerStep3,
        register,
        logout,
        refreshUser,
        clearRegistrationState,
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
