(function () {
  var toggle = document.getElementById("menuToggle");
  var nav = document.getElementById("navMenu");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", function () {
    var isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggle.textContent = isOpen ? "✕" : "☰";
  });
  nav.querySelectorAll("a, button").forEach(function (a) {
    a.addEventListener("click", function () {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "☰";
      nav.querySelectorAll("details.nav-dropdown[open]").forEach(function (d) { d.open = false; });
    });
  });
})();

/* ── Выпадающие меню в шапке (Продукция / Решения) ── */
(function () {
  var dropdowns = document.querySelectorAll("details.nav-dropdown");
  if (!dropdowns.length) return;
  dropdowns.forEach(function (d) {
    d.addEventListener("toggle", function () {
      if (d.open) {
        dropdowns.forEach(function (other) { if (other !== d) other.open = false; });
      }
    });
  });
  document.addEventListener("click", function (e) {
    dropdowns.forEach(function (d) {
      if (d.open && !d.contains(e.target)) d.open = false;
    });
  });
})();

(function () {
  var banner = document.getElementById("cookieBanner");
  var accept = document.getElementById("cookieAccept");
  if (!banner || !accept) return;
  var KEY = "cookieConsent";
  try {
    if (!localStorage.getItem(KEY)) banner.hidden = false;
  } catch (e) {
    banner.hidden = false;
  }
  accept.addEventListener("click", function () {
    banner.hidden = true;
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
  });
})();

/* ── Цели Яндекс.Метрики: клики по телефону и Telegram ── */
(function () {
  function goal(name) {
    if (typeof ym === "function") {
      try { ym(112136183, "reachGoal", name); } catch (e) {}
    }
  }
  document.addEventListener("click", function (e) {
    var tel = e.target.closest('a[href^="tel:"]');
    if (tel) { goal("phone_click"); return; }
    var tg = e.target.closest('a[href*="t.me"]');
    if (tg) { goal("tg_click"); return; }
  });
  window.gabionoptGoal = goal;
})();

/* ── Сквозная аналитика: UTM, yclid, ClientID Метрики — 30 дней ── */
(function () {
  var KEY = "gabionoptAttrib";
  var DAYS = 30;

  function readStore() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      if (!data.savedAt || Date.now() - data.savedAt > DAYS * 86400000) return {};
      return data;
    } catch (e) { return {}; }
  }

  function writeStore(data) {
    try {
      data.savedAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  var params = new URLSearchParams(location.search);
  var utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var hasNewUtm = utmKeys.some(function (k) { return params.get(k); });
  var store = readStore();

  if (hasNewUtm || params.get("yclid")) {
    var fresh = {};
    utmKeys.forEach(function (k) { fresh[k] = params.get(k) || ""; });
    fresh.yclid = params.get("yclid") || "";
    writeStore(fresh);
    store = fresh;
  }

  function fillHiddenFields(form) {
    utmKeys.concat(["yclid"]).forEach(function (k) {
      var input = form.querySelector('input[name="' + k + '"]');
      if (input) input.value = store[k] || "";
    });
    var cidInput = form.querySelector('input[name="client_id"]');
    if (cidInput && typeof ym === "function") {
      try {
        ym(112136183, "getClientID", function (clientID) {
          cidInput.value = clientID || "";
        });
      } catch (e) {}
    }
    var pageInput = form.querySelector('input[name="page_url"]');
    if (pageInput) pageInput.value = location.href;
  }

  window.gabionoptFillAttribution = fillHiddenFields;
})();
