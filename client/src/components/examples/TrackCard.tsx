import TrackCard from '../TrackCard';

export default function TrackCardExample() {
  const sampleTrack = {
    id: '1',
    name: 'Don\'t Stop Me Now',
    artists: ['Queen'],
    album: 'Jazz',
    duration: 209,
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
    previewUrl: 'https://example.com/preview',
    spotifyUrl: 'https://open.spotify.com/track/example'
  };

  return (
    <div className="p-4 max-w-md">
      <TrackCard 
        track={sampleTrack}
        onPlayPause={(id) => console.log('Play/pause track:', id)}
      />
    </div>
  );
}