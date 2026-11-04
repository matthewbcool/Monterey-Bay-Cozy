import { defineConfig } from 'vite';
export default defineConfig({base:'./',server:{host:'127.0.0.1',port:5191,strictPort:true},build:{rollupOptions:{output:{manualChunks:{three:['three','three/webgpu','three/tsl']}}}}});
