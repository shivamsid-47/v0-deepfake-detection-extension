// DeepFake Shield - Popup Script

document.addEventListener("DOMContentLoaded", () => {
  const shieldCircle = document.getElementById("shieldCircle");
  const statusTitle = document.getElementById("statusTitle");
  const statusSubtitle = document.getElementById("statusSubtitle");
  const imageCount = document.getElementById("imageCount");
  const videoCount = document.getElementById("videoCount");
  const audioCount = document.getElementById("audioCount");
  const resultsSection = document.getElementById("resultsSection");
  const resultsList = document.getElementById("resultsList");
  const rescanBtn = document.getElementById("rescanBtn");
  const clearBtn = document.getElementById("clearBtn");

  // Status configurations
  const statusConfig = {
    idle: {
      title: "No Media Detected",
      subtitle: "Visit a page with images, videos, or audio",
      class: "idle",
    },
    scanning: {
      title: "Scanning...",
      subtitle: "Analyzing media on this page",
      class: "scanning",
    },
    authentic: {
      title: "All Clear",
      subtitle: "No deepfakes detected on this page",
      class: "authentic",
    },
    uncertain: {
      title: "Uncertain",
      subtitle: "Some media could not be verified",
      class: "uncertain",
    },
    deepfake: {
      title: "Warning!",
      subtitle: "Potential deepfake content detected",
      class: "deepfake",
    },
  };

  // Get current tab and load results
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      loadResults(tabs[0].id);
    }
  });

  // Load and display results
  function loadResults(tabId) {
    chrome.runtime.sendMessage({ type: "GET_RESULTS", tabId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting results:", chrome.runtime.lastError);
        updateUI({ images: [], videos: [], audio: [], status: "idle" });
        return;
      }
      updateUI(response || { images: [], videos: [], audio: [], status: "idle" });
    });
  }

  // Update UI with results
  function updateUI(results) {
    const { images, videos, audio, status } = results;

    // Update counts
    imageCount.textContent = images.length;
    videoCount.textContent = videos.length;
    audioCount.textContent = audio.length;

    // Update shield status
    const config = statusConfig[status] || statusConfig.idle;
    shieldCircle.className = `shield-circle ${config.class}`;
    statusTitle.textContent = config.title;
    statusSubtitle.textContent = config.subtitle;

    // Update results list
    const allResults = [
      ...images.map((r) => ({ ...r, mediaType: "image" })),
      ...videos.map((r) => ({ ...r, mediaType: "video" })),
      ...audio.map((r) => ({ ...r, mediaType: "audio" })),
    ];

    if (allResults.length > 0) {
      resultsSection.classList.add("visible");
      resultsList.innerHTML = allResults
        .map((result) => createResultItem(result))
        .join("");
    } else {
      resultsSection.classList.remove("visible");
      resultsList.innerHTML = "";
    }
  }

  // Create result item HTML
  function createResultItem(result) {
    const confidence = Math.round(result.confidence * 100);
    const url = result.url.length > 30
      ? result.url.substring(0, 30) + "..."
      : result.url;

    return `
      <div class="result-item">
        <div class="result-indicator ${result.verdict}"></div>
        <div class="result-info">
          <div class="result-type">${result.mediaType}</div>
          <div class="result-url" title="${result.url}">${url}</div>
        </div>
        <div class="result-confidence">${confidence}%</div>
      </div>
    `;
  }

  // Rescan button
  rescanBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // Update UI to scanning state
        updateUI({ images: [], videos: [], audio: [], status: "scanning" });

        // Send rescan message to content script
        chrome.tabs.sendMessage(tabs[0].id, { type: "RESCAN" }, () => {
          // Reload results after a delay
          setTimeout(() => loadResults(tabs[0].id), 2000);
        });
      }
    });
  });

  // Clear button
  clearBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.runtime.sendMessage(
          { type: "CLEAR_RESULTS", tabId: tabs[0].id },
          () => {
            updateUI({ images: [], videos: [], audio: [], status: "idle" });
          }
        );
      }
    });
  });

  // Poll for updates
  setInterval(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        loadResults(tabs[0].id);
      }
    });
  }, 3000);
});
