import type { Session, User } from "@supabase/supabase-js";
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import supabase from '../lib/supabaseClient';

// Define the shape of our authentication context. It exposes the current
// session and user as well as helpers to sign in, sign up and sign out.
interface AuthContextType {
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<{ data: { session: Session | null; user: User | null } | null; error: any | null }>;
  signUp: (email: string, password: string, data?: Record<string, any>) => Promise<{ data: { user: User | null; session: Session | null } | null; error: any | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider wraps your application in a context that manages the
 * Supabase authentication state. It listens for changes to the session
 * and exposes convenient helpers for common auth actions.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Immediately invoke a function to fetch the existing session when
    // the provider first mounts. Without this the session would be
    // undefined until the auth state change subscription fires.
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
    })();
    // Subscribe to future session changes. When a user logs in or out
    // the onAuthStateChange handler will run and update local state.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });
    return () => {
      listener.subscription?.unsubscribe();
    };
  }, []);

  // Helper to sign in a user with an email/password combination. See
  // https://supabase.com/docs/reference/javascript/auth-signinwithpassword for more.
  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  // Helper to sign up a user. Additional profile data can be passed via the
  // optional data parameter and will be persisted to the auth.users table.
  const signUp = async (email: string, password: string, data: Record<string, any> = {}) => {
    return await supabase.auth.signUp({ email, password, options: { data } });
  };

  // Helper to sign out the current user. This will remove the session cookie.
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value: AuthContextType = {
    session,
    user,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth is a convenience hook that gives functional components access
 * to the authentication context. It throws an error when used outside
 * of an <AuthProvider> to make misuse obvious during development.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}