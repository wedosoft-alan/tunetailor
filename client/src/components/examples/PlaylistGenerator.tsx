import PlaylistGenerator from '../PlaylistGenerator';

export default function PlaylistGeneratorExample() {
  return (
    <div className="p-8 bg-background">
      <PlaylistGenerator 
        isConnectedToSpotify={true}
        onGenerate={(preferences) => console.log('Generated with:', preferences)}
      />
    </div>
  );
}