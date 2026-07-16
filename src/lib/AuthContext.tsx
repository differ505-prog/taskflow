"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import { subscribeBetaUsers } from "@/lib/betaListFS";
import { upsertProfile, getRole } from "@/lib/userProfiles";
import { UserRole, ADMIN_EMAILS, ROLE_CONFIGS } from "@/lib/types";

// ── Supabase client ──────────────────────────────────────────────
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── 通用 User type（同時相容 Firebase User 欄位）──────────────
export interface AuthUser {
  uid: string;
  id: string;         // === uid
  email: string | null;
  displayName: string | null;
  photoURL?: string | null; // OAuth avatar
}

// ── Context value ───────────────────────────────────────────────
interface AuthContextValue {
  user: AuthUser | null;
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
  // ── Beta Cloud List ───────────────────────────────
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [betaUsers, setBetaUsers] = useState<string[]>([]);
  const [betaLoading, setBetaLoading] = useState(true);
  // dbRole 是資料庫權威值（null = 尚未抓到，避免誤判為 free）
  const [dbRole, setDbRole] = useState<UserRole | null>(null);

  // ── 即時訂閱 Firestore Beta 名單（不受 auth 系統影響）────
  useEffect(() => {
    const unsubscribe = subscribeBetaUsers((emails) => {
      setBetaUsers(emails);
      setBetaLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ── 從資料庫取得權威 role ────────────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setDbRole(null);
      return;
    }
    void getRole(user.uid).then((r) => setDbRole(r));
  }, [user?.uid]);

  // ── 計算當前角色 ──────────────────────────────────────
  // 優先級：admin（env）> admin（資料庫）> beta（雲端名單）> beta（資料庫）> free
  // 即使 Supabase 失敗，ADMIN_EMAILS 與 betaUsers 也能完整判斷角色
  const role = (() => {
    if (!user?.email) return "free" as UserRole;
    const email = user.email.toLowerCase();

    if (ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
      return "admin" as UserRole;
    }
    if (dbRole === "admin") return "admin" as UserRole;

    if (betaUsers.map((e) => e.toLowerCase()).includes(email)) {
      return "beta" as UserRole;
    }
    if (dbRole === "beta") return "beta" as UserRole;

    return (dbRole ?? "free") as UserRole;
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

  // ── Supabase Auth 監聽 ────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (u?.id) {
        const authUser: AuthUser = {
          uid: u.id,
          id: u.id,
          email: u.email ?? null,
          displayName: u.user_metadata?.full_name ?? u.email?.split("@")[0] ?? null,
          photoURL: u.user_metadata?.avatar_url ?? null,
        };
        setUser(authUser);
        void upsertProfile({
          uid: u.id,
          email: u.email ?? "",
          displayName: authUser.displayName,
          avatarUrl: authUser.photoURL,
        });
      }
      setLoading(false);
    };
    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user;
        if (u?.id) {
          const authUser: AuthUser = {
            uid: u.id,
            id: u.id,
            email: u.email ?? null,
            displayName: u.user_metadata?.full_name ?? u.email?.split("@")[0] ?? null,
            photoURL: u.user_metadata?.avatar_url ?? null,
          };
          setUser(authUser);
          setDbRole(null); // 重置，等待 fetch
          void upsertProfile({
            uid: u.id,
            email: u.email ?? "",
            displayName: authUser.displayName,
            avatarUrl: authUser.photoURL,
          });
        } else {
          setUser(null);
          setDbRole(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Beta CRUD ────────────────────────────────────────
  const addBetaUser = async (email: string) => {
    const normalized = email.toLowerCase().trim();
    if (!normalized) return;
    if (!user?.uid) throw new Error("尚未登入");
    const { addBetaUserFS } = await import("@/lib/betaListFS");
    await addBetaUserFS(normalized, user.uid);
  };

  const removeBetaUser = async (email: string) => {
    const normalized = email.toLowerCase().trim();
    const { removeBetaUserFS } = await import("@/lib/betaListFS");
    await removeBetaUserFS(normalized);
  };

  // ── 登入方法 ────────────────────────────────────────
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setDbRole(null);
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
