import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // 相对路径 base:静态产物可托管在任意子路径(GitHub Pages 的
  // /geometry-for-agents/、Netlify、Cloudflare Pages 均直接可用),
  // 本地 dev 行为不变;分享链接走 URL hash,不受 base 影响。
  base: "./",
});
