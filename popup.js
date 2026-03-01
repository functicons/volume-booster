"use strict";

const slider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");
const resetBtn = document.getElementById("resetBtn");
const presetBtns = document.querySelectorAll(".preset-btn");

function updateDisplay(percent) {
  volumeValue.textContent = `${percent}%`;
  volumeValue.classList.toggle("boosted", percent > 100);

  presetBtns.forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.gain) === percent);
  });
}

function sendGain(percent) {
  const gain = percent / 100;

  chrome.storage.local.set({ gain });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: "SET_GAIN", value: gain });
  });

  updateDisplay(percent);
}

// --- Slider input ---
slider.addEventListener("input", () => {
  sendGain(Number(slider.value));
});

// --- Preset buttons ---
presetBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const percent = Number(btn.dataset.gain);
    slider.value = String(percent);
    sendGain(percent);
  });
});

// --- Reset button ---
resetBtn.addEventListener("click", () => {
  slider.value = "100";
  sendGain(100);
});

// --- Load saved state ---
chrome.storage.local.get("gain", (result) => {
  const gain = result.gain ?? 1.0;
  const percent = Math.round(gain * 100);
  slider.value = String(percent);
  updateDisplay(percent);
});
