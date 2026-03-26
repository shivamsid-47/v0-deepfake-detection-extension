import { NextRequest, NextResponse } from "next/server";

// Two models for better accuracy
const HF_MODEL_1 = "https://api-inference.huggingface.co/models/prithivMLmods/Deep-Fake-Detector-v2-Model";
const HF_MODEL_2 = "https://api-inference.huggingface.co/models/dima806/deepfake_vs_real_image_detection";

async function queryModel(modelUrl: string, imageData: Blob, apiKey?: string) {
  const headers: HeadersInit = {
    "Content-Type": "application/octet-stream",
  };
  
  // Use API key if available, otherwise use free tier
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(modelUrl, {
    method: "POST",
    headers,
    body: imageData,
  });

  if (!response.ok) {
    if (response.status === 503) {
      return { loading: true, estimatedTime: 20 };
    }
    throw new Error(`Model request failed: ${response.status}`);
  }

  return response.json();
}

function parseModelResult(result: unknown): { fake: number; real: number } {
  const predictions = Array.isArray(result) ? result : [result];
  let fakeScore = 0;
  let realScore = 0;

  for (const pred of predictions as Array<{ label?: string; score?: number }>) {
    const label = pred.label?.toLowerCase() || "";
    const score = pred.score || 0;
    
    if (label.includes("fake") || label.includes("deepfake") || label.includes("ai") || label.includes("generated")) {
      fakeScore = Math.max(fakeScore, score);
    } else if (label.includes("real") || label.includes("authentic") || label.includes("human") || label.includes("true")) {
      realScore = Math.max(realScore, score);
    }
  }

  return { fake: fakeScore, real: realScore };
}

export async function POST(request: NextRequest) {
  try {
    // API key is optional - works without it (with rate limits)
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    const { imageUrl, imageBase64 } = await request.json();

    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { error: "Either imageUrl or imageBase64 is required" },
        { status: 400 }
      );
    }

    let imageData: Blob;

    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Buffer.from(base64Data, "base64");
      imageData = new Blob([binaryData]);
    } else {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return NextResponse.json(
          { error: "Failed to fetch image from URL" },
          { status: 400 }
        );
      }
      imageData = await imageResponse.blob();
    }

    // Query both models in parallel for better accuracy
    const modelResults = await Promise.allSettled([
      queryModel(HF_MODEL_1, imageData, apiKey),
      queryModel(HF_MODEL_2, imageData, apiKey),
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
          const parsed = parseModelResult(data);
          scores.push(parsed);
          modelsUsed.push(index === 0 ? "Deep-Fake-Detector-v2" : "deepfake_vs_real_image_detection");
        }
      }
    });

    // If all models are loading
    if (scores.length === 0 && isLoading) {
      return NextResponse.json(
        {
          error: "Models are loading",
          status: "loading",
          estimatedTime: 20,
        },
        { status: 503 }
      );
    }

    // If no results at all
    if (scores.length === 0) {
      return NextResponse.json(
        { error: "All detection models failed" },
        { status: 500 }
      );
    }

    // Average scores from both models
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
      type: "image",
    });
  } catch (error) {
    console.error("Detection error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
