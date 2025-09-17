const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

const appModule = isProd
  ? await import("../dist/index.js")
  : await import("../server/index.ts");

const app = appModule.default ?? appModule;

export default app;
