// public/app.js
// Megan Kawiis AI frontend script — conversation state, server calls, voice, and Image Studio.

const $ = id => document.getElementById(id);

let conversation = []; // session-only
let isLoading = false;

function appendMessage(text, who, opts = {}) {
  const div = document.createElement("div");
  div.className = "msg " + who + (opts.loading ? " loading" : "");
  div.textContent = text;
  const container = $("messages");
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function setStatus(msg, isError = false) {
  const el = $("status");
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("status-error", !!isError);
}

async function sendToServer() {
  if (isLoading) return;
  const input = $("prompt");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  conversation.push({ role: "user", content: text });
  input.value = "";

  isLoading = true;
  const loader = appendMessage("Megan is thinking...", "megan", { loading: true });
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  loader.appendChild(spinner);
  setStatus("Thinking...");

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation }),
    });

    if (!resp.ok) {
      let errMsg = `Server error (${resp.status})`;
      try {
        const errJson = await resp.json();
        if (errJson && errJson.error) errMsg = errJson.error;
      } catch (e) {
        // ignore parse errors
      }
      throw new Error(errMsg);
    }

    let data;
    try {
      data = await resp.json();
    } catch (e) {
      throw new Error("Invalid response from server");
    }

    const reply = (data && data.reply) ? String(data.reply).trim() : "";

    loader.remove();

    if (!reply) {
      appendMessage("Sorry — the AI returned an empty response.", "megan");
      setStatus("AI returned empty response.", true);
    } else {
      appendMessage(reply, "megan");
      conversation.push({ role: "assistant", content: reply });
      setStatus("Connected to AI service.");
      try { speakText(reply); } catch {}
    }
  } catch (err) {
    loader.remove();
    appendMessage("Sorry — could not get a real AI response. " + (err.message || ""), "megan");
    setStatus("AI service unavailable — check server configuration.", true);
  } finally {
    isLoading = false;
  }
}

function clearConversation() {
  conversation = [];
  const messages = $("messages");
  if (messages) messages.innerHTML = "";
  appendMessage("Hey! 💜 Megan Kawiis AI is here. Tell me what's on your mind.", "megan");
  setStatus("Checking server configuration…");
}

function newChat() {
  clearConversation();
}

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    setStatus("Speech output not supported in this browser.", true);
    return;
  }
  if (window.currentUtterance) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const selected = $("voiceSelect")?.value;
  if (selected) {
    const v = speechSynthesis.getVoices().find(s => s.name === selected);
    if (v) u.voice = v;
  }
  u.rate = 1;
  u.pitch = 1.08;
  u.onend = () => (window.currentUtterance = null);
  window.currentUtterance = u;
  speechSynthesis.speak(u);
}

// Health check helper
async function checkServerHealth() {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    if (!r.ok) {
      setStatus("Server unreachable or misconfigured.", true);
      return false;
    }
    const j = await r.json().catch(() => null);
    if (j && j.status === "ok" && j.apiConfigured) {
      setStatus("Connected to AI service.");
      return true;
    } else if (j && j.status === "ok") {
      setStatus("Server running but AI not configured (demo mode).", true);
      return false;
    } else {
      setStatus("Server health check returned unexpected result.", true);
      return false;
    }
  } catch (e) {
    setStatus("Server unreachable — falling back to demo mode.", true);
    return false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const sendBtn = $("send");
  if (sendBtn) sendBtn.addEventListener("click", sendToServer);

  const prompt = $("prompt");
  if (prompt) {
    prompt.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendToServer();
      }
    });
  }

  const newBtn = $("newChat");
  if (newBtn) newBtn.addEventListener("click", newChat);
  const clearBtn = $("clear");
  if (clearBtn) clearBtn.addEventListener("click", clearConversation);

  // Image Studio
  const improve = $("improve");
  if (improve) improve.addEventListener("click", () => {
    const t = $("imagePrompt").value.trim();
    if (!t) {
      $("imageResult").classList.remove("hidden");
      $("imageResult").textContent = "Write a description first.";
      return;
    }
    const improved = t + ". Highly detailed composition, cinematic lighting, rich colors, clear subject, professional visual quality.";
    $("imagePrompt").value = improved;
    $("imageResult").classList.remove("hidden");
    $("imageResult").textContent = "Prompt improved — copy it or press Generate if a backend image API is configured.";
  });

  const copyBtn = $("copyPrompt");
  if (copyBtn) copyBtn.addEventListener("click", async () => {
    const text = $("imagePrompt").value.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      $("imageResult").classList.remove("hidden");
      $("imageResult").textContent = "Prompt copied!";
    } catch {
      $("imageResult").classList.remove("hidden");
      $("imageResult").textContent = "Unable to copy automatically. Please copy manually.";
    }
  });

  const genBtn = $("generateImage");
  if (genBtn) genBtn.addEventListener("click", async () => {
    const p = $("imagePrompt").value.trim();
    if (!p) {
      $("imageResult").classList.remove("hidden");
      $("imageResult").textContent = "Write a prompt first.";
      return;
    }
    $("imageResult").classList.remove("hidden");
    $("imageResult").textContent = "Generating image...";
    try {
      const r = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({ error: r.statusText }));
        throw new Error(body.error || r.statusText || "Image service error");
      }
      const j = await r.json();
      // Render image securely without innerHTML
      const result = $("imageResult");
      result.classList.remove("hidden");
      result.innerHTML = ""; // clear previous
      if (j.url) {
        const img = document.createElement("img");
        img.src = j.url;
        img.alt = "Generated image";
        img.style.maxWidth = "100%";
        img.style.borderRadius = "8px";
        result.appendChild(img);
      } else {
        result.textContent = "Image generated but no URL returned.";
      }
    } catch (err) {
      $("imageResult").textContent = "Image generation failed: " + (err.message || "unknown");
    }
  });

  // Voice typing
  const listen = $("listen");
  if (listen) listen.addEventListener("click", () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setStatus("Voice typing unavailable in this browser."); return; }
    const r = new Recognition();
    r.lang = "en-US";
    r.onresult = e => { $("prompt").value = e.results[0][0].transcript; setStatus("Voice captured. Press Send when ready."); };
    r.onerror = () => setStatus("Voice input failed. Check microphone permission.", true);
    r.start();
  });

  const stop = $("stop");
  if (stop) stop.addEventListener("click", () => { if ("speechSynthesis" in window) speechSynthesis.cancel(); });

  const speak = $("speak");
  if (speak) speak.addEventListener("click", () => { const t = $("voiceText").value.trim(); if (t) speakText(t); });

  const pause = $("pause");
  if (pause) pause.addEventListener("click", () => { if (!("speechSynthesis" in window)) return; if (speechSynthesis.paused) speechSynthesis.resume(); else speechSynthesis.pause(); });

  // Load voices
  if ("speechSynthesis" in window) {
    const loadVoices = () => {
      const sel = $("voiceSelect");
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = '<option value="">Default device voice</option>';
      speechSynthesis.getVoices().forEach(v => {
        const o = document.createElement("option");
        o.value = v.name;
        o.textContent = `${v.name} (${v.lang})`;
        sel.appendChild(o);
      });
      sel.value = prev;
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  // Tabs
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b === btn));
      ["chat","images","voice"].forEach(id => { const section = document.getElementById(id); section.classList.toggle("hidden", id !== btn.dataset.tab); });
    });
  });

  // Run health check and set initial status
  await checkServerHealth();
  clearConversation();
});
