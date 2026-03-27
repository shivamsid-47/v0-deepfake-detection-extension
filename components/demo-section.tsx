"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldIcon } from "@/components/shield-icon";
import { Upload, Image, Video, AudioLines, Loader2, X } from "lucide-react";

type MediaType = "image" | "video" | "audio";
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
}

export function DemoSection() {
  const [activeTab, setActiveTab] = useState<MediaType>("image");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setResult(null);
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
      // Create preview
      if (type === "image" || type === "video") {
        const url = URL.createObjectURL(file);
        setPreview(url);
      }

      // Convert file to base64
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
    // Extract frames from video
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

  const tabs = [
    { id: "image" as MediaType, label: "Image", icon: Image },
    { id: "video" as MediaType, label: "Video", icon: Video },
    { id: "audio" as MediaType, label: "Audio", icon: AudioLines },
  ];

  return (
    <section id="demo" className="py-24 bg-card/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Try It Now
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Upload an image, video, or audio file to test our deepfake detection AI. 
            Results are processed using multiple machine learning models.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-background rounded-lg border border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  resetState();
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Upload Area */}
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

              {!result && !isLoading && !error && (
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

              {isLoading && (
                <div className="text-center py-8">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <ShieldIcon status="scanning" size={96} />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Analyzing...</h3>
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing with AI models
                  </p>
                  {fileName && (
                    <p className="text-xs text-muted-foreground mt-2">
                      File: {fileName}
                    </p>
                  )}
                </div>
              )}

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

              {result && !isLoading && (
                <div className="space-y-6">
                  {/* Preview */}
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
                      <video
                        src={preview}
                        controls
                        className="w-full max-h-64 object-contain"
                      />
                    </div>
                  )}

                  {/* Result */}
                  <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
                    <ShieldIcon 
                      status={result.verdict || "idle"} 
                      size={80} 
                    />
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
                      {result.modelsUsed && result.modelsUsed.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Models: {result.modelsUsed.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Authentic</span>
                      <span>Deepfake</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          result.verdict === "authentic"
                            ? "bg-green-500"
                            : result.verdict === "uncertain"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{
                          width: `${result.scores.fake * 100}%`,
                          marginLeft: `${result.scores.real * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={resetState}
                    >
                      Upload Another
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Files are processed securely and not stored. Detection uses Hugging Face AI models.
          </p>
        </div>
      </div>
    </section>
  );
}
