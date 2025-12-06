FROM node:20-alpine

# Install ffmpeg and fonts for video generation
RUN apk add --no-cache ffmpeg ttf-dejavu

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

# Make script executable
RUN chmod +x generate-videos.sh

EXPOSE 4000

CMD ["node", "src/server.js"]
