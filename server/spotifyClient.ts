import { SpotifyApi } from "@spotify/web-api-ts-sdk";

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    // Return consistent object format even in cached path
    const refreshToken = connectionSettings?.settings?.oauth?.credentials?.refresh_token;
    const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
    const clientId = connectionSettings?.settings?.oauth?.credentials?.client_id;
    const expiresIn = connectionSettings.settings?.oauth?.credentials?.expires_in;
    return {accessToken, clientId, refreshToken, expiresIn};
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=spotify',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  console.log('🔗 Spotify connection fetch status:', response.status);
  const connectionData = await response.json();
  console.log('🔗 Connection response:', {
    hasItems: !!connectionData.items,
    itemsLength: connectionData.items?.length || 0,
    firstItemKeys: connectionData.items?.[0] ? Object.keys(connectionData.items[0]) : []
  });
  
  connectionSettings = connectionData.items?.[0];
   const refreshToken =
    connectionSettings?.settings?.oauth?.credentials?.refresh_token;
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
const clientId = connectionSettings?.settings?.oauth?.credentials?.client_id;
  const expiresIn = connectionSettings.settings?.oauth?.credentials?.expires_in;
  if (!connectionSettings || (!accessToken || !clientId || !refreshToken)) {
    throw new Error('Spotify not connected');
  }
  return {accessToken, clientId, refreshToken, expiresIn};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableSpotifyClient() {
  try {
    const {accessToken, clientId, refreshToken, expiresIn} = await getAccessToken();
    
    console.log('🎵 Creating Spotify client:', {
      hasAccessToken: !!accessToken,
      hasClientId: !!clientId,
      hasRefreshToken: !!refreshToken,
      expiresIn,
      clientIdValue: clientId
    });

    // Try different initialization approach for better OAuth handling
    const spotify = SpotifyApi.withAccessToken(clientId, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn || 3600,
      refresh_token: refreshToken,
    });
    
    // Test connection (non-blocking)
    try {
      console.log('🔍 Testing Spotify API with user profile...');
      const profile = await spotify.currentUser.profile();
      console.log('✅ Spotify API connected successfully:', { 
        userId: profile.id, 
        displayName: profile.display_name 
      });
      
      // Try genres as secondary test
      try {
        const genres = await spotify.recommendations.genreSeeds();
        console.log('✅ Genre seeds also working:', { count: genres.genres?.length || 0 });
      } catch (genreError: any) {
        console.log('⚠️ Genres not available but user profile works');
      }
      
    } catch (testError: any) {
      console.log('ℹ️ Spotify API connection issue:', testError?.message || 'Unknown error');
    }

    return spotify;
  } catch (error) {
    console.error('❌ Failed to create Spotify client:', error);
    throw error;
  }
}