let appModule: any;

if (process.env.VERCEL) {
  try {
    appModule = await import("../dist/index.js");
  } catch (error) {
    console.warn("Failed to load bundled server build, falling back to source:", error);
    appModule = await import("../server/index.ts");
  }
} else {
  appModule = await import("../server/index.ts");
}

const app = appModule.default ?? appModule;

export default app;
