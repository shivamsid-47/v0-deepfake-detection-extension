// DeepFake Shield - Background Service Worker
const API_URL = "https://v0-deepfake-detection-extension-pi.vercel.app";

// Store results per tab
const tabResults = {};

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : message.tabId;

  switch (message.type) {
    case "SCAN_IMAGE":
      scanImage(message.data, tabId).then(sendResponse);
      return true;

    case "SCAN_VIDEO":
      scanVideo(message.data, tabId).then(sendResponse);
      return true;

    case "SCAN_AUDIO":
      scanAudio(message.data, tabId).then(sendResponse);
      return true;

    case "GET_RESULTS":
      sendResponse(tabResults[tabId] || createEmptyResults());
      return true;

    case "CLEAR_RESULTS":
      tabResults[tabId] = createEmptyResults();
      sendResponse({ success: true });
      return true;

    case "UPDATE_STATUS":
      if (tabId && tabResults[tabId]) {
        tabResults[tabId].status = message.status;
      }
      sendResponse({ success: true });
      return true;
  }
});

function createEmptyResults() {
  return { images: [], videos: [], audio: [], status: "idle" };
}

function initTabResults(tabId) {
  if (!tabResults[tabId]) {
    tabResults[tabId] = createEmptyResults();
  }
  return tabResults[tabId];
}

async function scanImage(data, tabId) {
  const results = initTabResults(tabId);
  results.status = "scanning";

  try {
    const response = await fetch(API_URL + "/api/detect/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: data.base64 || null,
        imageUrl: data.url || null
      })
    });

    const result = await response.json();

    if (response.ok) {
      results.images.push({
        url: data.url || "uploaded",
        verdict: result.verdict,
        confidence: result.confidence,
        scores: result.scores
      });
      updateStatus(tabId);
      return { success: true, result: result };
    }
    return { success: false, error: result.error };
  } catch (e) {
    console.error("Scan error:", e);
    return { success: false, error: e.message };
  }
}

async function scanVideo(data, tabId) {
  const results = initTabResults(tabId);
  results.status = "scanning";

  try {
    const response = await fetch(API_URL + "/api/detect/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames: data.frames })
    });

    const result = await response.json();

    if (response.ok) {
      results.videos.push({
        url: data.url || "uploaded",
        verdict: result.verdict,
        confidence: result.confidence,
        scores: result.scores
      });
      updateStatus(tabId);
      return { success: true, result: result };
    }
    return { success: false, error: result.error };
  } catch (e) {
    console.error("Scan error:", e);
    return { success: false, error: e.message };
  }
}

async function scanAudio(data, tabId) {
  const results = initTabResults(tabId);
  results.status = "scanning";

  try {
    const response = await fetch(API_URL + "/api/detect/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64: data.base64 || null,
        audioUrl: data.url || null
      })
    });

    const result = await response.json();

    if (response.ok) {
      results.audio.push({
        url: data.url || "uploaded",
        verdict: result.verdict,
        confidence: result.confidence,
        scores: result.scores
      });
      updateStatus(tabId);
      return { success: true, result: result };
    }
    return { success: false, error: result.error };
  } catch (e) {
    console.error("Scan error:", e);
    return { success: false, error: e.message };
  }
}

function updateStatus(tabId) {
  const results = tabResults[tabId];
  if (!results) return;

  const all = [...results.images, ...results.videos, ...results.audio];
  
  if (all.length === 0) {
    results.status = "idle";
  } else if (all.some(r => r.verdict === "deepfake")) {
    results.status = "deepfake";
  } else if (all.some(r => r.verdict === "uncertain")) {
    results.status = "uncertain";
  } else {
    results.status = "authentic";
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabResults[tabId];
});
