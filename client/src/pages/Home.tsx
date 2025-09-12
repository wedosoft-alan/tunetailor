import { useState } from 'react';
import Header from '@/components/Header';
import PlaylistGenerator from '@/components/PlaylistGenerator';
import PlaylistDisplay from '@/components/PlaylistDisplay';

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

  const handleConnectSpotify = () => {
    console.log('Connecting to Spotify...');
    // Simulate connection
    setTimeout(() => {
      setIsConnectedToSpotify(true);
      console.log('Connected to Spotify!');
    }, 1000);
  };

  const handleDisconnectSpotify = () => {
    setIsConnectedToSpotify(false);
    setPlaylist(null);
    console.log('Disconnected from Spotify');
  };

  const handleGeneratePlaylist = (preferences: string) => {
    console.log('Generating playlist with preferences:', preferences);
    setIsGenerating(true);
    setPlaylist(null);
    
    // Simulate API call
    setTimeout(() => {
      const generatedPlaylist = {
        ...mockPlaylist,
        name: `${preferences.split(' ')[0]} Mix`,
        description: `A personalized playlist based on: "${preferences}"`
      };
      setPlaylist(generatedPlaylist);
      setIsGenerating(false);
    }, 3000);
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

  return (
    <div className="min-h-screen bg-background">
      <Header 
        isConnectedToSpotify={isConnectedToSpotify}
        onConnectSpotify={handleConnectSpotify}
        onDisconnectSpotify={handleDisconnectSpotify}
      />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <PlaylistGenerator 
          onGenerate={handleGeneratePlaylist}
          isLoading={isGenerating}
          isConnectedToSpotify={isConnectedToSpotify}
        />
        
        {(isGenerating || playlist) && (
          <PlaylistDisplay 
            playlist={playlist}
            isLoading={isGenerating}
            currentlyPlaying={currentlyPlaying}
            onPlayPause={handlePlayPause}
            onSaveToSpotify={handleSaveToSpotify}
            onRegenerate={handleRegenerate}
          />
        )}
      </main>
    </div>
  );
}