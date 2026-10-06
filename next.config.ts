import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ~14 KB of CSS: inline it into the HTML → no render-blocking stylesheet requests (FCP/LCP on mobile)
    inlineCss: true,
  },
};

export default nextConfig;
