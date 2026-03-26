import { NextRequest, NextResponse } from "next/server";

// Two models for video frame analysis
const HF_MODEL_1 = "https://api-inference.huggingface.co/models/prithivMLmods/Deep-Fake-Detector-v2-Model";
const HF_MODEL_2 = "https://api-inference.huggingface.co/models/dima806/deepfake_vs_real_image_detection";

async function queryFrameModel(modelUrl: string, imageData: Blob, apiKey?: string) {
  const headers: HeadersInit = {
    "Content-Type": "application/octet-stream",
  };
  
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

function parseFrameResult(result: unknown): { fake: number; real: number } {
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

    const { frames } = await request.json();

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json(
        { error: "Array of frame images (base64) is required" },
        { status: 400 }
      );
    }

    // Analyze multiple frames with both models for better accuracy
    const frameResults: Array<{ fake: number; real: number }> = [];
    const maxFrames = Math.min(frames.length, 5); // Limit to 5 frames
    let isLoading = false;
    const modelsUsed = new Set<string>();

    for (let i = 0; i < maxFrames; i++) {
      const frameBase64 = frames[i];

      try {
        // Convert base64 to blob
        const base64Data = frameBase64.replace(/^data:image\/\w+;base64,/, "");
        const binaryData = Buffer.from(base64Data, "base64");
        const imageData = new Blob([binaryData]);

        // Query both models for this frame
        const modelResults = await Promise.allSettled([
          queryFrameModel(HF_MODEL_1, imageData, apiKey),
          queryFrameModel(HF_MODEL_2, imageData, apiKey),
        ]);

        modelResults.forEach((result, modelIndex) => {
          if (result.status === "fulfilled") {
            const data = result.value;
            if (data.loading) {
              isLoading = true;
            } else {
              const parsed = parseFrameResult(data);
              frameResults.push(parsed);
              modelsUsed.add(modelIndex === 0 ? "Deep-Fake-Detector-v2" : "deepfake_vs_real_image_detection");
            }
          }
        });
      } catch (frameError) {
        console.error(`Error processing frame ${i}:`, frameError);
        // Continue with other frames
      }
    }

    // If all models are loading
    if (frameResults.length === 0 && isLoading) {
      return NextResponse.json(
        {
          error: "Models are loading",
          status: "loading",
          estimatedTime: 20,
        },
        { status: 503 }
      );
    }

    if (frameResults.length === 0) {
      return NextResponse.json(
        { error: "Failed to analyze any frames" },
        { status: 500 }
      );
    }

    // Aggregate results across all frames and models
    const avgFakeScore = frameResults.reduce((sum, r) => sum + r.fake, 0) / frameResults.length;
    const avgRealScore = frameResults.reduce((sum, r) => sum + r.real, 0) / frameResults.length;

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
      framesAnalyzed: maxFrames,
      resultsCollected: frameResults.length,
      modelsUsed: Array.from(modelsUsed),
      type: "video",
    });
  } catch (error) {
    console.error("Video detection error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
