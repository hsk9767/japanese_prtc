import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "icon-maskable-512.png"],
      manifest: {
        name: "일본어 ↔ 한국어 학습",
        short_name: "JP↔KO",
        description: "폰 GPU로 동작하는 일본어-한국어 번역/학습 도우미",
        theme_color: "#282a5e",
        background_color: "#282a5e",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell only. ML model weights are fetched from the HF CDN at
        // runtime and cached by transformers.js itself via the Cache API,
        // so they must NOT be pulled into the precache manifest here.
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
