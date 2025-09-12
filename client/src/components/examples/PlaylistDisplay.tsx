//todo: remove mock functionality
import PlaylistDisplay from '../PlaylistDisplay';

export default function PlaylistDisplayExample() {
  const mockPlaylist = {
    id: '1',
    name: 'Morning Energy Mix',
    description: 'Upbeat pop songs perfect for morning workouts and getting energized',
    totalDuration: 2840, // ~47 minutes
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
      }
    ]
  };

  return (
    <div className="p-8 bg-background">
      <PlaylistDisplay 
        playlist={mockPlaylist}
        onSaveToSpotify={(playlist) => console.log('Saving:', playlist.name)}
        onRegenerate={() => console.log('Regenerating playlist')}
        onPlayPause={(id) => console.log('Play/pause:', id)}
      />
    </div>
  );
}