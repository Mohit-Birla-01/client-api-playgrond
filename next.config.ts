import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d2ubaw0xakcqxx.cloudfront.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "zymccnzvwmolsgyjrjnt.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
