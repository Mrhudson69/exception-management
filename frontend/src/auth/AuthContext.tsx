import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth, AuthUser, Role, SetupPayload, setUnauthorizedHandler, tokenStore } from "../api/client";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  needsSetup: boolean;
  login: (email: string, password: string) => Promise<void>;
  completeSetup: (payload: SetupPayload) => Promise<void>;
  logout: () => void;
  can: (min: Role) => boolean;
  /** True when the user is limited to specific applications (blocks config screens). */
  restricted: boolean;
}

const rank: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };
const AuthCtx = createContext<AuthState>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));

    async function bootstrap() {
      try {
        const { needsSetup } = await auth.setupStatus();
        setNeedsSetup(needsSetup);
        if (needsSetup) return; // skip token check; show setup wizard
        if (tokenStore.get()) {
          const me = await auth.me();
          setUser(me.user);
        }
      } catch {
        tokenStore.clear();
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await auth.login(email, password);
    tokenStore.set(token);
    setUser(user);
  }

  async function completeSetup(payload: SetupPayload) {
    const { token, user } = await auth.setup(payload);
    tokenStore.set(token);
    setUser(user);
    setNeedsSetup(false);
  }

  function logout() {
    tokenStore.clear();
    setUser(null);
  }

  const can = (min: Role) => (user ? rank[user.role] >= rank[min] : false);
  const restricted = !!user && user.role !== "admin" && user.all_applications === false;

  return (
    <AuthCtx.Provider value={{ user, loading, needsSetup, login, completeSetup, logout, can, restricted }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
