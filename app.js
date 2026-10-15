// app.js
// Frontend logic for Megan Kawiis AI.

const $ = (id) => document.getElementById(id);

let conversation = [];
let isLoading = false;

function appendMessage(text, who, options = {}) {
  const div = document.createElement("div");
  div.className = `msg ${who}` + (options.loading ? " loading" : "");
  div.textContent = text;
  $("messages").appendChild(div);
  $("messages").scrollTop = $("messages").scrollHeight;
  return div;
}

function setStatus(message, isError = false) {
  const el = $("status");
  el.textContent = message;
  el.classList.toggle("status-error", isError);
}

async function sendToServer() {
  if (isLoading) return;

  const text = $("prompt").value.trim();
  if (!text) return;

  appendMessage(text, "user");
  conversation.push({ role: "user", content: text });
  $("prompt").value = "";

  isLoading = true;
  const loader = appendMessage("Megan is thinking...", "megan", { loading: true });
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  loader.appendChild(spinner);
  setStatus("Thinking...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorBody.error || response.statusText || "Server error");
    }

    const data = await response.json();
    const reply = data.reply || "";
    loader.remove();
    appendMessage(reply, "megan");
    conversation.push({ role: "assistant", content: reply });
    setStatus("Conversation with real AI.");
    speakText(reply);
  } catch (error) {
    loader.remove();
    appendMessage(`Sorry — I couldn't connect to AI. ${error.message}`, "megan");
    setStatus("AI service unavailable — check server configuration.", true);
  } finally {
    isLoading = false;
  }
}

function clearConversation() {
  conversation = [];
  $("messages").innerHTML = "";
  appendMessage("Hey! 💜 Megan Kawiis AI is here. Tell me what's on your mind.", "megan");
  setStatus("Demo mode: connect an AI service for real AI answers.");
}

function newChat() {
  clearConversation();
}

function speakText(text) {
  if (!("speechSynthesis" in window)) return;

  if (window.currentUtterance) {
    speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const selectedVoiceName = $("voiceSelect")?.value;
  if (selectedVoiceName) {
    const selectedVoice = speechSynthesis.getVoices().find((voice) => voice.name === selectedVoiceName);
    if (selectedVoice) utterance.voice = selectedVoice;
  }

  utterance.rate = 1;
  utterance.pitch = 1.08;
  utterance.onend = () => {
    window.currentUtterance = null;
  };

  window.currentUtterance = utterance;
  speechSynthesis.speak(utterance);
}

document.addEventListener("DOMContentLoaded", () => {
  $("send").addEventListener("click", sendToServer);
  $("prompt").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendToServer();
    }
  });

  $("newChat").addEventListener("click", newChat);
  $("clear").addEventListener("click", clearConversation);

  $("improve").addEventListener("click", () => {
    const prompt = $("imagePrompt").value.trim();
    if (!prompt) {
      $("imageResult").classList.remove("hidden");
      $("imageResult").textContent = "Write a description first.";
      return;
    }

    const improved = `${prompt}. Highly detailed composition, cinematic lighting, rich colors, clear subject, professional visual quality.`;
    $("imagePrompt").value = improved;
    $("imageResult").classList.remove("hidden");
    $("imageResult").textContent = "Prompt enhanced. Copy it or press Generate if an image API is configured on the backend.";
  });

  $("copyPrompt").addEventListener("click", async () => {
    const text = $("imagePrompt").value.trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      $("imageResult").classList.remove("hidden");
      $("imageResult").textContent = "Prompt copied!";
    } catch {
      $("imageResult").classList.remove("hidden");
      $("imageResult").textContent = "Unable to copy automatically. Please select and copy the prompt manually.";
    }
  });

  $("generateImage").addEventListener("click", async () => {
    const prompt = $("imagePrompt").value.trim();
    if (!prompt) {
      $("imageResult").classList.remove("hidden");
      $("imageResult").textContent = "Write a prompt first.";
      return;
    }

    $("imageResult").classList.remove("hidden");
    $("imageResult").textContent = "Generating image...";

    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorBody.error || response.statusText || "Image service error");
      }

      const data = await response.json();
      const result = $("imageResult");
      result.textContent = "";
      const img = document.createElement("img");
      img.src = data.url;
      img.alt = "Generated image";
      img.style.maxWidth = "100%";
      img.style.borderRadius = "8px";
      result.appendChild(img);
    } catch (error) {
      $("imageResult").textContent = `Image generation failed: ${error.message}. Configure the backend image API to enable this feature.`;
    }
  });

  $("listen").addEventListener("click", () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus("Voice typing is unavailable in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      $("prompt").value = event.results[0][0].transcript;
      setStatus("Voice captured. Press Send when ready.");
    };
    recognition.onerror = () => {
      setStatus("Voice input failed. Check microphone permission.", true);
    };
    recognition.start();
  });

  $("stop").addEventListener("click", () => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
  });

  $("speak").addEventListener("click", () => {
    const text = $("voiceText").value.trim();
    if (text) speakText(text);
  });

  $("pause").addEventListener("click", () => {
    if (!("speechSynthesis" in window)) return;
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
    } else {
      speechSynthesis.pause();
    }
  });

  if ("speechSynthesis" in window) {
    const loadVoices = () => {
      const select = $("voiceSelect");
      const previousValue = select.value;
      select.innerHTML = '<option value="">Default device voice</option>';

      speechSynthesis.getVoices().forEach((voice) => {
        const option = document.createElement("option");
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        select.appendChild(option);
      });

      select.value = previousValue;
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach((tabButton) => {
        tabButton.classList.toggle("active", tabButton === button);
      });

      ["chat", "images", "voice"].forEach((sectionId) => {
        const section = $(sectionId);
        section.classList.toggle("hidden", sectionId !== button.dataset.tab);
      });
    });
  });

  clearConversation();
});
