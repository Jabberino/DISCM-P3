import { useState } from 'react';

export default function VideoModal({ videoUrl, filename, onClose }) {
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-6xl">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="bg-black rounded-lg overflow-hidden shadow-2xl">
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full"
            style={{ maxHeight: '85vh' }}
          />
        </div>

        <p className="text-white text-center mt-4 text-sm">{filename}</p>
      </div>
    </div>
  );
}
