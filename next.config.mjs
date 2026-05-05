/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.mux.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.r2.dev" },
    ],
  },
  experimental: {
    // Stable key so Server Action IDs survive across deploys. Without this,
    // Next regenerates the key per build and every existing browser tab gets
    // 'Failed to find Server Action "x"' the moment we deploy. Set
    // SERVER_ACTIONS_ENCRYPTION_KEY in .env.local to a 32-byte base64 value
    // (openssl rand -base64 32). It must be identical on every replica.
    serverActions: {
      encryptionKey: process.env.SERVER_ACTIONS_ENCRYPTION_KEY,
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
