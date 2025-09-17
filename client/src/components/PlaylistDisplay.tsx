import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Music2, Save, Shuffle, RotateCcw } from 'lucide-react';
import TrackCard from './TrackCard';

interface Track {
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

interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: Track[];
  totalDuration: number;
  createdAt: string | number | Date;
  usedFallback?: boolean;
}

interface PlaylistDisplayProps {
  playlist?: Playlist;
  isLoading?: boolean;
  onSaveToSpotify?: (playlist: Playlist) => Promise<void> | void;
  onRegenerate?: () => void;
  currentlyPlaying?: string;
  onPlayPause?: (trackId: string) => void;
  onRemoveTrack?: (trackId: string) => void;
  allowTrackRemoval?: boolean;
}

export default function PlaylistDisplay({ 
  playlist, 
  isLoading = false,
  onSaveToSpotify,
  onRegenerate,
  currentlyPlaying,
  onPlayPause,
  onRemoveTrack,
  allowTrackRemoval = false
}: PlaylistDisplayProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (isLoading) {
    return (
      <Card className="mx-auto w-full max-w-3xl" data-testid="card-loading">
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">플레이리스트 생성 중</h3>
              <p className="text-muted-foreground">선호도에 맞는 완벽한 곡들을 찾는 중...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!playlist) {
    return null;
  }

  const normalizeSeconds = (value: number) =>
    value > 1000 ? Math.round(value / 1000) : Math.round(value);

  const normalizedTotalDuration = normalizeSeconds(playlist.totalDuration);

  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleSave = async () => {
    if (!onSaveToSpotify) return;

    setIsSaving(true);
    try {
      await onSaveToSpotify(playlist);
    } catch (error) {
      console.error('Failed to save playlist to Spotify:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = () => {
    if (isLoading) return;
    onRegenerate?.();
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Playlist Header */}
      <Card data-testid="card-playlist-header">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-1 items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Music2 className="h-8 w-8 text-primary" data-testid="icon-playlist" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <CardTitle className="font-display text-xl sm:text-2xl" data-testid="text-playlist-name">
                    {playlist.name}
                  </CardTitle>
                  {playlist.description ? (
                    <CardDescription className="mt-2 text-sm sm:text-base" data-testid="text-playlist-description">
                      {playlist.description}
                    </CardDescription>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <Badge variant="secondary" className="text-xs sm:text-sm" data-testid="badge-track-count">
                    {playlist.tracks.length}곡
                  </Badge>
                  <Badge variant="secondary" className="text-xs sm:text-sm" data-testid="badge-duration">
                    {formatTotalDuration(normalizedTotalDuration)}
                  </Badge>
                  <Badge variant="outline" className="text-xs sm:text-sm" data-testid="badge-created">
                    생성일 {new Date(playlist.createdAt).toLocaleDateString('ko-KR')}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isLoading}
                className="h-10 w-full sm:w-auto"
                data-testid="button-regenerate"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                다시 생성
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="h-10 w-full sm:min-w-24 sm:w-auto"
                data-testid="button-save"
              >
                {isSaving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    저장
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Track List */}
      <Card data-testid="card-track-list">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-lg">트랙 목록</CardTitle>
            <Button variant="ghost" size="sm" className="h-9" data-testid="button-shuffle">
              <Shuffle className="mr-2 h-4 w-4" />
              셔플
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {playlist.tracks.map((track, index) => (
            <div key={track.id} className="flex items-center gap-3">
              <div className="w-6 text-center text-sm text-muted-foreground flex-shrink-0" data-testid={`text-track-number-${index}`}>
                {index + 1}
              </div>
              <div className="flex-1">
                <TrackCard
                  track={{ ...track, duration: normalizeSeconds(track.duration) }}
                  isPlaying={currentlyPlaying === track.id}
                  onPlayPause={onPlayPause}
                />
              </div>
              {allowTrackRemoval ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveTrack?.(track.id)}
                >
                  제거
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
