import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import PlaylistGenerator from '@/components/PlaylistGenerator';
import PlaylistDisplay from '@/components/PlaylistDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
}

interface GeneratedTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  duration: number;
  imageUrl?: string;
  previewUrl?: string;
  spotifyUrl?: string;
  spotifyId?: string;
  source?: 'recommended' | 'manual';
}

interface PlaylistForDisplay {
  id: string;
  name: string;
  description?: string;
  tracks: GeneratedTrack[];
  totalDuration: number;
  createdAt: string | number | Date;
}

export default function Home() {
  const [isConnectedToSpotify, setIsConnectedToSpotify] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastPreferences, setLastPreferences] = useState('');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [trackCount, setTrackCount] = useState<number>(15);

  const [recommendedTracks, setRecommendedTracks] = useState<GeneratedTrack[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<GeneratedTrack[]>([]);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeneratedTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    void checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/spotify/status');
      const data = await response.json();

      if (data.authenticated) {
        setIsConnectedToSpotify(true);
        setSpotifyUser(data.user);
      } else {
        setIsConnectedToSpotify(false);
        setSpotifyUser(null);
        resetPlaylistState();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const resetPlaylistState = () => {
    setRecommendedTracks([]);
    setSelectedTracks([]);
    setPlaylistName('');
    setPlaylistDescription('');
    setGeneratedAt(null);
    setGenerateError(null);
    setSearchResults([]);
  };

  const handleConnectSpotify = () => {
    window.location.href = '/auth/spotify';
  };

  const handleDisconnectSpotify = async () => {
    try {
      await fetch('/api/auth/spotify/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error disconnecting Spotify:', error);
    } finally {
      setIsConnectedToSpotify(false);
      setSpotifyUser(null);
      resetPlaylistState();
      setLastPreferences('');
    }
  };

  const normalizeTrack = (track: any, source: GeneratedTrack['source'] = 'recommended'): GeneratedTrack => {
    const artists = Array.isArray(track.artists)
      ? track.artists
      : track.artists
        ? [track.artists]
        : ['Unknown Artist'];

    const durationSeconds = typeof track.duration === 'number'
      ? Math.max(0, Math.round(track.duration))
      : track.duration_ms
        ? Math.round(track.duration_ms / 1000)
        : 0;

    return {
      id: track.id,
      name: track.name,
      artists,
      album: track.album || track.album?.name || 'Unknown Album',
      duration: durationSeconds,
      imageUrl: track.imageUrl ?? track.album?.images?.[0]?.url,
      previewUrl: track.previewUrl ?? track.preview_url,
      spotifyUrl: track.spotifyUrl ?? track.external_urls?.spotify,
      spotifyId: track.spotifyId ?? track.id,
      source,
    };
  };

  const handleGeneratePlaylist = async (preferences: string) => {
    if (!preferences.trim()) {
      return;
    }

    setLastPreferences(preferences);
    setGenerateError(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences, trackCount })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const message = data?.error || `Failed to generate playlist (${response.status})`;
        throw new Error(message);
      }

      const normalizedTracks = Array.isArray(data.playlist?.tracks)
        ? data.playlist.tracks.map((track: any) => normalizeTrack(track, 'recommended'))
        : [];

      setRecommendedTracks(normalizedTracks);
      setSelectedTracks(normalizedTracks);
      setPlaylistName(data.playlist?.name ?? 'AI Generated Mix');
      setPlaylistDescription(data.playlist?.description ?? '');
      setGeneratedAt(data.playlist?.createdAt ?? new Date().toISOString());
      setSearchResults([]);
    } catch (error) {
      console.error('Error generating playlist:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'AI 플레이리스트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      setGenerateError(message);
      toast({
        title: '생성 실패',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegeneratePlaylist = () => {
    if (lastPreferences) {
      void handleGeneratePlaylist(lastPreferences);
    }
  };

  const handleSearchTracks = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to search tracks');
      }

      const tracks = Array.isArray(data.tracks)
        ? data.tracks.map((track: any) => normalizeTrack(track, 'manual'))
        : [];
      setSearchResults(tracks);
    } catch (error) {
      console.error('Error searching tracks:', error);
      toast({
        title: '검색 실패',
        description: 'Spotify에서 곡을 검색하지 못했습니다. 잠시 후 다시 시도해주세요.',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTrack = (track: GeneratedTrack) => {
    const exists = selectedTracks.some((t) => t.id === track.id);
    if (exists) {
      toast({
        title: '이미 추가된 곡',
        description: '이 곡은 이미 플레이리스트에 포함되어 있습니다.',
      });
      return;
    }

    setSelectedTracks((prev) => [...prev, { ...track, source: track.source ?? 'manual' }]);
  };

  const handleRemoveTrack = (trackId: string) => {
    setSelectedTracks((prev) => prev.filter((track) => track.id !== trackId));
  };

  const playlistForDisplay: PlaylistForDisplay | undefined = useMemo(() => {
    if (selectedTracks.length === 0) {
      return undefined;
    }

    return {
      id: 'preview-playlist',
      name: playlistName || 'AI Generated Mix',
      description: playlistDescription,
      tracks: selectedTracks,
      totalDuration: selectedTracks.reduce((sum, track) => sum + track.duration, 0),
      createdAt: generatedAt ?? new Date().toISOString(),
    };
  }, [selectedTracks, playlistName, playlistDescription, generatedAt]);

  const handleSavePlaylistToSpotify = async (playlist: PlaylistForDisplay) => {
    try {
      const response = await fetch('/api/create-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistName: playlist.name,
          description: playlist.description,
          tracks: playlist.tracks.map(({ spotifyId, id, name, artists, album }) => ({
            spotifyId: spotifyId ?? id,
            id,
            name,
            artists,
            album,
          })),
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.error || 'Spotify playlist creation failed');
      }

      const playlistId: string | undefined = data.playlist?.id;
      const webUrl: string | undefined = data.playlist?.url || (playlistId ? `https://open.spotify.com/playlist/${playlistId}` : undefined);
      const appUrl: string | undefined = playlistId ? `spotify:playlist:${playlistId}` : undefined;

      toast({
        title: 'Spotify에 저장 완료',
        description: `"${playlist.name}" 플레이리스트가 Spotify에 생성되었습니다.`,
      });

      if (appUrl) {
        const appWindow = window.open(appUrl, '_blank');
        setTimeout(() => {
          if (!appWindow || appWindow.closed) {
            if (webUrl) {
              window.open(webUrl, '_blank');
            }
          }
        }, 600);
      } else if (webUrl) {
        window.open(webUrl, '_blank');
      }
    } catch (error) {
      console.error('Error saving playlist:', error);
      const message =
        error instanceof Error ? error.message : 'Spotify에 플레이리스트를 저장하지 못했습니다.';
      toast({
        title: '저장 실패',
        description: message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        isConnectedToSpotify={isConnectedToSpotify}
        onConnectSpotify={handleConnectSpotify}
        onDisconnectSpotify={handleDisconnectSpotify}
      />
      <main className="container mx-auto px-4 py-8 space-y-6">
        {!isConnectedToSpotify && !isCheckingAuth ? (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Spotify 계정을 연결하세요</CardTitle>
              <CardDescription>
                AI가 추천하는 플레이리스트를 만들려면 먼저 Spotify 계정을 연결해야 합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleConnectSpotify} className="w-full">
                스포티파이 연결
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {isConnectedToSpotify && spotifyUser ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>환영합니다, {spotifyUser.display_name}님</CardTitle>
                <CardDescription>{spotifyUser.email}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between flex-col sm:flex-row gap-3">
                <div className="text-sm text-muted-foreground">
                  Spotify 계정이 연결되었습니다. 아래에서 원하는 분위기를 설명해보세요.
                </div>
                <Button onClick={handleDisconnectSpotify} variant="outline">
                  연결 해제
                </Button>
              </CardContent>
            </Card>

            <PlaylistGenerator
              onGenerate={handleGeneratePlaylist}
              isLoading={isGenerating}
              isConnectedToSpotify={isConnectedToSpotify}
              trackCount={trackCount}
              onTrackCountChange={setTrackCount}
            />

            {generateError ? (
              <Alert variant="destructive">
                <AlertTitle>생성 실패</AlertTitle>
                <AlertDescription>{generateError}</AlertDescription>
              </Alert>
            ) : null}

            {playlistForDisplay ? (
              <Card>
                <CardHeader>
                  <CardTitle>플레이리스트 정보</CardTitle>
                  <CardDescription>제목과 설명을 원하는 대로 수정할 수 있습니다.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="playlist-name">플레이리스트 이름</Label>
                    <Input
                      id="playlist-name"
                      value={playlistName}
                      onChange={(e) => setPlaylistName(e.target.value)}
                      placeholder="AI Generated Mix"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playlist-description">설명</Label>
                    <Input
                      id="playlist-description"
                      value={playlistDescription}
                      onChange={(e) => setPlaylistDescription(e.target.value)}
                      placeholder="분위기를 설명하는 문장을 입력하세요"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>곡 검색으로 직접 추가하기</CardTitle>
                <CardDescription>AI 추천 외에 원하는 곡을 찾아 플레이리스트에 추가해 보세요.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="곡 제목, 아티스트 등을 입력하세요"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSearchTracks();
                      }
                    }}
                  />
                  <Button onClick={handleSearchTracks} disabled={isSearching}>
                    {isSearching ? '검색 중...' : '검색'}
                  </Button>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {searchResults.map((track) => (
                    <div key={track.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{track.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {track.artists.join(', ')} • {track.album}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddTrack(track)}
                        disabled={selectedTracks.some((t) => t.id === track.id)}
                      >
                        {selectedTracks.some((t) => t.id === track.id) ? '추가됨' : '추가'}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <PlaylistDisplay
              playlist={playlistForDisplay}
              isLoading={isGenerating && !playlistForDisplay}
              onSaveToSpotify={handleSavePlaylistToSpotify}
              onRegenerate={lastPreferences ? handleRegeneratePlaylist : undefined}
              onRemoveTrack={handleRemoveTrack}
              allowTrackRemoval
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
