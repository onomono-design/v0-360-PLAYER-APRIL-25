/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Add async headers function to enable CORS
  async headers() {
    return [
      {
        // This applies to all routes
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            // Allow all origins - you can restrict this to specific domains if needed
            // e.g., value: "https://your-webflow-site.webflow.io"
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "X-Requested-With, Content-Type, Accept",
          },
          // Add Permissions-Policy header to allow device sensors
          {
            key: "Permissions-Policy",
            value: "accelerometer=*, gyroscope=*, magnetometer=*, camera=(), microphone=(), geolocation=*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
