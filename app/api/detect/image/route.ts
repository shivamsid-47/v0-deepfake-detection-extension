import { NextRequest, NextResponse } from "next/server";

// More reliable models for deepfake detection
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
  retries = 3
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
        // Model is loading - wait and retry
        const waitTime = Math.min(5000 * (attempt + 1), 15000);
        console.log(`[v0] Model loading, waiting ${waitTime}ms before retry ${attempt + 1}`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[v0] Model error: ${response.status} - ${errorText}`);
        return { data: null, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      console.log(`[v0] Model response:`, JSON.stringify(data).slice(0, 200));
      return { data };
    } catch (error) {
      console.log(`[v0] Fetch error on attempt ${attempt + 1}:`, error);
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

  // If no scores found, try to infer from the structure
  if (fakeScore === 0 && realScore === 0 && predictions.length >= 2) {
    // Assume first two predictions are the main classes
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
      imageData = new Blob([binaryData], { type: "image/jpeg" });
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

    console.log(`[v0] Processing image, size: ${imageData.size} bytes`);

    // Query models sequentially to handle rate limits better
    const scores: Array<{ fake: number; real: number }> = [];
    const modelsUsed: string[] = [];
    const errors: string[] = [];

    for (const model of MODELS) {
      const { data, error } = await queryModel(model.url, imageData);

      if (error) {
        errors.push(`${model.name}: ${error}`);
        continue;
      }

      if (data) {
        const parsed = parseModelResult(data, model.fakeLabels, model.realLabels);
        if (parsed.fake > 0 || parsed.real > 0) {
          scores.push(parsed);
          modelsUsed.push(model.name);
          console.log(`[v0] ${model.name} scores - fake: ${parsed.fake}, real: ${parsed.real}`);
        }
      }
    }

    // If no models worked, return error with details
    if (scores.length === 0) {
      console.log(`[v0] All models failed:`, errors);
      return NextResponse.json(
        {
          error: "Detection models are temporarily unavailable. Please try again in a moment.",
          details: errors,
        },
        { status: 503 }
      );
    }

    // Average scores from all successful models
    const avgFakeScore = scores.reduce((sum, s) => sum + s.fake, 0) / scores.length;
    const avgRealScore = scores.reduce((sum, s) => sum + s.real, 0) / scores.length;

    // Determine verdict
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
      modelsUsed,
      type: "image",
    });
  } catch (error) {
    console.error("[v0] Detection error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
