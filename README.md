# Video Upload & Processing System

A distributed system for video uploading, processing, and viewing using a Producer-Consumer architecture.

## Setup & Usage

### 1. Generate Test Videos
First, create the test video files (folders 1-5):
```bash
cd producer
./setup-test-videos.sh 5 4
cd ..
```

### 2. Start the System
Run the system using Docker Compose:
```bash
docker-compose up -d --build
```

### 3. Access the Services
*   **Producer Dashboard** (Upload Videos): http://localhost:4000
    *   Enter the number of threads (Max 5) and click "Start Upload".
*   **Frontend Viewer** (View Results): http://localhost:5173
    *   Watch the videos appear as they are processed.
*   **Consumer API**: http://localhost:3000

## Commands
*   **Stop everything**: `docker-compose down`
*   **Stop and wipe data**: `docker-compose down -v`
