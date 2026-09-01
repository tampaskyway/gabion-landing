/* ============================================================
   GABIONOPT — рендер каталога на стороне клиента.
   Данные — data/catalog.json (артикулы, характеристики, цены).
   Страница одна (catalog.html), состояние — в query string:
   ?group=<slug>&subcat=<slug>, карточка товара — оверлей по клику,
   адрес фиксируется в hash (#sku=XXXX) для возможности поделиться ссылкой.
   ============================================================ */
(function () {
  "use strict";

  var GROUP_LABELS = {
    gabiony: "Габионы",
    setka: "Сетка и полотна",
    trosy: "Тросы",
  };

  var state = { data: null, group: null, subcat: null, coating: [] };

  var COATING_LABELS = { zinc: "Оцинкованное", pvc: "С ПВХ-покрытием", steel: "Нержавеющее" };
  function coatingBucket(specs) {
    var v = specs && (specs["Антикоррозионное покрытие"] || specs["Антикоррозионное покрытие соединительных элементов"]);
    if (!v) return null;
    var s = String(v).toLowerCase();
    if (s.indexOf("нерж") !== -1) return "steel";
    if (s.indexOf("пвх") !== -1) return "pvc";
    if (s.indexOf("цинк") !== -1 || s.trim() === "ц") return "zinc";
    return null;
  }

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function readParams() {
    var params = new URLSearchParams(location.search);
    state.group = params.get("group") || null;
    state.subcat = params.get("subcat") || null;
    state.coating = [];
  }

  function setParams(group, subcat) {
    var params = new URLSearchParams();
    if (group) params.set("group", group);
    if (subcat) params.set("subcat", subcat);
    var url = location.pathname + (params.toString() ? "?" + params.toString() : "");
    history.pushState({ group: group, subcat: subcat }, "", url);
    state.group = group;
    state.subcat = subcat;
    state.coating = [];
    render();
  }

  function groupSubcats(group) {
    return state.data.subcats.filter(function (s) { return s.group === group; });
  }

  function filteredProducts() {
    return state.data.products.filter(function (p) {
      if (state.group && p.group !== state.group) return false;
      if (state.subcat && p.subcat !== state.subcat) return false;
      if (state.coating.length && state.coating.indexOf(coatingBucket(p.specs)) === -1) return false;
      return true;
    });
  }

  function groupCoatings(group) {
    var buckets = {};
    state.data.products.forEach(function (p) {
      if (p.group !== group) return;
      var b = coatingBucket(p.specs);
      if (!b) return;
      buckets[b] = (buckets[b] || 0) + 1;
    });
    return Object.keys(buckets).map(function (b) { return { slug: b, name: COATING_LABELS[b], count: buckets[b] }; });
  }

  function render() {
    renderCrumbs();
    renderFilterbar();
    renderGrid();
  }

  function renderCrumbs() {
    var box = qs("#crumbs");
    if (!box) return;
    var parts = ['<a href="./">Каталог</a>'];
    if (state.group) {
      parts.push('<span class="sep">/</span>');
      if (state.subcat) {
        parts.push('<a href="?group=' + state.group + '" data-nav="' + state.group + '">' + GROUP_LABELS[state.group] + "</a>");
      } else {
        parts.push('<span class="cur">' + GROUP_LABELS[state.group] + "</span>");
      }
    }
    if (state.subcat) {
      var sc = state.data.subcats.find(function (s) { return s.group === state.group && s.slug === state.subcat; });
      parts.push('<span class="sep">/</span><span class="cur">' + (sc ? sc.name : state.subcat) + "</span>");
    }
    box.innerHTML = parts.join(" ");
  }

  function renderFilterbar() {
    var toolbar = qs("#catalogToolbar");
    var sidebar = qs("#filtersSidebar");
    var body = qs("#filtersBody");
    var resultCount = qs("#resultCount");
    var filtersCount = qs("#filtersCount");
    if (!toolbar || !sidebar || !body) return;

    if (!state.group) {
      toolbar.style.display = "none";
      sidebar.style.display = "none";
      return;
    }
    toolbar.style.display = "";
    sidebar.style.display = "";

    var subs = groupSubcats(state.group);
    var subsHtml =
      '<div class="filters-group">' +
        '<div class="filters-group-title">Раздел</div>' +
        '<ul class="filters-list">' +
          '<li><a class="filters-opt' + (!state.subcat ? " active" : "") + '" href="?group=' + state.group + '" data-nav-all="' + state.group + '">Все</a></li>' +
          subs.map(function (s) {
            return '<li><a class="filters-opt' + (state.subcat === s.slug ? " active" : "") + '" href="?group=' + state.group + "&subcat=" + s.slug + '" data-nav-sub="' + s.group + "|" + s.slug + '">' +
              s.name + '<span class="n">' + s.count + "</span></a></li>";
          }).join("") +
        "</ul>" +
      "</div>";

    var coatings = groupCoatings(state.group);
    var coatingHtml = "";
    if (coatings.length) {
      coatingHtml =
        '<div class="filters-group">' +
          '<div class="filters-group-title">Покрытие</div>' +
          '<ul class="filters-list">' +
            coatings.map(function (c) {
              var checked = state.coating.indexOf(c.slug) !== -1;
              return '<li><label class="filters-check">' +
                '<input type="checkbox" data-coating="' + c.slug + '"' + (checked ? " checked" : "") + '>' +
                c.name + '<span class="n">' + c.count + "</span>" +
              "</label></li>";
            }).join("") +
          "</ul>" +
        "</div>";
    }

    body.innerHTML = subsHtml + coatingHtml;

    var total = filteredProducts().length;
    if (resultCount) resultCount.textContent = total + " позиций";
    if (filtersCount) {
      var activeCount = (state.subcat ? 1 : 0) + state.coating.length;
      filtersCount.textContent = activeCount || "";
      filtersCount.hidden = !activeCount;
    }
  }

  function closeFilters() {
    qs("#filtersSidebar").classList.remove("open");
    qs("#filtersBackdrop").classList.remove("open");
    document.body.style.overflow = "";
  }
  function openFilters() {
    qs("#filtersSidebar").classList.add("open");
    qs("#filtersBackdrop").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function renderGrid() {
    var grid = qs("#plist");
    if (!grid) return;
    grid.innerHTML = "";
    var items = filteredProducts();
    if (!state.group) {
      renderGroupTiles(grid);
      return;
    }
    if (!items.length) {
      grid.className = "";
      grid.appendChild(el("div", "empty-state", "В этом разделе пока нет карточек — уточните у менеджера."));
      return;
    }
    grid.className = "plist";
    items.slice(0, 240).forEach(function (p) {
      grid.appendChild(renderCard(p));
    });
    if (items.length > 240) {
      var more = el("div", "empty-state", "Показаны первые 240 из " + items.length + " позиций. Уточните типоразмер через фильтр выше или свяжитесь с менеджером — подберём точный артикул.");
      grid.parentNode.appendChild(more);
    }
  }

  function renderGroupTiles(container) {
    container.className = "cat-grid";
    var groups = state.data.groups;
    groups.forEach(function (g, i) {
      var count = state.data.products.filter(function (p) { return p.group === g.slug; }).length;
      var subs = groupSubcats(g.slug).slice(0, 3).map(function (s) { return s.name; }).join(", ");
      var a = el("a", "cat-card");
      a.href = "?group=" + g.slug;
      a.setAttribute("data-nav", g.slug);
      a.innerHTML =
        '<div class="top"><span class="idx">' + String(i + 1).padStart(2, "0") + '</span><span class="count num">' + count + "</span></div>" +
        "<h3>" + g.name + "</h3>" +
        '<div class="sub">' + subs + "</div>" +
        '<div class="go">Перейти в раздел →</div>';
      container.appendChild(a);
    });
  }

  function renderCard(p) {
    var card = el("article", "pcard");
    var specsEntries = Object.entries(p.specs || {}).slice(0, 3);
    var specsHtml = specsEntries.map(function (kv) {
      return "<li><span>" + kv[0] + "</span><span>" + kv[1] + "</span></li>";
    }).join("");
    card.innerHTML =
      '<div class="thumb">фото уточняется</div>' +
      '<div class="sku">Арт. ' + p.sku + "</div>" +
      "<h4>" + p.name + "</h4>" +
      '<ul class="specs">' + specsHtml + "</ul>" +
      '<div class="foot">' +
        '<div class="price na">цена по расчёту</div>' +
        '<button class="btn btn-sm" data-open-sku="' + p.sku + '">Подробнее</button>' +
      "</div>";
    return card;
  }

  function openProduct(sku) {
    var p = state.data.products.find(function (x) { return String(x.sku) === String(sku); });
    if (!p) return;
    var overlay = qs("#pdpOverlay");
    var specRows = Object.entries(p.specs || {}).map(function (kv) {
      return "<tr><td>" + kv[0] + "</td><td>" + kv[1] + "</td></tr>";
    }).join("");
    qs("#pdpBody").innerHTML =
      '<div class="pdp">' +
        '<div class="pdp-gallery">фото изделия<br>уточняется у менеджера</div>' +
        '<div class="pdp-info">' +
          '<div class="sku">Артикул ' + p.sku + " · " + (p.subcat_label || "") + "</div>" +
          "<h2>" + p.name + "</h2>" +
          (p.specs && p.specs["Соответствие стандарту"] ? '<div class="gost">✓ Соответствует ' + p.specs["Соответствие стандарту"] + "</div>" : "") +
          '<p class="desc">' + p.description + "</p>" +
          (specRows ? '<table class="spectable">' + specRows + "</table>" : "") +
          '<div class="buybox">' +
            '<div class="price-row"><div><div class="price">По расчёту</div><div class="price-note">актуальная цена зависит от партии и курса металла — пришлём точный расчёт быстро</div></div></div>' +
            '<a class="btn btn-primary btn-full" href="./#order">Заказать расчёт</a>' +
          "</div>" +
        "</div>" +
      "</div>";
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    location.hash = "sku=" + p.sku;
  }

  function closeProduct() {
    qs("#pdpOverlay").hidden = true;
    document.body.style.overflow = "";
    if (location.hash.indexOf("sku=") === 0 || location.hash.indexOf("#sku=") === 0) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function init(data) {
    state.data = data;
    readParams();
    render();

    document.addEventListener("click", function (e) {
      var navAll = e.target.closest("[data-nav-all]");
      var navSub = e.target.closest("[data-nav-sub]");
      var nav = e.target.closest("[data-nav]");
      var openBtn = e.target.closest("[data-open-sku]");
      var closeBtn = e.target.closest("[data-pdp-close]");
      var filtersToggle = e.target.closest("#filtersToggle");
      var filtersClose = e.target.closest("#filtersClose, #filtersApply");

      if (navSub) {
        e.preventDefault();
        var parts = navSub.getAttribute("data-nav-sub").split("|");
        setParams(parts[0], parts[1]);
        closeFilters();
      } else if (navAll) {
        e.preventDefault();
        setParams(navAll.getAttribute("data-nav-all"), null);
        closeFilters();
      } else if (nav) {
        e.preventDefault();
        setParams(nav.getAttribute("data-nav"), null);
      } else if (openBtn) {
        openProduct(openBtn.getAttribute("data-open-sku"));
      } else if (closeBtn || e.target.id === "pdpOverlay") {
        closeProduct();
      } else if (filtersToggle) {
        openFilters();
      } else if (filtersClose || e.target.id === "filtersBackdrop") {
        closeFilters();
      }
    });

    document.addEventListener("change", function (e) {
      if (e.target.matches("[data-coating]")) {
        var slug = e.target.getAttribute("data-coating");
        var idx = state.coating.indexOf(slug);
        if (e.target.checked && idx === -1) state.coating.push(slug);
        if (!e.target.checked && idx !== -1) state.coating.splice(idx, 1);
        renderFilterbar();
        renderGrid();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeProduct(); closeFilters(); }
    });

    window.addEventListener("popstate", function () {
      readParams();
      render();
    });

    var hashSku = (location.hash.match(/sku=([^&]+)/) || [])[1];
    if (hashSku) openProduct(hashSku);
  }

  fetch("data/catalog.json")
    .then(function (r) { return r.json(); })
    .then(init)
    .catch(function (err) {
      console.error("Не удалось загрузить каталог:", err);
      var grid = qs("#plist");
      if (grid) grid.innerHTML = '<div class="empty-state">Не удалось загрузить каталог. Обновите страницу или свяжитесь с нами по телефону.</div>';
    });
})();
