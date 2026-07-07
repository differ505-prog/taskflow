"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  bindSupabaseAuthRefresher,
  refreshSupabaseRealtimeAuth,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { UserRole, ADMIN_EMAILS, ROLE_CONFIGS } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // ── Role & Permissions ────────────────────────────────
  role: UserRole;
  roleConfig: typeof ROLE_CONFIGS[UserRole];
  canUpload: boolean;
  maxFileSizeMB: number;
  isAdmin: boolean;
  isBeta: boolean;
  isFree: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
  role: "free",
  roleConfig: ROLE_CONFIGS.free,
  canUpload: false,
  maxFileSizeMB: 0,
  isAdmin: false,
  isBeta: false,
  isFree: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [betaUsers, setBetaUsers] = useState<string[]>([]);

  const BETA_USERS_KEY = "taskflow_beta_users";

  // Load beta users from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BETA_USERS_KEY);
      if (stored) {
        setBetaUsers(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Compute role based on user email and beta list
  const role = (() => {
    if (!user?.email) return "free" as UserRole;
    const email = user.email.toLowerCase();

    if (ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
      return "admin" as UserRole;
    }
    if (betaUsers.map((e) => e.toLowerCase()).includes(email)) {
      return "beta" as UserRole;
    }
    return "free" as UserRole;
  })();

  const roleConfig = ROLE_CONFIGS[role];
  const canUpload = roleConfig.canUpload;
  const maxFileSizeMB = roleConfig.maxFileSizeMB;
  const isAdmin = role === "admin";
  const isBeta = role === "beta";
  const isFree = role === "free";

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let unsubSupabase: (() => void) | undefined;

    try {
      const auth = getFirebaseAuth();
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
        // 登入 / 切換身分時立刻刷新 Realtime WebSocket 的 JWT
        if (isSupabaseConfigured()) {
          refreshSupabaseRealtimeAuth();
        }
      });
      // 監聽 Firebase ID token 刷新（~1 小時）並推到 Supabase Realtime
      if (isSupabaseConfigured()) {
        unsubSupabase = bindSupabaseAuthRefresher();
      }
    } catch {
      // Firebase not configured yet
      setLoading(false);
    }

    return () => {
      unsubscribe?.();
      unsubSupabase?.();
    };
  }, []);

  const signInWithGoogle = async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user, loading,
        signInWithGoogle, signInWithEmail, signUpWithEmail, signOut,
        role, roleConfig, canUpload, maxFileSizeMB,
        isAdmin, isBeta, isFree,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ── Beta User Management ───────────────────────────────────────
const BETA_USERS_KEY = "taskflow_beta_users";

export function getBetaUsers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(BETA_USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveBetaUsers(emails: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BETA_USERS_KEY, JSON.stringify(emails));
  } catch {
    // Storage unavailable
  }
}

export function addBetaUser(email: string): void {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return;
  const users = getBetaUsers();
  if (!users.map((e) => e.toLowerCase()).includes(normalized)) {
    saveBetaUsers([...users, normalized]);
  }
}

export function removeBetaUser(email: string): void {
  const normalized = email.toLowerCase().trim();
  const users = getBetaUsers().filter((e) => e.toLowerCase() !== normalized);
  saveBetaUsers(users);
}

export function isUserBeta(email: string | null | undefined): boolean {
  if (!email) return false;
  return getBetaUsers().map((e) => e.toLowerCase()).includes(email.toLowerCase());
}
