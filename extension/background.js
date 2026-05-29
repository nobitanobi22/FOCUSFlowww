/**
 * background.js — FocusFlow service worker
 *
 * Receives PAGE_VISIT messages from content_script.js,
 * batches them, and flushes to the FocusFlow API every 30 seconds.
 * Updates the extension badge with the live drift score.
 */

const API_BASE = "http://localhost:8000"; // change to production URL when deployed

let eventQueue = [];

// ── Receive events from content scripts ───────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "PAGE_VISIT") return;

  chrome.storage.local.get(["session_id", "token"], (data) => {
    if (!data.session_id || !data.token) return; // no active session

    // Skip internal pages and the FocusFlow dashboard itself
    const url = msg.data.url;
    if (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.includes("localhost:3000")
    ) return;

    eventQueue.push({ ...msg.data, session_id: data.session_id });
  });
});

// ── Flush queue every 30 seconds ──────────────────────────────────────────────

async function flushQueue() {
  if (eventQueue.length === 0) return;

  const batch = [...eventQueue];
  eventQueue = [];

  const { token } = await chrome.storage.local.get("token");
  if (!token) return;

  for (const event of batch) {
    try {
      const res = await fetch(`${API_BASE}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(event),
      });

      if (!res.ok) continue;

      const data = await res.json();

      // Update badge with drift score (0–100)
      const score = Math.round((data.drift_score || 0) * 100);
      const color =
        score < 30 ? "#22c55e" : score < 60 ? "#f59e0b" : "#ef4444";

      chrome.action.setBadgeText({ text: `${score}` });
      chrome.action.setBadgeBackgroundColor({ color });

      // Store latest drift response for popup to read
      chrome.storage.local.set({
        last_drift: {
          score: data.drift_score,
          state: data.state,
          message: data.message,
          updated_at: Date.now(),
        },
      });
    } catch {
      // Re-queue failed events for retry
      eventQueue.push(event);
    }
  }
}

// Use alarms API (more reliable than setInterval in service workers)
chrome.alarms.create("flush", { periodInMinutes: 0.5 }); // every 30 seconds

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flush") flushQueue();
});

// ── Listen for popup messages ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_STATUS") {
    chrome.storage.local.get(["session_id", "last_drift"], (data) => {
      sendResponse({ session_id: data.session_id, drift: data.last_drift });
    });
    return true; // keep channel open for async response
  }

  if (msg.type === "CLEAR_SESSION") {
    chrome.storage.local.remove(["session_id", "last_drift"]);
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ ok: true });
    return true;
  }
});
