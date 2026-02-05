import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Fallbacks: if Lovable's runtime/build env injection ever fails, we still
  // inline these public values so the app won't crash with
  // "Uncaught Error: supabaseUrl is required".
  // NOTE: These are public (URL + anon/publishable key) and safe to embed.
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL ?? "https://sfbaltsobmulweapgkco.supabase.co"
    ),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmYmFsdHNvYm11bHdlYXBna2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTk0OTcsImV4cCI6MjA4NDc3NTQ5N30.FYguuS5xw-I4jW68O4LM2hfq9OS103-SxLAgRQ5uexo"
    ),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
