/**
 * content_script.js
 * Injected into every page. Captures URL, title, and body text,
 * then sends to the background service worker.
 * Deliberately thin — no logic here.
 */

const captureAndSend = () => {
  const data = {
    url: window.location.href,
    title: document.title,
    // First 3000 chars of visible text — avoids sending giant pages
    text: document.body ? document.body.innerText.slice(0, 3000) : "",
    timestamp: Date.now(),
  };
  chrome.runtime.sendMessage({ type: "PAGE_VISIT", data });
};

// Fire once on initial load
captureAndSend();

// Handle SPA navigation (YouTube, React apps, etc.)
// MutationObserver watches for URL changes that don't trigger full page loads
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    // Wait 1.5s for SPA content to render before capturing
    setTimeout(captureAndSend, 1500);
  }
}).observe(document, { subtree: true, childList: true });
