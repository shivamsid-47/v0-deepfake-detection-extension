// DeepFake Shield - Content Script

(function () {
  if (window.__deepfakeShieldInjected) return;
  window.__deepfakeShieldInjected = true;

  let isScanning = false;
  let scannedUrls = new Set();

  setTimeout(() => {
    scanPage();
  }, 1500);

  const observer = new MutationObserver((mutations) => {
    let hasNewMedia = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.tagName === "IMG" || node.tagName === "VIDEO" || node.tagName === "AUDIO") {
            hasNewMedia = true;
          } else if (node.querySelectorAll) {
            const media = node.querySelectorAll("img, video, audio");
            if (media.length > 0) hasNewMedia = true;
          }
        }
      });
    });
    if (hasNewMedia && !isScanning) {
      setTimeout(() => scanPage(), 500);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  async function scanPage() {
    if (isScanning) return;
    isScanning = true;
    chrome.runtime.sendMessage({ type: "UPDATE_STATUS", status: "scanning" });

    try {
      const images = document.querySelectorAll("img");
      for (const img of images) {
        await scanImage(img);
      }
      const videos = document.querySelectorAll("video");
      for (const video of videos) {
        await scanVideo(video);
      }
      const audioElements = document.querySelectorAll("audio");
      for (const audio of audioElements) {
        await scanAudio(audio);
      }
    } catch (error) {
      console.error("DeepFake Shield scan error:", error);
    }
    isScanning = false;
  }

  async function scanImage(img) {
    const src = img.src || img.currentSrc;
    if (!src || scannedUrls.has(src)) return;
    if (src.startsWith("data:image/svg") || src.includes(".svg")) return;
    if (img.width < 50 || img.height < 50) return;

    scannedUrls.add(src);

    try {
      let data = null;
      if (isValidImageUrl(src)) {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!img.complete) {
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          if (canvas.width === 0 || canvas.height === 0) return;
          ctx.drawImage(img, 0, 0);
          data = canvas.toDataURL("image/jpeg", 0.8);
        } catch (e) {
          data = null;
        }
      }

      const result = await chrome.runtime.sendMessage({
        type: "SCAN_MEDIA",
        data: { type: "image", data: data, url: src },
      });

      if (result?.result) {
        console.log("DeepFake Shield: Image scanned -", result.result.verdict);
      }
    } catch (error) {
      console.error("Error scanning image:", error);
    }
  }

  async function scanVideo(video) {
    const src = video.src || video.currentSrc;
    const sourceElements = video.querySelectorAll("source");
    const actualSrc = src || (sourceElements.length > 0 ? sourceElements[0].src : null);
    if (!actualSrc || scannedUrls.has(actualSrc)) return;
    scannedUrls.add(actualSrc);

    try {
      if (video.readyState < 2) {
        await new Promise((resolve, reject) => {
          video.onloadeddata = resolve;
          video.onerror = reject;
          setTimeout(resolve, 5000);
        });
      }
      const frames = await extractVideoFrames(video, 3);
      if (frames.length === 0) return;

      const result = await chrome.runtime.sendMessage({
        type: "SCAN_MEDIA",
        data: { type: "video", data: frames, url: actualSrc },
      });

      if (result?.result) {
        console.log("DeepFake Shield: Video scanned -", result.result.verdict);
      }
    } catch (error) {
      console.error("Error scanning video:", error);
    }
  }

  async function extractVideoFrames(video, numFrames) {
    const frames = [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    if (canvas.width === 0 || canvas.height === 0) return frames;

    const duration = video.duration || 0;
    if (duration === 0 || isNaN(duration)) {
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.7));
      } catch (e) {}
      return frames;
    }

    const interval = duration / (numFrames + 1);
    for (let i = 1; i <= numFrames; i++) {
      try {
        video.currentTime = interval * i;
        await new Promise((resolve) => {
          video.onseeked = resolve;
          setTimeout(resolve, 1000);
        });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.7));
      } catch (e) {}
    }
    return frames;
  }

  async function scanAudio(audio) {
    const src = audio.src || audio.currentSrc;
    const sourceElements = audio.querySelectorAll("source");
    const actualSrc = src || (sourceElements.length > 0 ? sourceElements[0].src : null);
    if (!actualSrc || scannedUrls.has(actualSrc)) return;
    scannedUrls.add(actualSrc);

    try {
      const result = await chrome.runtime.sendMessage({
        type: "SCAN_MEDIA",
        data: { type: "audio", data: null, url: actualSrc },
      });
      if (result?.result) {
        console.log("DeepFake Shield: Audio scanned -", result.result.verdict);
      }
    } catch (error) {
      console.error("Error scanning audio:", error);
    }
  }

  function isValidImageUrl(url) {
    if (!url) return false;
    if (url.startsWith("data:")) return true;
    if (url.startsWith("blob:")) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "RESCAN") {
      scannedUrls.clear();
      scanPage().then(() => sendResponse({ success: true }));
      return true;
    }
  });
})();
