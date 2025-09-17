import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { getUncachableSpotifyClient } from './spotifyClient';

export interface Track {
  id: string;
  spotifyId?: string;
  name: string;
  artists: string[];
  artistIds?: string[];
  album: string;
  duration: number;
  imageUrl?: string;
  previewUrl?: string;
  spotifyUrl?: string;
  releaseYear?: number;
  popularity?: number;
}

export interface PlaylistData {
  name: string;
  description?: string;
  tracks: Track[];
}

const GENRE_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const ARTIST_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const USER_TOP_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
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
const cachedArtistSeeds = new Map<
  string,
  { artistId: string; topTrackId?: string; name: string; expiresAt: number }
>();
let clientCredentialCache: { token: string; expiresAt: number } | null = null;

const ARTIST_STOPWORDS = new Set([
  '플레이리스트',
  '만들어줘',
  '만들어',
  '추천',
  '노래',
  '음악',
  '곡',
  '해주세요',
  '해주세요',
  '해줘',
  'playlist',
  'make',
  'song',
  'music',
]);

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

class SpotifyService {
  private async getUserAccessToken(
    options: { spotify?: SpotifyApi; req?: any } = {},
  ): Promise<string | null> {
    const { spotify, req } = options;

    if (spotify) {
      try {
        const userToken = await spotify.getAccessToken();
        if (userToken?.access_token) {
          return userToken.access_token;
        }
      } catch (error) {
        console.warn('Failed to obtain access token from Spotify client:', error);
      }
    }

    const sessionToken = req?.session?.spotifyTokens?.access_token;
    if (sessionToken) {
      return sessionToken;
    }

    return null;
  }

  private async getClientCredentialsToken(): Promise<string> {
    console.log('🔑 Attempting to get client credentials token...');
    const now = Date.now();
    if (clientCredentialCache && clientCredentialCache.expiresAt > now) {
      console.log('✅ Using cached client credentials token');
      return clientCredentialCache.token;
    }

    console.log('🔐 Environment check:', {
      hasClientId: !!process.env.SPOTIFY_CLIENT_ID,
      hasClientSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
      clientId: process.env.SPOTIFY_CLIENT_ID?.substring(0, 8) + '...'
    });

    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      throw new Error('Spotify client credentials not configured');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
        ).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    });

    const data = await response.json();
    console.log('🎵 Client credentials response:', {
      status: response.status,
      ok: response.ok,
      hasAccessToken: !!data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in
    });

    if (!response.ok) {
      console.error('❌ Client credentials request failed:', data);
      throw new Error(`Client credentials token request failed: ${response.status} ${JSON.stringify(data)}`);
    }

    const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000 - 60 * 1000;
    clientCredentialCache = { token: data.access_token, expiresAt };
    return data.access_token;
  }

  private async fetchSpotifyJson<T>(
    path: string,
    options: {
      spotify?: SpotifyApi;
      req?: any;
      method?: 'GET' | 'POST';
      searchParams?: Record<string, string | number | boolean | undefined>;
      body?: any;
      useClientCredentials?: boolean;
    } = {},
  ): Promise<T> {
    const method = options.method ?? 'GET';
    const url = new URL(path, 'https://api.spotify.com/v1/');

    if (options.searchParams) {
      for (const [key, value] of Object.entries(options.searchParams)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers();
    headers.set('Accept', 'application/json');
    if (process.env.SPOTIFY_CLIENT_ID) {
      headers.set('Client-Id', process.env.SPOTIFY_CLIENT_ID);
    }

    const body = options.body ? JSON.stringify(options.body) : undefined;
    if (body) {
      headers.set('Content-Type', 'application/json');
    }

    const attemptRequest = async (accessToken: string): Promise<T> => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      console.log(`🌐 Spotify API 요청:`, {
        url: url.toString(),
        method,
        path,
        hasBody: !!body,
        searchParams: options.searchParams
      });

      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
      });

      console.log(`📡 Spotify API 응답:`, {
        status: response.status,
        ok: response.ok,
        url: url.toString()
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Spotify request failed (${response.status}) for ${url.toString()} :: ${text}`,
        );
      }

      return (await response.json()) as T;
    };    // Try user token first
    try {
      const userToken = await this.getUserAccessToken({
        spotify: options.spotify,
        req: options.req,
      });
      if (userToken) {
        const result = await attemptRequest(userToken);
        if (result) return result;
      } else {
        throw new Error('No user token available');
      }
    } catch (error) {
      console.warn('Spotify request with user token failed:', error);
      if (options.useClientCredentials === false) {
        throw error;
      }
    }

    if (options.useClientCredentials === false) {
      throw new Error('Spotify request failed with user token');
    }

    // Fallback to client credentials
    const clientToken = await this.getClientCredentialsToken();
    return await attemptRequest(clientToken);
  }

  async fetchRecommendations(
    params: Record<string, any>,
    options: { spotify?: SpotifyApi; req?: any },
  ) {
    console.log('🎵 fetchRecommendations 호출됨:', { params });

    const spotify = options.spotify ?? (await getUncachableSpotifyClient(options.req));

    // SDK의 내장 recommendations.get() 메서드 사용
    const recommendationParams = {
      seed_genres: Array.isArray(params.seed_genres) ? params.seed_genres.slice(0, 5) :
        params.seed_genres ? [params.seed_genres] : undefined,
      seed_artists: Array.isArray(params.seed_artists) ? params.seed_artists.slice(0, 5) :
        params.seed_artists ? [params.seed_artists] : undefined,
      seed_tracks: Array.isArray(params.seed_tracks) ? params.seed_tracks.slice(0, 5) :
        params.seed_tracks ? [params.seed_tracks] : undefined,
      target_energy: params.target_energy,
      target_valence: params.target_valence,
      target_danceability: params.target_danceability,
      min_popularity: params.min_popularity,
      limit: Math.min(100, Math.max(1, params.limit || 20)) as any,
      market: params.market || 'KR'
    };

    // 빈 배열 제거
    if (recommendationParams.seed_genres?.length === 0) {
      recommendationParams.seed_genres = undefined;
    }
    if (recommendationParams.seed_artists?.length === 0) {
      recommendationParams.seed_artists = undefined;
    }
    if (recommendationParams.seed_tracks?.length === 0) {
      recommendationParams.seed_tracks = undefined;
    }

    console.log('🎵 SDK recommendations.get() 파라미터:', recommendationParams);

    return await spotify.recommendations.get(recommendationParams);
  }

  async normalizeGenres(
    genreInputs: string[],
    options: { spotify?: SpotifyApi; req?: any } = {},
  ): Promise<{ seedGenres: string[]; unmatched: string[] }> {
    console.log('🎵 normalizeGenres 호출됨:', { genreInputs });

    // deprecated API 대신 하드코딩된 장르 시드 사용
    const KNOWN_SPOTIFY_GENRES = [
      'acoustic', 'afrobeat', 'alt-rock', 'alternative', 'ambient', 'blues', 'chill', 'classical',
      'country', 'dance', 'electronic', 'folk', 'funk', 'garage', 'gospel', 'groove', 'hip-hop',
      'house', 'indie', 'indie-pop', 'jazz', 'latin', 'metal', 'new-age', 'pop', 'punk', 'r-n-b',
      'reggae', 'rock', 'soul', 'techno', 'trance'
    ];

    const availableSeeds = KNOWN_SPOTIFY_GENRES;
    const seedSet = new Set(availableSeeds);
    const resolved = new Set<string>();
    const unmatched: string[] = [];

    const tryResolve = (term: string): string | null => {
      const sanitized = sanitizeGenre(term);
      if (!sanitized) return null;

      // Direct match
      if (seedSet.has(sanitized)) {
        return sanitized;
      }

      // Exact alias lookup
      for (const entry of GENRE_ALIAS_ENTRIES) {
        if (entry.keys.includes(sanitized) && seedSet.has(entry.value)) {
          return entry.value;
        }
      }

      // Fuzzy matching
      for (const seed of availableSeeds) {
        if (seed.includes(sanitized) || sanitized.includes(seed)) {
          return seed;
        }
      }

      return null;
    };

    for (const input of genreInputs) {
      if (!input?.trim()) continue;

      const match = tryResolve(input);
      if (match) {
        resolved.add(match);
      } else {
        unmatched.push(input);
      }
    }

    console.log('🎵 Genre normalization 완료:', {
      resolved: Array.from(resolved),
      unmatched,
      availableSeedsCount: availableSeeds.length
    });

    return {
      seedGenres: Array.from(resolved),
      unmatched,
    };
  }

  async resolveArtistSeeds(
    artists: string[] = [],
    options: { spotify?: SpotifyApi; req?: any; market?: string } = {},
  ): Promise<{ artistSeeds: string[]; trackSeeds: string[]; resolvedNames: string[] }> {
    if (!artists || artists.length === 0) {
      return { artistSeeds: [], trackSeeds: [], resolvedNames: [] };
    }

    const spotify =
      options.spotify ?? (await getUncachableSpotifyClient(options.req));
    const market = options.market ?? 'KR';

    const artistSeeds: string[] = [];
    const trackSeeds: string[] = [];
    const resolvedNames: string[] = [];
    const seenArtists = new Set<string>();

    for (const rawName of artists) {
      const name = sanitizeGenre(rawName);
      if (!name || seenArtists.has(name)) {
        continue;
      }

      seenArtists.add(name);

      const cacheKey = name;
      const now = Date.now();
      const cached = cachedArtistSeeds.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        artistSeeds.push(cached.artistId);
        resolvedNames.push(cached.name);
        if (cached.topTrackId) {
          trackSeeds.push(cached.topTrackId);
        }
        continue;
      }

      try {
        const searchResponse = await spotify.search(
          rawName,
          ['artist'],
          market as any,
          5 as any,
        );

        const firstArtist = searchResponse.artists.items.find(
          (artist: any) => !!artist?.id,
        );

        if (!firstArtist) {
          continue;
        }

        artistSeeds.push(firstArtist.id);
        resolvedNames.push(firstArtist.name);

        let topTrackId: string | undefined;
        try {
          const topTracks = await spotify.artists.topTracks(firstArtist.id, market as any);
          topTrackId = topTracks.tracks?.[0]?.id;
          if (topTrackId) {
            trackSeeds.push(topTrackId);
          }
        } catch (topTrackError) {
          console.warn('Failed to fetch top tracks for artist seed:', {
            artistId: firstArtist.id,
            error: topTrackError,
          });
        }

        cachedArtistSeeds.set(cacheKey, {
          artistId: firstArtist.id,
          topTrackId,
          name: firstArtist.name,
          expiresAt: now + ARTIST_CACHE_TTL,
        });
      } catch (error) {
        console.warn('Failed to resolve artist seed:', { rawName, error });
      }

      if (artistSeeds.length >= 4) {
        break;
      }
    }

    const uniqueArtists = Array.from(new Set(artistSeeds)).slice(0, 3);
    const uniqueTracks = Array.from(new Set(trackSeeds)).slice(0, 2);
    const uniqueNames = Array.from(new Set(resolvedNames)).slice(0, 3);

    return {
      artistSeeds: uniqueArtists,
      trackSeeds: uniqueTracks,
      resolvedNames: uniqueNames,
    };
  }

  async searchTracks(query: string, limit: number = 20, req?: any): Promise<Track[]> {
    try {
      const spotify = await getUncachableSpotifyClient(req);
      const results = await spotify.search(query, ['track'], 'KR' as any, Math.min(50, Math.max(1, limit)) as any);

      return results.tracks.items.map((track: any) => {
        const release = track.album?.release_date as string | undefined;
        const year = release ? parseInt(release.slice(0, 4), 10) : undefined;
        return {
          id: track.id,
          spotifyId: track.id,
          name: track.name,
          artists: track.artists.map((artist: any) => artist.name),
          artistIds: track.artists.map((artist: any) => artist.id).filter(Boolean),
          album: track.album.name,
          duration: track.duration_ms,
          imageUrl: track.album.images[0]?.url,
          previewUrl: track.preview_url,
          spotifyUrl: track.external_urls.spotify,
          releaseYear: Number.isFinite(year) ? year : undefined,
          popularity: track.popularity,
        } as Track;
      });
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
        duration: track.duration_ms,
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
    // Avoid calling deprecated/unstable endpoint. Return curated list.
    return [
      'acoustic', 'afrobeat', 'alt-rock', 'alternative', 'ambient', 'blues', 'chill', 'classical',
      'country', 'dance', 'electronic', 'folk', 'funk', 'garage', 'gospel', 'groove', 'hip-hop',
      'house', 'indie', 'indie-pop', 'jazz', 'latin', 'metal', 'new-age', 'pop', 'punk', 'r-n-b',
      'reggae', 'rock', 'soul', 'techno', 'trance'
    ];
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

      return topTracks.items.map((track: any) => {
        const release = track.album?.release_date as string | undefined;
        const year = release ? parseInt(release.slice(0, 4), 10) : undefined;
        return {
          id: track.id,
          name: track.name,
          artists: track.artists.map((artist: any) => artist.name),
          artistIds: track.artists.map((artist: any) => artist.id).filter(Boolean),
          album: track.album.name,
          duration: track.duration_ms,
          imageUrl: track.album.images[0]?.url,
          previewUrl: track.preview_url,
          spotifyUrl: track.external_urls.spotify,
          releaseYear: Number.isFinite(year) ? year : undefined,
          popularity: track.popularity,
        } as Track;
      });
    } catch (error) {
      console.error('Error getting top tracks:', error);
      return [];
    }
  }

  private extractArtistCandidates(input: string): string[] {
    const candidates = new Set<string>();
    const normalized = input.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return [];
    }

    const lower = normalized.toLowerCase();

    // Full text as candidate
    if (!ARTIST_STOPWORDS.has(lower) && lower.length > 1) {
      candidates.add(normalized);
    }

    const hangulMatches = normalized.match(/[가-힣]{2,}/g) ?? [];
    for (const match of hangulMatches) {
      const trimmed = match.trim();
      if (trimmed.length >= 2 && !ARTIST_STOPWORDS.has(trimmed)) {
        candidates.add(trimmed);
      }
    }

    const latinMatches = normalized.match(/[A-Za-z][A-Za-z0-9.'&\s-]{1,}/g) ?? [];
    for (const match of latinMatches) {
      const trimmed = match.trim();
      const lowerTrim = trimmed.toLowerCase();
      if (trimmed.length >= 2 && !ARTIST_STOPWORDS.has(lowerTrim)) {
        candidates.add(trimmed);
      }
    }

    return Array.from(candidates).slice(0, 5);
  }

  async guessArtistsFromInput(
    input: string,
    options: { spotify?: SpotifyApi; req?: any; market?: string } = {},
  ): Promise<string[]> {
    const spotify =
      options.spotify ?? (await getUncachableSpotifyClient(options.req));
    const market = options.market ?? 'KR';
    const normalizedInput = input.toLowerCase();
    const candidates = this.extractArtistCandidates(input);

    if (candidates.length === 0) {
      return [];
    }

    const foundNames = new Set<string>();

    for (const candidate of candidates) {
      try {
        const searchResponse = await spotify.search(
          candidate,
          ['artist'],
          market as any,
          5 as any,
        );

        for (const artist of searchResponse.artists.items ?? []) {
          const name = artist?.name;
          if (!name) continue;
          const nameLower = name.toLowerCase();
          if (
            normalizedInput.includes(nameLower) ||
            candidate.toLowerCase().includes(nameLower)
          ) {
            foundNames.add(name);
            break;
          }
        }
      } catch (error) {
        console.warn('Failed to guess artist from input:', { candidate, error });
      }

      if (foundNames.size >= 3) break;
    }

    return Array.from(foundNames);
  }

  async getUserTopData(
    options: { spotify?: SpotifyApi; req: any; force?: boolean; market?: string },
  ): Promise<{ artistIds: string[]; artistNames: string[]; trackIds: string[] }> {
    const { req, force = false } = options;
    const market = options.market ?? 'KR';

    if (!req?.session) {
      return { artistIds: [], artistNames: [], trackIds: [] };
    }

    const cache = req.session.spotifyTopCache;
    const now = Date.now();
    if (!force && cache && cache.expiresAt > now) {
      return cache.data;
    }

    const spotify =
      options.spotify ?? (await getUncachableSpotifyClient(options.req));

    try {
      const [topArtists, topTracks] = await Promise.all([
        spotify.currentUser.topItems('artists', 'medium_term', 10 as any),
        spotify.currentUser.topItems('tracks', 'medium_term', 10 as any),
      ]);

      const artistIds = Array.from(
        new Set((topArtists.items ?? []).map((artist: any) => artist.id).filter(Boolean)),
      ).slice(0, 5);

      const artistNames = Array.from(
        new Set((topArtists.items ?? []).map((artist: any) => artist.name).filter(Boolean)),
      ).slice(0, 5);

      const trackIds = Array.from(
        new Set((topTracks.items ?? []).map((track: any) => track.id).filter(Boolean)),
      ).slice(0, 5);

      const data = { artistIds, artistNames, trackIds };
      req.session.spotifyTopCache = {
        data,
        market,
        expiresAt: now + USER_TOP_CACHE_TTL,
      };

      return data;
    } catch (error) {
      console.warn('Failed to fetch user top data:', error);
      return { artistIds: [], artistNames: [], trackIds: [] };
    }
  }

  async getTopTracksForArtists(
    artistIds: string[],
    options: { spotify?: SpotifyApi; req?: any; market?: string; limitPerArtist?: number } = {},
  ): Promise<Track[]> {
    if (!artistIds || artistIds.length === 0) {
      return [];
    }

    const spotify =
      options.spotify ?? (await getUncachableSpotifyClient(options.req));
    const market = options.market ?? 'KR';
    const limitPerArtist = Math.max(1, options.limitPerArtist ?? 3);

    const uniqueTracks = new Map<string, Track>();

    for (const artistId of artistIds) {
      if (!artistId || uniqueTracks.size >= artistIds.length * limitPerArtist) {
        continue;
      }

      try {
        const topTracks = await spotify.artists.topTracks(artistId, market as any);
        for (const track of topTracks.tracks ?? []) {
          if (!track?.id || uniqueTracks.has(track.id)) continue;
          const release = track.album?.release_date as string | undefined;
          const year = release ? parseInt(release.slice(0, 4), 10) : undefined;
          uniqueTracks.set(track.id, {
            id: track.id,
            spotifyId: track.id,
            name: track.name,
            artists: track.artists?.map((a: any) => a.name) || ['Unknown Artist'],
            artistIds: track.artists?.map((a: any) => a.id).filter(Boolean) || [],
            album: track.album?.name || 'Unknown Album',
            duration: track.duration_ms,
            previewUrl: track.preview_url ?? undefined,
            spotifyUrl: track.external_urls?.spotify,
            imageUrl: track.album?.images?.[0]?.url,
            releaseYear: Number.isFinite(year) ? year : undefined,
            popularity: track.popularity,
          });

          if (uniqueTracks.size >= artistIds.length * limitPerArtist) break;
        }
      } catch (error) {
        console.warn('Failed to fetch top tracks for artist:', { artistId, error });
      }
    }

    return Array.from(uniqueTracks.values());
  }

  // Fetch related artists for a set of seeds
  async getRelatedArtists(
    artistIds: string[],
    options: { spotify?: SpotifyApi; req?: any; limitPerArtist?: number } = {}
  ): Promise<{ id: string; name: string }[]> {
    if (!artistIds || artistIds.length === 0) return [];

    const spotify = options.spotify ?? (await getUncachableSpotifyClient(options.req));
    const limitPerArtist = Math.max(1, options.limitPerArtist ?? 5);
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];

    for (const id of artistIds) {
      try {
        const rel = await (spotify as any).artists.relatedArtists(id);
        for (const a of rel.artists ?? []) {
          if (!a?.id || seen.has(a.id)) continue;
          out.push({ id: a.id, name: a.name });
          seen.add(a.id);
          if (out.length >= artistIds.length * limitPerArtist) break;
        }
      } catch (e) {
        // Silenced: related artists call may be restricted in some markets/clients
      }
    }
    return out;
  }

  // Fetch audio features for tracks and return a map
  async getAudioFeaturesMap(
    trackIds: string[],
    options: { spotify?: SpotifyApi; req?: any } = {}
  ): Promise<Record<string, { energy?: number; valence?: number; danceability?: number; tempo?: number }>> {
    const ids = Array.from(new Set(trackIds)).filter(Boolean).slice(0, 100);
    if (ids.length === 0) return {};
    try {
      // Intentionally disabled to avoid 403 in some environments
      return {};
    } catch (e) {
      return {};
    }
  }

  // Batch fetch artist genres map to improve genre filtering quality
  private async getArtistsGenresMap(artistIds: string[], req?: any): Promise<Record<string, string[]>> {
    const ids = Array.from(new Set(artistIds)).filter(Boolean);
    if (ids.length === 0) return {};
    try {
      const resp = await this.fetchSpotifyJson<{ artists: Array<any> }>('artists', {
        req,
        searchParams: { ids: ids.slice(0, 50).join(',') },
      });
      const map: Record<string, string[]> = {};
      for (const a of resp.artists ?? []) {
        if (!a?.id) continue;
        map[a.id] = Array.isArray(a.genres) ? a.genres.map((g: string) => g.toLowerCase()) : [];
      }
      return map;
    } catch (e) {
      console.warn('Failed to fetch artists genres batch:', e);
      return {};
    }
  }

  // Hybrid recommendation builder to avoid /v1/recommendations 404
  async buildHybridRecommendations(
    params: {
      genres?: string[];
      seedArtistIds?: string[];
      userTopArtistIds?: string[];
      limit?: number;
      targetEnergy?: number;
      targetValence?: number;
      targetDanceability?: number;
      yearRange?: { from: number; to: number } | null;
      market?: string;
      keywords?: string[];
    },
    req?: any,
  ): Promise<Track[]> {
    const spotify = await getUncachableSpotifyClient(req);
    const market = params.market ?? 'KR';
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));

    const seeds: string[] = [];
    for (const id of params.seedArtistIds ?? []) {
      if (id && !seeds.includes(id)) seeds.push(id);
      if (seeds.length >= 5) break;
    }
    for (const id of params.userTopArtistIds ?? []) {
      if (id && !seeds.includes(id)) seeds.push(id);
      if (seeds.length >= 5) break;
    }

    // Candidate artists = seeds only (avoid related-artists to prevent sporadic 404s)
    const candidateArtistIds = Array.from(new Set(seeds)).slice(0, 12);

    // Collect top tracks from these artists
    const artistTracks = await this.getTopTracksForArtists(candidateArtistIds, { spotify, market: market as any, limitPerArtist: 3 });
    let candidates: Track[] = [...artistTracks];

    // If not enough, structured search by genre/year
    if (candidates.length < limit) {
      const queries: string[] = [];
      const years = params.yearRange ? `${params.yearRange.from}-${params.yearRange.to}` : '';
      for (const g of params.genres ?? []) {
        queries.push(years ? `genre:${g} year:${years}` : `genre:${g}`);
      }
      // Also try keyword searches (e.g., artist names, mood, free keywords)
      for (const kw of params.keywords ?? []) {
        const q = kw.toString().trim();
        if (!q) continue;
        queries.push(q);
      }
      // Ensure at least one query exists
      if (queries.length === 0 && years) queries.push(`year:${years}`);

      const unique = new Map<string, Track>();
      for (const t of candidates) unique.set(t.id, t);

      for (const q of queries.slice(0, 6)) {
        try {
          const res = await spotify.search(q, ['track'], market as any, 20 as any);
          for (const item of res.tracks.items ?? []) {
            if (!item?.id || unique.has(item.id)) continue;
            unique.set(item.id, {
              id: item.id,
              spotifyId: item.id,
              name: item.name,
              artists: item.artists?.map((a: any) => a.name) || ['Unknown Artist'],
              album: item.album?.name || 'Unknown Album',
              duration: item.duration_ms,
              previewUrl: item.preview_url ?? undefined,
              spotifyUrl: item.external_urls?.spotify,
              imageUrl: item.album?.images?.[0]?.url,
            });
            if (unique.size >= limit * 2) break;
          }
        } catch (e) {
          console.warn('Search query failed:', { q, error: e });
        }
        if (unique.size >= limit * 2) break;
      }

      candidates = Array.from(unique.values());
    }

    // Enrich with artist genres to constrain to rock-related candidates for "90년대 록" 등
    const allArtistIds = Array.from(new Set(candidates.flatMap(c => c.artistIds || [])));
    const artistGenresMap = await this.getArtistsGenresMap(allArtistIds, req);

    const ROCK_HINTS = new Set([
      'rock', 'alt-rock', 'alternative rock', 'indie-rock', 'hard rock', 'classic rock', 'post-rock',
      'garage rock', 'grunge', 'britpop', 'pop rock', 'punk', 'emo', 'nu metal', 'metal', 'stoner rock', 'math rock', 'shoegaze'
    ]);
    const isRockish = (ids?: string[]) => {
      for (const id of ids || []) {
        const genres = artistGenresMap[id] || [];
        for (const g of genres) {
          // normalize
          const gg = g.toLowerCase();
          if (Array.from(ROCK_HINTS).some(h => gg.includes(h))) return true;
        }
      }
      return false;
    };

    // Build scores
    const kwSet = new Set((params.keywords ?? []).map((k) => k.toLowerCase()));
    const keywordScore = (t: Track) => {
      const name = t.name.toLowerCase();
      const artistNames = (t.artists || []).map((a) => a.toLowerCase());
      let s = 0;
      for (const kw of Array.from(kwSet)) {
        if (!kw) continue;
        if (name.includes(kw)) s += 0.8;
        if (artistNames.some((a) => a.includes(kw))) s += 0.6;
      }
      return s;
    };

    const yearScore = (t: Track) => {
      const yr = t.releaseYear;
      if (!params.yearRange) return 0.2;
      if (!yr) return 0.0;
      const { from, to } = params.yearRange;
      if (yr >= from && yr <= to) return 1.2;
      // distance-based decay
      const dist = Math.min(Math.abs(yr - from), Math.abs(yr - to));
      return Math.max(0, 1.0 - dist / 20);
    };

    const genreScore = (t: Track) => (isRockish(t.artistIds) ? 1.5 : -0.7);
    const popularityScore = (t: Track) => ((t.popularity ?? 50) / 100) * 0.6;

    // Pre-filter: try to keep rockish tracks if we have enough candidates
    let filtered = candidates;
    const rockCandidates = candidates.filter(t => isRockish(t.artistIds));
    if (rockCandidates.length >= Math.max(10, Math.floor(limit * 0.6))) {
      filtered = rockCandidates;
    }

    const scored = filtered
      .map((t, i) => ({
        t,
        score: genreScore(t) + yearScore(t) + keywordScore(t) + popularityScore(t) + (filtered.length - i) * 0.001,
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.t);

    // Enforce per-artist cap to avoid duplicates
    const perArtistCapPrimary = 1;
    const perArtistCapRelaxed = 2;
    const pickWithCap = (cap: number) => {
      const out: Track[] = [];
      const counts = new Map<string, number>();
      const seen = new Set<string>();
      for (const t of scored) {
        if (out.length >= limit) break;
        if (seen.has(t.id)) continue;
        const ids = (t.artistIds && t.artistIds.length > 0) ? t.artistIds : [];
        const key = ids[0] || (t.artists?.[0] || 'unknown');
        const cur = counts.get(key) || 0;
        if (cur >= cap) continue;
        out.push(t);
        seen.add(t.id);
        counts.set(key, cur + 1);
      }
      return out;
    };

    let finalPick = pickWithCap(perArtistCapPrimary);
    if (finalPick.length < Math.floor(limit * 0.7)) {
      finalPick = pickWithCap(perArtistCapRelaxed);
    }

    return finalPick.slice(0, limit);
  }
}

export const spotifyService = new SpotifyService();
