import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Using stable OpenAI model for reliable Korean language support
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

export interface PlaylistPreferences {
  genres: string[];
  mood: 'happy' | 'sad' | 'energetic' | 'calm' | 'party' | 'chill';
  energy: number; // 0.0 - 1.0
  danceability: number; // 0.0 - 1.0
  valence: number; // 0.0 - 1.0 (positivity)
  artists?: string[];
  activities?: string[];
  keywords: string[];
  // Optional year range, e.g., [1990, 1999]
  years?: [number, number];
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

      console.log('🤖 Calling OpenAI with model:', OPENAI_MODEL);
      console.log('🔑 API Key exists:', !!process.env.OPENAI_API_KEY);

      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput }
        ],
        max_completion_tokens: 1000,
        response_format: { type: "json_object" }
      });

      console.log('✅ OpenAI Response received:', {
        id: completion.id,
        model: completion.model,
        choices_length: completion.choices?.length,
        first_choice: completion.choices[0]?.message?.content ? '📝 Content exists' : '❌ No content'
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        console.error('❌ Empty OpenAI response:', {
          completion_id: completion.id,
          choices: completion.choices,
          usage: completion.usage
        });
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
      const prompt = `다음 음악 취향에 맞는 창의적인 한국어 플레이리스트 제목을 생성해주세요:
- 장르: ${preferences.genres.join(', ')}
- 분위기: ${preferences.mood}
- 키워드: ${preferences.keywords.join(', ')}

감성적이고 매력적인 한국어 제목을 만들어주세요. 제목만 응답하고, 따옴표나 추가 텍스트는 없이 답변해주세요.`;

      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 150
      });

      return completion.choices[0]?.message?.content?.trim() || 'AI Generated Mix';
    } catch (error) {
      console.error('Error generating playlist name:', error);
      return `${preferences.mood.charAt(0).toUpperCase() + preferences.mood.slice(1)} Mix`;
    }
  }

  async generatePlaylistDescription(preferences: PlaylistPreferences, trackCount: number): Promise<string> {
    try {
      const prompt = `한국어로 플레이리스트 설명을 작성해주세요:
- 총 ${trackCount}곡
- 장르: ${preferences.genres.join(', ')}
- 분위기: ${preferences.mood}
- 용도: ${preferences.activities?.join(', ') || '듣기'}

100자 이내로 매력적이고 감성적인 한국어 설명을 작성해주세요. 반드시 한국어로만 응답하세요.`;

      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 200
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

// Extract a year range from free text like:
// - "90년대", "1990년대"
// - "1990-1999", "2010~2015", "2012 to 2016"
// - "early 90s", "mid 2000s", "late 80s", "90s"
export function extractYearRange(text: string): { from: number; to: number } | null {
  if (!text) return null;
  const s = text.toLowerCase();

  // Helper to clamp a decade to early/mid/late buckets
  const applyBucket = (from: number, to: number) => {
    const hasEarly = /early|초반/.test(s);
    const hasMid = /mid|중반/.test(s);
    const hasLate = /late|후반/.test(s);
    if (hasEarly) return { from, to: from + 2 };
    if (hasMid) return { from: from + 3, to: from + 6 };
    if (hasLate) return { from: from + 7, to };
    return { from, to };
  };

  // 1) Explicit range: 1990-1999, 2010~2015, 2010 to 2015
  const rangeMatch = s.match(/\b(19|20)(\d{2})\s*(?:-|~|to)\s*(19|20)(\d{2})\b/);
  if (rangeMatch) {
    const y1 = parseInt(rangeMatch[1] + rangeMatch[2], 10);
    const y2 = parseInt(rangeMatch[3] + rangeMatch[4], 10);
    if (y1 <= y2) return { from: y1, to: y2 };
    return { from: y2, to: y1 };
  }

  // 2) 4-digit decade: 1990s, 1990's, 1990년대
  const decade4Match = s.match(/\b((?:19|20)\d{2})(?:s|'s)?\b|\b((?:19|20)\d{2})년대\b/);
  if (decade4Match) {
    const yearStr = (decade4Match[1] || decade4Match[2]) as string;
    if (yearStr) {
      const base = parseInt(yearStr, 10);
      const decadeStart = Math.floor(base / 10) * 10;
      const decadeEnd = decadeStart + 9;
      return applyBucket(decadeStart, decadeEnd);
    }
  }

  // 3) 2-digit decade: 90s, 80's, 90년대
  const decade2Korean = s.match(/\b(\d{2})년대\b/);
  const decade2English = s.match(/\b(\d{2})(?:s|'s)\b/);
  const decade2 = decade2Korean?.[1] || decade2English?.[1];
  if (decade2) {
    const d = parseInt(decade2, 10);
    // Heuristic: 00-29 -> 2000s, 30-99 -> 1900s
    const century = d <= 29 ? 2000 : 1900;
    const decadeStart = century + d;
    const alignedStart = Math.floor(decadeStart / 10) * 10;
    const alignedEnd = alignedStart + 9;
    return applyBucket(alignedStart, alignedEnd);
  }

  return null;
}