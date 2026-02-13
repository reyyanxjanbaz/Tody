import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from 'react';
import { AuthState, User } from '../types';
import { saveUser, getUser, removeUser, clearAll } from '../utils/storage';
import { generateId } from '../utils/id';

// ── Actions ──────────────────────────────────────────────────────────────────

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'LOGOUT' };

// ── Context shape ────────────────────────────────────────────────────────────

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Reducer ──────────────────────────────────────────────────────────────────

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, error: null };
    case 'SET_USER':
      return { user: action.payload, isLoading: false, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'LOGOUT':
      return { user: null, isLoading: false, error: null };
    default:
      return state;
  }
}

const INITIAL: AuthState = { user: null, isLoading: true, error: null };

// ── Validation ───────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateFields(
  email: string,
  password: string,
): string | null {
  if (!email.trim() || !password.trim()) {
    return 'Email and password are required';
  }
  if (!isValidEmail(email)) {
    return 'Please enter a valid email';
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  return null;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, INITIAL);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const user = await getUser<User>();
        if (user) {
          dispatch({ type: 'SET_USER', payload: user });
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    const error = validateFields(email, password);
    if (error) {
      dispatch({ type: 'SET_ERROR', payload: error });
      return;
    }

    // Simulate network call
    await new Promise<void>(r => setTimeout(r, 400));

    const user: User = {
      id: generateId(),
      email: email.toLowerCase().trim(),
      token: generateId(),
    };

    await saveUser(user);
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    const error = validateFields(email, password);
    if (error) {
      dispatch({ type: 'SET_ERROR', payload: error });
      return;
    }

    // Simulate network call
    await new Promise<void>(r => setTimeout(r, 600));

    const user: User = {
      id: generateId(),
      email: email.toLowerCase().trim(),
      token: generateId(),
    };

    await saveUser(user);
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const logout = useCallback(async () => {
    await clearAll();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const clearErrorFn = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, clearError: clearErrorFn }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) { throw new Error('useAuth must be used within AuthProvider'); }
  return ctx;
}
