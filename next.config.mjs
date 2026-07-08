/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 🔑 告訴 Next.js 15 不要把 firebase-admin 打包進 bundle，
  // 讓它在 runtime 走 Node.js require()。
  // 沒設這個會導致 firebase-admin 模組載入時 throw，500 連 try-catch 都接不到。
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;