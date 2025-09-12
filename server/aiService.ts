import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5';

export interface PlaylistPreferences {
  genres: string[];
  mood: 'happy' | 'sad' | 'energetic' | 'calm' | 'party' | 'chill';
  energy: number; // 0.0 - 1.0
  danceability: number; // 0.0 - 1.0
  valence: number; // 0.0 - 1.0 (positivity)
  artists?: string[];
  activities?: string[];
  keywords: string[];
}

class AIService {
  async analyzePreferences(userInput: string): Promise<PlaylistPreferences> {
    try {
      const systemPrompt = `You are a music preference analyzer. Given a user's description of their music taste, extract structured data for playlist generation.

Respond with a JSON object containing:
- genres: array of music genres (pop, rock, hip-hop, electronic, jazz, etc.)
- mood: one of: happy, sad, energetic, calm, party, chill
- energy: number 0.0-1.0 (how energetic the music should be)
- danceability: number 0.0-1.0 (how danceable)
- valence: number 0.0-1.0 (how positive/happy)
- artists: array of mentioned artists (if any)
- activities: array of activities mentioned (workout, study, party, etc.)
- keywords: array of important keywords from the description

Examples:
"I love upbeat pop music for morning workouts" →
{
  "genres": ["pop", "dance"],
  "mood": "energetic",
  "energy": 0.8,
  "danceability": 0.7,
  "valence": 0.8,
  "artists": [],
  "activities": ["workout"],
  "keywords": ["upbeat", "morning", "workout"]
}`;

      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from AI');
      }

      return JSON.parse(response);
    } catch (error) {
      console.error('Error analyzing preferences:', error);
      // Fallback to basic parsing
      return this.fallbackAnalysis(userInput);
    }
  }

  public fallbackAnalysis(userInput: string): PlaylistPreferences {
    const text = userInput.toLowerCase();
    
    // Basic genre detection
    const genreMap = {
      'pop': ['pop'],
      'rock': ['rock'],
      'hip-hop': ['hip-hop', 'rap'],
      'jazz': ['jazz'],
      'electronic': ['electronic', 'edm', 'techno'],
      'indie': ['indie'],
      'classical': ['classical'],
      'country': ['country'],
      'r&b': ['r&b', 'rnb']
    };

    const genres: string[] = [];
    for (const [genre, keywords] of Object.entries(genreMap)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        genres.push(genre);
      }
    }

    // Mood detection
    let mood: PlaylistPreferences['mood'] = 'happy';
    if (text.includes('sad') || text.includes('melancholy')) mood = 'sad';
    else if (text.includes('energetic') || text.includes('workout')) mood = 'energetic';
    else if (text.includes('calm') || text.includes('relax')) mood = 'calm';
    else if (text.includes('party') || text.includes('dance')) mood = 'party';
    else if (text.includes('chill')) mood = 'chill';

    // Energy mapping
    const energyMap = {
      'energetic': 0.8,
      'party': 0.9,
      'happy': 0.7,
      'chill': 0.4,
      'calm': 0.3,
      'sad': 0.4
    };

    const energy = energyMap[mood] || 0.6;
    const danceability = mood === 'party' || mood === 'energetic' ? 0.8 : 0.5;
    const valence = mood === 'sad' ? 0.3 : 0.7;

    return {
      genres: genres.length > 0 ? genres : ['pop'],
      mood,
      energy,
      danceability,
      valence,
      artists: [],
      activities: [],
      keywords: text.split(' ').slice(0, 10)
    };
  }

  async generatePlaylistName(preferences: PlaylistPreferences): Promise<string> {
    try {
      const prompt = `Generate a creative playlist name for music with these preferences:
- Genres: ${preferences.genres.join(', ')}
- Mood: ${preferences.mood}
- Keywords: ${preferences.keywords.join(', ')}

The name should be catchy and reflect the music style. Respond with just the playlist name, no quotes or extra text.`;

      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 50
      });

      return completion.choices[0]?.message?.content?.trim() || 'AI Generated Mix';
    } catch (error) {
      console.error('Error generating playlist name:', error);
      return `${preferences.mood.charAt(0).toUpperCase() + preferences.mood.slice(1)} Mix`;
    }
  }

  async generatePlaylistDescription(preferences: PlaylistPreferences, trackCount: number): Promise<string> {
    try {
      const prompt = `Write a brief, engaging description for a playlist with:
- ${trackCount} tracks
- Genres: ${preferences.genres.join(', ')}
- Mood: ${preferences.mood}
- Perfect for: ${preferences.activities?.join(', ') || 'listening'}

Keep it under 100 characters and make it appealing.`;

      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 100
      });

      return completion.choices[0]?.message?.content?.trim() || 
        `${trackCount} ${preferences.mood} tracks perfect for your day`;
    } catch (error) {
      console.error('Error generating description:', error);
      return `${trackCount} ${preferences.mood} tracks perfect for your day`;
    }
  }
}

export const aiService = new AIService();