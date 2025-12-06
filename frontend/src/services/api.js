const API_BASE_URL = '';

export async function fetchVideos() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/videos`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch videos:', error);
    throw error;
  }
}

export function getVideoUrl(filename) {
  return `${API_BASE_URL}/uploads/${filename}`;
}
