import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertScheduleSchema,
  insertGeneratedPlaylistSchema,
  generatePlaylistSchema,
} from "@shared/schema";
import { spotifyService } from "./spotifyService";
import { aiService } from "./aiService";
import type { Track } from "./spotifyService";
import type { PlaylistPreferences } from "./aiService";
import crypto from "crypto";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";

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
  }
}

// Spotify OAuth configuration from environment variables - REQUIRED
if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error(
    "❌ CRITICAL: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables are required for security.",
  );
  console.error(
    "❌ Set these in your environment before starting the application.",
  );
  process.exit(1);
}

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const constructRedirectUri = (req: any) => {
  const protocol = req.protocol;
  const host = req.get("host");
  return `${protocol}://${host}/auth/spotify/callback`;
};

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

// In-memory token storage (in production, use database)
let userTokens: {
  [userId: string]: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    user_profile: any;
  };
} = {};

// Generate random state for security
function generateRandomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Refresh access token if expired (session-based)
async function refreshTokenIfNeeded(req: any): Promise<void> {
  const userId = req.session.userId;
  const sessionTokens = req.session.spotifyTokens;

  if (!userId || !sessionTokens) {
    throw new Error("No tokens found in session");
  }

  // Check if token expires within next 5 minutes
  if (sessionTokens.expires_at < Date.now() + 5 * 60 * 1000) {
    console.log(`🔄 Refreshing expired token for user ${userId}`);

    try {
      const refreshResponse = await fetch(SPOTIFY_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: sessionTokens.refresh_token,
        }),
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        throw new Error(`Token refresh failed: ${JSON.stringify(refreshData)}`);
      }

      // Update session tokens
      req.session.spotifyTokens = {
        ...sessionTokens,
        access_token: refreshData.access_token,
        expires_at: Date.now() + refreshData.expires_in * 1000,
        refresh_token: refreshData.refresh_token || sessionTokens.refresh_token, // Keep old refresh token if not provided
      };

      // Also update in-memory storage for compatibility
      if (userTokens[userId]) {
        userTokens[userId] = {
          ...userTokens[userId],
          access_token: refreshData.access_token,
          expires_at: Date.now() + refreshData.expires_in * 1000,
          refresh_token:
            refreshData.refresh_token || userTokens[userId].refresh_token,
        };
      }

      console.log("✅ Token refreshed successfully for user:", userId);
    } catch (error) {
      console.error("❌ Failed to refresh token:", error);
      throw new Error("Token refresh failed");
    }
  }
}

// Create Spotify client with user tokens (with auto-refresh, session-based)
async function createSpotifyClient(req: any) {
  // Refresh token if needed
  await refreshTokenIfNeeded(req);

  const sessionTokens = req.session.spotifyTokens;
  if (!sessionTokens || sessionTokens.expires_at < Date.now()) {
    throw new Error("No valid tokens in session");
  }

  return SpotifyApi.withAccessToken(SPOTIFY_CLIENT_ID, {
    access_token: sessionTokens.access_token,
    token_type: "Bearer",
    expires_in: Math.floor((sessionTokens.expires_at - Date.now()) / 1000),
    refresh_token: sessionTokens.refresh_token,
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ===============================
  // Spotify OAuth Routes
  // ===============================

  // Route 0: Diagnostic endpoint to show current configuration
  app.get("/api/oauth/config", (req, res) => {
    res.json({
      redirectUri: constructRedirectUri(req),
      clientId: SPOTIFY_CLIENT_ID,
      environment: process.env.NODE_ENV,
      callbackUrl: `${req.protocol}://${req.get("host")}/auth/spotify/callback`,
      currentHost: req.get("host"),
      timestamp: new Date().toISOString(),
    });
  });

  // Route 1: Initiate OAuth flow
  app.get("/auth/spotify", (req, res) => {
    const state = generateRandomString(16);
    const scope =
      "user-read-private user-read-email playlist-modify-public playlist-modify-private user-library-read user-top-read";

    // Store state in a signed cookie for CSRF protection
    res.cookie("spotify_auth_state", state, {
      httpOnly: true,
      signed: true,
      maxAge: 300000,
    }); // 5-minute expiry

    const authUrl =
      `${SPOTIFY_AUTH_URL}?` +
      new URLSearchParams({
        response_type: "code",
        client_id: SPOTIFY_CLIENT_ID,
        scope: scope,
        redirect_uri: constructRedirectUri(req),
        state: state,
      });

    console.log("🎵 Initiating Spotify OAuth with user app:", {
      redirectUri: constructRedirectUri(req),
      clientId: SPOTIFY_CLIENT_ID,
    });

    res.redirect(authUrl);
  });

  // Route 2: Handle OAuth callback
  app.get("/auth/spotify/callback", async (req, res) => {
    const { code, state, error } = req.query;
    const storedState = req.signedCookies.spotify_auth_state;

    // Enhanced logging for debugging
    console.log("🎵 OAuth Callback received with full details:", {
      code: code ? `${String(code).substring(0, 20)}...` : null,
      state,
      error,
      storedState,
      hasSession: !!req.session,
      sessionId: req.sessionID,
      allQueryParams: req.query,
      fullUrl: req.url,
      headers: {
        host: req.headers.host,
        userAgent: req.headers["user-agent"],
        referer: req.headers.referer,
      },
    });

    if (error) {
      console.error("❌ Spotify OAuth error received:", error);
      return res.redirect(
        "/?error=access_denied&spotify_error=" + encodeURIComponent(String(error)),
      );
    }

    if (!code) {
      console.error(
        "❌ No authorization code received from Spotify - this likely means the redirect URI in Spotify app settings doesn't match",
      );
      console.error("❌ Expected redirect URI:", constructRedirectUri(req));
      console.error("❌ Received URL:", req.url);
      return res.redirect(
        "/?error=no_code&expected_uri=" +
        encodeURIComponent(constructRedirectUri(req)),
      );
    }

    if (!state || state !== storedState) {
      console.error(
        "❌ State mismatch - potential CSRF attack or session issue:",
        { received: state, stored: storedState },
      );
      return res.redirect("/?error=state_mismatch");
    }

    try {
      console.log("🔄 Exchanging code for tokens with user app...");

      // Exchange authorization code for access token
      const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: constructRedirectUri(req),
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
      }

      const { access_token, refresh_token, expires_in } = tokenData;

      console.log("✅ Tokens received successfully with user app");

      // Get user profile to get user ID
      const userResponse = await fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const userData = await userResponse.json();

      if (!userResponse.ok) {
        throw new Error(
          `User profile fetch failed: ${JSON.stringify(userData)}`,
        );
      }

      const userId = userData.id;

      // Store user data securely in session instead of in-memory storage
      req.session.userId = userId;
      req.session.spotifyTokens = {
        access_token,
        refresh_token,
        expires_at: Date.now() + expires_in * 1000,
      };
      req.session.userProfile = userData;

      // Also keep in memory for compatibility during transition
      userTokens[userId] = {
        access_token,
        refresh_token,
        expires_at: Date.now() + expires_in * 1000,
        user_profile: userData,
      };

      console.log("✅ User authenticated with personal app:", {
        userId,
        displayName: userData.display_name,
        country: userData.country,
        sessionStored: !!req.session.userId,
      });

      // Clear state from session and cookie
      res.clearCookie("spotify_auth_state");

      // Redirect to frontend with success (no longer expose userId in URL)
      res.redirect("/?spotify_auth=success");
    } catch (error) {
      console.error("❌ OAuth callback error:", error);
      res.redirect("/?error=token_exchange_failed");
    }
  });

  // Route 3: Check authentication status (using sessions)
  app.get("/api/auth/spotify/status", (req, res) => {
    const sessionUserId = req.session.userId;
    const sessionTokens = req.session.spotifyTokens;
    const sessionProfile = req.session.userProfile;

    const isAuthenticated =
      sessionUserId && sessionTokens && sessionTokens.expires_at > Date.now();

    console.log("🔍 Auth status check (session-based):", {
      userId: sessionUserId,
      isAuthenticated,
      hasSessionTokens: !!sessionTokens,
    });

    res.json({
      authenticated: !!isAuthenticated,
      userId: isAuthenticated ? sessionUserId : undefined,
      user: isAuthenticated ? sessionProfile : undefined,
    });
  });

  // Route 4: Logout/disconnect (using sessions)
  app.post("/api/auth/spotify/logout", (req, res) => {
    const userId = req.session.userId;

    if (userId) {
      // Clean up in-memory tokens if they exist
      if (userTokens[userId]) {
        delete userTokens[userId];
      }

      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error("❌ Error destroying session:", err);
          return res.status(500).json({ error: "Logout failed" });
        }

        console.log("🚪 User logged out:", userId);
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  });

  // Route 5: Create playlist with user's Spotify (using sessions)
  app.post("/api/create-playlist", async (req, res) => {
    try {
      const { playlistName, description, tracks } = req.body;
      const userId = req.session.userId;

      if (!userId || !req.session.spotifyTokens) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const spotify = await createSpotifyClient(req);

      // Create playlist
      const playlist = await spotify.playlists.createPlaylist(userId, {
        name: playlistName,
        description: description,
        public: false,
      });

      console.log("✅ Playlist created:", {
        playlistId: playlist.id,
        name: playlist.name,
      });

      // Add tracks if provided
      if (tracks && tracks.length > 0) {
        const trackUris = tracks
          .filter((t: any) => t.spotifyId)
          .map((t: any) => `spotify:track:${t.spotifyId}`);
        if (trackUris.length > 0) {
          await spotify.playlists.addItemsToPlaylist(playlist.id, trackUris);
          console.log("✅ Tracks added to playlist:", trackUris.length);
        }
      }

      res.json({
        success: true,
        playlist: {
          id: playlist.id,
          name: playlist.name,
          url: playlist.external_urls.spotify,
        },
      });
    } catch (error) {
      console.error("❌ Create playlist error:", error);
      res.status(500).json({ error: "Failed to create playlist" });
    }
  });

  // Route 6: Search Spotify tracks with the authenticated session
  app.get("/api/spotify/search", async (req, res) => {
    try {
      const query = req.query.q;
      const limitParam = req.query.limit;

      if (!req.session.userId || !req.session.spotifyTokens) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!query || typeof query !== "string" || query.trim().length === 0) {
        return res.status(400).json({ error: "검색어가 필요합니다." });
      }

      const limit = Math.min(
        50,
        Math.max(1, limitParam ? parseInt(String(limitParam), 10) || 20 : 20),
      );

      const tracks = await spotifyService.searchTracks(query, limit, req);
      res.json({ tracks });
    } catch (error) {
      console.error("Error searching Spotify tracks:", error);
      res.status(500).json({ error: "Failed to search tracks" });
    }
  });

  // ===============================
  // Application Routes
  // ===============================

  // Schedule management routes (using sessions)
  app.get("/api/schedules", async (req, res) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const schedules = await storage.getSchedulesByUserId(userId);
      res.json(schedules);
    } catch (error) {
      console.error("Error getting schedules:", error);
      res.status(500).json({ error: "Failed to get schedules" });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const scheduleData = insertScheduleSchema.parse({ ...req.body, userId });
      const schedule = await storage.createSchedule(scheduleData);
      res.json(schedule);
    } catch (error) {
      console.error("Error creating schedule:", error);
      res.status(400).json({ error: "Invalid schedule data" });
    }
  });

  app.put("/api/schedules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const schedule = await storage.updateSchedule(id, updates);

      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      res.json(schedule);
    } catch (error) {
      console.error("Error updating schedule:", error);
      res.status(500).json({ error: "Failed to update schedule" });
    }
  });

  app.delete("/api/schedules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteSchedule(id);

      if (!success) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting schedule:", error);
      res.status(500).json({ error: "Failed to delete schedule" });
    }
  });

  // Playlist generation routes (using OAuth-authenticated Spotify with sessions)
  app.post("/api/generate-playlist", async (req, res) => {
    try {
      const parsedRequest = generatePlaylistSchema.safeParse(req.body);
      if (!parsedRequest.success) {
        return res.status(400).json({
          success: false,
          error:
            parsedRequest.error.flatten().formErrors.join(" ") ||
            "Invalid request",
        });
      }

      const { preferences, trackCount } = parsedRequest.data;
      const userId = req.session.userId;
      const sessionTokens = req.session.spotifyTokens;

      console.log(
        `🎵 Generating playlist for authenticated user ${userId} with preferences: "${preferences}" (limit: ${trackCount})`,
      );

      if (!userId || !sessionTokens) {
        return res.status(401).json({
          success: false,
          error: "User not authenticated with Spotify. Please reconnect.",
        });
      }

      let analyzedPrefs: PlaylistPreferences;
      try {
        analyzedPrefs = await aiService.analyzePreferences(preferences);
      } catch (aiError) {
        console.log("AI service failed, using fallback analysis:", aiError);
        analyzedPrefs = aiService.fallbackAnalysis(preferences);
      }

      // Create Spotify client
      let spotify: SpotifyApi;
      try {
        spotify = await createSpotifyClient(req);
      } catch (clientError) {
        console.error("Failed to create Spotify client:", clientError);
        return res.status(502).json({
          success: false,
          error: "Spotify 인증 세션이 만료되었습니다. 다시 연결해주세요.",
        });
      }

      const { seedGenres: normalizedGenres, unmatched } =
        await spotifyService.normalizeGenres(analyzedPrefs.genres, { spotify });

      const keywordPool = [...unmatched, ...analyzedPrefs.keywords];

      let tracks: Track[] = [];

      try {
        const recommendationResponse = await spotify.recommendations.get({
          seed_genres: normalizedGenres.slice(0, 2),
          target_energy: analyzedPrefs.energy,
          target_valence: analyzedPrefs.valence,
          target_danceability: analyzedPrefs.danceability,
          limit: trackCount,
        });

        if (recommendationResponse.tracks.length > 0) {
          tracks = recommendationResponse.tracks.map((track: any) => ({
            id: track.id,
            spotifyId: track.id,
            name: track.name,
            artists: track.artists?.map((a: any) => a.name) || ["Unknown Artist"],
            album: track.album?.name || "Unknown Album",
            duration: track.duration_ms,
            previewUrl: track.preview_url,
            spotifyUrl: track.external_urls?.spotify,
            imageUrl: track.album?.images?.[0]?.url,
          }));
          console.log(`✅ Found ${tracks.length} tracks via recommendations`);
        }
      } catch (recError) {
        console.warn("Spotify recommendations failed:", recError);
      }

      if (tracks.length === 0) {
        const fallbackTerms = new Set<string>();
        if (normalizedGenres[0]) fallbackTerms.add(normalizedGenres[0]);
        if (analyzedPrefs.mood) fallbackTerms.add(analyzedPrefs.mood);
        keywordPool.slice(0, 3).forEach((term) => fallbackTerms.add(term));
        const fallbackQuery = Array.from(fallbackTerms)
          .filter(Boolean)
          .join(" ");

        try {
          const searchResponse = await spotify.search(
            fallbackQuery,
            ["track"],
            undefined,
            trackCount as any,
          );

          if (searchResponse.tracks.items.length > 0) {
            tracks = searchResponse.tracks.items.map((track: any) => ({
              id: track.id,
              spotifyId: track.id,
              name: track.name,
              artists: track.artists?.map((a: any) => a.name) || ["Unknown Artist"],
              album: track.album?.name || "Unknown Album",
              duration: track.duration_ms,
              previewUrl: track.preview_url,
              spotifyUrl: track.external_urls?.spotify,
              imageUrl: track.album?.images?.[0]?.url,
            }));
            console.log(`✅ Found ${tracks.length} tracks via search`);
          }
        } catch (searchError) {
          console.error("Spotify search failed:", searchError);
          return res.status(502).json({
            success: false,
            error: "Spotify 검색 요청이 실패했습니다. 입력을 변경한 뒤 다시 시도해주세요.",
          });
        }
      }

      if (tracks.length === 0) {
        return res.status(404).json({
          success: false,
          error: "조건에 맞는 곡을 찾지 못했습니다. 다른 키워드를 시도해보세요.",
        });
      }

      let playlistName: string;
      let playlistDescription: string;
      try {
        playlistName = await aiService.generatePlaylistName(analyzedPrefs);
        playlistDescription = await aiService.generatePlaylistDescription(
          analyzedPrefs,
          tracks.length,
        );
      } catch (aiError) {
        console.log("AI playlist naming failed, using fallback:", aiError);
        playlistName = `${analyzedPrefs.mood.charAt(0).toUpperCase() + analyzedPrefs.mood.slice(1)} Mix`;
        playlistDescription = `${tracks.length} ${analyzedPrefs.mood} tracks perfect for your day`;
      }

      let spotifyPlaylistId = null;
      try {
        await storage.createGeneratedPlaylist({
          userId,
          scheduleId: null,
          spotifyPlaylistId,
          name: playlistName,
          description: playlistDescription,
          trackCount: tracks.length,
        });
      } catch (storageError) {
        console.error("Failed to save to storage:", storageError);
      }

      res.json({
        success: true,
        playlist: {
          id: spotifyPlaylistId || `generated-${Date.now()}`,
          name: playlistName,
          description: playlistDescription,
          tracks,
          totalDuration: tracks.reduce((sum, track) => sum + track.duration, 0),
          createdAt: new Date(),
          spotifyId: spotifyPlaylistId,
          trackCountRequested: trackCount,
        },
      });
    } catch (error) {
      console.error("Error generating playlist:", error);
      res.status(500).json({ error: "Failed to generate playlist" });
    }
  });

  // Scheduled playlist generation (for background tasks)
  app.post("/api/generate-scheduled-playlist", async (req, res) => {
    try {
      const activeSchedules = await storage.getActiveSchedules();
      const results = [];

      for (const schedule of activeSchedules) {
        try {
          // Check if it's time to run this schedule
          if (shouldRunSchedule(schedule)) {
            console.log(
              `Running scheduled playlist generation for schedule ${schedule.id}`,
            );

            // Analyze preferences with AI (with fallback)
            let analyzedPrefs;
            try {
              analyzedPrefs = await aiService.analyzePreferences(
                schedule.preferences,
              );
            } catch (aiError) {
              console.log(
                "AI service failed for scheduled generation, using fallback analysis:",
                aiError,
              );
              analyzedPrefs = aiService.fallbackAnalysis(schedule.preferences);
            }

            const { seedGenres: scheduleSeeds, unmatched: scheduleUnmatched } =
              await spotifyService.normalizeGenres(analyzedPrefs.genres, { req });

            // Get music recommendations
            let tracks: Track[] = [];

            try {
              tracks = await spotifyService.getRecommendations({
                seedGenres: scheduleSeeds.slice(0, 2),
                targetEnergy: analyzedPrefs.energy,
                targetValence: analyzedPrefs.valence,
                targetDanceability: analyzedPrefs.danceability,
                limit: 20,
              }, req);
            } catch (recError) {
              console.log(
                "Recommendations failed for scheduled generation, trying search:",
                recError,
              );

              try {
                const fallbackTerms = new Set<string>();
                if (scheduleSeeds[0]) fallbackTerms.add(scheduleSeeds[0]);
                if (analyzedPrefs.mood) fallbackTerms.add(analyzedPrefs.mood);
                [...scheduleUnmatched, ...analyzedPrefs.keywords]
                  .slice(0, 3)
                  .forEach((term) => fallbackTerms.add(term));
                const searchQuery = Array.from(fallbackTerms)
                  .filter(Boolean)
                  .join(" ");
                tracks = await spotifyService.searchTracks(searchQuery, 20, req);
              } catch (searchError) {
                console.log(
                  "Spotify search also failed for scheduled generation:",
                  searchError,
                );
              }
            }

            if (tracks.length === 0) {
              console.log(
                "No tracks found for scheduled generation; skipping playlist creation",
              );
              results.push({
                scheduleId: schedule.id,
                success: false,
                error: "No tracks returned from Spotify",
              });
              continue;
            }

            // Generate playlist name and description (with fallback)
            let playlistName, playlistDescription;
            try {
              playlistName =
                await aiService.generatePlaylistName(analyzedPrefs);
              playlistDescription = await aiService.generatePlaylistDescription(
                analyzedPrefs,
                tracks.length,
              );
            } catch (aiError) {
              console.log(
                "AI playlist naming failed for scheduled generation, using fallback:",
                aiError,
              );
              playlistName = `${analyzedPrefs.mood.charAt(0).toUpperCase() + analyzedPrefs.mood.slice(1)} Mix`;
              playlistDescription = `${tracks.length} ${analyzedPrefs.mood} tracks perfect for your day`;
            }

            // Create playlist on Spotify
            let spotifyPlaylistId = null;
            try {
              spotifyPlaylistId = await spotifyService.createPlaylist({
                name: playlistName,
                description: playlistDescription,
                tracks,
              }, req);
            } catch (spotifyError) {
              console.error(
                "Failed to create Spotify playlist for scheduled generation:",
                spotifyError,
              );
              // Continue without creating on Spotify
            }

            // Save to storage
            try {
              await storage.createGeneratedPlaylist({
                userId: schedule.userId,
                scheduleId: schedule.id,
                spotifyPlaylistId,
                name: playlistName,
                description: playlistDescription,
                trackCount: tracks.length,
              });
            } catch (storageError) {
              console.error(
                "Failed to save scheduled playlist to storage:",
                storageError,
              );
              // Continue - still mark as successful generation
            }

            // Update last run time
            await storage.updateScheduleLastRun(schedule.id);

            results.push({
              scheduleId: schedule.id,
              success: true,
              playlistName,
              trackCount: tracks.length,
            });
          }
        } catch (scheduleError) {
          console.error(
            `Error running schedule ${schedule.id}:`,
            scheduleError,
          );
          results.push({
            scheduleId: schedule.id,
            success: false,
            error:
              scheduleError instanceof Error
                ? scheduleError.message
                : String(scheduleError),
          });
        }
      }

      res.json({
        success: true,
        results,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error in scheduled generation:", error);
      res.status(500).json({ error: "Failed to run scheduled generation" });
    }
  });

  // Get user's generated playlists
  app.get("/api/playlists/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const playlists = await storage.getGeneratedPlaylistsByUserId(userId);
      res.json(playlists);
    } catch (error) {
      console.error("Error getting playlists:", error);
      res.status(500).json({ error: "Failed to get playlists" });
    }
  });

  // Test Spotify connection
  app.get("/api/spotify/test", async (req, res) => {
    try {
      const genres = await spotifyService.getAvailableGenres(req);
      res.json({
        connected: true,
        availableGenres: genres.slice(0, 10), // Return first 10 genres as test
      });
    } catch (error) {
      console.error("Spotify connection test failed:", error);
      res.status(500).json({
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to test Spotify connection",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to determine if a schedule should run
function shouldRunSchedule(schedule: any): boolean {
  const now = new Date();
  const [hour, minute] = schedule.time.split(":").map(Number);

  // Check if we're at the right time (within 5 minutes)
  const scheduledTime = new Date();
  scheduledTime.setHours(hour, minute, 0, 0);

  const timeDiff = Math.abs(now.getTime() - scheduledTime.getTime());
  const fiveMinutes = 5 * 60 * 1000;

  if (timeDiff > fiveMinutes) {
    return false;
  }

  // Check if we've already run today/this period
  if (schedule.lastRun) {
    const lastRun = new Date(schedule.lastRun);
    const now = new Date();

    if (schedule.frequency === "daily") {
      // Don't run if already ran today
      return lastRun.toDateString() !== now.toDateString();
    } else if (schedule.frequency === "weekly") {
      // Don't run if already ran this week and it's the right day
      const daysSinceLastRun = Math.floor(
        (now.getTime() - lastRun.getTime()) / (24 * 60 * 60 * 1000),
      );
      return daysSinceLastRun >= 7 && now.getDay() === schedule.dayOfWeek;
    } else if (schedule.frequency === "monthly") {
      // Don't run if already ran this month and it's the right day
      return (
        lastRun.getMonth() !== now.getMonth() &&
        now.getDate() === schedule.dayOfMonth
      );
    }
  }

  // Additional day checks for weekly/monthly
  if (schedule.frequency === "weekly" && now.getDay() !== schedule.dayOfWeek) {
    return false;
  }

  if (
    schedule.frequency === "monthly" &&
    now.getDate() !== schedule.dayOfMonth
  ) {
    return false;
  }

  return true;
}
