import { useState, useRef } from 'react';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import { getVideoUrl } from '../services/api';
import VideoModal from './VideoModal';

export default function VideoCard({ filename }) {
  const [elementRef, isVisible] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px',
  });
  const [isHovering, setIsHovering] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const videoRef = useRef(null);

  const videoUrl = getVideoUrl(filename);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0; 
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.currentTime >= 10) {
      videoRef.current.pause();
    }
  };

  const handleClick = () => {
    setShowModal(true);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <>
      <div
        ref={elementRef}
        className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div className="aspect-video bg-gray-900 relative">
          {isVisible ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
              onTimeUpdate={handleTimeUpdate}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-pulse text-gray-600">Loading...</div>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-200 truncate" title={filename}>
            {filename}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {isHovering ? 'Playing 10s preview...' : 'Hover: 10s preview | Click: fullscreen'}
          </p>
        </div>
      </div>

      {showModal && (
        <VideoModal
          videoUrl={videoUrl}
          filename={filename}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
