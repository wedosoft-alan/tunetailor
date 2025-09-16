import { SpotifyApi } from "@spotify/web-api-ts-sdk";

// Helper function to refresh token if needed
async function refreshTokenIfNeeded(sessionTokens: any): Promise<any> {
  // Check if token expires within next 5 minutes
  if (sessionTokens.expires_at < Date.now() + 5 * 60 * 1000) {
    console.log('🔄 Refreshing expired token...');

    try {
      const refreshResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: sessionTokens.refresh_token,
        }),
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        throw new Error(`Token refresh failed: ${JSON.stringify(refreshData)}`);
      }

      // Update tokens
      const updatedTokens = {
        ...sessionTokens,
        access_token: refreshData.access_token,
        expires_at: Date.now() + refreshData.expires_in * 1000,
        refresh_token: refreshData.refresh_token || sessionTokens.refresh_token,
      };

      console.log('✅ Token refreshed successfully');
      return updatedTokens;
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      throw new Error('Token refresh failed');
    }
  }

  return sessionTokens;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableSpotifyClient(req?: any) {
  try {
    // Check if we have session tokens from OAuth flow
    if (req?.session?.spotifyTokens) {
      console.log('🎵 Using session-based Spotify tokens');

      let sessionTokens = req.session.spotifyTokens;

      // Refresh token if needed
      if (sessionTokens.expires_at < Date.now() + 5 * 60 * 1000) {
        sessionTokens = await refreshTokenIfNeeded(sessionTokens);
        // Update session with refreshed tokens
        req.session.spotifyTokens = sessionTokens;
      }

      console.log('🎵 Creating Spotify client with session tokens:', {
        hasAccessToken: !!sessionTokens.access_token,
        expiresAt: new Date(sessionTokens.expires_at).toISOString(),
        clientId: process.env.SPOTIFY_CLIENT_ID
      });

      const spotify = SpotifyApi.withAccessToken(process.env.SPOTIFY_CLIENT_ID!, {
        access_token: sessionTokens.access_token,
        token_type: "Bearer",
        expires_in: Math.floor((sessionTokens.expires_at - Date.now()) / 1000),
        refresh_token: sessionTokens.refresh_token,
      });

      // Test connection
      try {
        console.log('🔍 Testing Spotify API with user profile...');
        const profile = await spotify.currentUser.profile();
        console.log('✅ Spotify API connected successfully:', {
          userId: profile.id,
          displayName: profile.display_name
        });
      } catch (testError: any) {
        console.log('⚠️ Spotify API connection issue:', testError?.message || 'Unknown error');
      }

      return spotify;
    }

    // Fallback to client credentials for public data (no user context)
    console.log('🎵 No session tokens, using client credentials');

    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      throw new Error('Spotify client credentials not configured');
    }

    const spotify = SpotifyApi.withClientCredentials(
      process.env.SPOTIFY_CLIENT_ID,
      process.env.SPOTIFY_CLIENT_SECRET
    );

    console.log('✅ Spotify client created with client credentials');
    return spotify;

  } catch (error) {
    console.error('❌ Failed to create Spotify client:', error);
    throw error;
  }
}