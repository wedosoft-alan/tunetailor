import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScheduleSchema, insertGeneratedPlaylistSchema, generatePlaylistSchema } from "@shared/schema";
import { spotifyService } from "./spotifyService";
import { aiService } from "./aiService";
import type { Track } from "./spotifyService";
import type { PlaylistPreferences } from "./aiService";

// Helper function to generate mock tracks when real APIs fail
function generateMockTracks(preferences: PlaylistPreferences): Track[] {
  const mockTracksByGenre: Record<string, Track[]> = {
    'pop': [
      {
        id: 'mock-pop-1',
        name: 'Sunny Days',
        artists: ['The Sunshine Band'],
        album: 'Happy Vibes',
        duration: 215,
        imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        previewUrl: null,
        spotifyUrl: null
      },
      {
        id: 'mock-pop-2',
        name: 'Dance Forever',
        artists: ['Pop Dreams'],
        album: 'Energy Boost',
        duration: 198,
        imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
        previewUrl: null,
        spotifyUrl: null
      }
    ],
    'rock': [
      {
        id: 'mock-rock-1',
        name: 'Electric Thunder',
        artists: ['Rock Legends'],
        album: 'Power Surge',
        duration: 240,
        imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        previewUrl: null,
        spotifyUrl: null
      },
      {
        id: 'mock-rock-2',
        name: 'Wild Freedom',
        artists: ['Lightning Strike'],
        album: 'Untamed',
        duration: 225,
        imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
        previewUrl: null,
        spotifyUrl: null
      }
    ],
    'electronic': [
      {
        id: 'mock-electronic-1',
        name: 'Digital Dreams',
        artists: ['Cyber Sound'],
        album: 'Future Beats',
        duration: 180,
        imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=300&fit=crop',
        previewUrl: null,
        spotifyUrl: null
      },
      {
        id: 'mock-electronic-2',
        name: 'Neon Nights',
        artists: ['Electro Pulse'],
        album: 'Synthesized',
        duration: 195,
        imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop',
        previewUrl: null,
        spotifyUrl: null
      }
    ]
  };

  // Get tracks based on preferences
  const tracks: Track[] = [];
  const targetGenres = preferences.genres.length > 0 ? preferences.genres : ['pop'];
  
  for (const genre of targetGenres) {
    const genreKey = genre.toLowerCase();
    const genreTracks = mockTracksByGenre[genreKey] || mockTracksByGenre['pop'];
    tracks.push(...genreTracks);
  }

  // Add some generic tracks if we don't have enough
  while (tracks.length < 10) {
    tracks.push({
      id: `mock-generic-${tracks.length + 1}`,
      name: `${preferences.mood.charAt(0).toUpperCase() + preferences.mood.slice(1)} Track ${tracks.length + 1}`,
      artists: ['AI Generated Artist'],
      album: `${preferences.mood.charAt(0).toUpperCase() + preferences.mood.slice(1)} Collection`,
      duration: Math.floor(Math.random() * 60) + 180, // 3-4 minutes
      imageUrl: 'https://images.unsplash.com/photo-1571974599782-87624638275a?w=300&h=300&fit=crop',
      previewUrl: null,
      spotifyUrl: null
    });
  }

  return tracks.slice(0, 15); // Return up to 15 tracks
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Schedule management routes
  app.get("/api/schedules/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const schedules = await storage.getSchedulesByUserId(userId);
      res.json(schedules);
    } catch (error) {
      console.error("Error getting schedules:", error);
      res.status(500).json({ error: "Failed to get schedules" });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const scheduleData = insertScheduleSchema.parse(req.body);
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

  // Playlist generation routes
  app.post("/api/generate-playlist", async (req, res) => {
    try {
      const validatedData = generatePlaylistSchema.parse(req.body);
      const { preferences, userId } = validatedData;

      // Analyze preferences with AI (with fallback)
      let analyzedPrefs;
      try {
        analyzedPrefs = await aiService.analyzePreferences(preferences);
      } catch (aiError) {
        console.log("AI service failed, using fallback analysis:", aiError);
        analyzedPrefs = aiService.fallbackAnalysis(preferences);
      }
      
      // Get music recommendations with robust fallback
      let tracks = [];
      let usedFallback = false;
      
      // Try to get recommendations first
      try {
        tracks = await spotifyService.getRecommendations({
          seedGenres: analyzedPrefs.genres.slice(0, 2),
          targetEnergy: analyzedPrefs.energy,
          targetValence: analyzedPrefs.valence,
          targetDanceability: analyzedPrefs.danceability,
          limit: 25
        });
      } catch (recError) {
        console.log("Recommendations failed, trying search:", recError);
        
        // Fallback to search if recommendations fail
        try {
          const searchQuery = `${analyzedPrefs.genres[0]} ${analyzedPrefs.mood} ${analyzedPrefs.keywords.slice(0, 3).join(' ')}`;
          tracks = await spotifyService.searchTracks(searchQuery, 20);
        } catch (searchError) {
          console.log("Spotify search also failed, using mock data:", searchError);
          usedFallback = true;
          
          // Ultimate fallback - generate mock tracks based on preferences
          tracks = generateMockTracks(analyzedPrefs);
        }
      }

      if (tracks.length === 0) {
        console.log("No tracks found, generating mock tracks");
        usedFallback = true;
        tracks = generateMockTracks(analyzedPrefs);
      }

      // Generate playlist name and description (with fallback)
      let playlistName, playlistDescription;
      try {
        playlistName = await aiService.generatePlaylistName(analyzedPrefs);
        playlistDescription = await aiService.generatePlaylistDescription(analyzedPrefs, tracks.length);
      } catch (aiError) {
        console.log("AI playlist naming failed, using fallback:", aiError);
        playlistName = `${analyzedPrefs.mood.charAt(0).toUpperCase() + analyzedPrefs.mood.slice(1)} Mix`;
        playlistDescription = `${tracks.length} ${analyzedPrefs.mood} tracks perfect for your day`;
      }
      
      // Create playlist on Spotify (only if we have real tracks)
      let spotifyPlaylistId = null;
      if (!usedFallback) {
        try {
          spotifyPlaylistId = await spotifyService.createPlaylist({
            name: playlistName,
            description: playlistDescription,
            tracks
          });
        } catch (spotifyError) {
          console.error("Failed to create Spotify playlist:", spotifyError);
          // Continue without creating on Spotify
        }
      }

      // Save to storage if userId provided
      if (userId) {
        try {
          await storage.createGeneratedPlaylist({
            userId,
            scheduleId: null,
            spotifyPlaylistId,
            name: playlistName,
            description: playlistDescription,
            trackCount: tracks.length
          });
        } catch (storageError) {
          console.error("Failed to save to storage:", storageError);
          // Continue without saving
        }
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
          usedFallback: usedFallback // Indicate if fallback data was used
        }
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
            console.log(`Running scheduled playlist generation for schedule ${schedule.id}`);
            
            // Analyze preferences with AI (with fallback)
            let analyzedPrefs;
            try {
              analyzedPrefs = await aiService.analyzePreferences(schedule.preferences);
            } catch (aiError) {
              console.log("AI service failed for scheduled generation, using fallback analysis:", aiError);
              analyzedPrefs = aiService.fallbackAnalysis(schedule.preferences);
            }
            
            // Get music recommendations with robust fallback
            let tracks = [];
            let usedFallback = false;
            
            // Try to get recommendations first
            try {
              tracks = await spotifyService.getRecommendations({
                seedGenres: analyzedPrefs.genres.slice(0, 2),
                targetEnergy: analyzedPrefs.energy,
                targetValence: analyzedPrefs.valence,
                targetDanceability: analyzedPrefs.danceability,
                limit: 20
              });
            } catch (recError) {
              console.log("Recommendations failed for scheduled generation, trying search:", recError);
              
              // Fallback to search if recommendations fail
              try {
                const searchQuery = `${analyzedPrefs.genres[0]} ${analyzedPrefs.mood} ${analyzedPrefs.keywords.slice(0, 3).join(' ')}`;
                tracks = await spotifyService.searchTracks(searchQuery, 20);
              } catch (searchError) {
                console.log("Spotify search also failed for scheduled generation, using mock data:", searchError);
                usedFallback = true;
                
                // Ultimate fallback - generate mock tracks based on preferences
                tracks = generateMockTracks(analyzedPrefs);
              }
            }

            if (tracks.length === 0) {
              console.log("No tracks found for scheduled generation, generating mock tracks");
              usedFallback = true;
              tracks = generateMockTracks(analyzedPrefs);
            }

            // Generate playlist name and description (with fallback)
            let playlistName, playlistDescription;
            try {
              playlistName = await aiService.generatePlaylistName(analyzedPrefs);
              playlistDescription = await aiService.generatePlaylistDescription(analyzedPrefs, tracks.length);
            } catch (aiError) {
              console.log("AI playlist naming failed for scheduled generation, using fallback:", aiError);
              playlistName = `${analyzedPrefs.mood.charAt(0).toUpperCase() + analyzedPrefs.mood.slice(1)} Mix`;
              playlistDescription = `${tracks.length} ${analyzedPrefs.mood} tracks perfect for your day`;
            }
            
            // Create playlist on Spotify (only if we have real tracks)
            let spotifyPlaylistId = null;
            if (!usedFallback) {
              try {
                spotifyPlaylistId = await spotifyService.createPlaylist({
                  name: playlistName,
                  description: playlistDescription,
                  tracks
                });
              } catch (spotifyError) {
                console.error("Failed to create Spotify playlist for scheduled generation:", spotifyError);
                // Continue without creating on Spotify
              }
            }

            // Save to storage
            try {
              await storage.createGeneratedPlaylist({
                userId: schedule.userId,
                scheduleId: schedule.id,
                spotifyPlaylistId,
                name: playlistName,
                description: playlistDescription,
                trackCount: tracks.length
              });
            } catch (storageError) {
              console.error("Failed to save scheduled playlist to storage:", storageError);
              // Continue - still mark as successful generation
            }

            // Update last run time
            await storage.updateScheduleLastRun(schedule.id);

            results.push({
              scheduleId: schedule.id,
              success: true,
              playlistName,
              trackCount: tracks.length,
              usedFallback: usedFallback
            });
          }
        } catch (scheduleError) {
          console.error(`Error running schedule ${schedule.id}:`, scheduleError);
          results.push({
            scheduleId: schedule.id,
            success: false,
            error: scheduleError instanceof Error ? scheduleError.message : String(scheduleError)
          });
        }
      }

      res.json({
        success: true,
        results,
        timestamp: Date.now()
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
      const genres = await spotifyService.getAvailableGenres();
      res.json({ 
        connected: true, 
        availableGenres: genres.slice(0, 10) // Return first 10 genres as test
      });
    } catch (error) {
      console.error("Spotify connection test failed:", error);
      res.status(500).json({ 
        connected: false, 
        error: error instanceof Error ? error.message : "Failed to test Spotify connection" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to determine if a schedule should run
function shouldRunSchedule(schedule: any): boolean {
  const now = new Date();
  const [hour, minute] = schedule.time.split(':').map(Number);
  
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
    
    if (schedule.frequency === 'daily') {
      // Don't run if already ran today
      return lastRun.toDateString() !== now.toDateString();
    } else if (schedule.frequency === 'weekly') {
      // Don't run if already ran this week and it's the right day
      const daysSinceLastRun = Math.floor((now.getTime() - lastRun.getTime()) / (24 * 60 * 60 * 1000));
      return daysSinceLastRun >= 7 && now.getDay() === schedule.dayOfWeek;
    } else if (schedule.frequency === 'monthly') {
      // Don't run if already ran this month and it's the right day
      return lastRun.getMonth() !== now.getMonth() && now.getDate() === schedule.dayOfMonth;
    }
  }

  // Additional day checks for weekly/monthly
  if (schedule.frequency === 'weekly' && now.getDay() !== schedule.dayOfWeek) {
    return false;
  }
  
  if (schedule.frequency === 'monthly' && now.getDate() !== schedule.dayOfMonth) {
    return false;
  }

  return true;
}