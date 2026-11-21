import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Permite escribir JSX/TSX dentro de los tests y de los componentes.
  plugins: [react()],
  test: {
    // Simula un navegador: da `document`, `window`, etc. para renderizar componentes.
    environment: 'jsdom',
    // Se ejecuta antes de los tests: aquí cargamos las comprobaciones de jest-dom.
    setupFiles: ['./vitest.setup.ts'],
    // Con esto no hace falta importar describe/it/expect en cada test.
    globals: true,
    // Evita que Vitest intente ejecutar tests dentro de la salida de build de Next.
    exclude: ['node_modules', '.next'],
  },
});
