import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;
const IS_VERCEL = !!process.env.VERCEL;

// __dirname is not defined in ESM by default; compute it for local/edge runtimes
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests without an Origin header (e.g., server-to-server, curl)
        if (!origin) return callback(null, true);

        const devOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ];

        const isAllowed =
            devOrigins.includes(origin) ||
            /\.vercel\.app$/i.test(origin) ||
            origin === 'https://tunetailor-nine.vercel.app';

        callback(null, isAllowed);
    },
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// On Vercel, incoming paths are like /api/auth/... due to rewrites. Our routes are defined
// without the /api prefix. Normalize only those under /api/auth/* so health endpoints keep /api.
if (IS_VERCEL) {
    app.use((req, _res, next) => {
        if (req.url.startsWith('/api/auth/')) {
            req.url = req.url.replace(/^\/api/, '');
        }
        next();
    });
}

// Simple in-memory storage for tokens (in production, use a proper database)
const tokenStorage = new Map<string, {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    user: any;
}>();

// Helper function to generate session ID
function generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Spotify OAuth endpoints
app.get('/auth/spotify/login', (req, res) => {
    const state = generateSessionId();
    const scope = 'user-read-private user-read-email playlist-modify-public playlist-modify-private';

    // Build redirect URI dynamically to support preview/prod domains
    const proto = (process.env.NODE_ENV === 'production') ? 'https' : (req.protocol || 'http');
    const host = req.get('host');
    const dynamicRedirectUri = `${proto}://${host}/api/auth/spotify/callback`;

    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', process.env.SPOTIFY_CLIENT_ID!);
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('redirect_uri', process.env.SPOTIFY_REDIRECT_URI || dynamicRedirectUri);
    authUrl.searchParams.append('state', state);

    // Store state for verification
    res.cookie('spotify_auth_state', state, {
        maxAge: 10 * 60 * 1000, // 10 minutes
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    res.redirect(authUrl.toString());
});

app.get('/auth/spotify/callback', async (req, res) => {
    const { code, state } = req.query;
    const storedState = req.cookies?.spotify_auth_state;

    if (!code || !state || state !== storedState) {
        console.error('Auth callback failed:', { code: !!code, state: !!state, storedState: !!storedState });
        return res.redirect('/?error=auth_failed');
    }

    try {
        // Log environment variables (without revealing secrets)
        const proto = (process.env.NODE_ENV === 'production') ? 'https' : (req.protocol || 'http');
        const host = req.get('host');
        const dynamicRedirectUri = `${proto}://${host}/api/auth/spotify/callback`;

        console.log('Spotify OAuth Config:', {
            clientId: process.env.SPOTIFY_CLIENT_ID?.substring(0, 8) + '...',
            redirectUri: process.env.SPOTIFY_REDIRECT_URI || dynamicRedirectUri,
            hasSecret: !!process.env.SPOTIFY_CLIENT_SECRET
        });

        // Exchange code for tokens
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code as string,
                redirect_uri: process.env.SPOTIFY_REDIRECT_URI || dynamicRedirectUri
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Token exchange failed:', tokenResponse.status, errorText);
            throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }

        const tokens = await tokenResponse.json();

        // Get user profile
        const userResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            console.error('Failed to get user profile:', userResponse.status, errorText);
            throw new Error(`Failed to get user profile: ${userResponse.status}`);
        }

        const user = await userResponse.json();

        // Store tokens with user data
        const sessionId = generateSessionId();
        tokenStorage.set(sessionId, {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (tokens.expires_in * 1000),
            user
        });

        // Set session cookie
        res.cookie('spotify_session', sessionId, {
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        res.redirect('/?connected=true');

    } catch (error) {
        console.error('Spotify callback error:', error);
        res.redirect('/?error=auth_failed');
    }
});

// Auth status endpoint
app.get('/auth/status', (req, res) => {
    const sessionId = req.cookies?.spotify_session;

    if (!sessionId) {
        return res.json({ authenticated: false });
    }

    const session = tokenStorage.get(sessionId);
    if (!session) {
        return res.json({ authenticated: false });
    }

    // Check if token is expired
    if (Date.now() > session.expires_at) {
        tokenStorage.delete(sessionId);
        return res.json({ authenticated: false });
    }

    res.json({
        authenticated: true,
        user: session.user
    });
});

// Get access token endpoint
app.get('/auth/token', (req, res) => {
    const sessionId = req.cookies?.spotify_session;

    if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const session = tokenStorage.get(sessionId);
    if (!session) {
        return res.status(401).json({ error: 'Session not found' });
    }

    // Check if token is expired
    if (Date.now() > session.expires_at) {
        tokenStorage.delete(sessionId);
        return res.status(401).json({ error: 'Token expired' });
    }

    res.json({
        access_token: session.access_token
    });
});

// Logout endpoint
app.post('/auth/logout', (req, res) => {
    const sessionId = req.cookies?.spotify_session;

    if (sessionId) {
        tokenStorage.delete(sessionId);
    }

    res.clearCookie('spotify_session');
    res.clearCookie('spotify_auth_state');
    res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        hasSpotifyConfig: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_REDIRECT_URI)
    });
});

// Environment check endpoint for debugging
app.get('/api/env-check', (req, res) => {
    res.json({
        hasClientId: !!process.env.SPOTIFY_CLIENT_ID,
        hasClientSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
        hasRedirectUri: !!process.env.SPOTIFY_REDIRECT_URI,
        redirectUri: process.env.SPOTIFY_REDIRECT_URI,
        nodeEnv: process.env.NODE_ENV
    });
});

// Serve static files in production
// When running a single server locally we also serve the client build.
// Skip this block on Vercel serverless functions (frontend is served by Vercel static hosting).
if (process.env.NODE_ENV === 'production' && !IS_VERCEL) {
    const clientDist = path.join(__dirname, '../client/dist');
    if (fs.existsSync(clientDist)) {
        app.use(express.static(clientDist));

        // Only serve SPA for non-API routes
        app.get('*', (req, res) => {
            // Skip API routes
            if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
                return res.status(404).json({ error: 'Not found' });
            }
            res.sendFile(path.join(clientDist, 'index.html'));
        });
    }
}

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        headers: req.headers
    });
    res.status(500).json({ error: 'Internal server error', message: error.message });
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

export default app;