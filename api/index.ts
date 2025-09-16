import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
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

// Session configuration for Vercel
const sessionConfig = {
    secret: process.env.SESSION_SECRET || "your-session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "lax" as const,
    },
};

app.use(session(sessionConfig));

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`Error ${status}:`, message);
    res.status(status).json({ message });
});

// Register API routes
registerRoutes(app);

// Export for Vercel serverless functions
export default app;