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
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: Track[];
  totalDuration: number;
  createdAt: Date;
}

interface PlaylistDisplayProps {
  playlist?: Playlist;
  isLoading?: boolean;
  onSaveToSpotify?: (playlist: Playlist) => void;
  onRegenerate?: () => void;
  currentlyPlaying?: string;
  onPlayPause?: (trackId: string) => void;
}

export default function PlaylistDisplay({ 
  playlist, 
  isLoading = false,
  onSaveToSpotify,
  onRegenerate,
  currentlyPlaying,
  onPlayPause
}: PlaylistDisplayProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto" data-testid="card-loading">
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Creating Your Playlist</h3>
              <p className="text-muted-foreground">Finding the perfect tracks based on your taste...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!playlist) {
    return null;
  }

  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleSave = async () => {
    setIsSaving(true);
    console.log('Saving playlist to Spotify:', playlist.name);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
    onSaveToSpotify?.(playlist);
    setIsSaving(false);
  };

  const handleRegenerate = () => {
    console.log('Regenerating playlist');
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
                    {playlist.tracks.length} tracks
                  </Badge>
                  <Badge variant="secondary" className="text-xs" data-testid="badge-duration">
                    {formatTotalDuration(playlist.totalDuration)}
                  </Badge>
                  <Badge variant="outline" className="text-xs" data-testid="badge-created">
                    Created {playlist.createdAt.toLocaleDateString()}
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
                data-testid="button-regenerate"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="min-w-24"
                data-testid="button-save"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
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
            <CardTitle className="text-lg">Tracks</CardTitle>
            <Button variant="ghost" size="sm" data-testid="button-shuffle">
              <Shuffle className="w-4 h-4 mr-2" />
              Shuffle
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
                  track={track}
                  isPlaying={currentlyPlaying === track.id}
                  onPlayPause={onPlayPause}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}