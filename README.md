# DeepFake Shield

> AI-powered deepfake detection Chrome extension that analyzes images, videos, and audio in real-time using advanced forensic analysis techniques.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/shivamsid-47/v0-deepfake-detection-extension)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

![DeepFake Shield Banner](https://v0-deepfake-detection-extension.vercel.app/og-image.png)

## Overview

DeepFake Shield is a comprehensive solution for detecting AI-generated and manipulated media. It consists of:

1. **Chrome Extension** - Auto-scans web pages for deepfake content with a color-coded shield indicator
2. **Web Dashboard** - Landing page with live demo to test files directly
3. **Detection API** - RESTful endpoints for image, video, and audio analysis

### Key Features

- **Multi-Format Detection**: Analyzes images, videos, and audio files
- **Real-time Scanning**: Automatically scans media on any webpage
- **Color-coded Shield**: Visual indicator (Green = Safe, Yellow = Uncertain, Red = Deepfake)
- **Local Processing**: Forensic analysis runs entirely on the server - no external API dependencies
- **Privacy-Focused**: Files are analyzed and immediately discarded
- **Free to Use**: No API keys or subscriptions required

---

## Table of Contents

- [Live Demo](#live-demo)
- [Installation](#installation)
  - [Chrome Extension](#chrome-extension-installation)
  - [Local Development](#local-development)
- [How It Works](#how-it-works)
  - [Image Detection](#image-detection)
  - [Video Detection](#video-detection)
  - [Audio Detection](#audio-detection)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)
- [License](#license)

---

## Live Demo

**Website**: [https://v0-deepfake-detection-extension.vercel.app](https://v0-deepfake-detection-extension.vercel.app)

Try the demo section on the website to upload and analyze:
- Images (JPEG, PNG, WebP, GIF)
- Videos (MP4, WebM, MOV)
- Audio files (MP3, WAV, OGG, M4A)

---

## Installation

### Chrome Extension Installation

1. **Download the Extension**
   - Visit [https://v0-deepfake-detection-extension.vercel.app](https://v0-deepfake-detection-extension.vercel.app)
   - Click "Download Extension" button
   - Extract the ZIP file

2. **Install in Chrome**
   - Open Chrome and go to `chrome://extensions`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the extracted `extension` folder

3. **Start Using**
   - The shield icon will appear in your extensions bar
   - Browse any webpage - media will be auto-scanned
   - Click the extension icon to see detection results

### Local Development

```bash
# Clone the repository
git clone https://github.com/shivamsid-47/v0-deepfake-detection-extension.git
cd v0-deepfake-detection-extension

# Install dependencies
pnpm install

# Run development server
pnpm dev

# Open http://localhost:3000
```

To test the extension locally, update the API URL in `public/extension/background.js`:
```javascript
const DEFAULT_API_URL = "http://localhost:3000";
```

---

## How It Works

DeepFake Shield uses multiple forensic analysis techniques to detect synthetic media. Unlike AI-based approaches that require external APIs, our methods run entirely server-side using statistical analysis.

### Image Detection

The image analyzer uses **5 forensic techniques**:

| Technique | What It Detects | Weight |
|-----------|-----------------|--------|
| **Noise Pattern Analysis** | Deepfakes often have unnaturally uniform noise patterns | 25% |
| **Edge Sharpness Analysis** | AI-generated images have unusual edge characteristics | 20% |
| **Color Distribution** | GANs produce unnatural color clustering and saturation | 25% |
| **JPEG Artifact Analysis** | Double compression artifacts from image manipulation | 15% |
| **Symmetry Analysis** | Deepfake faces often have unnatural bilateral symmetry | 15% |

```
Input Image → Decode → Extract Features → Run 5 Analyses → Weighted Score → Verdict
```

### Video Detection

Video analysis extends image detection with temporal consistency checks:

1. **Frame Extraction**: Analyzes up to 5 key frames
2. **Per-Frame Analysis**: Each frame runs through the image detector
3. **Temporal Consistency**: Checks for unnatural frame-to-frame variations
4. **Score Aggregation**: Combines all metrics for final verdict

### Audio Detection

Audio detection uses **spectral analysis**:

| Metric | Description |
|--------|-------------|
| **Zero Crossing Rate** | Frequency of sign changes - AI audio has unusual patterns |
| **Amplitude Variance** | Natural speech has varied amplitude; synthetic is often flat |
| **Silence Ratio** | AI-generated audio may have unnatural silence patterns |
| **Spectral Flatness** | Measures noise-like vs tonal characteristics |
| **High Frequency Content** | AI often lacks natural high-frequency detail |

---

## API Reference

### POST `/api/detect/image`

Analyze an image for deepfake indicators.

**Request Body:**
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```
or
```json
{
  "imageUrl": "https://example.com/image.jpg"
}
```

**Response:**
```json
{
  "verdict": "authentic" | "uncertain" | "deepfake",
  "confidence": 0.85,
  "scores": {
    "fake": 0.15,
    "real": 0.85
  },
  "analysis": {
    "noiseScore": 0.72,
    "edgeScore": 0.65,
    "colorScore": 0.45,
    "compressionScore": 0.38,
    "symmetryScore": 0.52
  },
  "type": "image"
}
```

### POST `/api/detect/video`

Analyze video frames for deepfake indicators.

**Request Body:**
```json
{
  "frames": [
    "data:image/jpeg;base64,/9j/4AAQ...",
    "data:image/jpeg;base64,/9j/4AAQ..."
  ]
}
```

**Response:**
```json
{
  "verdict": "authentic" | "uncertain" | "deepfake",
  "confidence": 0.78,
  "scores": {
    "fake": 0.22,
    "real": 0.78
  },
  "framesAnalyzed": 5,
  "temporalConsistency": 0.85,
  "type": "video"
}
```

### POST `/api/detect/audio`

Analyze audio for synthetic speech indicators.

**Request Body:**
```json
{
  "audioBase64": "data:audio/mp3;base64,..."
}
```

**Response:**
```json
{
  "verdict": "authentic" | "uncertain" | "deepfake",
  "confidence": 0.92,
  "scores": {
    "fake": 0.08,
    "real": 0.92
  },
  "analysis": {
    "zeroCrossingRate": 0.15,
    "amplitudeVariance": 0.72,
    "silenceRatio": 0.08,
    "spectralFlatness": 0.45,
    "highFrequencyContent": 0.68
  },
  "type": "audio"
}
```

### GET `/api/download-extension`

Downloads the Chrome extension as a ZIP file.

---

## Project Structure

```
v0-deepfake-detection-extension/
├── app/
│   ├── api/
│   │   ├── detect/
│   │   │   ├── image/route.ts    # Image detection API
│   │   │   ├── video/route.ts    # Video detection API
│   │   │   └── audio/route.ts    # Audio detection API
│   │   └── download-extension/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Landing page
├── components/
│   ├── demo-section.tsx          # Upload & test demo
│   ├── shield-icon.tsx           # Animated shield component
│   └── ui/                       # shadcn/ui components
├── public/
│   └── extension/                # Chrome extension files
│       ├── manifest.json
│       ├── background.js         # Service worker
│       ├── content.js            # Content script
│       ├── popup.html/css/js     # Extension popup UI
│       └── icons/                # Extension icons
├── package.json
└── README.md
```

---

## Technologies Used

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - Component library
- **Lucide React** - Icons

### Backend
- **Next.js API Routes** - Serverless functions
- **JSZip** - Extension packaging

### Chrome Extension
- **Manifest V3** - Latest Chrome extension format
- **Service Worker** - Background processing
- **Content Scripts** - Page media detection

### Deployment
- **Vercel** - Hosting and serverless functions

---

## Shield Status Colors

| Color | Status | Meaning |
|-------|--------|---------|
| 🟢 Green | Authentic | Media appears to be genuine (confidence > 65%) |
| 🟡 Yellow | Uncertain | Unable to determine with confidence |
| 🔴 Red | Deepfake | Likely AI-generated or manipulated (fake score > 65%) |
| 🔵 Blue | Scanning | Analysis in progress |
| ⚪ Gray | Idle | No media detected on page |

---

## Limitations

- **Not 100% Accurate**: Forensic analysis provides indicators, not definitive proof
- **Compressed Images**: Highly compressed images may produce less accurate results
- **New AI Models**: Detection may be less effective against cutting-edge generation techniques
- **Audio Formats**: Works best with uncompressed or lightly compressed audio

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Vercel](https://vercel.com/) - Deployment platform
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [v0](https://v0.app/) - AI-powered development

---

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/shivamsid-47/v0-deepfake-detection-extension/issues) page
2. Create a new issue with detailed information
3. Join the discussion in existing issues

---

**Made with v0 by Vercel**

<a href="https://v0.app/chat/api/kiro/clone/shivamsid-47/v0-deepfake-detection-extension" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>
