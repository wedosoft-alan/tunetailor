import PlaylistScheduler from '../PlaylistScheduler';

export default function PlaylistSchedulerExample() {
  return (
    <div className="p-8 bg-background">
      <PlaylistScheduler 
        notificationPermission="default"
        onScheduleUpdate={(settings) => console.log('Schedule updated:', settings)}
        onRequestNotificationPermission={() => console.log('Notification permission requested')}
      />
    </div>
  );
}