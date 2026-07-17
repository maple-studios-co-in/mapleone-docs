/** @type {import('next').NextConfig} */
export default {
  output: "export",              // fully static — deploys to any host, Vercel included
  trailingSlash: true,           // /slug/ -> /slug/index.html, robust on static hosts
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};
