import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/strudel-synth/',
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Force Vite to pre-bundle all @strudel/* packages together
    // so circular dependencies between sub-packages resolve correctly.
    include: ['@strudel/web'],
  },
  build: {
    commonjsOptions: {
      // Strudel sub-packages have circular references that break
      // default tree-shaking in production builds ("cannot access X
      // before initialization").  Treating them as external CJS
      // modules avoids the issue.
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // Keep all @strudel/* code in a single chunk so module-init
        // order is preserved and circular deps don't break.
        manualChunks(id) {
          if (id.includes('@strudel') || id.includes('superdough') || id.includes('webaudio')) {
            return 'strudel-vendor'
          }
        },
      },
    },
  },
})
