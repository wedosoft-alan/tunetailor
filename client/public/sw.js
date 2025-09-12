// Service Worker for handling push notifications and background tasks

const CACHE_NAME = 'playlist-generator-v1';
const urlsToCache = [
  '/'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'view') {
    // Open the app when user clicks "View Playlist"
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle background sync (for offline playlist generation)
self.addEventListener('sync', (event) => {
  if (event.tag === 'generate-playlist') {
    event.waitUntil(
      // This would typically call your backend API
      fetch('/api/generate-scheduled-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timestamp: Date.now()
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Show notification about the new playlist
          return self.registration.showNotification('새 플레이리스트가 생성되었어요! 🎵', {
            body: `"${data.playlistName}" 플레이리스트가 준비되었습니다.`,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            data: {
              type: 'playlist-created',
              playlistName: data.playlistName,
              trackCount: data.trackCount
            },
            actions: [
              {
                action: 'view',
                title: '플레이리스트 보기'
              }
            ],
            requireInteraction: true,
            tag: 'playlist-notification'
          });
        }
      })
      .catch(error => {
        console.error('Background playlist generation failed:', error);
      })
    );
  }
});

// Handle push messages (if using server-sent push notifications)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification(data.title || '새 플레이리스트 알림', {
        body: data.body || '새로운 플레이리스트가 생성되었습니다.',
        icon: data.icon || '/icon-192.png',
        badge: data.badge || '/badge-72.png',
        data: data.data,
        actions: data.actions || [
          {
            action: 'view',
            title: '보기'
          }
        ],
        requireInteraction: true,
        tag: 'playlist-push-notification'
      })
    );
  }
});