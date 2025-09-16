import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string };
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  external_urls: { spotify: string };
}

export default function Home() {
  const [isConnectedToSpotify, setIsConnectedToSpotify] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<SpotifyTrack[]>([]);
  const [createdPlaylist, setCreatedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();

      if (data.authenticated) {
        setIsConnectedToSpotify(true);
        setSpotifyUser(data.user);

        // Get access token
        const tokenResponse = await fetch('/api/auth/token');
        const tokenData = await tokenResponse.json();
        setAccessToken(tokenData.access_token);
      } else {
        setIsConnectedToSpotify(false);
        setSpotifyUser(null);
        setAccessToken(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  const handleConnectSpotify = () => {
    window.location.href = '/api/auth/spotify/login';
  };

  const handleDisconnectSpotify = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      setIsConnectedToSpotify(false);
      setSpotifyUser(null);
      setAccessToken(null);
      setSearchResults([]);
      setSelectedTracks([]);
      setCreatedPlaylist(null);
    } catch (error) {
      console.error('Error disconnecting Spotify:', error);
    }
  };

  // Search tracks using Spotify Web API
  const searchTracks = async () => {
    if (!accessToken || !searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data.tracks.items);
    } catch (error) {
      console.error('Error searching tracks:', error);
      alert('Failed to search tracks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add track to selected list
  const addTrack = (track: SpotifyTrack) => {
    if (!selectedTracks.find(t => t.id === track.id)) {
      setSelectedTracks([...selectedTracks, track]);
    }
  };

  // Remove track from selected list
  const removeTrack = (trackId: string) => {
    setSelectedTracks(selectedTracks.filter(t => t.id !== trackId));
  };

  // Create playlist using Spotify Web API
  const createPlaylist = async () => {
    if (!accessToken || !spotifyUser || !playlistName.trim() || selectedTracks.length === 0) {
      alert('Please provide a playlist name and select at least one track.');
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Create empty playlist
      const createResponse = await fetch(
        `https://api.spotify.com/v1/users/${spotifyUser.id}/playlists`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: playlistName,
            description: playlistDescription || 'Created with Tune Tailor',
            public: false
          })
        }
      );

      if (!createResponse.ok) {
        throw new Error('Failed to create playlist');
      }

      const playlist = await createResponse.json();

      // Step 2: Add tracks to playlist
      const trackUris = selectedTracks.map(track => `spotify:track:${track.id}`);

      const addTracksResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            uris: trackUris
          })
        }
      );

      if (!addTracksResponse.ok) {
        throw new Error('Failed to add tracks to playlist');
      }

      setCreatedPlaylist(playlist);
      alert(`Playlist "${playlist.name}" created successfully!`);

      // Reset form
      setPlaylistName('');
      setPlaylistDescription('');
      setSelectedTracks([]);
      setSearchResults([]);
      setSearchQuery('');

    } catch (error) {
      console.error('Error creating playlist:', error);
      alert('Failed to create playlist. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {!isConnectedToSpotify ? (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Connect to Spotify</CardTitle>
              <CardDescription>
                Connect your Spotify account to create playlists
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleConnectSpotify} className="w-full">
                Connect Spotify
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Welcome, {spotifyUser?.display_name}!</CardTitle>
                <CardDescription>
                  Connected to Spotify • {spotifyUser?.email}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleDisconnectSpotify} variant="outline">
                  Disconnect Spotify
                </Button>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Search and Select Tracks */}
              <Card>
                <CardHeader>
                  <CardTitle>Search Tracks</CardTitle>
                  <CardDescription>
                    Search for tracks to add to your playlist
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search for songs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchTracks()}
                    />
                    <Button onClick={searchTracks} disabled={isLoading}>
                      Search
                    </Button>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {searchResults.map((track) => (
                      <div key={track.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1">
                          <p className="font-medium">{track.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {track.artists.map(artist => artist.name).join(', ')} • {track.album.name}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addTrack(track)}
                          disabled={selectedTracks.some(t => t.id === track.id)}
                        >
                          {selectedTracks.some(t => t.id === track.id) ? 'Added' : 'Add'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Create Playlist */}
              <Card>
                <CardHeader>
                  <CardTitle>Create Playlist</CardTitle>
                  <CardDescription>
                    Selected tracks: {selectedTracks.length}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="playlist-name">Playlist Name</Label>
                    <Input
                      id="playlist-name"
                      placeholder="My awesome playlist"
                      value={playlistName}
                      onChange={(e) => setPlaylistName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="playlist-description">Description (optional)</Label>
                    <Input
                      id="playlist-description"
                      placeholder="Created with Tune Tailor"
                      value={playlistDescription}
                      onChange={(e) => setPlaylistDescription(e.target.value)}
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {selectedTracks.map((track) => (
                      <div key={track.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{track.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {track.artists.map(artist => artist.name).join(', ')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeTrack(track.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={createPlaylist}
                    disabled={isLoading || !playlistName.trim() || selectedTracks.length === 0}
                    className="w-full"
                  >
                    {isLoading ? 'Creating...' : 'Create Playlist'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {createdPlaylist && (
              <Card>
                <CardHeader>
                  <CardTitle>✅ Playlist Created!</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-2">
                    <strong>{createdPlaylist.name}</strong> has been created successfully.
                  </p>
                  <Button asChild>
                    <a
                      href={createdPlaylist.external_urls.spotify}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in Spotify
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}