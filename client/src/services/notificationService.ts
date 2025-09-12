export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

class NotificationService {
  private registration: ServiceWorkerRegistration | null = null;

  async init(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('Notification' in window) || typeof window.Notification === 'undefined') {
      console.warn('Service Worker or Notifications not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully');
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window) || typeof window.Notification === 'undefined') {
      return 'denied';
    }

    let permission = window.Notification.permission;
    
    if (permission === 'default') {
      permission = await window.Notification.requestPermission();
    }

    return permission;
  }

  async showNotification(data: NotificationData): Promise<void> {
    const permission = await this.requestPermission();
    
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    if (this.registration) {
      // Use service worker to show notification for better control
      const options: NotificationOptions = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        data: data.data,
        requireInteraction: true,
        tag: 'playlist-notification'
      };
      
      // Add actions if supported (only available in service worker context)
      if (data.actions && 'showNotification' in this.registration) {
        (options as any).actions = data.actions;
      }
      
      await this.registration.showNotification(data.title, options);
    } else {
      // Fallback to browser notification
      if ('Notification' in window && typeof window.Notification !== 'undefined') {
        new window.Notification(data.title, {
          body: data.body,
          icon: data.icon,
          data: data.data
        });
      }
    }
  }

  async showPlaylistNotification(playlistName: string, trackCount: number): Promise<void> {
    await this.showNotification({
      title: '새 플레이리스트가 생성되었어요! 🎵',
      body: `"${playlistName}" 플레이리스트에 ${trackCount}곡이 추가되었습니다.`,
      icon: '/icon-192.png',
      data: {
        type: 'playlist-created',
        playlistName,
        trackCount
      },
      actions: [
        {
          action: 'view',
          title: '플레이리스트 보기'
        },
        {
          action: 'dismiss',
          title: '닫기'
        }
      ]
    });
  }

  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'Notification' in window && typeof window.Notification !== 'undefined';
  }

  getPermission(): NotificationPermission {
    if ('Notification' in window && typeof window.Notification !== 'undefined') {
      return window.Notification.permission;
    }
    return 'denied';
  }
}

export const notificationService = new NotificationService();