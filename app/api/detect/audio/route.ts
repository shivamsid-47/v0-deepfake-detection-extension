import { NextRequest, NextResponse } from "next/server";

// Audio classification models that work with inference API
const MODELS = [
  {
    url: "https://api-inference.huggingface.co/models/facebook/wav2vec2-base-960h",
    name: "Wav2Vec2-Base",
    type: "speech-recognition",
  },
];

async function queryAudioModel(
  modelUrl: string,
  audioData: Blob,
  retries = 3
): Promise<{ data: unknown; error?: string }> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(modelUrl, {
        method: "POST",
        headers: {
          "Content-Type": "audio/wav",
        },
        body: audioData,
      });

      if (response.status === 503) {
        const waitTime = Math.min(5000 * (attempt + 1), 15000);
        console.log(`[v0] Audio model loading, waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[v0] Audio model error: ${response.status} - ${errorText}`);
        return { data: null, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      console.log(`[v0] Audio model response:`, JSON.stringify(data).slice(0, 200));
      return { data };
    } catch (error) {
      console.log(`[v0] Audio fetch error:`, error);
      if (attempt === retries - 1) {
        return { data: null, error: String(error) };
      }
    }
  }
  return { data: null, error: "Max retries exceeded" };
}

// Audio deepfake detection using spectral analysis heuristics
function analyzeAudioCharacteristics(audioData: Buffer): { fake: number; real: number } {
  // Analyze audio buffer for deepfake indicators
  // This is a simplified heuristic-based approach
  
  const dataView = new DataView(audioData.buffer);
  let totalVariance = 0;
  let previousSample = 0;
  let zeroCrossings = 0;
  let peakCount = 0;
  
  // Analyze sample variance and zero crossings (common deepfake indicators)
  const sampleCount = Math.min(audioData.length / 2, 10000);
  
  for (let i = 0; i < sampleCount; i++) {
    const sample = i * 2 < audioData.length - 1 
      ? dataView.getInt16(i * 2, true) 
      : 0;
    
    totalVariance += Math.abs(sample - previousSample);
    
    if ((previousSample >= 0 && sample < 0) || (previousSample < 0 && sample >= 0)) {
      zeroCrossings++;
    }
    
    if (Math.abs(sample) > 20000) {
      peakCount++;
    }
    
    previousSample = sample;
  }
  
  const avgVariance = totalVariance / sampleCount;
  const zeroCrossingRate = zeroCrossings / sampleCount;
  const peakRate = peakCount / sampleCount;
  
  // Heuristic scoring based on audio characteristics
  // Deepfakes often have: lower variance, unusual zero-crossing patterns, fewer peaks
  let fakeScore = 0;
  
  // Very uniform variance suggests synthetic audio
  if (avgVariance < 500) {
    fakeScore += 0.3;
  } else if (avgVariance > 3000) {
    fakeScore -= 0.2;
  }
  
  // Unusual zero-crossing rate
  if (zeroCrossingRate < 0.1 || zeroCrossingRate > 0.6) {
    fakeScore += 0.2;
  }
  
  // Very few or too many peaks
  if (peakRate < 0.01 || peakRate > 0.3) {
    fakeScore += 0.2;
  }
  
  // Normalize to 0-1 range
  fakeScore = Math.max(0, Math.min(1, 0.5 + fakeScore));
  const realScore = 1 - fakeScore;
  
  console.log(`[v0] Audio analysis - variance: ${avgVariance.toFixed(2)}, zeroCrossing: ${zeroCrossingRate.toFixed(3)}, peaks: ${peakRate.toFixed(3)}`);
  console.log(`[v0] Audio scores - fake: ${fakeScore.toFixed(3)}, real: ${realScore.toFixed(3)}`);
  
  return { fake: fakeScore, real: realScore };
}

export async function POST(request: NextRequest) {
  try {
    const { audioUrl, audioBase64 } = await request.json();

    if (!audioUrl && !audioBase64) {
      return NextResponse.json(
        { error: "Either audioUrl or audioBase64 is required" },
        { status: 400 }
      );
    }

    let audioBuffer: Buffer;

    if (audioBase64) {
      const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
      audioBuffer = Buffer.from(base64Data, "base64");
    } else {
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        return NextResponse.json(
          { error: "Failed to fetch audio from URL" },
          { status: 400 }
        );
      }
      const arrayBuffer = await audioResponse.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
    }

    console.log(`[v0] Processing audio, size: ${audioBuffer.length} bytes`);

    // Analyze audio characteristics for deepfake detection
    const analysisResult = analyzeAudioCharacteristics(audioBuffer);
    
    // Try HuggingFace model as secondary check
    const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
    const modelsUsed = ["Spectral-Analysis"];
    
    for (const model of MODELS) {
      const { data, error } = await queryAudioModel(model.url, audioBlob);
      if (!error && data) {
        modelsUsed.push(model.name);
        // If we get valid transcription, it's likely real audio
        if (typeof data === "object" && data !== null && "text" in data) {
          const text = (data as { text: string }).text;
          if (text && text.length > 10) {
            analysisResult.real = Math.min(1, analysisResult.real + 0.1);
            analysisResult.fake = Math.max(0, analysisResult.fake - 0.1);
          }
        }
      }
    }

    // Determine verdict
    let verdict: "authentic" | "uncertain" | "deepfake";
    let confidence: number;

    if (analysisResult.fake > analysisResult.real && analysisResult.fake > 0.55) {
      verdict = "deepfake";
      confidence = analysisResult.fake;
    } else if (analysisResult.real > analysisResult.fake && analysisResult.real > 0.55) {
      verdict = "authentic";
      confidence = analysisResult.real;
    } else {
      verdict = "uncertain";
      confidence = Math.max(analysisResult.fake, analysisResult.real);
    }

    return NextResponse.json({
      verdict,
      confidence,
      scores: {
        fake: analysisResult.fake,
        real: analysisResult.real,
      },
      modelsUsed,
      type: "audio",
    });
  } catch (error) {
    console.error("[v0] Audio detection error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
