import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { getUncachableSpotifyClient } from './spotifyClient';

export interface Track {
  id: string;
  spotifyId?: string;
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

const GENRE_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const FALLBACK_SEEDS = [
  'pop',
  'rock',
  'indie',
  'alternative',
  'electronic',
  'hip-hop',
  'jazz',
  'chill',
];

const GENRE_ALIAS_ENTRIES: Array<{ keys: string[]; value: string }> = [
  { keys: ['록', '락', '락앤롤', 'rock n roll', 'rock-and-roll'], value: 'rock' },
  { keys: ['발라드', 'ballad'], value: 'ballad' },
  { keys: ['재즈', 'jaz', 'jazz'], value: 'jazz' },
  { keys: ['힙합', '힙합음악', 'hiphop', 'hip-hop'], value: 'hip-hop' },
  { keys: ['인디', 'indie'], value: 'indie' },
  { keys: ['인디팝', 'indie pop'], value: 'indie-pop' },
  { keys: ['인디록', 'indie rock'], value: 'indie-rock' },
  { keys: ['일렉트로닉', 'electro', 'electronic', 'edm'], value: 'electronic' },
  { keys: ['신스', '신스팝', 'synth', 'synthpop', 'synth pop'], value: 'synth-pop' },
  { keys: ['포크', '포크록', 'folk'], value: 'folk' },
  { keys: ['포스트록', 'post rock', 'postrock'], value: 'post-rock' },
  { keys: ['스튜디', 'study'], value: 'study' },
  { keys: ['lofi', 'lo-fi', '로파이'], value: 'lo-fi' },
  { keys: ['차분한', 'calm', 'chill'], value: 'chill' },
  { keys: ['집중', 'focus'], value: 'focus' },
  { keys: ['드라이브', 'drive'], value: 'road-trip' },
];

const GENRE_ALIAS_MAP = new Map<string, string>();
for (const entry of GENRE_ALIAS_ENTRIES) {
  for (const key of entry.keys) {
    GENRE_ALIAS_MAP.set(sanitizeGenre(key), entry.value);
  }
}

let cachedGenreSeeds: { values: string[]; expiresAt: number } | null = null;

function sanitizeGenre(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function slugifyGenre(value: string): string {
  return sanitizeGenre(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => []);

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1,
        );
      }
    }
  }

  return matrix[a.length][b.length];
}

async function loadGenreSeeds(spotify: SpotifyApi): Promise<string[]> {
  const now = Date.now();
  if (cachedGenreSeeds && cachedGenreSeeds.expiresAt > now) {
    return cachedGenreSeeds.values;
  }

  const response = await spotify.recommendations.genreSeeds();
  const seeds = response.genres.map((genre: string) => genre.toLowerCase());
  cachedGenreSeeds = { values: seeds, expiresAt: now + GENRE_CACHE_TTL };
  return seeds;
}

class SpotifyService {
  async normalizeGenres(
    genres: string[],
    options: { spotify?: SpotifyApi; req?: any } = {},
  ): Promise<{ seedGenres: string[]; unmatched: string[] }> {
    const spotify =
      options.spotify ?? (await getUncachableSpotifyClient(options.req));

    let availableSeeds: string[];
    try {
      availableSeeds = await loadGenreSeeds(spotify);
    } catch (error) {
      console.warn('Falling back to default genre seeds:', error);
      availableSeeds = FALLBACK_SEEDS;
    }

    const seedSet = new Set(availableSeeds);
    const resolved = new Set<string>();
    const unmatched: string[] = [];

    const tryResolve = (term: string): string | null => {
      const sanitized = sanitizeGenre(term);
      if (!sanitized) return null;

      const alias = GENRE_ALIAS_MAP.get(sanitized);
      if (alias && (seedSet.has(alias) || FALLBACK_SEEDS.includes(alias))) {
        return alias;
      }

      if (seedSet.has(sanitized)) {
        return sanitized;
      }

      const slug = slugifyGenre(sanitized);
      if (seedSet.has(slug)) {
        return slug;
      }

      return null;
    };

    const seedsArray = availableSeeds;

    for (const original of genres) {
      const sanitized = sanitizeGenre(original);
      if (!sanitized) continue;

      const searchTerms = [sanitized, slugifyGenre(sanitized), ...sanitized.split(/\s+/)];
      let resolvedSeed: string | null = null;

      for (const term of searchTerms) {
        const result = tryResolve(term);
        if (result) {
          resolvedSeed = result;
          break;
        }
      }

      if (!resolvedSeed) {
        let bestSeed: string | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const seed of seedsArray) {
          const distance = levenshtein(sanitized, seed);
          const normalized = distance / Math.max(seed.length, sanitized.length, 1);
          if (normalized <= 0.4 && distance < bestDistance) {
            bestDistance = distance;
            bestSeed = seed;
          }
        }
        if (bestSeed) {
          resolvedSeed = bestSeed;
        }
      }

      if (resolvedSeed) {
        resolved.add(resolvedSeed);
      } else {
        unmatched.push(original);
      }
    }

    if (resolved.size === 0) {
      FALLBACK_SEEDS.slice(0, 2).forEach((seed) => resolved.add(seed));
    }

    const seedGenres = Array.from(resolved).slice(0, 3);
    return { seedGenres, unmatched };
  }

  async searchTracks(query: string, limit: number = 20, req?: any): Promise<Track[]> {
    try {
      const spotify = await getUncachableSpotifyClient(req);
      const results = await spotify.search(query, ['track'], 'KR', Math.min(50, Math.max(1, limit)) as any);

      return results.tracks.items.map((track: any) => ({
        id: track.id,
        spotifyId: track.id,
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
  }, req?: any): Promise<Track[]> {
    try {
      const spotify = await getUncachableSpotifyClient(req);

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
        spotifyId: track.id,
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

  async createPlaylist(playlistData: PlaylistData, req?: any): Promise<string> {
    try {
      const spotify = await getUncachableSpotifyClient(req);
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

  async getAvailableGenres(req?: any): Promise<string[]> {
    try {
      const spotify = await getUncachableSpotifyClient(req);
      const genres = await spotify.recommendations.genreSeeds();
      return genres.genres;
    } catch (error) {
      console.error('Error getting genres:', error);
      return [];
    }
  }

  async getUserTopArtists(limit: number = 10, req?: any): Promise<any[]> {
    try {
      const spotify = await getUncachableSpotifyClient(req);
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

  async getUserTopTracks(limit: number = 10, req?: any): Promise<Track[]> {
    try {
      const spotify = await getUncachableSpotifyClient(req);
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
