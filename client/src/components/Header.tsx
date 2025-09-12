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
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50" data-testid="header">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Music className="w-6 h-6 text-primary" data-testid="logo-icon" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground" data-testid="app-title">
                플레이리스트 생성기
              </h1>
              <p className="text-sm text-muted-foreground">AI와 스포티파이 기반</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Spotify Connection Status */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                isConnectedToSpotify 
                  ? 'bg-primary/10 text-primary border border-primary/20' 
                  : 'bg-muted text-muted-foreground border border-border'
              }`} data-testid="connection-status">
                <div className={`w-2 h-2 rounded-full ${
                  isConnectedToSpotify ? 'bg-primary' : 'bg-muted-foreground'
                }`} />
                {isConnectedToSpotify ? '연결됨' : '연결 안됨'}
              </div>
              
              <Button 
                variant={isConnectedToSpotify ? "secondary" : "default"}
                size="sm"
                onClick={handleSpotifyAction}
                data-testid="button-spotify-connect"
              >
                {isConnectedToSpotify ? '연결 해제' : '스포티파이 연결'}
              </Button>
            </div>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" data-testid="icon-sun" />
              ) : (
                <Moon className="w-4 h-4" data-testid="icon-moon" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}