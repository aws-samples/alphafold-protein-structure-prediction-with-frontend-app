import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import replace from '@rollup/plugin-replace'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    replace({
      preventAssignment: true,
      include: 'node_modules/3dmol/build/3Dmol-nojquery.js',
      values: {
        'require = _3dmol_saved_require': ''
      }
    }),
    react()
  ],
  build: {
    chunkSizeWarningLimit: 5000
  }
})
