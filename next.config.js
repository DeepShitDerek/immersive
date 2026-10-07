/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  // Native addon used by the build-time link-preview cards (src/lib/og);
  // it has to be required at runtime, not bundled.
  serverExternalPackages: ["@resvg/resvg-js"],
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  basePath: "",
  assetPrefix: "",
};

module.exports = nextConfig;
