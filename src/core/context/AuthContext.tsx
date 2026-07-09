import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from 'react';
import { AuthState, User, DEFAULT_PREFERENCES } from '../types';
import { supabase } from '../lib/supabase';
import { clearAll, saveUserPreferences } from '../utils/storage';
import { resetSwipeMemoryCache } from '../utils/swipeMemory';
import { useTheme } from './ThemeContext';

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

/**
 * Map a Supabase auth user to the app's User type.
 */
function toAppUser(supabaseUser: { id: string; email?: string }): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
  };
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { resetTheme } = useTheme();
  const [state, dispatch] = useReducer(authReducer, INITIAL);

  // Restore session on mount & listen for auth state changes
  useEffect(() => {
    // 1. Check for an existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        dispatch({ type: 'SET_USER', payload: toAppUser(session.user) });
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }).catch(() => {
      // Network error while restoring session — drop into logged-out state
      dispatch({ type: 'SET_LOADING', payload: false });
    });

    // 2. Subscribe to future auth changes (token refresh, sign-out from another tab, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          dispatch({ type: 'SET_USER', payload: toAppUser(session.user) });
        } else {
          dispatch({ type: 'LOGOUT' });
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    const validationError = validateFields(email, password);
    if (validationError) {
      dispatch({ type: 'SET_ERROR', payload: validationError });
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        return;
      }
    } catch (e: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: 'Network error — please check your connection and try again',
      });
      return;
    }

    // The onAuthStateChange listener will dispatch SET_USER automatically.
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    const validationError = validateFields(email, password);
    if (validationError) {
      dispatch({ type: 'SET_ERROR', payload: validationError });
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        return;
      }

      // Supabase may require email confirmation. If the user object is returned
      // but has no session, it means email confirmation is pending.
      if (data.user && !data.session) {
        dispatch({
          type: 'SET_ERROR',
          payload: 'Check your email for a confirmation link',
        });
        return;
      }
    } catch (e: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: 'Network error — please check your connection and try again',
      });
      return;
    }

    // The onAuthStateChange listener will dispatch SET_USER automatically.
  }, []);

  const logout = useCallback(async () => {
    resetSwipeMemoryCache();               // clear in-memory swipe stats before wipe
    await supabase.auth.signOut();
    await clearAll();
    // Reset theme to light mode and seed defaults for next user
    resetTheme();
    await saveUserPreferences(DEFAULT_PREFERENCES);
    dispatch({ type: 'LOGOUT' });
  }, [resetTheme]);

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
