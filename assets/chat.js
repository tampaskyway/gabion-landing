/* ============================================================
   GABIONOPT — чат на сайте, пишет менеджеру в Telegram.
   Бэкенд: /api/chat/send, /api/chat/messages (lead_server.py).
   ============================================================ */
(function () {
  "use strict";

  var API_BASE = "/api/chat";
  var POLL_MS = 4000;

  var launcher = document.getElementById("chatLauncher");
  var panel = document.getElementById("chatPanel");
  var body = document.getElementById("chatBody");
  var input = document.getElementById("chatInput");
  var sendBtn = document.getElementById("chatSendBtn");
  var closeBtn = document.getElementById("chatPanelClose");
  if (!launcher || !panel) return;

  var token = localStorage.getItem("chatToken") || "";
  var lastSeenId = parseInt(localStorage.getItem("chatLastSeenId") || "0", 10);
  var lastMsgId = 0;
  var renderedIds = {};
  var pollTimer = null;
  var isOpen = false;

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }

  function bubbleHtml(m) {
    var cls = m.sender === "manager" ? "manager" : "visitor";
    var text = String(m.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return '<div class="chat-msg ' + cls + '" data-id="' + m.id + '">' + text.replace(/\n/g, "<br>") + "</div>";
  }

  function renderMessages(list, opts) {
    opts = opts || {};
    var emptyEl = qs(".chat-empty", body);
    var added = false;
    list.forEach(function (m) {
      if (renderedIds[m.id]) return;
      renderedIds[m.id] = true;
      if (m.id > lastMsgId) lastMsgId = m.id;
      var div = document.createElement("div");
      div.innerHTML = bubbleHtml(m);
      body.appendChild(div.firstChild);
      added = true;
    });
    if (added && emptyEl) emptyEl.remove();
    if (added && !opts.silent) body.scrollTop = body.scrollHeight;
    return added;
  }

  function updateUnreadDot() {
    if (lastMsgId > lastSeenId) {
      launcher.classList.add("has-unread");
    } else {
      launcher.classList.remove("has-unread");
    }
  }

  function loadMessages(opts) {
    if (!token) return;
    opts = opts || {};
    var afterId = opts.fromZero ? 0 : lastMsgId;
    fetch(API_BASE + "/messages?token=" + encodeURIComponent(token) + "&after_id=" + afterId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok) return;
        renderMessages(data.messages || [], { silent: !isOpen });
        if (isOpen) {
          lastSeenId = lastMsgId;
          localStorage.setItem("chatLastSeenId", String(lastSeenId));
        }
        updateUnreadDot();
      })
      .catch(function () {});
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(function () { loadMessages(); }, POLL_MS);
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function openPanel() {
    panel.hidden = false;
    isOpen = true;
    loadMessages();
    lastSeenId = lastMsgId;
    localStorage.setItem("chatLastSeenId", String(lastSeenId));
    updateUnreadDot();
    startPolling();
    setTimeout(function () { input && input.focus(); }, 50);
  }
  function closePanel() {
    panel.hidden = true;
    isOpen = false;
    stopPolling();
  }

  launcher.addEventListener("click", function () {
    if (panel.hidden) openPanel(); else closePanel();
  });
  if (closeBtn) closeBtn.addEventListener("click", closePanel);

  function appendOptimistic(text) {
    var tempId = "tmp-" + Date.now();
    var div = document.createElement("div");
    div.className = "chat-msg visitor";
    div.setAttribute("data-tmp", tempId);
    div.textContent = text;
    var emptyEl = qs(".chat-empty", body);
    if (emptyEl) emptyEl.remove();
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  function markFailed(el) {
    el.classList.add("failed");
    var retry = document.createElement("span");
    retry.className = "chat-retry";
    retry.textContent = "не доставлено — нажмите, чтобы повторить";
    retry.addEventListener("click", function () {
      var text = el.textContent.replace("не доставлено — нажмите, чтобы повторить", "").trim();
      el.remove();
      deliver(text);
    });
    el.appendChild(retry);
  }

  function deliver(text) {
    var el = appendOptimistic(text);
    var params = new URLSearchParams();
    params.set("token", token);
    params.set("text", text);
    params.set("page_url", location.href);
    fetch(API_BASE + "/send", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok || data.delivered === false) {
          markFailed(el);
          return;
        }
        if (data.token) {
          token = data.token;
          localStorage.setItem("chatToken", token);
        }
        if (data.message_id) {
          el.setAttribute("data-id", data.message_id);
          renderedIds[data.message_id] = true;
          if (data.message_id > lastMsgId) lastMsgId = data.message_id;
        }
      })
      .catch(function () { markFailed(el); });
  }

  function sendChatMessage() {
    var text = (input.value || "").trim();
    if (!text) return;
    input.value = "";
    input.style.height = "auto";
    deliver(text);
  }

  if (sendBtn) sendBtn.addEventListener("click", sendChatMessage);
  if (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 90) + "px";
    });
  }

  // При наличии токена — тихо подгружаем историю, чтобы показать бейдж непрочитанного.
  if (token) {
    loadMessages({ fromZero: true });
  }
})();
