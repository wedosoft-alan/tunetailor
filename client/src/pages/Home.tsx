import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '@/components/Header';
import PlaylistGenerator from '@/components/PlaylistGenerator';
import PlaylistDisplay from '@/components/PlaylistDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';
import { ChevronDown } from 'lucide-react';

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
  const [isSearchSectionOpen, setIsSearchSectionOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GeneratedTrack[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const suggestionController = useRef<AbortController | null>(null);

  useEffect(() => {
    void checkAuthStatus();
  }, []);

  useEffect(() => {
    if (window.innerWidth >= 640) {
      setIsSearchSectionOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!isConnectedToSpotify) {
      suggestionController.current?.abort();
      suggestionController.current = null;
      setSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      suggestionController.current?.abort();
      suggestionController.current = null;
      setSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      suggestionController.current?.abort();
      const controller = new AbortController();
      suggestionController.current = controller;
      setIsSuggesting(true);

      try {
        const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(trimmed)}&limit=6`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }

        const data = await response.json();
        const suggestionTracks = Array.isArray(data.tracks)
          ? data.tracks.map((track: any) => normalizeTrack(track, 'manual'))
          : [];
        setSuggestions(suggestionTracks);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error fetching suggestions:', error);
          setSuggestions([]);
        }
      } finally {
        if (suggestionController.current === controller) {
          suggestionController.current = null;
        }
        setIsSuggesting(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      suggestionController.current?.abort();
      suggestionController.current = null;
    };
  }, [searchQuery, isConnectedToSpotify]);

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
    suggestionController.current?.abort();
    suggestionController.current = null;
    setSuggestions([]);
    setIsSuggesting(false);
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
    suggestionController.current?.abort();
    suggestionController.current = null;
    setIsSuggesting(false);
    setSuggestions([]);
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
    setSuggestions((prev) => prev.filter((t) => t.id !== track.id));
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
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-32 pt-6 sm:space-y-8 sm:pb-20 sm:pt-8">
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
          <div className="space-y-6 sm:space-y-8">
            <Card className="border-border/60 bg-card/70 shadow-sm">
              <CardHeader className="space-y-1 pb-3">
                <CardTitle className="text-lg sm:text-xl">환영합니다, {spotifyUser.display_name}님</CardTitle>
                <CardDescription className="text-sm text-muted-foreground sm:text-base">
                  {spotifyUser.email}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Spotify 계정이 연결되었습니다. 지금 원하는 분위기나 상황을 알려주시면 맞춤 플레이리스트를 만들어 드릴게요.
                </p>
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

            <Collapsible open={isSearchSectionOpen} onOpenChange={setIsSearchSectionOpen}>
              <Card className="border-border/60 bg-card/60 shadow-sm">
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg sm:text-xl">원하는 곡 검색</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        필요한 곡을 빠르게 검색해 플레이리스트에 바로 추가하세요.
                      </CardDescription>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-9 w-9 rounded-full border border-border/60 transition-transform ${
                          isSearchSectionOpen ? 'rotate-180' : 'rotate-0'
                        }`}
                        aria-label={isSearchSectionOpen ? '검색 영역 접기' : '검색 영역 펼치기'}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>
                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                  <CardContent className="space-y-4 pt-0 sm:pt-2">
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row">
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
                          className="h-11 min-w-0 flex-1"
                        />
                        <Button
                          onClick={handleSearchTracks}
                          disabled={isSearching}
                          className="h-11 px-4 sm:w-auto"
                        >
                          {isSearching ? '검색 중...' : '검색'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        검색 후 원하는 곡을 선택하면 플레이리스트에 바로 추가됩니다.
                      </p>
                    </div>

                    {isSuggesting ? (
                      <p className="text-xs text-muted-foreground">자동 완성 검색 중...</p>
                    ) : null}

                    {suggestions.length > 0 ? (
                      <div className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-3">
                        <p className="text-xs font-medium text-muted-foreground sm:text-sm">바로 추가할 수 있는 추천 곡</p>
                        <div className="space-y-2">
                          {suggestions.map((track) => {
                            const alreadyAdded = selectedTracks.some((t) => t.id === track.id);
                            return (
                              <button
                                key={track.id}
                                type="button"
                                onClick={() => handleAddTrack(track)}
                                disabled={alreadyAdded}
                                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                  alreadyAdded
                                    ? 'border-border bg-muted/30 text-muted-foreground'
                                    : 'border-border/60 bg-card/80 hover:bg-card'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium sm:text-base">{track.name}</p>
                                  <p className="truncate text-xs text-muted-foreground sm:text-sm">
                                    {track.artists.join(', ')} • {track.album}
                                  </p>
                                </div>
                                <span className="text-xs font-semibold text-primary">
                                  {alreadyAdded ? '추가됨' : '추가'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {searchResults.length > 0 ? (
                      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        {searchResults.map((track) => {
                          const alreadyAdded = selectedTracks.some((t) => t.id === track.id);
                          return (
                            <div
                              key={track.id}
                              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium sm:text-base">{track.name}</p>
                                <p className="truncate text-xs text-muted-foreground sm:text-sm">
                                  {track.artists.join(', ')} • {track.album}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant={alreadyAdded ? 'outline' : 'default'}
                                onClick={() => handleAddTrack(track)}
                                disabled={alreadyAdded}
                              >
                                {alreadyAdded ? '추가됨' : '추가'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {searchResults.length === 0 && suggestions.length === 0 && !isSearching ? (
                      <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground sm:text-sm">
                        검색 결과가 여기에 표시됩니다.
                      </p>
                    ) : null}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

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
