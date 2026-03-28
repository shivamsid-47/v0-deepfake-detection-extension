// DeepFake Shield - Content Script
(function() {
  if (window._deepfakeShield) return;
  window._deepfakeShield = true;

  const scanned = new Set();

  // Start scanning after page loads
  setTimeout(scanPage, 2000);

  // Watch for new elements
  const observer = new MutationObserver(() => {
    setTimeout(scanPage, 1000);
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function scanPage() {
    // Scan images
    document.querySelectorAll("img").forEach(img => scanImage(img));
    
    // Scan videos
    document.querySelectorAll("video").forEach(video => scanVideo(video));
    
    // Scan audio
    document.querySelectorAll("audio").forEach(audio => scanAudio(audio));
  }

  async function scanImage(img) {
    const src = img.src || img.currentSrc;
    if (!src || scanned.has(src)) return;
    if (img.width < 100 || img.height < 100) return;
    if (src.includes(".svg") || src.startsWith("data:image/svg")) return;
    
    scanned.add(src);

    try {
      let base64 = null;
      
      // Try to get base64 from canvas
      if (img.complete && img.naturalWidth > 0) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(img.naturalWidth, 800);
          canvas.height = Math.min(img.naturalHeight, 800);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          base64 = canvas.toDataURL("image/jpeg", 0.8);
        } catch (e) {
          // CORS error, use URL instead
        }
      }

      chrome.runtime.sendMessage({
        type: "SCAN_IMAGE",
        data: { base64: base64, url: src }
      });
    } catch (e) {
      console.error("DeepFake Shield: Image scan error", e);
    }
  }

  async function scanVideo(video) {
    const src = video.src || video.currentSrc;
    const key = src || video.getAttribute("data-src") || "video-" + Math.random();
    if (scanned.has(key)) return;
    scanned.add(key);

    try {
      // Wait for video to be ready
      if (video.readyState < 2) {
        await new Promise(r => {
          video.addEventListener("loadeddata", r, { once: true });
          setTimeout(r, 3000);
        });
      }

      const frames = [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = Math.min(video.videoWidth || 640, 640);
      canvas.height = Math.min(video.videoHeight || 480, 480);

      // Capture current frame
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.7));
      } catch (e) {}

      if (frames.length > 0) {
        chrome.runtime.sendMessage({
          type: "SCAN_VIDEO",
          data: { frames: frames, url: src }
        });
      }
    } catch (e) {
      console.error("DeepFake Shield: Video scan error", e);
    }
  }

  async function scanAudio(audio) {
    const src = audio.src || audio.currentSrc;
    if (!src || scanned.has(src)) return;
    scanned.add(src);

    try {
      chrome.runtime.sendMessage({
        type: "SCAN_AUDIO",
        data: { url: src }
      });
    } catch (e) {
      console.error("DeepFake Shield: Audio scan error", e);
    }
  }

  // Listen for rescan command
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "RESCAN") {
      scanned.clear();
      scanPage();
      sendResponse({ success: true });
    }
    return true;
  });
})();
