import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Music, Moon, Sun } from 'lucide-react';

interface HeaderProps {
  isConnectedToSpotify?: boolean;
  onConnectSpotify?: () => void;
  onDisconnectSpotify?: () => void;
}

export default function Header({
  isConnectedToSpotify = false,
  onConnectSpotify,
  onDisconnectSpotify
}: HeaderProps) {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
    console.log('Theme toggled to:', !isDarkMode ? 'dark' : 'light');
  };

  const handleSpotifyAction = () => {
    if (isConnectedToSpotify) {
      onDisconnectSpotify?.();
      console.log('Disconnected from Spotify');
    } else {
      onConnectSpotify?.();
      console.log('Connecting to Spotify...');
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-card/60 backdrop-blur" data-testid="header">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Music className="h-6 w-6 text-primary" data-testid="logo-icon" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-display font-semibold text-foreground sm:text-xl" data-testid="app-title">
              Tune Tailor
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">AI와 스포티파이 기반</p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
          <Button
            size="sm"
            onClick={handleSpotifyAction}
            data-testid="button-spotify-connect"
            aria-pressed={isConnectedToSpotify}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors sm:text-sm ${
              isConnectedToSpotify
                ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-border bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                isConnectedToSpotify ? 'bg-white/90' : 'bg-muted-foreground'
              }`}
            />
            {isConnectedToSpotify ? 'Spotify 연결됨' : 'Spotify 연결하기'}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 rounded-full border border-border/60 text-muted-foreground"
            data-testid="button-theme-toggle"
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4" data-testid="icon-sun" />
            ) : (
              <Moon className="h-4 w-4" data-testid="icon-moon" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
