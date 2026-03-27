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

  /** Whether the user has activated boosting via the popup */
  let activated = false;

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
   * Connect a media element to the gain node.
   * Must be called from a user-gesture context (e.g., inside a play handler)
   * so that audioCtx.resume() is allowed by the browser.
   * @param {HTMLMediaElement} element
   */
  async function connectElement(element) {
    if (connectedElements.has(element)) return;

    try {
      const { audioCtx, gainNode } = getAudioContext();

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaElementSource(element);
      source.connect(gainNode);
      connectedElements.set(element, source);
      return true;
    } catch (e) {
      console.debug("[Volume Booster] Could not connect element:", e.message);
      return false;
    }
  }

  /**
   * Scan the page for audio/video elements and try to connect them.
   * @returns {{ found: number, connected: number }}
   */
  async function scanAndConnect() {
    const elements = [...document.querySelectorAll("audio, video")];
    const results = await Promise.all(elements.map(connectElement));
    return {
      found: elements.length,
      connected: connectedElements.size,
      newlyConnected: results.filter(Boolean).length,
    };
  }

  function setGain(value) {
    currentGain = value;
    if (gainNode) {
      gainNode.gain.value = value;
    }
  }

  /** Activate: start observing, scan existing elements, and hook play events. */
  function activate() {
    if (activated) return;
    activated = true;

    // Connect elements already on the page
    scanAndConnect();

    // Connect elements added to the DOM later
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
  }

  // --- Hook play events at capture phase ---
  // "play" fires inside a user-gesture context, which allows AudioContext.resume().
  // This also catches elements that were paused during the initial scan.
  document.addEventListener(
    "play",
    (e) => {
      if (!activated) return;
      if (e.target instanceof HTMLMediaElement) {
        connectElement(e.target);
      }
    },
    true // capture so we run before the page's own listeners
  );

  // --- Resume AudioContext on any user interaction on the page ---
  // This is a fallback for cases where the context was created but remains suspended.
  const resumeOnGesture = () => {
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  };
  document.addEventListener("click", resumeOnGesture, true);
  document.addEventListener("keydown", resumeOnGesture, true);

  // --- Message listener ---
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "SET_GAIN") {
      activate();
      setGain(message.value);
      scanAndConnect().then((stats) => {
        sendResponse({ ok: true, gain: currentGain, ...stats });
      });
      return true; // keep channel open for async response
    } else if (message.type === "GET_GAIN") {
      sendResponse({ ok: true, gain: currentGain });
    } else if (message.type === "SCAN") {
      if (activated) {
        scanAndConnect().then((stats) => sendResponse({ ok: true, ...stats }));
        return true;
      }
      sendResponse({ ok: true, found: 0, connected: 0 });
    }
    return true;
  });
})();
