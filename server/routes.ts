import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScheduleSchema, insertGeneratedPlaylistSchema } from "@shared/schema";
import { spotifyService } from "./spotifyService";
import { aiService } from "./aiService";

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
      const { preferences, userId } = req.body;
      
      if (!preferences) {
        return res.status(400).json({ error: "Preferences are required" });
      }

      // Analyze preferences with AI
      const analyzedPrefs = await aiService.analyzePreferences(preferences);
      
      // Get music recommendations
      let tracks = [];
      
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
        const searchQuery = `${analyzedPrefs.genres[0]} ${analyzedPrefs.mood} ${analyzedPrefs.keywords.slice(0, 3).join(' ')}`;
        tracks = await spotifyService.searchTracks(searchQuery, 20);
      }

      if (tracks.length === 0) {
        return res.status(404).json({ error: "No tracks found for your preferences" });
      }

      // Generate playlist name and description
      const playlistName = await aiService.generatePlaylistName(analyzedPrefs);
      const playlistDescription = await aiService.generatePlaylistDescription(analyzedPrefs, tracks.length);
      
      // Create playlist on Spotify
      let spotifyPlaylistId = null;
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

      // Save to storage if userId provided
      if (userId) {
        await storage.createGeneratedPlaylist({
          userId,
          scheduleId: null,
          spotifyPlaylistId,
          name: playlistName,
          description: playlistDescription,
          trackCount: tracks.length
        });
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
          spotifyId: spotifyPlaylistId
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
            
            // Generate playlist using stored preferences
            const analyzedPrefs = await aiService.analyzePreferences(schedule.preferences);
            
            const tracks = await spotifyService.getRecommendations({
              seedGenres: analyzedPrefs.genres.slice(0, 2),
              targetEnergy: analyzedPrefs.energy,
              targetValence: analyzedPrefs.valence,
              targetDanceability: analyzedPrefs.danceability,
              limit: 20
            });

            const playlistName = await aiService.generatePlaylistName(analyzedPrefs);
            const playlistDescription = await aiService.generatePlaylistDescription(analyzedPrefs, tracks.length);
            
            // Create playlist on Spotify
            const spotifyPlaylistId = await spotifyService.createPlaylist({
              name: playlistName,
              description: playlistDescription,
              tracks
            });

            // Save to storage
            await storage.createGeneratedPlaylist({
              userId: schedule.userId,
              scheduleId: schedule.id,
              spotifyPlaylistId,
              name: playlistName,
              description: playlistDescription,
              trackCount: tracks.length
            });

            // Update last run time
            await storage.updateScheduleLastRun(schedule.id);

            results.push({
              scheduleId: schedule.id,
              success: true,
              playlistName,
              trackCount: tracks.length
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