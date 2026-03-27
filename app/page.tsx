"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldIcon } from "@/components/shield-icon";
import {
  Shield,
  Download,
  Image,
  Video,
  Music,
  Zap,
  Lock,
  Eye,
  ChevronRight,
  Github,
  ExternalLink,
} from "lucide-react";

export default function LandingPage() {
  const [demoStatus, setDemoStatus] = useState<
    "idle" | "scanning" | "authentic" | "uncertain" | "deepfake"
  >("idle");

  const cycleDemo = () => {
    const states: Array<"scanning" | "authentic" | "uncertain" | "deepfake"> = [
      "scanning",
      "authentic",
      "uncertain",
      "deepfake",
    ];
    let index = 0;
    setDemoStatus("scanning");

    const interval = setInterval(() => {
      index++;
      if (index >= states.length) {
        clearInterval(interval);
        setDemoStatus("idle");
      } else {
        setDemoStatus(states[index]);
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">DeepFake Shield</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#download" className="hover:text-foreground transition-colors">
              Download
            </a>
          </nav>
          <Button asChild size="sm">
            <a href="#download">
              Get Extension
              <ChevronRight className="w-4 h-4 ml-1" />
            </a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-6">
                <Zap className="w-4 h-4" />
                AI-Powered Detection
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-balance">
                Protect Yourself From{" "}
                <span className="text-primary">Deepfake</span> Content
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 text-pretty">
                A Chrome extension that automatically scans images, videos, and audio
                for AI-generated content. Know what&apos;s real and what&apos;s fake.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button size="lg" asChild>
                  <a href="#download">
                    <Download className="w-5 h-5 mr-2" />
                    Download Extension
                  </a>
                </Button>
                <Button size="lg" variant="outline" onClick={cycleDemo}>
                  <Eye className="w-5 h-5 mr-2" />
                  See Demo
                </Button>
              </div>
            </div>

            {/* Interactive Shield Demo */}
            <div className="flex-1 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full" />
                <Card className="relative bg-card/50 backdrop-blur border-border p-8 rounded-2xl">
                  <div className="flex flex-col items-center gap-6">
                    <div
                      className="relative cursor-pointer"
                      onClick={cycleDemo}
                    >
                      <ShieldIcon status={demoStatus} size="xl" animated />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-lg capitalize">
                        {demoStatus === "idle" && "Click to Demo"}
                        {demoStatus === "scanning" && "Scanning..."}
                        {demoStatus === "authentic" && "All Clear"}
                        {demoStatus === "uncertain" && "Uncertain"}
                        {demoStatus === "deepfake" && "Deepfake Detected!"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {demoStatus === "idle" && "See how the shield changes"}
                        {demoStatus === "scanning" && "Analyzing media content"}
                        {demoStatus === "authentic" && "No deepfakes detected"}
                        {demoStatus === "uncertain" && "Could not verify authenticity"}
                        {demoStatus === "deepfake" && "AI-generated content found"}
                      </p>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-shield-green" />
                        Safe
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-shield-yellow" />
                        Uncertain
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-shield-red" />
                        Fake
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Complete Media Protection
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our extension uses multiple AI models to detect deepfakes across
              all media types
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                  <Image className="w-6 h-6 text-blue-500" />
                </div>
                <CardTitle>Image Detection</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Automatically scans all images on web pages to detect
                  AI-generated faces and manipulated photos using the
                  Deep-Fake-Detector-v2 model.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                  <Video className="w-6 h-6 text-purple-500" />
                </div>
                <CardTitle>Video Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Extracts and analyzes multiple frames from videos to detect
                  face-swapped or AI-generated video content with high accuracy.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4">
                  <Music className="w-6 h-6 text-pink-500" />
                </div>
                <CardTitle>Audio Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Detects synthetic voices and audio deepfakes using specialized
                  audio detection models trained on voice cloning datasets.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our extension runs silently in the background, protecting you from
              deepfakes
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                title: "Install Extension",
                description:
                  "Download and add the extension to Chrome in seconds",
              },
              {
                step: "02",
                title: "Auto-Scan Pages",
                description:
                  "The extension automatically scans all media on visited pages",
              },
              {
                step: "03",
                title: "AI Analysis",
                description:
                  "Two specialized AI models analyze images, video, and audio",
              },
              {
                step: "04",
                title: "Get Alerts",
                description:
                  "The shield changes color to warn you of detected deepfakes",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Models Section */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powered by Advanced AI
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We use state-of-the-art machine learning models for accurate detection
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Deep-Fake-Detector-v2</CardTitle>
                    <p className="text-xs text-muted-foreground">Image & Video Model</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  A vision transformer model trained to detect AI-generated and
                  manipulated images. Analyzes facial features, lighting
                  inconsistencies, and generation artifacts.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Music className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Audio Deepfake Detector</CardTitle>
                    <p className="text-xs text-muted-foreground">Audio Model</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Specialized model for detecting synthetic speech and voice
                  cloning. Trained on ASVspoof datasets to identify AI-generated
                  audio with high precision.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-20">
        <div className="container mx-auto px-4">
          <Card className="max-w-3xl mx-auto bg-card border-border overflow-hidden">
            <div className="p-8 md:p-12">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Shield className="w-12 h-12 text-primary" />
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <h2 className="text-2xl md:text-3xl font-bold mb-2">
                    Download DeepFake Shield
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Get the Chrome extension and start protecting yourself from
                    deepfake content today.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                    <Button size="lg" asChild>
                      <a href="/extension/deepfake-shield.zip" download>
                        <Download className="w-5 h-5 mr-2" />
                        Download ZIP
                      </a>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <a
                        href="https://github.com/shivamsid-47/v0-deepfake-detection-extension"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Github className="w-5 h-5 mr-2" />
                        View Source
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-secondary/50 px-8 py-6 border-t border-border">
              <h3 className="font-semibold mb-4">Installation Instructions</h3>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex gap-2">
                  <span className="text-primary font-medium">1.</span>
                  Download and extract the ZIP file
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-medium">2.</span>
                  Open Chrome and go to{" "}
                  <code className="bg-background px-1 rounded">
                    chrome://extensions
                  </code>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-medium">3.</span>
                  Enable &quot;Developer mode&quot; in the top right corner
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-medium">4.</span>
                  Click &quot;Load unpacked&quot; and select the extracted folder
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-medium">5.</span>
                  The DeepFake Shield icon will appear in your extensions bar
                </li>
              </ol>
              <div className="mt-4 p-3 bg-background/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Backend URL:</span>{" "}
                  <code className="bg-background px-1 rounded">
                    https://v0-deepfake-detection-extension.vercel.app
                  </code>
                  <br />
                  <span className="text-muted-foreground/70">Pre-configured in extension. No setup required!</span>
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Security Note */}
      <section className="py-16 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-center md:text-left">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Privacy First</h3>
              <p className="text-muted-foreground max-w-xl">
                All analysis is done through secure API calls. We never store your
                images, videos, or audio. Your browsing data stays private.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-semibold">DeepFake Shield</span>
            </div>
<p className="text-sm text-muted-foreground">
                  Powered by Free Hugging Face Inference API
                </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a
                href="https://huggingface.co"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                Hugging Face
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
