import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, MonthlyPackage } from '../types/index';
import { authService } from '../services/auth.service';
import { monthlyPackageService } from '../services/monthlyPackage.service';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (
    fullName: string,
    email: string,
    password: string,
    phoneNumber: string,
    plateNumber: string,
    vehicleType: 'MOTORBIKE' | 'CAR',
    otp: string
  ) => Promise<User>;
  logout: () => void;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  hasActiveMonthlyPackage: boolean;
  isPackageLoading: boolean;
  activePackages: MonthlyPackage[];
  refreshPackageStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  const [hasActiveMonthlyPackage, setHasActiveMonthlyPackage] = useState(false);
  const [activePackages, setActivePackages] = useState<MonthlyPackage[]>([]);
  const [isPackageLoading, setIsPackageLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (!stored) {
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const data: User = await authService.me();
        setUser(data);
        setToken(stored);
        localStorage.setItem('user', JSON.stringify(data));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const response = await authService.login({ email, password });
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    return response.user;
  };

  const register = async (
    fullName: string,
    email: string,
    password: string,
    phoneNumber: string,
    plateNumber: string,
    vehicleType: 'MOTORBIKE' | 'CAR',
    otp: string
  ): Promise<User> => {
    const response = await authService.register({ fullName, email, password, phoneNumber, plateNumber, vehicleType, otp });
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    return response.user;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const refreshPackageStatus = async () => {
    if (!user || user.role !== 'DRIVER') {
      setHasActiveMonthlyPackage(false);
      setActivePackages([]);
      setIsPackageLoading(false);
      return;
    }
    setIsPackageLoading(true);
    try {
      const data = await monthlyPackageService.getMyPackages();
      const list = Array.isArray(data) ? data : [];
      setActivePackages(list);

      const active = list.some((pkg) => {
        if (pkg.status !== 'ACTIVE') return false;
        const expiryTime = new Date(pkg.expiryDate).getTime();
        return Number.isFinite(expiryTime) && expiryTime > Date.now();
      });
      setHasActiveMonthlyPackage(active);
    } catch {
      setHasActiveMonthlyPackage(false);
      setActivePackages([]);
    } finally {
      setIsPackageLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setHasActiveMonthlyPackage(false);
      setActivePackages([]);
      setIsPackageLoading(false);
    } else {
      refreshPackageStatus();
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isLoading,
        setUser,
        hasActiveMonthlyPackage,
        isPackageLoading,
        activePackages,
        refreshPackageStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
