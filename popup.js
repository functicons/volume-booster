"use strict";

const slider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");
const resetBtn = document.getElementById("resetBtn");
const presetBtns = document.querySelectorAll(".preset-btn");
const statusMsg = document.getElementById("statusMsg");

function getTabKey(tabId) {
  return `gain_tab_${tabId}`;
}

let activeTabId = null;

function showStatus(text, isError) {
  statusMsg.textContent = text;
  statusMsg.style.display = "block";
  statusMsg.style.background = isError ? "#fde8e8" : "#e8f4e8";
  statusMsg.style.color = isError ? "#c00" : "#060";
  statusMsg.style.border = `1px solid ${isError ? "#f5c0c0" : "#b0d8b0"}`;
}

function updateDisplay(percent) {
  volumeValue.textContent = `${percent}%`;
  volumeValue.classList.toggle("boosted", percent > 100);
  presetBtns.forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.gain) === percent);
  });
}

function sendGainToTab(tabId, gain, isRetry) {
  chrome.tabs.sendMessage(
    tabId,
    { type: "SET_GAIN", value: gain },
    (response) => {
      if (chrome.runtime.lastError) {
        if (isRetry) {
          showStatus("Cannot reach page — try reloading the tab.", true);
          return;
        }
        // Content script not loaded yet — inject it, then retry once
        chrome.scripting.executeScript(
          { target: { tabId }, files: ["content.js"] },
          () => {
            if (chrome.runtime.lastError) {
              showStatus("Cannot inject on this page (try a normal http/https page).", true);
              return;
            }
            sendGainToTab(tabId, gain, true);
          }
        );
        return;
      }
      if (!response?.ok) return;
      if (response.found === 0) {
        showStatus("No audio/video found on this page.", true);
      } else if (response.connected === 0) {
        showStatus("This site manages its own audio — start playback, then try adjusting.", true);
      } else {
        statusMsg.style.display = "none";
      }
    }
  );
}

function sendGain(percent) {
  const gain = percent / 100;

  if (activeTabId == null) return;

  chrome.storage.local.set({ [getTabKey(activeTabId)]: gain });
  sendGainToTab(activeTabId, gain, false);
  updateDisplay(percent);
}

slider.addEventListener("input", () => sendGain(Number(slider.value)));

presetBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const percent = Number(btn.dataset.gain);
    slider.value = String(percent);
    sendGain(percent);
  });
});

resetBtn.addEventListener("click", () => {
  slider.value = "100";
  sendGain(100);
});

// Load saved state for this tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  activeTabId = tabs[0]?.id ?? null;
  if (activeTabId == null) return;

  chrome.storage.local.get(getTabKey(activeTabId), (result) => {
    const gain = result[getTabKey(activeTabId)] ?? 1.0;
    const percent = Math.round(gain * 100);
    slider.value = String(percent);
    updateDisplay(percent);
  });
});
