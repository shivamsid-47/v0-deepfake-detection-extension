import { NextRequest, NextResponse } from "next/server";

const HF_API_URL =
  "https://api-inference.huggingface.co/models/Mrkomodo/Deepfake-audio-detection";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "HUGGINGFACE_API_KEY not configured" },
        { status: 500 }
      );
    }

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

    // Call Hugging Face API
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/octet-stream",
      },
      body: audioData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HF API Error:", errorText);

      // Handle model loading
      if (response.status === 503) {
        return NextResponse.json(
          {
            error: "Model is loading",
            status: "loading",
            estimatedTime: 30,
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

    // Parse the results
    const predictions = Array.isArray(result) ? result : [result];

    let fakeScore = 0;
    let realScore = 0;

    for (const pred of predictions) {
      const label = pred.label?.toLowerCase() || "";
      if (label.includes("fake") || label.includes("spoof") || label.includes("synthetic")) {
        fakeScore = pred.score;
      } else if (label.includes("real") || label.includes("bonafide") || label.includes("genuine")) {
        realScore = pred.score;
      }
    }

    // Determine verdict
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
      model: "Deepfake-audio-detection",
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
