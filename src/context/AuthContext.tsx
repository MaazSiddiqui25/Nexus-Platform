import React, { createContext, useState, useContext, useEffect } from "react";
import toast from "react-hot-toast";
import { User, UserRole, AuthContextType } from "../types";
import { api } from "../api";
import { USER_STORAGE_KEY, TOKEN_STORAGE_KEY } from "../config";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) setUser(JSON.parse(storedUser));
    setIsLoading(false);
  }, []);

  // ✅ Updated login function to accept role parameter (required)
  const login = async (email: string, password: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const loginData = { email, password, role };
      
      console.log('Sending login request with:', { email, role }); // Debug log
      
      const data = await api("/auth/login", "POST", loginData);
      setUser(data);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      toast.success("Logged in successfully!");
    } catch (err: any) {
      console.error('Login error in AuthContext:', err); // Debug log
      toast.error(err.message || "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const data = await api("/auth/register", "POST", { name, email, password, role });
      setUser(data);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      toast.success("Account created successfully!");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const data = await api("/auth/forgot-password", "POST", { email });
      toast.success("Password reset instructions sent to your email");
      return data.resetToken; // for testing
    } catch (err: any) {
      toast.error(err.message || "Forgot password failed");
      throw err;
    }
  };

  const resetPassword = async (token: string, newPassword: string) => {
    try {
      await api(`/auth/reset-password/${token}`, "POST", { newPassword });
      toast.success("Password reset successfully");
    } catch (err: any) {
      toast.error(err.message || "Reset password failed");
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    toast.success("Logged out successfully");
  };

  const updateProfile = async (userId: string, updates: Partial<User>) => {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY) || "";
      const data = await api("/auth/profile", "PUT", updates, token);
      if (user?.id === userId) {
        setUser(data);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data));
      }
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Profile update failed");
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    isAuthenticated: !!user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};