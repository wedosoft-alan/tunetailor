import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import PlaylistGenerator from '@/components/PlaylistGenerator';
import PlaylistDisplay from '@/components/PlaylistDisplay';
import PlaylistScheduler from '@/components/PlaylistScheduler';
import { notificationService } from '@/services/notificationService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

//todo: remove mock functionality
const mockPlaylist = {
  id: '1',
  name: 'AI Generated Mix',
  description: 'A personalized playlist created based on your preferences',
  totalDuration: 2840,
  createdAt: new Date(),
  tracks: [
    {
      id: '1',
      name: 'Don\'t Stop Me Now',
      artists: ['Queen'],
      album: 'Jazz',
      duration: 209,
      imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop'
    },
    {
      id: '2',
      name: 'Uptown Funk',
      artists: ['Mark Ronson', 'Bruno Mars'],
      album: 'Uptown Special',
      duration: 270,
      imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop'
    },
    {
      id: '3',
      name: 'Good as Hell',
      artists: ['Lizzo'],
      album: 'Cuz I Love You',
      duration: 219,
      imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=300&fit=crop'
    },
    {
      id: '4',
      name: 'Blinding Lights',
      artists: ['The Weeknd'],
      album: 'After Hours',
      duration: 200,
      imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop'
    },
    {
      id: '5',
      name: 'Levitating',
      artists: ['Dua Lipa'],
      album: 'Future Nostalgia',
      duration: 203,
      imageUrl: 'https://images.unsplash.com/photo-1571974599782-87624638275a?w=300&h=300&fit=crop'
    }
  ]
};

export default function Home() {
  const [isConnectedToSpotify, setIsConnectedToSpotify] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [playlist, setPlaylist] = useState<typeof mockPlaylist | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | undefined>(undefined);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [activeTab, setActiveTab] = useState('generate');

  useEffect(() => {
    // Initialize notification service
    notificationService.init();
    setNotificationPermission(notificationService.getPermission());
  }, []);

  const handleConnectSpotify = async () => {
    console.log('Connecting to Spotify...');
    
    try {
      // Test Spotify connection
      const response = await fetch('/api/spotify/test');
      const data = await response.json();
      
      if (data.connected) {
        setIsConnectedToSpotify(true);
        console.log('Connected to Spotify!');
      } else {
        console.error('Spotify connection failed:', data.error);
        // For demo, still set as connected
        setIsConnectedToSpotify(true);
      }
    } catch (error) {
      console.error('Error testing Spotify connection:', error);
      // For demo, still set as connected
      setIsConnectedToSpotify(true);
    }
  };

  const handleDisconnectSpotify = () => {
    setIsConnectedToSpotify(false);
    setPlaylist(null);
    console.log('Disconnected from Spotify');
  };

  const handleGeneratePlaylist = async (preferences: string) => {
    console.log('Generating playlist with preferences:', preferences);
    setIsGenerating(true);
    setPlaylist(null);
    
    try {
      const response = await fetch('/api/generate-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          preferences, 
          userId: 'demo-user' // TODO: implement proper user system
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setPlaylist(data.playlist);
        
        // Show notification if permission granted
        if (notificationPermission === 'granted') {
          await notificationService.showPlaylistNotification(
            data.playlist.name,
            data.playlist.tracks.length
          );
        }
      } else {
        console.error('Failed to generate playlist:', data.error);
        // Fallback to mock data for demo
        const generatedPlaylist = {
          ...mockPlaylist,
          name: `${preferences.split(' ')[0]} Mix`,
          description: `A personalized playlist based on: "${preferences}"`
        };
        setPlaylist(generatedPlaylist);
      }
    } catch (error) {
      console.error('Error generating playlist:', error);
      // Fallback to mock data for demo
      const generatedPlaylist = {
        ...mockPlaylist,
        name: `${preferences.split(' ')[0]} Mix`,
        description: `A personalized playlist based on: "${preferences}"`
      };
      setPlaylist(generatedPlaylist);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = (trackId: string) => {
    setCurrentlyPlaying(prev => prev === trackId ? undefined : trackId);
    console.log('Playing track:', trackId);
  };

  const handleSaveToSpotify = (playlist: any) => {
    console.log('Saving playlist to Spotify:', playlist.name);
    // Simulate saving
  };

  const handleRegenerate = () => {
    console.log('Regenerating playlist...');
    setIsGenerating(true);
    setPlaylist(null);
    setTimeout(() => {
      setPlaylist(mockPlaylist);
      setIsGenerating(false);
    }, 3000);
  };

  const handleScheduleUpdate = async (settings: any) => {
    console.log('Updating schedule:', settings);
    
    if (settings.enabled) {
      try {
        const response = await fetch('/api/schedules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...settings,
            userId: 'demo-user' // TODO: implement proper user system
          })
        });

        const data = await response.json();
        console.log('Schedule saved:', data);
      } catch (error) {
        console.error('Error saving schedule:', error);
      }
    }
  };

  const handleRequestNotificationPermission = async () => {
    const permission = await notificationService.requestPermission();
    setNotificationPermission(permission);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        isConnectedToSpotify={isConnectedToSpotify}
        onConnectSpotify={handleConnectSpotify}
        onDisconnectSpotify={handleDisconnectSpotify}
      />
      
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
            <TabsTrigger value="generate" data-testid="tab-generate">플레이리스트 생성</TabsTrigger>
            <TabsTrigger value="schedule" data-testid="tab-schedule">자동 스케줄</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-8">
            <PlaylistGenerator 
              onGenerate={handleGeneratePlaylist}
              isLoading={isGenerating}
              isConnectedToSpotify={isConnectedToSpotify}
            />
            
            {(isGenerating || playlist) && (
              <PlaylistDisplay 
                playlist={playlist || undefined}
                isLoading={isGenerating}
                currentlyPlaying={currentlyPlaying}
                onPlayPause={handlePlayPause}
                onSaveToSpotify={handleSaveToSpotify}
                onRegenerate={handleRegenerate}
              />
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-8">
            <PlaylistScheduler
              onScheduleUpdate={handleScheduleUpdate}
              notificationPermission={notificationPermission}
              onRequestNotificationPermission={handleRequestNotificationPermission}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}