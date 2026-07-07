
import { createClient } from '@supabase/supabase-js';

// =================================================================
// 🔐 DATABASE KEYS
// =================================================================

// Ideally, these are in a .env file, but for quick setup, we can use them here.
// It is SAFE to use the ANON key in the client-side code.
const MANUAL_URL = "";
const MANUAL_KEY = "";

let supabaseUrl = MANUAL_URL;
let supabaseAnonKey = MANUAL_KEY;

// Allow dynamic live updates for ES Module bindings
export let isSupabaseConfigured = false;
let realSupabase: any = null;

// Helper to initialize Supabase dynamically (e.g. before mounting React)
export function initSupabase(url: string, key: string) {
  if (url && key) {
    supabaseUrl = url;
    supabaseAnonKey = key;
    isSupabaseConfigured = true;
    realSupabase = createClient(url, key);
    console.log("Supabase dynamically initialized from backend configuration.");
  }
}

try {
  // Safely attempt to read Vite environment variables if they exist
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    const envUrl = import.meta.env.VITE_SUPABASE_URL;
    // @ts-ignore
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Only override manual keys if env vars are actually set and not empty
    if (envUrl && envKey) {
      initSupabase(envUrl, envKey);
    }
  }
} catch (e) {
  console.warn("Environment variables check failed. Using manual keys.", e);
}

// =================================================================

// Export a Proxy that routes all calls to realSupabase if available
export const supabase = new Proxy({} as any, {
  get(target, prop, receiver) {
    if (realSupabase) {
      return Reflect.get(realSupabase, prop, receiver);
    }
    // Fallback if not initialized yet
    console.warn(`Supabase accessed before initialization (property: ${String(prop)})`);
    return {
      from: () => ({
        select: () => Promise.resolve({ data: null, error: new Error("Supabase not initialized") }),
        insert: () => Promise.resolve({ data: null, error: new Error("Supabase not initialized") }),
        update: () => Promise.resolve({ data: null, error: new Error("Supabase not initialized") }),
        delete: () => Promise.resolve({ data: null, error: new Error("Supabase not initialized") }),
        single: () => Promise.resolve({ data: null, error: new Error("Supabase not initialized") }),
        order: () => Promise.resolve({ data: null, error: new Error("Supabase not initialized") }),
      }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      }
    } as any;
  }
});

