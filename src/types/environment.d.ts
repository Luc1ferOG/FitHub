export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Expo replaces literal dot-access references at bundle time. Declare the
      // keys rather than switching to dynamic/bracket access to satisfy strict TS.
      readonly EXPO_PUBLIC_SUPABASE_URL?: string;
      readonly EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    }
  }
}
