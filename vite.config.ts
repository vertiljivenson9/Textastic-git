import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Monaco Editor worker configuration
  // Esto permite que Monaco cargue sus workers correctamente en Vite
  optimizeDeps: {
    include: ['@monaco-editor/react'],
  },
  build: {
    // Asegurar que los workers de Monaco se manejen correctamente
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
