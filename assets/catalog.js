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

  var GROUP_SEO = {
    gabiony: {
      h1: "Габионы — купить оптом и в розницу",
      title: "Габионы купить — коробчатые, матрацно-тюфячные, цилиндрические | ГабионОпт",
      description: "Габионы от производителя: коробчатые сварные и двойного кручения, матрацно-тюфячные, цилиндрические, ландшафтные. Соответствие ГОСТ, доставка по России.",
    },
    setka: {
      h1: "Сетка и полотна для габионов и ограждений",
      title: "Сетка для габионов купить — двойного кручения, сварная, защитная | ГабионОпт",
      description: "Металлическая сетка для габионных конструкций: двойного кручения, сварная в картах, защитная от БПЛА, противокамнепадная. Оцинкованная и с ПВХ-покрытием.",
    },
    trosy: {
      h1: "Стальные тросы (канаты) — все диаметры и типы свивки",
      title: "Стальные тросы (канаты) купить — одинарной, двойной, шестипрядной свивки | ГабионОпт",
      description: "Стальной трос (канат) от 1 до 28 мм: одинарной, двойной и шестипрядной свивки, по ГОСТ. Расчёт стоимости и доставка по России.",
    },
  };
  var DEFAULT_TITLE = "Каталог габионов, сетки и тросов — ГабионОпт";
  var DEFAULT_DESC = "Каталог габионов, заборных конструкций, сетки двойного кручения, сварной сетки и тросов. Характеристики, ГОСТ. Расчёт стоимости бесплатно.";

  function updateSeo() {
    var h1 = qs("#catalogH1");
    var canonical = qs('link[rel="canonical"]');
    var descTag = qs('meta[name="description"]');
    var seo = state.group && GROUP_SEO[state.group];
    var subLabel = null;
    if (state.group && state.subcat) {
      var sc = state.data.subcats.find(function (s) { return s.group === state.group && s.slug === state.subcat; });
      subLabel = sc ? sc.name : null;
    }

    if (h1) h1.textContent = seo ? (subLabel ? seo.h1.split(" — ")[0] + " — " + subLabel : seo.h1) : "Каталог габионов, сетки и тросов";
    document.title = seo ? (subLabel ? subLabel + " — " + GROUP_LABELS[state.group] + " | ГабионОпт" : seo.title) : DEFAULT_TITLE;
    if (descTag) descTag.setAttribute("content", seo ? seo.description : DEFAULT_DESC);
    if (canonical) {
      canonical.setAttribute("href", state.group ? "https://gabionopt.ru/catalog.html?group=" + state.group : "https://gabionopt.ru/catalog.html");
    }

    var items = [{ "@type": "ListItem", position: 1, name: "Главная", item: "https://gabionopt.ru/" }];
    items.push({ "@type": "ListItem", position: 2, name: "Каталог", item: "https://gabionopt.ru/catalog.html" });
    if (state.group) {
      items.push({
        "@type": "ListItem", position: 3, name: GROUP_LABELS[state.group],
        item: "https://gabionopt.ru/catalog.html?group=" + state.group,
      });
    }
    if (subLabel) {
      items.push({
        "@type": "ListItem", position: 4, name: subLabel,
        item: "https://gabionopt.ru/catalog.html?group=" + state.group + "&subcat=" + state.subcat,
      });
    }
    var breadcrumbLd = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
    var ldScript = qs("#breadcrumbLd");
    if (!ldScript) {
      ldScript = document.createElement("script");
      ldScript.type = "application/ld+json";
      ldScript.id = "breadcrumbLd";
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(breadcrumbLd);
  }

  var state = { data: null, group: null, subcat: null, coating: [], diameter: [] };

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

  function diameterBucket(specs) {
    var v = specs && specs["Диаметр проволоки сетки, мм"];
    if (!v) return null;
    var s = String(v).replace(",", ".");
    var m = s.match(/(\d+(\.\d+)?)/);
    if (!m) return null;
    var n = parseFloat(m[1]);
    if (isNaN(n)) return null;
    return Math.round(n * 2) / 2;
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
    state.diameter = [];
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
    state.diameter = [];
    render();
  }

  function matchesFacets(p, opts) {
    opts = opts || {};
    if (opts.group && p.group !== opts.group) return false;
    if (opts.subcat && p.subcat !== opts.subcat) return false;
    if (opts.coating && opts.coating.length && opts.coating.indexOf(coatingBucket(p.specs)) === -1) return false;
    if (opts.diameter && opts.diameter.length && opts.diameter.indexOf(diameterBucket(p.specs)) === -1) return false;
    return true;
  }

  function countProducts(opts) {
    var n = 0;
    for (var i = 0; i < state.data.products.length; i++) {
      if (matchesFacets(state.data.products[i], opts)) n++;
    }
    return n;
  }

  function groupSubcats(group) {
    var subs = state.data.subcats.filter(function (s) { return s.group === group; });
    return subs.map(function (s) {
      return { group: s.group, slug: s.slug, name: s.name, count: countProducts({ group: group, subcat: s.slug, coating: state.coating, diameter: state.diameter }) };
    });
  }

  function filteredProducts() {
    return state.data.products.filter(function (p) {
      return matchesFacets(p, { group: state.group, subcat: state.subcat, coating: state.coating, diameter: state.diameter });
    });
  }

  function groupCoatings(group) {
    var buckets = {};
    state.data.products.forEach(function (p) {
      if (!matchesFacets(p, { group: group, subcat: state.subcat, diameter: state.diameter })) return;
      var b = coatingBucket(p.specs);
      if (!b) return;
      buckets[b] = (buckets[b] || 0) + 1;
    });
    return Object.keys(buckets).map(function (b) { return { slug: b, name: COATING_LABELS[b], count: buckets[b] }; });
  }

  function groupDiameters(group) {
    var buckets = {};
    state.data.products.forEach(function (p) {
      if (!matchesFacets(p, { group: group, subcat: state.subcat, coating: state.coating })) return;
      var b = diameterBucket(p.specs);
      if (b === null) return;
      buckets[b] = (buckets[b] || 0) + 1;
    });
    return Object.keys(buckets).map(Number).sort(function (a, b) { return a - b; }).map(function (b) {
      return { slug: b, name: (b % 1 === 0 ? b : b) + " мм", count: buckets[b] };
    });
  }

  function render() {
    renderCrumbs();
    renderFilterbar();
    renderGrid();
    updateSeo();
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
          '<li><a class="filters-opt' + (!state.subcat ? " active" : "") + '" href="?group=' + state.group + '" data-nav-all="' + state.group + '">Все<span class="n">' + countProducts({ group: state.group, coating: state.coating, diameter: state.diameter }) + '</span></a></li>' +
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

    var diameters = groupDiameters(state.group);
    var diameterHtml = "";
    if (diameters.length > 1) {
      diameterHtml =
        '<div class="filters-group">' +
          '<div class="filters-group-title">Диаметр проволоки</div>' +
          '<ul class="filters-list">' +
            diameters.map(function (d) {
              var checked = state.diameter.indexOf(d.slug) !== -1;
              return '<li><label class="filters-check">' +
                '<input type="checkbox" data-diameter="' + d.slug + '"' + (checked ? " checked" : "") + '>' +
                d.name + '<span class="n">' + d.count + "</span>" +
              "</label></li>";
            }).join("") +
          "</ul>" +
        "</div>";
    }

    body.innerHTML = subsHtml + coatingHtml + diameterHtml;

    var total = filteredProducts().length;
    if (resultCount) resultCount.textContent = total + " позиций";
    if (filtersCount) {
      var activeCount = (state.subcat ? 1 : 0) + state.coating.length + state.diameter.length;
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
    var layout = qs("#catalogLayout");
    if (!grid) return;
    grid.innerHTML = "";
    var items = filteredProducts();
    if (!state.group) {
      if (layout) layout.classList.add("no-sidebar");
      renderGroupTiles(grid);
      return;
    }
    if (layout) layout.classList.remove("no-sidebar");
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
      var subs = groupSubcats(g.slug).slice(0, 3).map(function (s) { return s.name; }).join(", ");
      var a = el("a", "cat-card");
      a.href = "?group=" + g.slug;
      a.setAttribute("data-nav", g.slug);
      a.innerHTML =
        '<div class="top"><span class="idx">' + String(i + 1).padStart(2, "0") + '</span></div>' +
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
            '<a class="btn btn-primary btn-full" href="./?openOrder=1">Заказать расчёт</a>' +
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
      } else if (e.target.matches("[data-diameter]")) {
        var dval = parseFloat(e.target.getAttribute("data-diameter"));
        var didx = state.diameter.indexOf(dval);
        if (e.target.checked && didx === -1) state.diameter.push(dval);
        if (!e.target.checked && didx !== -1) state.diameter.splice(didx, 1);
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
