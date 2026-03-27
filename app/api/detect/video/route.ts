import { NextRequest, NextResponse } from "next/server";

// Same models as image detection
const MODELS = [
  {
    url: "https://api-inference.huggingface.co/models/Organika/sdxl-detector",
    name: "SDXL-Detector",
    fakeLabels: ["artificial", "fake", "generated", "ai"],
    realLabels: ["real", "human", "authentic", "natural"],
  },
  {
    url: "https://api-inference.huggingface.co/models/umm-maybe/AI-image-detector",
    name: "AI-Image-Detector",
    fakeLabels: ["artificial", "ai", "generated"],
    realLabels: ["human", "real"],
  },
];

async function queryModel(
  modelUrl: string,
  imageData: Blob,
  retries = 2
): Promise<{ data: unknown; error?: string }> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(modelUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: imageData,
      });

      if (response.status === 503) {
        const waitTime = Math.min(3000 * (attempt + 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}` };
      }

      return { data: await response.json() };
    } catch (error) {
      if (attempt === retries - 1) {
        return { data: null, error: String(error) };
      }
    }
  }
  return { data: null, error: "Max retries exceeded" };
}

function parseModelResult(
  result: unknown,
  fakeLabels: string[],
  realLabels: string[]
): { fake: number; real: number } {
  const predictions = Array.isArray(result) ? result : [result];
  let fakeScore = 0;
  let realScore = 0;

  for (const pred of predictions as Array<{ label?: string; score?: number }>) {
    const label = pred.label?.toLowerCase() || "";
    const score = pred.score || 0;

    const isFake = fakeLabels.some((fl) => label.includes(fl));
    const isReal = realLabels.some((rl) => label.includes(rl));

    if (isFake) {
      fakeScore = Math.max(fakeScore, score);
    } else if (isReal) {
      realScore = Math.max(realScore, score);
    }
  }

  if (fakeScore === 0 && realScore === 0 && predictions.length >= 2) {
    const sorted = [...predictions].sort(
      (a: { score?: number }, b: { score?: number }) =>
        (b.score || 0) - (a.score || 0)
    );
    const topPred = sorted[0] as { label?: string; score?: number };
    const label = topPred.label?.toLowerCase() || "";
    const score = topPred.score || 0.5;

    if (fakeLabels.some((fl) => label.includes(fl))) {
      fakeScore = score;
      realScore = 1 - score;
    } else {
      realScore = score;
      fakeScore = 1 - score;
    }
  }

  return { fake: fakeScore, real: realScore };
}

export async function POST(request: NextRequest) {
  try {
    const { frames } = await request.json();

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json(
        { error: "Array of frame images (base64) is required" },
        { status: 400 }
      );
    }

    const frameResults: Array<{ fake: number; real: number }> = [];
    const maxFrames = Math.min(frames.length, 3); // Limit to 3 frames for speed
    const modelsUsed = new Set<string>();
    const errors: string[] = [];

    console.log(`[v0] Processing ${maxFrames} video frames`);

    for (let i = 0; i < maxFrames; i++) {
      const frameBase64 = frames[i];

      try {
        const base64Data = frameBase64.replace(/^data:image\/\w+;base64,/, "");
        const binaryData = Buffer.from(base64Data, "base64");
        const imageData = new Blob([binaryData], { type: "image/jpeg" });

        // Query first available model for each frame
        for (const model of MODELS) {
          const { data, error } = await queryModel(model.url, imageData);

          if (error) {
            errors.push(`Frame ${i}, ${model.name}: ${error}`);
            continue;
          }

          if (data) {
            const parsed = parseModelResult(data, model.fakeLabels, model.realLabels);
            if (parsed.fake > 0 || parsed.real > 0) {
              frameResults.push(parsed);
              modelsUsed.add(model.name);
              console.log(`[v0] Frame ${i} - ${model.name}: fake=${parsed.fake.toFixed(3)}, real=${parsed.real.toFixed(3)}`);
              break; // One model per frame is enough
            }
          }
        }
      } catch (frameError) {
        console.error(`[v0] Error processing frame ${i}:`, frameError);
      }
    }

    if (frameResults.length === 0) {
      console.log(`[v0] All video frames failed:`, errors);
      return NextResponse.json(
        {
          error: "Detection models are temporarily unavailable. Please try again.",
          details: errors.slice(0, 3),
        },
        { status: 503 }
      );
    }

    // Average scores across all frames
    const avgFakeScore = frameResults.reduce((sum, r) => sum + r.fake, 0) / frameResults.length;
    const avgRealScore = frameResults.reduce((sum, r) => sum + r.real, 0) / frameResults.length;

    let verdict: "authentic" | "uncertain" | "deepfake";
    let confidence: number;

    if (avgFakeScore > avgRealScore && avgFakeScore > 0.5) {
      verdict = "deepfake";
      confidence = avgFakeScore;
    } else if (avgRealScore > avgFakeScore && avgRealScore > 0.5) {
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
    console.error("[v0] Video detection error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
