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
    "아침 운동에 좋은 신나는 팝 음악",
    "공부할 때 듣는 차분한 인디 음악",
    "드라이브를 위한 90년대 록 히트곡",
    "저녁 식사 때 듣는 편안한 재즈"
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
              완벽한 플레이리스트를 설명해주세요
            </CardTitle>
            <CardDescription className="text-base mt-2" data-testid="description-generator">
              현재 기분, 좋아하는 장르, 활동, 또는 선호하는 아티스트를 알려주세요
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Textarea
              placeholder="예시: 아침 조깅에 완벽한 신나는 팝과 록 음악을 원해요. 두아 리파나 더 킬러스 같이 기운이 나는 곡들로요..."
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              rows={4}
              className="resize-none text-base"
              data-testid="input-preferences"
            />
            <div className="text-xs text-muted-foreground text-right">
              {preferences.length}/500자
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">이런 예시들을 참고해보세요:</p>
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
                  플레이리스트 생성 중...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  플레이리스트 생성
                </>
              )}
            </Button>
            
            {!isConnectedToSpotify && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                플레이리스트를 생성하려면 스포티파이 계정을 연결하세요
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}