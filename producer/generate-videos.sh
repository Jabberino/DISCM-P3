#!/bin/sh
# Script to generate sample test videos using ffmpeg
# Usage: ./generate-videos.sh [num_producers] [videos_per_producer]

NUM_PRODUCERS=${1:-3}
VIDEOS_PER_PRODUCER=${2:-3}

# Input validation function
validate_positive_integer() {
  if ! echo "$1" | grep -qE '^[0-9]+$'; then
    return 1
  fi
  if [ "$1" -eq 0 ]; then
    return 1
  fi
  return 0
}

# Validate num_producers
if ! validate_positive_integer "$NUM_PRODUCERS"; then
  echo "============================================================"
  echo "❌ INPUT VALIDATION ERROR"
  echo "============================================================"
  echo "Error: num_producers '$NUM_PRODUCERS' is not a valid positive integer"
  echo ""
  echo "Usage: $0 [num_producers] [videos_per_producer]"
  echo "  num_producers: Positive integer (1-100), default: 3"
  echo "  videos_per_producer: Positive integer (1-50), default: 3"
  echo "============================================================"
  exit 1
fi

if [ "$NUM_PRODUCERS" -gt 100 ]; then
  echo "============================================================"
  echo "❌ INPUT VALIDATION ERROR"
  echo "============================================================"
  echo "Error: num_producers=$NUM_PRODUCERS exceeds maximum (100)"
  echo "  Generating too many producers may take excessive time and disk space"
  echo "============================================================"
  exit 1
fi

# Validate videos_per_producer
if ! validate_positive_integer "$VIDEOS_PER_PRODUCER"; then
  echo "============================================================"
  echo "❌ INPUT VALIDATION ERROR"
  echo "============================================================"
  echo "Error: videos_per_producer '$VIDEOS_PER_PRODUCER' is not a valid positive integer"
  echo ""
  echo "Usage: $0 [num_producers] [videos_per_producer]"
  echo "  num_producers: Positive integer (1-100), default: 3"
  echo "  videos_per_producer: Positive integer (1-50), default: 3"
  echo "============================================================"
  exit 1
fi

if [ "$VIDEOS_PER_PRODUCER" -gt 50 ]; then
  echo "============================================================"
  echo "❌ INPUT VALIDATION ERROR"
  echo "============================================================"
  echo "Error: videos_per_producer=$VIDEOS_PER_PRODUCER exceeds maximum (50)"
  echo "  Generating too many videos may take excessive time and disk space"
  echo "============================================================"
  exit 1
fi

# All validation passed - print header
TOTAL_VIDEOS=$((NUM_PRODUCERS * VIDEOS_PER_PRODUCER))
ESTIMATED_SIZE_MB=$((TOTAL_VIDEOS * 2))

echo "============================================================"
echo "Generating test videos for producer demonstration"
echo "============================================================"
echo "  Producers: $NUM_PRODUCERS"
echo "  Videos per producer: $VIDEOS_PER_PRODUCER"
echo "  Total videos: $TOTAL_VIDEOS"
echo "  Estimated disk space: ~${ESTIMATED_SIZE_MB}MB"
echo "============================================================"
echo ""

# Function to get color for a producer number
get_color() {
  case $(( $1 % 10 )) in
    1) echo "FF6B6B" ;;  # Red
    2) echo "4ECDC4" ;;  # Cyan
    3) echo "45B7D1" ;;  # Blue
    4) echo "FFA07A" ;;  # Orange
    5) echo "98D8C8" ;;  # Mint
    6) echo "F7DC6F" ;;  # Yellow
    7) echo "BB8FCE" ;;  # Purple
    8) echo "85C1E2" ;;  # Sky Blue
    9) echo "F8B88B" ;;  # Peach
    0) echo "A8E6CF" ;;  # Light Green
  esac
}

# Generate videos for each producer
for p in $(seq 1 $NUM_PRODUCERS); do
  FOLDER="folder$p"
  
  # Create folder if it doesn't exist
  mkdir -p "videos/$FOLDER"
  
  # Get color for this producer
  COLOR=$(get_color $p)
  
  echo "Generating videos for Producer #$p (Color: #$COLOR)..."
  
  for v in $(seq 1 $VIDEOS_PER_PRODUCER); do
    echo "  Creating $FOLDER/video_$v.mp4..."
    
    # Create video with:
    # - Solid color background unique to this producer
    # - Text overlay showing "Producer #X - Video Y"
    # - Running timestamp
    # - No audio (silent)
    ffmpeg -f lavfi \
      -i "color=c=0x${COLOR}:s=1280x720:d=30:r=30" \
      -vf "drawtext=text='Producer #$p':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2-60:borderw=4:bordercolor=black,\
           drawtext=text='Video $v':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2+60:borderw=3:bordercolor=black,\
           drawtext=text='%{pts\:hms}':fontcolor=white:fontsize=40:x=20:y=20:borderw=2:bordercolor=black" \
      -c:v libx264 -pix_fmt yuv420p -preset ultrafast \
      -y "videos/$FOLDER/video_$v.mp4" -loglevel error 2>&1
    
    if [ $? -eq 0 ]; then
      echo "    ✓ Success"
    else
      echo "    ✗ Failed"
    fi
  done
  echo ""
done

echo "============================================================"
echo "✓ Generated $(($NUM_PRODUCERS * $VIDEOS_PER_PRODUCER)) videos successfully!"
echo "============================================================"
