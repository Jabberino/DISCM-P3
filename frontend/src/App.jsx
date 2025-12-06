import { useState, useEffect } from 'react';
import VideoGrid from './components/VideoGrid';
import { fetchVideos } from './services/api';

function App() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadVideos() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchVideos();
        setVideos(data);
      } catch (err) {
        setError(err.message);
        console.error('Error loading videos:', err);
      } finally {
        setLoading(false);
      }
    }

    loadVideos();

    const interval = setInterval(loadVideos, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-white">Video Consumer</h1>
          <p className="text-gray-400 text-sm mt-1">
            Displaying processed videos from gRPC upload system
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {loading && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              <p className="text-gray-400 mt-4">Loading videos...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-md">
              <h2 className="text-red-400 font-semibold text-lg mb-2">
                Error Loading Videos
              </h2>
              <p className="text-gray-300">{error}</p>
              <p className="text-gray-400 text-sm mt-3">
                Make sure the backend server is running on port 3000
              </p>
            </div>
          </div>
        )}

        {!loading && !error && <VideoGrid videos={videos} />}

        {!loading && !error && videos.length > 0 && (
          <footer className="text-center py-6 text-gray-500 text-sm">
            Showing {videos.length} video{videos.length !== 1 ? 's' : ''}
          </footer>
        )}
      </main>
    </div>
  );
}

export default App;
