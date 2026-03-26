import { NextRequest, NextResponse } from "next/server";

const HF_API_URL =
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

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/octet-stream",
      },
      body: imageData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HF API Error:", errorText);

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

      return NextResponse.json(
        { error: "Detection failed", details: errorText },
        { status: response.status }
      );
    }

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

    let verdict: "authentic" | "uncertain" | "deepfake";
    let confidence: number;

    if (fakeScore > 0.7) {
      verdict = "deepfake";
      confidence = fakeScore;
    } else if (realScore > 0.7) {
      verdict = "authentic";
      confidence = realScore;
    } else {
      verdict = "uncertain";
      confidence = Math.max(fakeScore, realScore);
    }

    return NextResponse.json({
      verdict,
      confidence,
      scores: {
        fake: fakeScore,
        real: realScore,
      },
      model: "Deep-Fake-Detector-v2",
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
