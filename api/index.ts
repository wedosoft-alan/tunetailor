import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://tunetailor.vercel.app', 'https://tunetailor-git-main-alans-projects-a5e8c4c4.vercel.app']
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());

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
  
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', process.env.SPOTIFY_CLIENT_ID!);
  authUrl.searchParams.append('scope', scope);
  authUrl.searchParams.append('redirect_uri', process.env.SPOTIFY_REDIRECT_URI!);
  authUrl.searchParams.append('state', state);

  // Store state for verification
  res.cookie('spotify_auth_state', state, { maxAge: 10 * 60 * 1000 }); // 10 minutes
  res.redirect(authUrl.toString());
});

app.get('/auth/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.headers.cookie?.split('; ').find(row => row.startsWith('spotify_auth_state='))?.split('=')[1];

  if (!code || !state || state !== storedState) {
    return res.redirect('/?error=auth_failed');
  }

  try {
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
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Token exchange failed');
    }

    const tokens = await tokenResponse.json();

    // Get user profile
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user profile');
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
  const sessionId = req.headers.cookie?.split('; ').find(row => row.startsWith('spotify_session='))?.split('=')[1];
  
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
  const sessionId = req.headers.cookie?.split('; ').find(row => row.startsWith('spotify_session='))?.split('=')[1];
  
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
  const sessionId = req.headers.cookie?.split('; ').find(row => row.startsWith('spotify_session='))?.split('=')[1];
  
  if (sessionId) {
    tokenStorage.delete(sessionId);
  }

  res.clearCookie('spotify_session');
  res.clearCookie('spotify_auth_state');
  res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;