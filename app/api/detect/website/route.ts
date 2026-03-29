import { NextRequest, NextResponse } from "next/server";
import { createForensicLog } from "@/lib/forensic-logger";

interface MediaItem {
  url: string;
  type: "image" | "video" | "audio";
  verdict: "authentic" | "uncertain" | "deepfake";
  confidence: number;
  scores: { fake: number; real: number };
}

interface WebsiteScanResult {
  url: string;
  totalMedia: number;
  imagesFound: number;
  videosFound: number;
  audiosFound: number;
  deepfakesDetected: number;
  overallVerdict: "safe" | "suspicious" | "dangerous";
  mediaResults: MediaItem[];
  scanDuration: number;
  logId: string;
}

// Analyze image buffer for deepfake indicators
function analyzeImageData(buffer: Buffer): { fakeScore: number; realScore: number } {
  const bytes = new Uint8Array(buffer);
  
  // Noise pattern analysis
  let noiseSum = 0;
  let edgeCount = 0;
  
  for (let i = 1; i < Math.min(bytes.length, 50000); i++) {
    const diff = Math.abs(bytes[i] - bytes[i - 1]);
    noiseSum += diff;
    if (diff > 30) edgeCount++;
  }
  
  const avgNoise = noiseSum / Math.min(bytes.length, 50000);
  const normalizedNoise = Math.min(avgNoise / 50, 1);
  const edgeRatio = edgeCount / Math.min(bytes.length, 50000);
  
  // Color distribution analysis
  const colorBuckets = new Array(16).fill(0);
  for (let i = 0; i < Math.min(bytes.length, 30000); i++) {
    colorBuckets[Math.floor(bytes[i] / 16)]++;
  }
  
  const totalPixels = Math.min(bytes.length, 30000);
  let colorEntropy = 0;
  for (const count of colorBuckets) {
    if (count > 0) {
      const p = count / totalPixels;
      colorEntropy -= p * Math.log2(p);
    }
  }
  const normalizedEntropy = colorEntropy / 4;
  
  // Calculate scores
  let fakeScore = 0.3;
  
  if (normalizedNoise < 0.15) fakeScore += 0.2;
  if (normalizedNoise > 0.4) fakeScore -= 0.1;
  if (edgeRatio < 0.05) fakeScore += 0.15;
  if (normalizedEntropy < 0.6) fakeScore += 0.15;
  if (normalizedEntropy > 0.85) fakeScore -= 0.1;
  
  fakeScore = Math.max(0.05, Math.min(0.95, fakeScore));
  const realScore = 1 - fakeScore;
  
  return { fakeScore, realScore };
}

export async function POST(request: NextRequest) {
  const processingStartTime = Date.now();
  
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Fetch the webpage
    let htmlContent: string;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "DeepFakeShield/1.0 (Website Scanner)",
          "Accept": "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      htmlContent = await response.text();
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to fetch website: ${err instanceof Error ? err.message : "Unknown error"}` },
        { status: 400 }
      );
    }

    // Extract media URLs from HTML
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    
    // Extract images
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const imageUrls: string[] = [];
    let match;
    while ((match = imgRegex.exec(htmlContent)) !== null) {
      const src = match[1];
      if (src && !src.startsWith("data:")) {
        const fullUrl = src.startsWith("http") ? src : 
                       src.startsWith("//") ? `${parsedUrl.protocol}${src}` :
                       src.startsWith("/") ? `${baseUrl}${src}` : 
                       `${baseUrl}/${src}`;
        imageUrls.push(fullUrl);
      }
    }

    // Also check for background images in style attributes
    const bgImageRegex = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
    while ((match = bgImageRegex.exec(htmlContent)) !== null) {
      const src = match[1];
      if (src && !src.startsWith("data:")) {
        const fullUrl = src.startsWith("http") ? src : 
                       src.startsWith("//") ? `${parsedUrl.protocol}${src}` :
                       src.startsWith("/") ? `${baseUrl}${src}` : 
                       `${baseUrl}/${src}`;
        imageUrls.push(fullUrl);
      }
    }

    // Extract videos
    const videoRegex = /<video[^>]*>[\s\S]*?<\/video>|<source[^>]+src=["']([^"']+)["'][^>]*type=["']video/gi;
    const videoSrcRegex = /src=["']([^"']+)["']/gi;
    const videoUrls: string[] = [];
    
    // Find video tags
    const videoTagRegex = /<video[^>]*(?:src=["']([^"']+)["'])?[^>]*>/gi;
    while ((match = videoTagRegex.exec(htmlContent)) !== null) {
      if (match[1]) {
        const src = match[1];
        const fullUrl = src.startsWith("http") ? src : 
                       src.startsWith("//") ? `${parsedUrl.protocol}${src}` :
                       src.startsWith("/") ? `${baseUrl}${src}` : 
                       `${baseUrl}/${src}`;
        videoUrls.push(fullUrl);
      }
    }
    
    // Find source tags within videos
    const sourceRegex = /<source[^>]+src=["']([^"']+)["'][^>]*>/gi;
    while ((match = sourceRegex.exec(htmlContent)) !== null) {
      const src = match[1];
      if (src.match(/\.(mp4|webm|mov|avi|mkv)/i)) {
        const fullUrl = src.startsWith("http") ? src : 
                       src.startsWith("//") ? `${parsedUrl.protocol}${src}` :
                       src.startsWith("/") ? `${baseUrl}${src}` : 
                       `${baseUrl}/${src}`;
        videoUrls.push(fullUrl);
      }
    }

    // Extract audio
    const audioRegex = /<audio[^>]*(?:src=["']([^"']+)["'])?[^>]*>/gi;
    const audioUrls: string[] = [];
    while ((match = audioRegex.exec(htmlContent)) !== null) {
      if (match[1]) {
        const src = match[1];
        const fullUrl = src.startsWith("http") ? src : 
                       src.startsWith("//") ? `${parsedUrl.protocol}${src}` :
                       src.startsWith("/") ? `${baseUrl}${src}` : 
                       `${baseUrl}/${src}`;
        audioUrls.push(fullUrl);
      }
    }

    // Deduplicate URLs
    const uniqueImages = [...new Set(imageUrls)].slice(0, 15);
    const uniqueVideos = [...new Set(videoUrls)].slice(0, 5);
    const uniqueAudios = [...new Set(audioUrls)].slice(0, 5);

    const mediaResults: MediaItem[] = [];
    let deepfakesDetected = 0;

    // Analyze images
    for (const imageUrl of uniqueImages) {
      try {
        const response = await fetch(imageUrl, {
          headers: { "User-Agent": "DeepFakeShield/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length > 1000) { // Only analyze if larger than 1KB
            const analysis = analyzeImageData(buffer);
            
            let verdict: "authentic" | "uncertain" | "deepfake";
            if (analysis.fakeScore > 0.65) {
              verdict = "deepfake";
              deepfakesDetected++;
            } else if (analysis.realScore > 0.65) {
              verdict = "authentic";
            } else {
              verdict = "uncertain";
            }
            
            mediaResults.push({
              url: imageUrl,
              type: "image",
              verdict,
              confidence: Math.max(analysis.fakeScore, analysis.realScore),
              scores: analysis,
            });
          }
        }
      } catch {
        // Skip failed fetches
      }
    }

    // Analyze videos (fetch poster frame or first bytes)
    for (const videoUrl of uniqueVideos) {
      try {
        const response = await fetch(videoUrl, {
          headers: { 
            "User-Agent": "DeepFakeShield/1.0",
            "Range": "bytes=0-100000" // Get first 100KB for analysis
          },
          signal: AbortSignal.timeout(10000),
        });
        
        if (response.ok || response.status === 206) {
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length > 1000) {
            const analysis = analyzeImageData(buffer);
            
            let verdict: "authentic" | "uncertain" | "deepfake";
            if (analysis.fakeScore > 0.6) {
              verdict = "deepfake";
              deepfakesDetected++;
            } else if (analysis.realScore > 0.6) {
              verdict = "authentic";
            } else {
              verdict = "uncertain";
            }
            
            mediaResults.push({
              url: videoUrl,
              type: "video",
              verdict,
              confidence: Math.max(analysis.fakeScore, analysis.realScore),
              scores: analysis,
            });
          }
        }
      } catch {
        // Skip failed fetches
      }
    }

    // Analyze audio
    for (const audioUrl of uniqueAudios) {
      try {
        const response = await fetch(audioUrl, {
          headers: { 
            "User-Agent": "DeepFakeShield/1.0",
            "Range": "bytes=0-50000"
          },
          signal: AbortSignal.timeout(8000),
        });
        
        if (response.ok || response.status === 206) {
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length > 500) {
            // Simple audio analysis based on byte patterns
            const bytes = new Uint8Array(buffer);
            let variance = 0;
            let sum = 0;
            for (let i = 0; i < bytes.length; i++) {
              sum += bytes[i];
            }
            const mean = sum / bytes.length;
            for (let i = 0; i < bytes.length; i++) {
              variance += Math.pow(bytes[i] - mean, 2);
            }
            variance /= bytes.length;
            
            const normalizedVariance = Math.min(variance / 3000, 1);
            const fakeScore = normalizedVariance < 0.3 ? 0.6 : 0.35;
            const realScore = 1 - fakeScore;
            
            let verdict: "authentic" | "uncertain" | "deepfake";
            if (fakeScore > 0.55) {
              verdict = "deepfake";
              deepfakesDetected++;
            } else if (realScore > 0.55) {
              verdict = "authentic";
            } else {
              verdict = "uncertain";
            }
            
            mediaResults.push({
              url: audioUrl,
              type: "audio",
              verdict,
              confidence: Math.max(fakeScore, realScore),
              scores: { fake: fakeScore, real: realScore },
            });
          }
        }
      } catch {
        // Skip failed fetches
      }
    }

    const processingEndTime = Date.now();
    const scanDuration = processingEndTime - processingStartTime;

    // Determine overall verdict
    let overallVerdict: "safe" | "suspicious" | "dangerous";
    const deepfakeRatio = mediaResults.length > 0 
      ? deepfakesDetected / mediaResults.length 
      : 0;
    
    if (deepfakeRatio > 0.3 || deepfakesDetected >= 3) {
      overallVerdict = "dangerous";
    } else if (deepfakesDetected > 0 || mediaResults.some(m => m.verdict === "uncertain")) {
      overallVerdict = "suspicious";
    } else {
      overallVerdict = "safe";
    }

    // Create forensic log
    const forensicLog = createForensicLog({
      type: "website",
      verdict: overallVerdict === "dangerous" ? "deepfake" : overallVerdict === "suspicious" ? "uncertain" : "authentic",
      confidence: mediaResults.length > 0 
        ? mediaResults.reduce((sum, m) => sum + m.confidence, 0) / mediaResults.length 
        : 0.5,
      scores: {
        fake: mediaResults.length > 0 
          ? mediaResults.reduce((sum, m) => sum + m.scores.fake, 0) / mediaResults.length 
          : 0.5,
        real: mediaResults.length > 0 
          ? mediaResults.reduce((sum, m) => sum + m.scores.real, 0) / mediaResults.length 
          : 0.5,
      },
      fileData: Buffer.from(url),
      fileSize: htmlContent.length,
      mimeType: "text/html",
      sourceIP: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      modelsUsed: ["Website-Scanner", "Forensic-Analysis"],
      processingTimeMs: scanDuration,
      indicators: {
        scannedUrl: url,
        imagesFound: uniqueImages.length,
        videosFound: uniqueVideos.length,
        audiosFound: uniqueAudios.length,
        mediaAnalyzed: mediaResults.length,
        deepfakesDetected,
      },
      referer: request.headers.get("referer") || undefined,
      origin: request.headers.get("origin") || undefined,
    });

    const result: WebsiteScanResult = {
      url,
      totalMedia: uniqueImages.length + uniqueVideos.length + uniqueAudios.length,
      imagesFound: uniqueImages.length,
      videosFound: uniqueVideos.length,
      audiosFound: uniqueAudios.length,
      deepfakesDetected,
      overallVerdict,
      mediaResults,
      scanDuration,
      logId: forensicLog.id,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error("Website scan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Website scan failed" },
      { status: 500 }
    );
  }
}
