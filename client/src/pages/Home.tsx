import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import PlaylistGenerator from '@/components/PlaylistGenerator';
import PlaylistDisplay from '@/components/PlaylistDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
}

interface GeneratedPlaylist {
  id: string;
  name: string;
  description?: string;
  tracks: GeneratedTrack[];
  totalDuration: number;
  createdAt: string | number | Date;
  usedFallback?: boolean;
}

export default function Home() {
  const [isConnectedToSpotify, setIsConnectedToSpotify] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlaylist, setGeneratedPlaylist] = useState<GeneratedPlaylist | null>(null);
  const [lastPreferences, setLastPreferences] = useState('');
  const [generateError, setGenerateError] = useState<string | null>(null);

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
        setGeneratedPlaylist(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsCheckingAuth(false);
    }
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
      setGeneratedPlaylist(null);
      setLastPreferences('');
      setGenerateError(null);
    }
  };

  const normalizeTrack = (track: any): GeneratedTrack => {
    const artists = Array.isArray(track.artists)
      ? track.artists
      : track.artists
        ? [track.artists]
        : ['Unknown Artist'];

    const durationSeconds = typeof track.duration === 'number'
      ? (track.duration > 1000 ? Math.round(track.duration / 1000) : Math.round(track.duration))
      : 0;

    return {
      id: track.id,
      name: track.name,
      artists,
      album: track.album || 'Unknown Album',
      duration: durationSeconds,
      imageUrl: track.imageUrl,
      previewUrl: track.previewUrl,
      spotifyUrl: track.spotifyUrl,
      spotifyId: track.spotifyId ?? track.id,
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
        body: JSON.stringify({ preferences })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate playlist: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.playlist) {
        throw new Error(data.error || 'Playlist payload missing');
      }

      const normalizedTracks = Array.isArray(data.playlist.tracks)
        ? data.playlist.tracks.map(normalizeTrack)
        : [];

      const totalDuration = normalizedTracks.reduce((sum, track) => sum + track.duration, 0);

      setGeneratedPlaylist({
        id: data.playlist.id,
        name: data.playlist.name,
        description: data.playlist.description,
        tracks: normalizedTracks,
        totalDuration,
        createdAt: data.playlist.createdAt ?? new Date().toISOString(),
        usedFallback: data.playlist.usedFallback,
      });

      if (data.playlist.usedFallback) {
        toast({
          title: '참고',
          description: 'Spotify 추천이 실패하여 예시 곡으로 플레이리스트를 구성했습니다.',
        });
      }
    } catch (error) {
      console.error('Error generating playlist:', error);
      setGenerateError('AI 플레이리스트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      toast({
        title: '생성 실패',
        description: '플레이리스트를 생성하지 못했습니다. 환경 변수와 OpenAI/Spotify 설정을 확인해주세요.',
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

  const handleSavePlaylistToSpotify = async (playlist: GeneratedPlaylist) => {
    const response = await fetch('/api/create-playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlistName: playlist.name,
        description: playlist.description,
        tracks: playlist.tracks,
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to save playlist: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Spotify playlist creation failed');
    }

    toast({
      title: 'Spotify에 저장 완료',
      description: `"${playlist.name}" 플레이리스트가 Spotify에 생성되었습니다.`,
    });

    if (data.playlist?.url) {
      window.open(data.playlist.url, '_blank');
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
                <CardDescription>
                  {spotifyUser.email}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
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
            />

            {generateError ? (
              <Alert variant="destructive">
                <AlertTitle>생성 실패</AlertTitle>
                <AlertDescription>{generateError}</AlertDescription>
              </Alert>
            ) : null}

            {generatedPlaylist?.usedFallback ? (
              <Alert>
                <AlertTitle>참고</AlertTitle>
                <AlertDescription>
                  외부 API 응답이 없어서 예시 곡으로 플레이리스트를 채웠습니다. API 키와 권한을 확인해주세요.
                </AlertDescription>
              </Alert>
            ) : null}

            <PlaylistDisplay
              playlist={generatedPlaylist ?? undefined}
              isLoading={isGenerating && !generatedPlaylist}
              onSaveToSpotify={handleSavePlaylistToSpotify}
              onRegenerate={lastPreferences ? handleRegeneratePlaylist : undefined}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
