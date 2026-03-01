# Volume Booster

A Chrome extension that boosts audio and video volume beyond the normal 100% limit — up to 600%.

## Features

- Boost volume up to 600% on any page with audio or video
- Slider control for fine-grained adjustment
- Quick preset buttons (100%, 200%, 400%, 600%)
- Remembers your volume setting across tabs
- Automatically detects dynamically added media elements
- Works with `<audio>` and `<video>` elements

## How It Works

Volume Booster uses the Web Audio API to create a `GainNode` that amplifies audio output beyond the browser's default maximum. A content script connects to all media elements on the page and routes their audio through the gain node.

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/functicons/volume-booster.git
   ```
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the cloned directory

## Usage

1. Navigate to a page with audio or video
2. Click the Volume Booster extension icon
3. Drag the slider or use a preset button to set your desired volume

## License

MIT
