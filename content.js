(() => {
  "use strict";

  /** @type {AudioContext | null} */
  let audioCtx = null;

  /** @type {GainNode | null} */
  let gainNode = null;

  /** @type {Map<HTMLMediaElement, MediaElementAudioSourceNode>} */
  const connectedElements = new Map();

  /** Current gain multiplier (1.0 = 100%) */
  let currentGain = 1.0;

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new AudioContext();
      gainNode = audioCtx.createGain();
      gainNode.gain.value = currentGain;
      gainNode.connect(audioCtx.destination);
    }
    return { audioCtx, gainNode };
  }

  /**
   * Connect a media element to the gain node for volume boosting.
   * @param {HTMLMediaElement} element
   */
  function connectElement(element) {
    if (connectedElements.has(element)) return;

    try {
      const { audioCtx, gainNode } = getAudioContext();

      // Resume context if suspended (browsers require user gesture)
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const source = audioCtx.createMediaElementSource(element);
      source.connect(gainNode);
      connectedElements.set(element, source);
    } catch (e) {
      // Element may already be connected to another context — ignore
      console.debug("[Volume Booster] Could not connect element:", e.message);
    }
  }

  /** Scan the page for audio/video elements and connect them. */
  function scanAndConnect() {
    const mediaElements = document.querySelectorAll("audio, video");
    mediaElements.forEach(connectElement);
  }

  /**
   * Set the gain value.
   * @param {number} value - Gain multiplier (e.g. 1.0 = 100%, 3.0 = 300%)
   */
  function setGain(value) {
    currentGain = value;
    if (gainNode) {
      gainNode.gain.value = value;
    }
  }

  // --- Observe DOM for dynamically added media elements ---
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLMediaElement) {
          connectElement(node);
        } else if (node instanceof HTMLElement) {
          node.querySelectorAll?.("audio, video").forEach(connectElement);
        }
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // --- Initial scan ---
  scanAndConnect();

  // --- Listen for messages from the popup ---
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "SET_GAIN") {
      setGain(message.value);
      sendResponse({ ok: true, gain: currentGain });
    } else if (message.type === "GET_GAIN") {
      sendResponse({ ok: true, gain: currentGain });
    } else if (message.type === "SCAN") {
      scanAndConnect();
      sendResponse({ ok: true, count: connectedElements.size });
    }
    return true; // keep channel open for async sendResponse
  });

  // --- Restore saved gain for this tab ---
  chrome.storage.local.get("gain", (result) => {
    if (result.gain !== undefined) {
      setGain(result.gain);
    }
  });
})();
