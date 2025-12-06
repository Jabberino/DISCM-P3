#!/bin/bash

# Setup test videos for producer
# Usage: ./setup-test-videos.sh <num_folders> <videos_per_folder>

# Defaults
NUM_FOLDERS=${1:-3}
VIDEOS_PER_FOLDER=${2:-4}

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VIDEOS_DIR="$SCRIPT_DIR/videos"

# Validation
if ! [[ "$NUM_FOLDERS" =~ ^[0-9]+$ ]] || [ "$NUM_FOLDERS" -lt 1 ]; then
  echo "Error: num_folders must be a positive integer"
  exit 1
fi

if ! [[ "$VIDEOS_PER_FOLDER" =~ ^[0-9]+$ ]] || [ "$VIDEOS_PER_FOLDER" -lt 2 ]; then
  echo "Error: videos_per_folder must be an integer >= 2 (to allow for duplication)"
  exit 1
fi

echo "========================================="
echo "Setting up test videos"
echo "========================================="
echo "Folders: $NUM_FOLDERS"
echo "Videos per folder: $VIDEOS_PER_FOLDER"
echo "========================================="

# Clean up old folders
echo "Cleaning up videos directory..."
rm -rf "$VIDEOS_DIR"/folder*

# 1. GENERATE videos with correct labels (Producer #X matches folderX)
echo "Generating fresh videos (Producer #Matches Folder)..."
docker run --rm \
  -v "$VIDEOS_DIR":/app/videos \
  p3-producer \
  ./generate-videos.sh "$NUM_FOLDERS" "$VIDEOS_PER_FOLDER"

# 2. APPLY DUPLICATE HACK (User Requirement: Last Video = Duplicate of Previous)
echo "Applying Duplicate Logic..."
LAST_VIDEO_IDX=$VIDEOS_PER_FOLDER
PREV_VIDEO_IDX=$((VIDEOS_PER_FOLDER - 1))

echo "Config: Video $LAST_VIDEO_IDX will be a copy of Video $PREV_VIDEO_IDX"

for folder_num in $(seq 1 $NUM_FOLDERS); do
  FOLDER="$VIDEOS_DIR/folder$folder_num"
  SOURCE="$FOLDER/video_${PREV_VIDEO_IDX}.mp4"
  TARGET="$FOLDER/video_${LAST_VIDEO_IDX}.mp4"
  
  if [ -f "$SOURCE" ]; then
    cp "$SOURCE" "$TARGET"
    echo "  folder$folder_num: Made video_${LAST_VIDEO_IDX}.mp4 a duplicate of video_${PREV_VIDEO_IDX}.mp4"
  else
    echo "  Warning: Source $SOURCE not found for duplication"
  fi
done

echo ""
echo "  Total: Checked $NUM_FOLDERS folders"
echo ""

echo "========================================="
echo "Summary"
echo "========================================="
echo "Created $NUM_FOLDERS folders"
echo "$VIDEOS_PER_FOLDER videos per folder"
# Calculation: (Total Uploads) - (Originals) = Duplicates
# Logic: We duplicate 1 video per folder. So N folders = N duplicates.
UNIQUE_CONTENT=$(( (VIDEOS_PER_FOLDER - 1) * NUM_FOLDERS )) # Wait, no.
# Actually: Each folder has V videos. 1 is duplicate.
# So V-1 unique videos per folder?
# No, wait. Videos across folders are unique now (since we regenerated).
# So:
# Total Files = N * V
# Duplicates = N (One per folder)
# Unique Files = N * (V - 1)
# Successful Uploads = N * (V - 1)
# Failed Uploads = N

SUCCESSFUL=$(( NUM_FOLDERS * (VIDEOS_PER_FOLDER - 1) ))
FAILED=$NUM_FOLDERS

echo "Total Files: $(( NUM_FOLDERS * VIDEOS_PER_FOLDER ))"
echo "Expected SUCCESS: $SUCCESSFUL"
echo "Expected FAIL (Duplicates): $FAILED"
echo ""
echo "Ready to upload with Producer UI (Max threads: $NUM_FOLDERS)"
echo "========================================="
