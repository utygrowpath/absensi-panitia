import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // VS Code port forwarding reports the tunnel host as x-forwarded-host while
    // the browser sends localhost as the action origin, and Next's CSRF check
    // rejects the mismatch. Listing the origin lets the action through. The dev
    // port shifts when 3000 is taken, so allow the usual range.
    serverActions: {
      allowedOrigins: ["localhost:3000", "localhost:3001", "localhost:3002"],
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  redirects: async () => [
    {
      source: "/",
      destination: "/admin",
      permanent: false,
    },
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
