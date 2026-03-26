import { NextRequest, NextResponse } from "next/server";

const HF_IMAGE_API_URL =
  "https://api-inference.huggingface.co/models/prithivMLmods/Deep-Fake-Detector-v2-Model";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "HUGGINGFACE_API_KEY not configured" },
        { status: 500 }
      );
    }

    const { frames } = await request.json();

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json(
        { error: "Array of frame images (base64) is required" },
        { status: 400 }
      );
    }

    // Analyze multiple frames for better accuracy
    const frameResults: Array<{ fake: number; real: number }> = [];
    const maxFrames = Math.min(frames.length, 5); // Limit to 5 frames

    for (let i = 0; i < maxFrames; i++) {
      const frameBase64 = frames[i];

      try {
        // Convert base64 to blob
        const base64Data = frameBase64.replace(/^data:image\/\w+;base64,/, "");
        const binaryData = Buffer.from(base64Data, "base64");
        const imageData = new Blob([binaryData]);

        // Call Hugging Face API for each frame
        const response = await fetch(HF_IMAGE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/octet-stream",
          },
          body: imageData,
        });

        if (response.status === 503) {
          return NextResponse.json(
            {
              error: "Model is loading",
              status: "loading",
              estimatedTime: 20,
            },
            { status: 503 }
          );
        }

        if (response.ok) {
          const result = await response.json();
          const predictions = Array.isArray(result) ? result : [result];

          let fakeScore = 0;
          let realScore = 0;

          for (const pred of predictions) {
            const label = pred.label?.toLowerCase() || "";
            if (label.includes("fake") || label.includes("deepfake") || label.includes("ai")) {
              fakeScore = pred.score;
            } else if (label.includes("real") || label.includes("authentic") || label.includes("human")) {
              realScore = pred.score;
            }
          }

          frameResults.push({ fake: fakeScore, real: realScore });
        }
      } catch (frameError) {
        console.error(`Error processing frame ${i}:`, frameError);
        // Continue with other frames
      }
    }

    if (frameResults.length === 0) {
      return NextResponse.json(
        { error: "Failed to analyze any frames" },
        { status: 500 }
      );
    }

    // Aggregate results across all frames
    const avgFakeScore =
      frameResults.reduce((sum, r) => sum + r.fake, 0) / frameResults.length;
    const avgRealScore =
      frameResults.reduce((sum, r) => sum + r.real, 0) / frameResults.length;

    // Determine verdict based on average scores
    let verdict: "authentic" | "uncertain" | "deepfake";
    let confidence: number;

    if (avgFakeScore > 0.7) {
      verdict = "deepfake";
      confidence = avgFakeScore;
    } else if (avgRealScore > 0.7) {
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
      framesAnalyzed: frameResults.length,
      model: "Deep-Fake-Detector-v2",
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
