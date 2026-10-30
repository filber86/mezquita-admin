import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// El navegador solo habla con este mismo dominio, con Supabase (REST, Auth,
// Storage y Realtime) y con la API de pagos (transferencias del Zakat).
// Sin nonces para no forzar el renderizado dinámico.
const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://supabase.co").origin;
const paymentsApi = new URL(process.env.NEXT_PUBLIC_PAYMENTS_API ?? "https://zakat-rates-api.vercel.app/api").origin;

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabase}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabase.replace(/^https:/, "wss:")} ${paymentsApi}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
