const APP_URL = "http://localhost:3000"; // change for production

const $ = (id) => document.getElementById(id);

function setScore(score) {
  const pct = Math.round(score * 100);
  const ring = $("gauge-ring");
  const scoreEl = $("score-text");

  scoreEl.textContent = pct;

  ring.classList.remove("amber", "red");
  if (score >= 0.6) {
    ring.classList.add("red");
    scoreEl.style.color = "#f87171";
  } else if (score >= 0.3) {
    ring.classList.add("amber");
    scoreEl.style.color = "#fbbf24";
  } else {
    scoreEl.style.color = "#4ade80";
  }
}

function setState(state, message) {
  const badge = $("state-badge");
  const msg = $("state-message");

  const labels = {
    active: "Active",
    focused: "Focused",
    drifting: "Drifting",
    deeply_drifted: "Off Topic",
    recovered: "Recovered",
    completed: "Complete",
  };

  badge.textContent = labels[state] || state;
  badge.classList.remove("amber", "red");
  if (state === "drifting") badge.classList.add("amber");
  if (state === "deeply_drifted") badge.classList.add("red");

  msg.textContent = message || "";
}

// Load state from storage (set by background.js)
chrome.storage.local.get(
  ["session_id", "intent_raw", "last_drift"],
  (data) => {
    const dot = $("connection-dot");

    if (!data.session_id) {
      $("no-session").classList.remove("hidden");
      $("active-session").classList.add("hidden");
      dot.className = "dot dot-off";
      return;
    }

    $("no-session").classList.add("hidden");
    $("active-session").classList.remove("hidden");
    dot.className = "dot dot-on";

    if (data.intent_raw) {
      $("intent-text").textContent = data.intent_raw;
    }

    if (data.last_drift) {
      setScore(data.last_drift.score || 0);
      setState(data.last_drift.state || "active", data.last_drift.message || "");
    }
  }
);

// Open app links
$("open-app").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: APP_URL });
});

$("open-dashboard").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${APP_URL}/dashboard` });
});
