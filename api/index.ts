import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple health check first
app.get("/api/health", (_req: Request, res: Response) => {
    console.log("Health check endpoint called");
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        env: {
            NODE_ENV: process.env.NODE_ENV,
            hasSpotifyId: !!process.env.SPOTIFY_CLIENT_ID,
            hasSpotifySecret: !!process.env.SPOTIFY_CLIENT_SECRET,
            hasOpenAI: !!process.env.OPENAI_API_KEY,
            hasSession: !!process.env.SESSION_SECRET
        }
    });
});

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

// Basic auth routes for minimal functionality
app.get("/auth/login", (_req: Request, res: Response) => {
    if (!process.env.SPOTIFY_CLIENT_ID) {
        return res.status(500).json({ error: "Spotify client ID not configured" });
    }

    const spotifyAuthUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.SPOTIFY_CLIENT_ID}&scope=user-read-private user-read-email playlist-modify-public playlist-modify-private user-top-read&redirect_uri=${encodeURIComponent(process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:5001/auth/callback')}`;
    res.redirect(spotifyAuthUrl);
});

app.get("/auth/callback", (_req: Request, res: Response) => {
    res.json({ message: "Auth callback - implementation needed" });
});

app.get("/api/auth/status", (_req: Request, res: Response) => {
    res.json({ authenticated: false, message: "Auth system simplified for deployment" });
});

// Fallback routes for undefined endpoints
app.get("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({
        error: "API endpoint not implemented",
        message: "This API endpoint is not available in simplified version",
        timestamp: new Date().toISOString()
    });
});

app.get("/auth/*", (_req: Request, res: Response) => {
    res.status(404).json({
        error: "Auth endpoint not implemented",
        message: "This auth endpoint is not available in simplified version",
        timestamp: new Date().toISOString()
    });
});

// Export for Vercel serverless functions
export default app;