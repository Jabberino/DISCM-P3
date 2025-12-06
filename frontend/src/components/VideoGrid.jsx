import VideoCard from './VideoCard';

export default function VideoGrid({ videos }) {
  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No videos available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
      {videos.map((filename) => (
        <VideoCard key={filename} filename={filename} />
      ))}
    </div>
  );
}
