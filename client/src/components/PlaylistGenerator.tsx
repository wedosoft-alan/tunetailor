import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Wand2 } from 'lucide-react';

interface PlaylistGeneratorProps {
  onGenerate?: (preferences: string) => void;
  isLoading?: boolean;
  isConnectedToSpotify?: boolean;
}

export default function PlaylistGenerator({ 
  onGenerate, 
  isLoading = false,
  isConnectedToSpotify = false 
}: PlaylistGeneratorProps) {
  const [preferences, setPreferences] = useState('');

  const handleGenerate = () => {
    if (preferences.trim()) {
      onGenerate?.(preferences);
      console.log('Generating playlist with preferences:', preferences);
    }
  };

  const suggestionExamples = [
    "Upbeat pop songs for morning workout",
    "Chill indie music for studying",
    "90s rock hits for road trip",
    "Relaxing jazz for evening dinner"
  ];

  const handleSuggestionClick = (suggestion: string) => {
    setPreferences(suggestion);
    console.log('Selected suggestion:', suggestion);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid="card-generator">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-3 bg-primary/10 rounded-full w-fit">
            <Wand2 className="w-8 h-8 text-primary" data-testid="icon-generator" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display text-foreground" data-testid="title-generator">
              Describe Your Perfect Playlist
            </CardTitle>
            <CardDescription className="text-base mt-2" data-testid="description-generator">
              Tell us about your mood, favorite genres, activities, or any artists you love
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Textarea
              placeholder="E.g., I want energetic pop and rock songs perfect for a morning jog, something that gets me pumped up like Dua Lipa and The Killers..."
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              rows={4}
              className="resize-none text-base"
              data-testid="input-preferences"
            />
            <div className="text-xs text-muted-foreground text-right">
              {preferences.length}/500 characters
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Try these examples:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestionExamples.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="justify-start text-left h-auto py-2 px-3 text-xs hover-elevate"
                  data-testid={`button-suggestion-${index}`}
                >
                  <Sparkles className="w-3 h-3 mr-2 text-primary" />
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleGenerate}
              disabled={!preferences.trim() || isLoading || !isConnectedToSpotify}
              className="w-full h-12 text-base font-medium"
              data-testid="button-generate"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                  Creating Your Playlist...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Playlist
                </>
              )}
            </Button>
            
            {!isConnectedToSpotify && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Connect your Spotify account to generate playlists
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}