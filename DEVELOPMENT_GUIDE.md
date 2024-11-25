# Development Guide

## 1. Core Components Overview

### Entry Points

1. **manifest.json**

   - Start here to understand permissions and extension structure
   - Key configurations for Chrome APIs
   - Content script and service worker registration

2. **content.js**

   - Handles user interactions (double-click events)
   - Creates and manages popup UI
   - Implements message passing with background script

3. **background.js (Service Worker)**
   - Manages AI model interactions
   - Coordinates between content script and side panel
   - Handles extension lifecycle events

### UI Components

4. **sidepanel.html & sidepanel.js**

   - Main interface for detailed word analysis
   - Three main sections: Etymology, Usage, Synonyms
   - Handles data rendering and updates

5. **styles.css**
   - UI styling for popup and side panel
   - Component-specific styles
   - Animation and transition definitions

## 2. Data Flow

A[User Selection] --> B[content.js]
B --> C[background.js]
C --> D[AI Model]
D --> C
C --> E[sidepanel.js]
E --> F[UI Update]

## 3. Key Processes

1. **Word Selection Flow**

   ```javascript
   User double-clicks word
   → content.js creates popup
   → background.js queries AI model
   → sidepanel.js updates UI
   ```

2. **Message Passing System**

   ```javascript
   content.js ↔ background.js ↔ sidepanel.js
   ```

3. **State Management**
   - Popup state in content.js
   - Loading states across components
   - Side panel content management

## 4. Getting Started

1. **Initial Setup**

   ```bash
   git clone [repository-url]
   cd [repository-name]
   # Load extension in Chrome
   ```

2. **Development Environment**

   - Chrome DevTools for debugging
   - Extension management page (`chrome://extensions`)
   - Enable Developer Mode

3. **Testing Flow**
   ```bash
   1. Make changes
   2. Reload extension
   3. Test on sample pages
   4. Check console for errors
   ```

## 5. Common Development Tasks

### Adding New Features

1. Determine component location (content/background/sidepanel)
2. Update message passing if needed
3. Add UI elements
4. Implement error handling
5. Update documentation

### Debugging Tips

- Use `console.log()` in content.js for page interactions
- Check background page console for service worker logs
- Monitor network requests in DevTools
- Inspect side panel using right-click → Inspect

## 6. Code Organization

src/
├── manifest.json # Extension configuration
├── content.js # Page interaction logic
├── background.js # Service worker
├── sidepanel/
│ ├── sidepanel.html # Panel layout
│ ├── sidepanel.js # Panel logic
│ └── styles.css # Styling
└── lib/ # Third-party libraries

## 7. Testing Checklist

- [ ] Word selection works across different sites
- [ ] Popup appears in correct position
- [ ] Side panel updates properly
- [ ] Error states handled gracefully
- [ ] Memory leaks checked
- [ ] Cross-browser compatibility verified

## 8. Common Pitfalls

1. **Message Passing**

   - Always check for runtime errors
   - Handle disconnection cases
   - Clean up listeners

2. **Memory Management**

   - Remove event listeners when not needed
   - Clear popups before creating new ones
   - Monitor side panel memory usage

3. **Security Considerations**
   - Sanitize HTML content
   - Validate user input
   - Follow CSP guidelines

## 9. Performance Tips

1. **Event Handling**

   - Debounce frequent events
   - Use event delegation
   - Clean up listeners

2. **Resource Loading**
   - Lazy load when possible
   - Minimize API calls
   - Cache responses when appropriate

## 10. Useful Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Chrome AI API Reference](https://developer.chrome.com/docs/extensions/reference/ai/)
- [Message Passing Guide](https://developer.chrome.com/docs/extensions/mv3/messaging/)

## 11. Architecture Deep Dive

### Message Types

1. **Content → Background**

   - `getPopupData`: Fetches initial etymology
   - `openSidePanel`: Triggers side panel opening
   - `closeSidePanel`: Closes side panel

2. **Background → Sidepanel**
   - `updateSidePanel`: Updates panel content
   - `updateLoadingStates`: Manages loading indicators

### State Management

javascript
// Key State Objects
let currentPopup = null; // Tracks active popup
let currentButton = null; // Tracks active button
let messageListener = null; // Tracks message listener

## 12. Development Workflow

1. **Feature Development**

   ```bash
   1. Create feature branch
   2. Implement changes
   3. Test locally
   4. Submit PR
   ```

2. **Bug Fixes**
   ```bash
   1. Reproduce issue
   2. Add console logging
   3. Fix and verify
   4. Add regression test
   ```

## 13. Code Review Guidelines

- Check message passing implementation
- Verify memory cleanup
- Review error handling
- Validate UI responsiveness
- Ensure documentation updates
