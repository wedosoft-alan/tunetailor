import { getUncachableSpotifyClient } from './spotifyClient.js';

export interface Track {
  id: string;
  name: string;
  artists: string[];
  album: string;
  duration: number;
  imageUrl?: string;
  previewUrl?: string;
  spotifyUrl?: string;
}

export interface PlaylistData {
  name: string;
  description?: string;
  tracks: Track[];
}

class SpotifyService {
  async searchTracks(query: string, limit: number = 20): Promise<Track[]> {
    try {
      const spotify = await getUncachableSpotifyClient();
      const results = await spotify.search(query, ['track'], 'KR', Math.min(50, Math.max(1, limit)) as any);
      
      return results.tracks.items.map((track: any) => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map((artist: any) => artist.name),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        imageUrl: track.album.images[0]?.url,
        previewUrl: track.preview_url,
        spotifyUrl: track.external_urls.spotify
      }));
    } catch (error) {
      console.error('Error searching tracks:', error);
      throw new Error('Failed to search tracks');
    }
  }

  async getRecommendations(params: {
    seedGenres?: string[];
    seedArtists?: string[];
    seedTracks?: string[];
    targetEnergy?: number;
    targetValence?: number;
    targetDanceability?: number;
    limit?: number;
  }): Promise<Track[]> {
    try {
      const spotify = await getUncachableSpotifyClient();
      
      const recommendations = await spotify.recommendations.get({
        seed_genres: params.seedGenres?.slice(0, 2), // Limit to 2 genres
        seed_artists: params.seedArtists?.slice(0, 2),
        seed_tracks: params.seedTracks?.slice(0, 1),
        target_energy: params.targetEnergy,
        target_valence: params.targetValence,
        target_danceability: params.targetDanceability,
        limit: Math.min(100, Math.max(1, params.limit || 20)) as any,
        market: 'KR'
      });

      return recommendations.tracks.map((track: any) => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map((artist: any) => artist.name),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        imageUrl: track.album.images[0]?.url,
        previewUrl: track.preview_url,
        spotifyUrl: track.external_urls.spotify
      }));
    } catch (error) {
      console.error('Error getting recommendations:', error);
      throw new Error('Failed to get recommendations');
    }
  }

  async createPlaylist(playlistData: PlaylistData): Promise<string> {
    try {
      const spotify = await getUncachableSpotifyClient();
      const profile = await spotify.currentUser.profile();
      
      const playlist = await spotify.playlists.createPlaylist(profile.id, {
        name: playlistData.name,
        description: playlistData.description,
        public: false
      });

      const trackUris = playlistData.tracks.map(track => `spotify:track:${track.id}`);
      
      if (trackUris.length > 0) {
        await spotify.playlists.addItemsToPlaylist(playlist.id, trackUris);
      }

      return playlist.id;
    } catch (error) {
      console.error('Error creating playlist:', error);
      throw new Error('Failed to create playlist');
    }
  }

  async getAvailableGenres(): Promise<string[]> {
    try {
      const spotify = await getUncachableSpotifyClient();
      const genres = await spotify.recommendations.genreSeeds();
      return genres.genres;
    } catch (error) {
      console.error('Error getting genres:', error);
      return [];
    }
  }

  async getUserTopArtists(limit: number = 10): Promise<any[]> {
    try {
      const spotify = await getUncachableSpotifyClient();
      const topArtists = await spotify.currentUser.topItems('artists', 'medium_term', Math.min(50, Math.max(1, limit)) as any);
      return topArtists.items.map((artist: any) => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres
      }));
    } catch (error) {
      console.error('Error getting top artists:', error);
      return [];
    }
  }

  async getUserTopTracks(limit: number = 10): Promise<Track[]> {
    try {
      const spotify = await getUncachableSpotifyClient();
      const topTracks = await spotify.currentUser.topItems('tracks', 'medium_term', Math.min(50, Math.max(1, limit)) as any);
      
      return topTracks.items.map((track: any) => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map((artist: any) => artist.name),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        imageUrl: track.album.images[0]?.url,
        previewUrl: track.preview_url,
        spotifyUrl: track.external_urls.spotify
      }));
    } catch (error) {
      console.error('Error getting top tracks:', error);
      return [];
    }
  }
}

export const spotifyService = new SpotifyService();