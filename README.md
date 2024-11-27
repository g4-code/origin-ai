# Origin AI - Word Etymology Extension

A Chrome extension that provides detailed etymology, usage examples, and synonyms for any word you select on a webpage. Powered by Chrome's AI Language Model API.

## Features

- **Quick Etymology Lookup**: Double-click any word to see its basic etymology in a popup
- **Detailed Side Panel Analysis**: Get comprehensive word information including:
  - Etymology and word origins
  - Usage examples in context
  - Synonyms and antonyms
- **Non-intrusive UI**: Clean popup interface with a loading state indicator
- **AI-Powered Analysis**: Leverages Chrome's AI Language Model for accurate linguistic information
- **Cross-site Compatibility**: Works on any webpage

## Open trial

Go to: https://developer.chrome.com/origintrials/#/trials
yo get a trail token as described at : https://developer.chrome.com/docs/web-platform/origin-trials#extensions

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. load the extension by clicking "Load unpacked" and selecting the extension directory
3. grab the extension ID from details page
4. go to https://developer.chrome.com/origintrials/#/trials
5. create a trial and add the extension ID and trial token
6. refresh the extension page and try it out!

You may need to enable developer mode in chrome://extensions/

## Usage

1. **Basic Word Lookup**:

   - Double-click any word on a webpage
   - A small popup will appear with basic etymology
   - Wait for the "Open in Side Panel" button to become active

2. **Detailed Analysis**:

   - Click "Open in Side Panel" in the popup
   - The side panel will open with three sections:
     - Etymology
     - Usage Examples
     - Synonyms & Antonyms

3. **Navigation**:
   - Click outside the popup to close it
   - The side panel remains open for continued reference
   - Select new words to update the side panel content

## Development

### Project Structure
