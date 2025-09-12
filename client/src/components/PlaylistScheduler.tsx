import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Clock, Bell, Calendar, Settings2 } from 'lucide-react';

interface ScheduleSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  dayOfWeek?: number; // 0-6, Sunday=0
  dayOfMonth?: number; // 1-31
  preferences: string;
}

interface PlaylistSchedulerProps {
  onScheduleUpdate?: (settings: ScheduleSettings) => void;
  currentSchedule?: ScheduleSettings;
  notificationPermission?: 'granted' | 'denied' | 'default';
  onRequestNotificationPermission?: () => void;
}

const daysOfWeek = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export default function PlaylistScheduler({ 
  onScheduleUpdate,
  currentSchedule,
  notificationPermission = 'default',
  onRequestNotificationPermission
}: PlaylistSchedulerProps) {
  const [settings, setSettings] = useState<ScheduleSettings>(currentSchedule || {
    enabled: false,
    frequency: 'weekly',
    time: '09:00',
    dayOfWeek: 1, // Monday
    preferences: ''
  });

  const handleSettingChange = (key: keyof ScheduleSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onScheduleUpdate?.(newSettings);
    console.log('Schedule settings updated:', key, value);
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      onRequestNotificationPermission?.();
    }
  };

  const getTimeOptions = () => {
    const options = [];
    for (let hour = 6; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
  };

  const getDayOptions = () => {
    const options = [];
    for (let day = 1; day <= 31; day++) {
      options.push(day.toString());
    }
    return options;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto" data-testid="card-scheduler">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Clock className="w-5 h-5 text-primary" data-testid="icon-scheduler" />
          </div>
          <div>
            <CardTitle className="text-xl font-display" data-testid="title-scheduler">
              자동 플레이리스트 스케줄
            </CardTitle>
            <CardDescription data-testid="description-scheduler">
              정기적으로 새로운 플레이리스트를 생성하고 알림으로 받아보세요
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-medium">자동 생성 활성화</Label>
            <p className="text-sm text-muted-foreground">
              설정한 시간에 자동으로 플레이리스트를 생성합니다
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => handleSettingChange('enabled', enabled)}
            data-testid="switch-enable-schedule"
          />
        </div>

        {settings.enabled && (
          <>
            {/* Notification Permission */}
            {notificationPermission !== 'granted' && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Bell className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">알림 권한 필요</p>
                      <p className="text-sm text-muted-foreground">
                        새 플레이리스트가 생성되면 알림을 받으려면 권한을 허용해주세요
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={requestNotificationPermission}
                    data-testid="button-enable-notifications"
                  >
                    알림 허용
                  </Button>
                </div>
              </div>
            )}

            {/* Frequency */}
            <div className="space-y-3">
              <Label className="text-base font-medium">생성 주기</Label>
              <Select
                value={settings.frequency}
                onValueChange={(frequency: 'daily' | 'weekly' | 'monthly') => 
                  handleSettingChange('frequency', frequency)
                }
              >
                <SelectTrigger data-testid="select-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">매일</SelectItem>
                  <SelectItem value="weekly">매주</SelectItem>
                  <SelectItem value="monthly">매월</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time */}
            <div className="space-y-3">
              <Label className="text-base font-medium">생성 시간</Label>
              <Select
                value={settings.time}
                onValueChange={(time) => handleSettingChange('time', time)}
              >
                <SelectTrigger data-testid="select-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getTimeOptions().map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day Selection based on frequency */}
            {settings.frequency === 'weekly' && (
              <div className="space-y-3">
                <Label className="text-base font-medium">요일 선택</Label>
                <Select
                  value={settings.dayOfWeek?.toString() || '1'}
                  onValueChange={(day) => handleSettingChange('dayOfWeek', parseInt(day))}
                >
                  <SelectTrigger data-testid="select-day-of-week">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {daysOfWeek.map((day, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {settings.frequency === 'monthly' && (
              <div className="space-y-3">
                <Label className="text-base font-medium">날짜 선택</Label>
                <Select
                  value={settings.dayOfMonth?.toString() || '1'}
                  onValueChange={(day) => handleSettingChange('dayOfMonth', parseInt(day))}
                >
                  <SelectTrigger data-testid="select-day-of-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getDayOptions().map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}일
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Schedule Summary */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">스케줄 요약</span>
              </div>
              <div className="space-y-1">
                <Badge variant="outline" className="text-xs" data-testid="badge-schedule-summary">
                  {settings.frequency === 'daily' && `매일 ${settings.time}`}
                  {settings.frequency === 'weekly' && 
                    `매주 ${daysOfWeek[settings.dayOfWeek || 1]} ${settings.time}`
                  }
                  {settings.frequency === 'monthly' && 
                    `매월 ${settings.dayOfMonth || 1}일 ${settings.time}`
                  }
                </Badge>
                {notificationPermission === 'granted' && (
                  <Badge variant="secondary" className="text-xs">
                    <Bell className="w-3 h-3 mr-1" />
                    알림 활성화됨
                  </Badge>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}