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
      <Card className="w-full max-w-4xl mx-auto" data-testid="card-loading">
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
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Playlist Header */}
      <Card data-testid="card-playlist-header">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Music2 className="w-8 h-8 text-primary" data-testid="icon-playlist" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl font-display mb-2" data-testid="text-playlist-name">
                  {playlist.name}
                </CardTitle>
                {playlist.description && (
                  <CardDescription className="text-base mb-3" data-testid="text-playlist-description">
                    {playlist.description}
                  </CardDescription>
                )}
                <div className="flex items-center gap-4 flex-wrap">
                  <Badge variant="secondary" className="text-xs" data-testid="badge-track-count">
                    {playlist.tracks.length}곡
                  </Badge>
                  <Badge variant="secondary" className="text-xs" data-testid="badge-duration">
                    {formatTotalDuration(normalizedTotalDuration)}
                  </Badge>
                  <Badge variant="outline" className="text-xs" data-testid="badge-created">
                    생성일: {new Date(playlist.createdAt).toLocaleDateString('ko-KR')}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isLoading}
                data-testid="button-regenerate"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                다시 생성
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="min-w-24"
                data-testid="button-save"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">트랙 목록</CardTitle>
            <Button variant="ghost" size="sm" data-testid="button-shuffle">
              <Shuffle className="w-4 h-4 mr-2" />
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
