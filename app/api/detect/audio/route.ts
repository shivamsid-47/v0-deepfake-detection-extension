import { NextRequest, NextResponse } from "next/server";

// Two audio deepfake detection models
const HF_MODEL_1 = "https://api-inference.huggingface.co/models/Mrkomodo/Deepfake-audio-detection";
const HF_MODEL_2 = "https://api-inference.huggingface.co/models/motheecreator/Deepfake-audio-detection";

async function queryAudioModel(modelUrl: string, audioData: Blob, apiKey?: string) {
  const headers: HeadersInit = {
    "Content-Type": "application/octet-stream",
  };
  
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(modelUrl, {
    method: "POST",
    headers,
    body: audioData,
  });

  if (!response.ok) {
    if (response.status === 503) {
      return { loading: true, estimatedTime: 30 };
    }
    throw new Error(`Model request failed: ${response.status}`);
  }

  return response.json();
}

function parseAudioResult(result: unknown): { fake: number; real: number } {
  const predictions = Array.isArray(result) ? result : [result];
  let fakeScore = 0;
  let realScore = 0;

  for (const pred of predictions as Array<{ label?: string; score?: number }>) {
    const label = pred.label?.toLowerCase() || "";
    const score = pred.score || 0;
    
    if (label.includes("fake") || label.includes("spoof") || label.includes("synthetic") || label.includes("deepfake")) {
      fakeScore = Math.max(fakeScore, score);
    } else if (label.includes("real") || label.includes("bonafide") || label.includes("genuine") || label.includes("original")) {
      realScore = Math.max(realScore, score);
    }
  }

  return { fake: fakeScore, real: realScore };
}

export async function POST(request: NextRequest) {
  try {
    // API key is optional - works without it (with rate limits)
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    const { audioUrl, audioBase64 } = await request.json();

    if (!audioUrl && !audioBase64) {
      return NextResponse.json(
        { error: "Either audioUrl or audioBase64 is required" },
        { status: 400 }
      );
    }

    let audioData: Blob;

    if (audioBase64) {
      // Convert base64 to blob
      const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
      const binaryData = Buffer.from(base64Data, "base64");
      audioData = new Blob([binaryData]);
    } else {
      // Fetch audio from URL
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        return NextResponse.json(
          { error: "Failed to fetch audio from URL" },
          { status: 400 }
        );
      }
      audioData = await audioResponse.blob();
    }

    // Query both audio models in parallel
    const modelResults = await Promise.allSettled([
      queryAudioModel(HF_MODEL_1, audioData, apiKey),
      queryAudioModel(HF_MODEL_2, audioData, apiKey),
    ]);

    const scores: Array<{ fake: number; real: number }> = [];
    const modelsUsed: string[] = [];
    let isLoading = false;

    modelResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const data = result.value;
        if (data.loading) {
          isLoading = true;
        } else {
          const parsed = parseAudioResult(data);
          scores.push(parsed);
          modelsUsed.push(index === 0 ? "Deepfake-audio-detection-1" : "Deepfake-audio-detection-2");
        }
      }
    });

    // If all models are loading
    if (scores.length === 0 && isLoading) {
      return NextResponse.json(
        {
          error: "Models are loading",
          status: "loading",
          estimatedTime: 30,
        },
        { status: 503 }
      );
    }

    // If no results at all
    if (scores.length === 0) {
      return NextResponse.json(
        { error: "All audio detection models failed" },
        { status: 500 }
      );
    }

    // Average scores from models
    const avgFakeScore = scores.reduce((sum, s) => sum + s.fake, 0) / scores.length;
    const avgRealScore = scores.reduce((sum, s) => sum + s.real, 0) / scores.length;

    // Determine verdict with ensemble approach
    let verdict: "authentic" | "uncertain" | "deepfake";
    let confidence: number;

    if (avgFakeScore > 0.65) {
      verdict = "deepfake";
      confidence = avgFakeScore;
    } else if (avgRealScore > 0.65) {
      verdict = "authentic";
      confidence = avgRealScore;
    } else {
      verdict = "uncertain";
      confidence = Math.max(avgFakeScore, avgRealScore);
    }

    return NextResponse.json({
      verdict,
      confidence,
      scores: {
        fake: avgFakeScore,
        real: avgRealScore,
      },
      modelsUsed,
      type: "audio",
    });
  } catch (error) {
    console.error("Detection error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
