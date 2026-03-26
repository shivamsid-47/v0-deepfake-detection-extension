// DeepFake Shield - Background Service Worker

// API endpoint - Update this to your deployed URL
const API_BASE_URL = "https://YOUR_DEPLOYED_URL.vercel.app";

// Store scan results per tab
const tabResults = new Map();

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCAN_MEDIA") {
    handleMediaScan(message.data, sender.tab?.id).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === "GET_RESULTS") {
    const tabId = message.tabId;
    const results = tabResults.get(tabId) || { images: [], videos: [], audio: [], status: "idle" };
    sendResponse(results);
    return true;
  }

  if (message.type === "CLEAR_RESULTS") {
    const tabId = message.tabId;
    tabResults.delete(tabId);
    updateBadge(tabId, "idle");
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "UPDATE_STATUS") {
    const tabId = sender.tab?.id;
    if (tabId) {
      updateBadge(tabId, message.status);
    }
    sendResponse({ success: true });
    return true;
  }
});

// Handle media scanning
async function handleMediaScan(mediaData, tabId) {
  if (!tabId) return { error: "No tab ID" };

  // Initialize results for this tab
  if (!tabResults.has(tabId)) {
    tabResults.set(tabId, { images: [], videos: [], audio: [], status: "scanning" });
  }

  const results = tabResults.get(tabId);
  results.status = "scanning";
  updateBadge(tabId, "scanning");

  try {
    const { type, data, url } = mediaData;

    let endpoint;
    let body;

    switch (type) {
      case "image":
        endpoint = `${API_BASE_URL}/api/detect/image`;
        body = data ? { imageBase64: data } : { imageUrl: url };
        break;
      case "video":
        endpoint = `${API_BASE_URL}/api/detect/video`;
        body = { frames: data };
        break;
      case "audio":
        endpoint = `${API_BASE_URL}/api/detect/audio`;
        body = data ? { audioBase64: data } : { audioUrl: url };
        break;
      default:
        return { error: "Unknown media type" };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (response.ok) {
      // Store result
      const mediaResult = {
        url: url || "inline-data",
        verdict: result.verdict,
        confidence: result.confidence,
        scores: result.scores,
        timestamp: Date.now(),
      };

      if (type === "image") {
        results.images.push(mediaResult);
      } else if (type === "video") {
        results.videos.push(mediaResult);
      } else if (type === "audio") {
        results.audio.push(mediaResult);
      }

      // Update overall status based on worst result
      updateOverallStatus(tabId);

      return { success: true, result };
    } else {
      return { error: result.error || "Detection failed" };
    }
  } catch (error) {
    console.error("Scan error:", error);
    return { error: error.message };
  }
}

// Update overall status based on all results
function updateOverallStatus(tabId) {
  const results = tabResults.get(tabId);
  if (!results) return;

  const allResults = [...results.images, ...results.videos, ...results.audio];

  if (allResults.length === 0) {
    results.status = "idle";
    updateBadge(tabId, "idle");
    return;
  }

  // Check for any deepfakes
  const hasDeepfake = allResults.some((r) => r.verdict === "deepfake");
  const hasUncertain = allResults.some((r) => r.verdict === "uncertain");

  if (hasDeepfake) {
    results.status = "deepfake";
    updateBadge(tabId, "deepfake");
  } else if (hasUncertain) {
    results.status = "uncertain";
    updateBadge(tabId, "uncertain");
  } else {
    results.status = "authentic";
    updateBadge(tabId, "authentic");
  }
}

// Update badge based on status
function updateBadge(tabId, status) {
  const badgeConfig = {
    idle: { text: "", color: "#6B7280" },
    scanning: { text: "...", color: "#3B82F6" },
    authentic: { text: "OK", color: "#22C55E" },
    uncertain: { text: "?", color: "#EAB308" },
    deepfake: { text: "!", color: "#EF4444" },
  };

  const config = badgeConfig[status] || badgeConfig.idle;

  chrome.action.setBadgeText({ tabId, text: config.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: config.color });
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabResults.delete(tabId);
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("DeepFake Shield installed");
});
