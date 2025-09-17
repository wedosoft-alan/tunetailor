import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import cookieParser from "cookie-parser";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  cookieParser(
    process.env.SESSION_SECRET || "your-session-secret-change-in-production",
  ),
);

// Vercel rewrite 보정: /api/index.ts?path=/api/xxx 형태로 들어온 요청의 원래 경로를 복원
app.use((req, _res, next) => {
  const q = req.query as any;
  const originalPath = q?.path as string | undefined;
  if (originalPath && typeof originalPath === "string") {
    try {
      // 현재 URL의 쿼리스트링에서 path 파라미터 제거한 나머지를 보존
      const urlObj = new URL(req.protocol + "://" + req.get("host") + req.originalUrl);
      urlObj.searchParams.delete("path");
      const remainingQuery = urlObj.searchParams.toString();
      const rebuilt = originalPath + (remainingQuery ? `?${remainingQuery}` : "");
      // @ts-ignore - mutate for downstream routing only
      req.url = rebuilt;
      // @ts-ignore
      req.path = originalPath;
    } catch {
      // no-op
    }
  }
  next();
});

// Configure session middleware with secure settings
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "your-session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax", // CSRF protection
    },
  }),
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.

  if (!process.env.VERCEL) {
    // In local development, start the server
    const port = parseInt(process.env.PORT || "5001", 10);
    server.listen(
      {
        port,
        host: "0.0.0.0",
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  }
})();

// Export the app for Vercel
export default app;
