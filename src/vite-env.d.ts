interface ImportMetaEnv { readonly [key: string]: string | boolean | undefined; readonly VITE_SUPABASE_URL?: string; readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string; }
interface ImportMeta { readonly env: ImportMetaEnv; readonly glob: (pattern: string, options?: Record<string, unknown>) => Record<string, unknown>; }
