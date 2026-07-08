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
import {
  addBetaUserFS,
  removeBetaUserFS,
  subscribeBetaUsers,
} from "@/lib/betaListFS";

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
  // ── Beta Cloud List (Firestore-backed) ───────────────
  betaUsers: string[];
  betaLoading: boolean;
  addBetaUser: (email: string) => Promise<void>;
  removeBetaUser: (email: string) => Promise<void>;
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
  betaUsers: [],
  betaLoading: true,
  addBetaUser: async () => {},
  removeBetaUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [betaUsers, setBetaUsers] = useState<string[]>([]);
  const [betaLoading, setBetaLoading] = useState(true);

  // ── 即時訂閱 Firestore Beta 名單 ──────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeBetaUsers((emails) => {
      setBetaUsers(emails);
      setBetaLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 計算當前登入用戶的角色
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
  const maxFileSizeMB =
    roleConfig.maxFileSizeMB === Infinity
      ? Infinity
      : roleConfig.maxFileSizeMB;
  const isAdmin = role === "admin";
  const isBeta = role === "beta";
  const isFree = role === "free";

  // ── Firebase Auth 監聽 ──────────────────────────────────
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let unsubSupabase: (() => void) | undefined;

    try {
      const auth = getFirebaseAuth();
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
        if (isSupabaseConfigured()) {
          refreshSupabaseRealtimeAuth();
        }
      });
      if (isSupabaseConfigured()) {
        unsubSupabase = bindSupabaseAuthRefresher();
      }
    } catch {
      setLoading(false);
    }

    return () => {
      unsubscribe?.();
      unsubSupabase?.();
    };
  }, []);

  // ── Beta CRUD（寫入 Firestore，介面保持相容）─────────────
  const addBetaUser = async (email: string) => {
    const normalized = email.toLowerCase().trim();
    if (!normalized) return;
    if (!user?.uid) throw new Error("尚未登入");
    await addBetaUserFS(normalized, user.uid);
    // 不需手動更新 state，onSnapshot 會即時推送
  };

  const removeBetaUser = async (email: string) => {
    const normalized = email.toLowerCase().trim();
    await removeBetaUserFS(normalized);
  };

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
        betaUsers, betaLoading,
        addBetaUser, removeBetaUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
