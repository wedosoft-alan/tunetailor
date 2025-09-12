import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, ExternalLink, Clock } from 'lucide-react';

interface Track {
  id: string;
  name: string;
  artists: string[];
  album: string;
  duration: number; // in seconds
  imageUrl?: string;
  previewUrl?: string;
  spotifyUrl?: string;
}

interface TrackCardProps {
  track: Track;
  isPlaying?: boolean;
  onPlayPause?: (trackId: string) => void;
}

export default function TrackCard({ track, isPlaying = false, onPlayPause }: TrackCardProps) {
  const [imageError, setImageError] = useState(false);
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    onPlayPause?.(track.id);
    console.log(`${isPlaying ? 'Pausing' : 'Playing'} track:`, track.name);
  };

  const handleOpenInSpotify = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Opening in Spotify:', track.name);
    if (track.spotifyUrl) {
      window.open(track.spotifyUrl, '_blank');
    }
  };

  return (
    <Card className="group hover-elevate cursor-pointer transition-all duration-200" data-testid={`card-track-${track.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Album Art & Play Button */}
          <div className="relative">
            <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
              {track.imageUrl && !imageError ? (
                <img 
                  src={track.imageUrl}
                  alt={`${track.album} album cover`}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                  data-testid={`img-album-${track.id}`}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <div className="w-6 h-6 bg-muted-foreground/20 rounded" />
                </div>
              )}
            </div>
            
            {/* Play/Pause Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
              <Button
                size="icon"
                variant="ghost"
                onClick={handlePlayPause}
                className="w-8 h-8 text-white hover:text-primary"
                data-testid={`button-play-${track.id}`}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate" data-testid={`text-track-name-${track.id}`}>
              {track.name}
            </h3>
            <p className="text-sm text-muted-foreground truncate" data-testid={`text-artists-${track.id}`}>
              {track.artists.join(', ')}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5" data-testid={`text-album-${track.id}`}>
              {track.album}
            </p>
          </div>

          {/* Duration & Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span data-testid={`text-duration-${track.id}`}>{formatDuration(track.duration)}</span>
            </div>
            
            <Button
              size="icon"
              variant="ghost"
              onClick={handleOpenInSpotify}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8"
              data-testid={`button-spotify-${track.id}`}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}