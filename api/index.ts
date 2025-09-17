// Vercel에서는 항상 TypeScript 소스를 직접 사용
const appModule = await import("../server/index.ts");

const app = appModule.default ?? appModule;

export default app;
