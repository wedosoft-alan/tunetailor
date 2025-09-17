import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Minus, Plus, Sparkles, Wand2 } from 'lucide-react';

interface PlaylistGeneratorProps {
  onGenerate?: (preferences: string) => void;
  isLoading?: boolean;
  isConnectedToSpotify?: boolean;
  trackCount?: number;
  onTrackCountChange?: (value: number) => void;
}

export default function PlaylistGenerator({ 
  onGenerate, 
  isLoading = false,
  isConnectedToSpotify = false,
  trackCount = 15,
  onTrackCountChange
}: PlaylistGeneratorProps) {
  const [preferences, setPreferences] = useState('');

  const handleGenerate = () => {
    if (preferences.trim()) {
      onGenerate?.(preferences);
      console.log('Generating playlist with preferences:', preferences);
    }
  };

  const isGenerateDisabled = !preferences.trim() || isLoading || !isConnectedToSpotify;

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

  const handleCountChange = (value: string) => {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.max(1, Math.min(50, parsed));
      onTrackCountChange?.(clamped);
    }
  };

  const handleStep = (delta: number) => {
    const next = Math.max(1, Math.min(50, trackCount + delta));
    onTrackCountChange?.(next);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid="card-generator">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-3">
            <Wand2 className="h-7 w-7 text-primary" data-testid="icon-generator" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-display text-foreground sm:text-2xl" data-testid="title-generator">
              듣고싶은 플레이리스트를 설명해주세요
            </CardTitle>
            <CardDescription className="text-sm sm:text-base" data-testid="description-generator">
              현재 기분이나 활동, 선호 아티스트를 간단히 적어주시면 플레이리스트를 만들어드려요.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 sm:space-y-6">
          <div className="space-y-3">
            <Textarea
              placeholder="예시: 출근길에 기분 좋은 신나는 팝과 알앤비 곡이 필요해요. 두아 리파, 위켄드 느낌이면 좋겠어요."
              value={preferences}
              onChange={(e) => setPreferences(e.target.value.slice(0, 500))}
              rows={3}
              className="min-h-[120px] resize-none text-base sm:min-h-[160px]"
              data-testid="input-preferences"
            />
            <div className="text-right text-xs text-muted-foreground">
              {preferences.length}/500자
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 p-3 sm:flex sm:items-center sm:justify-between sm:space-y-0 sm:p-4">
            <div className="space-y-1">
              <Label htmlFor="track-count" className="text-sm font-medium">
                선곡 개수 (1-50)
              </Label>
              <p className="text-xs text-muted-foreground sm:text-sm">
                추천 수는 Spotify 결과에 따라 다를 수 있어요.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => handleStep(-1)}
                disabled={trackCount <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="track-count"
                type="number"
                min={1}
                max={50}
                value={trackCount}
                onChange={(e) => handleCountChange(e.target.value)}
                className="h-9 w-16 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => handleStep(1)}
                disabled={trackCount >= 50}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">원한다면 아래 예시를 눌러보세요.</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 sm:grid sm:grid-cols-2 sm:gap-2 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
              {suggestionExamples.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="h-auto min-w-[200px] justify-start whitespace-normal px-3 py-2 text-left text-xs sm:min-w-0 sm:text-sm"
                  data-testid={`button-suggestion-${index}`}
                >
                  <Sparkles className="mr-2 h-3 w-3 text-primary" />
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>

          <div className="hidden pt-4 sm:block">
            <Button
              onClick={handleGenerate}
              disabled={isGenerateDisabled}
              className="h-12 w-full text-base font-medium"
              data-testid="button-generate"
            >
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
                  플레이리스트 생성 중...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  플레이리스트 생성
                </>
              )}
            </Button>

            {!isConnectedToSpotify && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                플레이리스트를 생성하려면 스포티파이 계정을 먼저 연결하세요.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="pointer-events-none sticky bottom-0 -mx-4 sm:hidden">
        <div className="pointer-events-auto mx-auto max-w-xl rounded-t-3xl border border-border/70 bg-background/95 px-4 pb-6 pt-4 shadow-lg backdrop-blur">
          <Button
            onClick={handleGenerate}
            disabled={isGenerateDisabled}
            className="h-12 w-full text-base font-medium"
            data-testid="button-generate-mobile"
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
                생성 중...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                플레이리스트 생성
              </>
            )}
          </Button>
          {!isConnectedToSpotify && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              먼저 Spotify 계정을 연결해주세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
