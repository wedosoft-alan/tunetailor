import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";

// Extend Express session to include our user data
declare module "express-session" {
    interface SessionData {
        userId?: string;
        spotifyTokens?: {
            access_token: string;
            refresh_token: string;
            expires_at: number;
        };
        userProfile?: any;
        state?: string;
    }
}

// Spotify OAuth configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI ||
    (process.env.NODE_ENV === 'production'
        ? 'https://tunetailor-nine.vercel.app/api/auth/spotify/callback'
        : 'http://localhost:5001/api/auth/spotify/callback');

const SPOTIFY_SCOPES = [
    'user-read-private',
    'user-read-email',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-top-read',
    'user-read-recently-played'
].join(' ');

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

// Helper function to generate random state
function generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper function to exchange authorization code for tokens
async function exchangeCodeForTokens(code: string): Promise<any> {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: SPOTIFY_REDIRECT_URI!
        })
    });

    if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return await response.json();
}

// Helper function to get user profile
async function getUserProfile(accessToken: string): Promise<any> {
    const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Profile fetch failed: ${response.statusText}`);
    }

    return await response.json();
}

// Standard Spotify OAuth endpoints
app.get("/api/auth/spotify/login", (req: Request, res: Response) => {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        return res.status(500).json({
            error: "Spotify credentials not configured",
            message: "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set"
        });
    }

    const state = generateState();
    req.session.state = state;

    const spotifyAuthUrl = new URL('https://accounts.spotify.com/authorize');
    spotifyAuthUrl.searchParams.append('response_type', 'code');
    spotifyAuthUrl.searchParams.append('client_id', SPOTIFY_CLIENT_ID);
    spotifyAuthUrl.searchParams.append('scope', SPOTIFY_SCOPES);
    spotifyAuthUrl.searchParams.append('redirect_uri', SPOTIFY_REDIRECT_URI!);
    spotifyAuthUrl.searchParams.append('state', state);

    res.redirect(spotifyAuthUrl.toString());
});

app.get("/api/auth/spotify/callback", async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.status(400).json({
            error: "Authorization failed",
            message: error
        });
    }

    if (!code || !state) {
        return res.status(400).json({
            error: "Missing parameters",
            message: "Authorization code or state missing"
        });
    }

    if (state !== req.session.state) {
        return res.status(400).json({
            error: "Invalid state",
            message: "State parameter mismatch"
        });
    }

    try {
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code as string);

        // Get user profile
        const userProfile = await getUserProfile(tokens.access_token);

        // Store in session
        req.session.spotifyTokens = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (tokens.expires_in * 1000)
        };
        req.session.userProfile = userProfile;
        req.session.userId = userProfile.id;

        // Clear state
        delete req.session.state;

        // Redirect to frontend with success
        const frontendUrl = process.env.NODE_ENV === 'production'
            ? 'https://tunetailor-nine.vercel.app'
            : 'http://localhost:5173';

        res.redirect(`${frontendUrl}?auth=success`);
    } catch (error) {
        console.error('Spotify callback error:', error);
        res.status(500).json({
            error: "Authentication failed",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

app.get("/api/auth/status", (req: Request, res: Response) => {
    const isAuthenticated = !!(req.session.spotifyTokens && req.session.userProfile);

    if (isAuthenticated) {
        res.json({
            authenticated: true,
            user: {
                id: req.session.userProfile.id,
                display_name: req.session.userProfile.display_name,
                email: req.session.userProfile.email,
                images: req.session.userProfile.images
            },
            tokenExpiry: req.session.spotifyTokens!.expires_at
        });
    } else {
        res.json({
            authenticated: false,
            message: "User not authenticated"
        });
    }
});

app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Logout failed" });
        }
        res.json({ message: "Logged out successfully" });
    });
});

// Helper function to refresh Spotify token if needed
async function refreshSpotifyToken(refreshToken: string): Promise<any> {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });

    if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    return await response.json();
}

// Helper function to make authenticated Spotify API calls
async function spotifyApiCall(req: Request, endpoint: string, options: RequestInit = {}): Promise<any> {
    const tokens = req.session.spotifyTokens;
    if (!tokens) {
        throw new Error('User not authenticated with Spotify');
    }

    // Check if token needs refresh
    if (tokens.expires_at < Date.now()) {
        try {
            const newTokens = await refreshSpotifyToken(tokens.refresh_token);
            req.session.spotifyTokens = {
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token || tokens.refresh_token,
                expires_at: Date.now() + (newTokens.expires_in * 1000)
            };
        } catch (error) {
            throw new Error('Failed to refresh Spotify token');
        }
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${req.session.spotifyTokens!.access_token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
}

// Playlist generation endpoint
app.post("/api/generate-playlist", async (req: Request, res: Response) => {
    try {
        const { preferences, tracks } = req.body;

        if (!req.session.spotifyTokens || !req.session.userProfile) {
            return res.status(401).json({
                error: "Not authenticated",
                message: "Please authenticate with Spotify first"
            });
        }

        if (!preferences?.name) {
            return res.status(400).json({
                error: "Missing playlist name",
                message: "Playlist name is required"
            });
        }

        // Create playlist
        const playlistData = {
            name: preferences.name,
            description: preferences.description || "Generated by TuneTailor",
            public: false
        };

        const playlist = await spotifyApiCall(
            req,
            `/users/${req.session.userProfile.id}/playlists`,
            {
                method: 'POST',
                body: JSON.stringify(playlistData)
            }
        );

        // Add tracks to playlist if provided
        if (tracks && tracks.length > 0) {
            const trackUris = tracks.map((track: any) => track.uri || `spotify:track:${track.id}`);

            await spotifyApiCall(
                req,
                `/playlists/${playlist.id}/tracks`,
                {
                    method: 'POST',
                    body: JSON.stringify({ uris: trackUris })
                }
            );
        }

        res.json({
            success: true,
            playlist: {
                id: playlist.id,
                name: playlist.name,
                description: playlist.description,
                external_urls: playlist.external_urls,
                tracks: {
                    total: tracks?.length || 0
                }
            }
        });

    } catch (error) {
        console.error('Playlist generation error:', error);
        res.status(500).json({
            error: "Playlist generation failed",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Search tracks endpoint
app.get("/api/search/tracks", async (req: Request, res: Response) => {
    try {
        const { q, limit = 20 } = req.query;

        if (!req.session.spotifyTokens) {
            return res.status(401).json({
                error: "Not authenticated",
                message: "Please authenticate with Spotify first"
            });
        }

        if (!q) {
            return res.status(400).json({
                error: "Missing query",
                message: "Search query is required"
            });
        }

        const searchResults = await spotifyApiCall(
            req,
            `/search?q=${encodeURIComponent(q as string)}&type=track&limit=${limit}`
        );

        res.json({
            tracks: searchResults.tracks.items.map((track: any) => ({
                id: track.id,
                name: track.name,
                artists: track.artists.map((artist: any) => artist.name),
                album: track.album.name,
                duration_ms: track.duration_ms,
                preview_url: track.preview_url,
                external_urls: track.external_urls,
                uri: track.uri
            }))
        });

    } catch (error) {
        console.error('Track search error:', error);
        res.status(500).json({
            error: "Track search failed",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get user's top tracks endpoint
app.get("/api/user/top-tracks", async (req: Request, res: Response) => {
    try {
        const { limit = 20, time_range = 'medium_term' } = req.query;

        if (!req.session.spotifyTokens) {
            return res.status(401).json({
                error: "Not authenticated",
                message: "Please authenticate with Spotify first"
            });
        }

        const topTracks = await spotifyApiCall(
            req,
            `/me/top/tracks?limit=${limit}&time_range=${time_range}`
        );

        res.json({
            tracks: topTracks.items.map((track: any) => ({
                id: track.id,
                name: track.name,
                artists: track.artists.map((artist: any) => artist.name),
                album: track.album.name,
                duration_ms: track.duration_ms,
                preview_url: track.preview_url,
                external_urls: track.external_urls,
                uri: track.uri
            }))
        });

    } catch (error) {
        console.error('Top tracks error:', error);
        res.status(500).json({
            error: "Failed to get top tracks",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
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