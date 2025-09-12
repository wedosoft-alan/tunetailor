import Header from '../Header';

export default function HeaderExample() {
  return (
    <Header 
      isConnectedToSpotify={true}
      onConnectSpotify={() => console.log('Connect clicked')}
      onDisconnectSpotify={() => console.log('Disconnect clicked')}
    />
  );
}