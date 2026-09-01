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
