"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldIcon } from "@/components/shield-icon";
import { Upload, Image, Video, AudioLines, Globe, Loader2, X, ExternalLink, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

type MediaType = "image" | "video" | "audio" | "website";
type Verdict = "authentic" | "uncertain" | "deepfake" | null;

interface DetectionResult {
  verdict: Verdict;
  confidence: number;
  scores: {
    fake: number;
    real: number;
  };
  modelsUsed?: string[];
  type: string;
  logId?: string;
}

interface WebsiteMediaItem {
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
  mediaResults: WebsiteMediaItem[];
  scanDuration: number;
  logId: string;
}

export function DemoSection() {
  const [activeTab, setActiveTab] = useState<MediaType>("image");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [websiteResult, setWebsiteResult] = useState<WebsiteScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setResult(null);
    setWebsiteResult(null);
    setError(null);
    setPreview(null);
    setFileName(null);
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: MediaType
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    resetState();
    setFileName(file.name);
    setIsLoading(true);

    try {
      if (type === "image" || type === "video") {
        const url = URL.createObjectURL(file);
        setPreview(url);
      }

      const base64 = await fileToBase64(file);

      if (type === "image") {
        await detectImage(base64);
      } else if (type === "video") {
        await detectVideo(file);
      } else if (type === "audio") {
        await detectAudio(base64);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detection failed");
    } finally {
      setIsLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const detectImage = async (base64: string) => {
    const response = await fetch("/api/detect/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64 }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Image detection failed");
    }

    const data = await response.json();
    setResult(data);
  };

  const detectVideo = async (file: File) => {
    const frames = await extractVideoFrames(file, 5);
    
    const response = await fetch("/api/detect/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Video detection failed");
    }

    const data = await response.json();
    setResult(data);
  };

  const extractVideoFrames = (file: File, numFrames: number): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        video.currentTime = 0;
      };

      const frames: string[] = [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      const captureFrame = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        frames.push(canvas.toDataURL("image/jpeg", 0.8));
      };

      let framesCaptured = 0;
      const duration = video.duration || 10;
      const interval = duration / (numFrames + 1);

      video.onseeked = () => {
        captureFrame();
        framesCaptured++;
        
        if (framesCaptured < numFrames) {
          video.currentTime = interval * (framesCaptured + 1);
        } else {
          URL.revokeObjectURL(video.src);
          resolve(frames);
        }
      };

      video.onloadeddata = () => {
        video.currentTime = interval;
      };

      video.onerror = () => {
        reject(new Error("Failed to load video"));
      };
    });
  };

  const detectAudio = async (base64: string) => {
    const response = await fetch("/api/detect/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64: base64 }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Audio detection failed");
    }

    const data = await response.json();
    setResult(data);
  };

  const scanWebsite = async () => {
    if (!websiteUrl.trim()) {
      setError("Please enter a URL");
      return;
    }

    resetState();
    setIsLoading(true);

    try {
      const response = await fetch("/api/detect/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Website scan failed");
      }

      const data: WebsiteScanResult = await response.json();
      setWebsiteResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Website scan failed");
    } finally {
      setIsLoading(false);
    }
  };

  const getVerdictColor = (verdict: Verdict) => {
    switch (verdict) {
      case "authentic":
        return "text-green-500";
      case "uncertain":
        return "text-yellow-500";
      case "deepfake":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getVerdictText = (verdict: Verdict) => {
    switch (verdict) {
      case "authentic":
        return "Likely Authentic";
      case "uncertain":
        return "Uncertain";
      case "deepfake":
        return "Likely Deepfake";
      default:
        return "Unknown";
    }
  };

  const getWebsiteVerdictInfo = (verdict: "safe" | "suspicious" | "dangerous") => {
    switch (verdict) {
      case "safe":
        return { color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle, text: "Safe - No Deepfakes Detected" };
      case "suspicious":
        return { color: "text-yellow-500", bg: "bg-yellow-500/10", icon: AlertTriangle, text: "Suspicious - Some Uncertain Content" };
      case "dangerous":
        return { color: "text-red-500", bg: "bg-red-500/10", icon: XCircle, text: "Warning - Deepfakes Detected" };
    }
  };

  const tabs = [
    { id: "image" as MediaType, label: "Image", icon: Image },
    { id: "video" as MediaType, label: "Video", icon: Video },
    { id: "audio" as MediaType, label: "Audio", icon: AudioLines },
    { id: "website" as MediaType, label: "Website", icon: Globe },
  ];

  return (
    <section id="demo" className="py-24 bg-card/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Try It Now
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Upload media files or scan a website URL to detect deepfakes. 
            Results are processed using forensic analysis and logged for law enforcement.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 bg-background rounded-lg border border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  resetState();
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-md font-medium transition-all text-sm ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Upload/Input Area */}
          <Card className="border-dashed border-2 border-border bg-background/50">
            <CardContent className="p-8">
              {/* Hidden file inputs */}
              <input
                type="file"
                ref={imageInputRef}
                onChange={(e) => handleFileSelect(e, "image")}
                accept="image/*"
                className="hidden"
              />
              <input
                type="file"
                ref={videoInputRef}
                onChange={(e) => handleFileSelect(e, "video")}
                accept="video/*"
                className="hidden"
              />
              <input
                type="file"
                ref={audioInputRef}
                onChange={(e) => handleFileSelect(e, "audio")}
                accept="audio/*"
                className="hidden"
              />

              {/* Website URL Input */}
              {activeTab === "website" && !isLoading && !websiteResult && !error && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      <Globe className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Scan Website for Deepfakes</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Enter a URL to scan all images, videos, and audio on the page
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="flex-1 px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") scanWebsite();
                      }}
                    />
                    <Button onClick={scanWebsite} size="lg">
                      <Globe className="w-4 h-4 mr-2" />
                      Scan
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Scans up to 15 images, 5 videos, and 5 audio files on the page
                  </p>
                </div>
              )}

              {/* File Upload UI for other tabs */}
              {activeTab !== "website" && !result && !isLoading && !error && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    Upload {activeTab === "image" ? "an Image" : activeTab === "video" ? "a Video" : "an Audio File"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {activeTab === "image" && "Supported formats: JPG, PNG, WebP, GIF"}
                    {activeTab === "video" && "Supported formats: MP4, WebM, MOV"}
                    {activeTab === "audio" && "Supported formats: MP3, WAV, OGG, M4A"}
                  </p>
                  <Button
                    onClick={() => {
                      if (activeTab === "image") imageInputRef.current?.click();
                      if (activeTab === "video") videoInputRef.current?.click();
                      if (activeTab === "audio") audioInputRef.current?.click();
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="text-center py-8">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <ShieldIcon status="scanning" size={96} />
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    {activeTab === "website" ? "Scanning Website..." : "Analyzing..."}
                  </h3>
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {activeTab === "website" 
                      ? "Fetching and analyzing media content" 
                      : "Processing with forensic analysis"}
                  </p>
                  {fileName && (
                    <p className="text-xs text-muted-foreground mt-2">File: {fileName}</p>
                  )}
                  {activeTab === "website" && websiteUrl && (
                    <p className="text-xs text-muted-foreground mt-2">URL: {websiteUrl}</p>
                  )}
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-lg font-medium mb-2 text-red-500">Error</h3>
                  <p className="text-sm text-muted-foreground mb-4">{error}</p>
                  <Button variant="outline" onClick={resetState}>
                    Try Again
                  </Button>
                </div>
              )}

              {/* File Detection Result */}
              {result && !isLoading && activeTab !== "website" && (
                <div className="space-y-6">
                  {preview && activeTab === "image" && (
                    <div className="relative rounded-lg overflow-hidden bg-muted aspect-video flex items-center justify-center">
                      <img
                        src={preview}
                        alt="Uploaded preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                  {preview && activeTab === "video" && (
                    <div className="relative rounded-lg overflow-hidden bg-muted">
                      <video src={preview} controls className="w-full max-h-64 object-contain" />
                    </div>
                  )}

                  <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
                    <ShieldIcon status={result.verdict || "idle"} size={80} />
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold ${getVerdictColor(result.verdict)}`}>
                        {getVerdictText(result.verdict)}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Confidence: {(result.confidence * 100).toFixed(1)}%
                      </p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Real: {(result.scores.real * 100).toFixed(1)}%</span>
                        <span>Fake: {(result.scores.fake * 100).toFixed(1)}%</span>
                      </div>
                      {result.logId && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Log ID: {result.logId}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Authentic</span>
                      <span>Deepfake</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          result.verdict === "authentic" ? "bg-green-500" :
                          result.verdict === "uncertain" ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${result.scores.fake * 100}%` }}
                      />
                    </div>
                  </div>

                  <Button variant="outline" className="w-full" onClick={resetState}>
                    Upload Another
                  </Button>
                </div>
              )}

              {/* Website Scan Result */}
              {websiteResult && !isLoading && activeTab === "website" && (
                <div className="space-y-6">
                  {/* Overall Verdict */}
                  {(() => {
                    const verdictInfo = getWebsiteVerdictInfo(websiteResult.overallVerdict);
                    const VerdictIcon = verdictInfo.icon;
                    return (
                      <div className={`flex items-center gap-4 p-4 rounded-lg ${verdictInfo.bg}`}>
                        <ShieldIcon 
                          status={websiteResult.overallVerdict === "dangerous" ? "deepfake" : 
                                  websiteResult.overallVerdict === "suspicious" ? "uncertain" : "authentic"} 
                          size={64} 
                        />
                        <div className="flex-1">
                          <div className={`flex items-center gap-2 text-lg font-bold ${verdictInfo.color}`}>
                            <VerdictIcon className="w-5 h-5" />
                            {verdictInfo.text}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Scanned in {(websiteResult.scanDuration / 1000).toFixed(1)}s
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* URL */}
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate flex-1">{websiteResult.url}</span>
                    <a href={websiteResult.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold">{websiteResult.totalMedia}</p>
                      <p className="text-xs text-muted-foreground">Total Media</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold">{websiteResult.imagesFound}</p>
                      <p className="text-xs text-muted-foreground">Images</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold">{websiteResult.videosFound}</p>
                      <p className="text-xs text-muted-foreground">Videos</p>
                    </div>
                    <div className="p-3 bg-red-500/10 rounded-lg text-center">
                      <p className="text-2xl font-bold text-red-500">{websiteResult.deepfakesDetected}</p>
                      <p className="text-xs text-muted-foreground">Deepfakes</p>
                    </div>
                  </div>

                  {/* Media Results */}
                  {websiteResult.mediaResults.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Analyzed Media ({websiteResult.mediaResults.length})</h4>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {websiteResult.mediaResults.map((item, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                            <div className={`w-3 h-3 rounded-full ${
                              item.verdict === "authentic" ? "bg-green-500" :
                              item.verdict === "uncertain" ? "bg-yellow-500" : "bg-red-500"
                            }`} />
                            <span className="uppercase text-xs font-medium text-muted-foreground w-12">
                              {item.type}
                            </span>
                            <span className="truncate flex-1 text-xs">{item.url.split("/").pop()}</span>
                            <span className={`text-xs font-medium ${
                              item.verdict === "authentic" ? "text-green-500" :
                              item.verdict === "uncertain" ? "text-yellow-500" : "text-red-500"
                            }`}>
                              {(item.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Log ID */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-xs">
                    <span className="text-muted-foreground">Forensic Log ID:</span>
                    <code className="bg-background px-2 py-1 rounded">{websiteResult.logId}</code>
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => {
                    resetState();
                    setWebsiteUrl("");
                  }}>
                    Scan Another Website
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center mt-4">
            All scans are logged with forensic metadata for law enforcement purposes.
          </p>
        </div>
      </div>
    </section>
  );
}
