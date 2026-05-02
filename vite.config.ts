import { defineConfig } from 'vite';

// DESIGN-DECISION: base: './' / 理由: ローカル直接開き・GitHub Pages・サーバー配信のいずれにも対応
//   (設計の心得 2章 + 12章 過去の失敗対策)
// NOTE: 王都への道(凍結)とポート分離 — Auto-Strategos は 5181
export default defineConfig({
  base: './',
  server: { port: 5181 },
  build: { outDir: 'dist', sourcemap: true },
});
