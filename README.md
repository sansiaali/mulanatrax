# mtrax.exe

Web-based mapper/notepad for La-Mulana players

### Features

- Drag screenshots to the browser to create a map
- Add notes and images to individual tiles (with opt-in OCR via your own Google Vision API)
- Search through notes and maptiles
- Set tiles as unsolved and display them
- All data is saved and kept within the browser
- The tool can be run offline if the Google Vision API integration is not enabled (see below)

### Instructions

- Install Node.js v16+
- Download this repository and unzip it somewhere
- Navigate to the extracted folder
- **Optional**: if you want to have the text of your screenshots automatically detected and added to the tile notes, copy `.env.sample` file and rename the copy to `.env`, replace `GOOGLE_VISION_API_KEY_HERE` with your personal API key from google cloud console.
- npm install
- npm run dev
- Point your browser to http://localhost:5173 and start building you maps!

### Notes

For best results, set your game to windowed mode and a resolution that has an aspect ratio of 4:3 (e.g. 1280x960).

Open up the folder where Steam stores your game screenshots so that you can press F12 ingame and then drag the file to the browser.
