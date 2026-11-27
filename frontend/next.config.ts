import type { NextConfig } from 'next';

// Dirección del backend. Configurable por entorno; en local es el puerto 3000.
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  // El navegador solo habla con Next (puerto 3001). Next reenvía /api/* al backend, así que
  // no hay CORS y, más adelante, la cookie de sesión será del mismo origen.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backendUrl}/:path*` }];
  },
};

export default nextConfig;
