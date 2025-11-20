/** @type {import('next').NextConfig} */
const nextConfig = {
  // keep any existing config here (reactStrictMode, experimental, etc.)

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
    // or, if you prefer the simpler syntax:
    // domains: ["lh3.googleusercontent.com"],
  },
};

export default nextConfig;
