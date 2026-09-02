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
    var introEl = qs("#catalogIntro");
    var seo = state.group && GROUP_SEO[state.group];
    var subLabel = null;
    var sc = null;
    if (state.group && state.subcat) {
      sc = state.data.subcats.find(function (s) { return s.group === state.group && s.slug === state.subcat; });
      subLabel = sc ? sc.name : null;
    }

    if (h1) h1.textContent = seo ? (subLabel ? seo.h1.split(" — ")[0] + " — " + subLabel : seo.h1) : "Каталог габионов, сетки и тросов";
    document.title = seo ? (subLabel ? subLabel + " — " + GROUP_LABELS[state.group] + " | ГабионОпт" : seo.title) : DEFAULT_TITLE;
    if (descTag) descTag.setAttribute("content", (sc && sc.seo_intro) ? sc.seo_intro.slice(0, 300) : (seo ? seo.description : DEFAULT_DESC));
    if (introEl) {
      var introText = (sc && sc.seo_intro) || (seo && seo.description) || "";
      if (introText) { introEl.textContent = introText; introEl.hidden = false; }
      else { introEl.hidden = true; introEl.textContent = ""; }
    }
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

  var state = { data: null, group: null, subcat: null, coating: [], diameter: [], size: [] };

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

  var TROSY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 25, 28, 46, 48, 55, 65, 75];
  function trosySizeRange(specs) {
    var v = specs && specs["Диапазон диаметров"];
    if (!v) return null;
    var s = String(v).replace(",", ".");
    var range = s.match(/(\d+(\.\d+)?)\s*[–-]\s*(\d+(\.\d+)?)/);
    if (range) return [parseFloat(range[1]), parseFloat(range[3])];
    var single = s.match(/(\d+(\.\d+)?)/);
    if (!single) return null;
    var n = parseFloat(single[1]);
    return [n, n];
  }
  function matchesTrosySize(specs, size) {
    var range = trosySizeRange(specs);
    if (!range) return false;
    var lower = size - 0.5, upper = size + 0.5;
    return range[1] >= lower && range[0] < upper;
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
    state.size = [];
  }

  function scrollToGridTop() {
    var target = qs("#catalogLayout") || qs("#plist");
    if (!target) return;
    var top = target.getBoundingClientRect().top + window.pageYOffset - 90;
    if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: "smooth" });
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
    state.size = [];
    render();
    scrollToGridTop();
  }

  function matchesFacets(p, opts) {
    opts = opts || {};
    if (opts.group && p.group !== opts.group) return false;
    if (opts.subcat && p.subcat !== opts.subcat) return false;
    if (opts.coating && opts.coating.length && opts.coating.indexOf(coatingBucket(p.specs)) === -1) return false;
    if (opts.diameter && opts.diameter.length && opts.diameter.indexOf(diameterBucket(p.specs)) === -1) return false;
    if (opts.size && opts.size.length && !opts.size.some(function (sz) { return matchesTrosySize(p.specs, sz); })) return false;
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
      return { group: s.group, slug: s.slug, name: s.name, count: countProducts({ group: group, subcat: s.slug, coating: state.coating, diameter: state.diameter, size: state.size }) };
    });
  }

  function filteredProducts() {
    return state.data.products.filter(function (p) {
      return matchesFacets(p, { group: state.group, subcat: state.subcat, coating: state.coating, diameter: state.diameter, size: state.size });
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

  function groupTrosySizes(group) {
    if (group !== "trosy") return [];
    var buckets = {};
    state.data.products.forEach(function (p) {
      if (!matchesFacets(p, { group: group, subcat: state.subcat })) return;
      TROSY_SIZES.forEach(function (sz) {
        if (matchesTrosySize(p.specs, sz)) buckets[sz] = (buckets[sz] || 0) + 1;
      });
    });
    return TROSY_SIZES.filter(function (sz) { return buckets[sz]; }).map(function (sz) {
      return { slug: sz, name: sz + " мм", count: buckets[sz] };
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
          '<li><a class="filters-opt' + (!state.subcat ? " active" : "") + '" href="?group=' + state.group + '" data-nav-all="' + state.group + '">Все<span class="n">' + countProducts({ group: state.group, coating: state.coating, diameter: state.diameter, size: state.size }) + '</span></a></li>' +
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

    var trosySizes = groupTrosySizes(state.group);
    var trosySizeHtml = "";
    if (trosySizes.length > 1) {
      trosySizeHtml =
        '<div class="filters-group">' +
          '<div class="filters-group-title">Диаметр, мм</div>' +
          '<ul class="filters-list">' +
            trosySizes.map(function (d) {
              var checked = state.size.indexOf(d.slug) !== -1;
              return '<li><label class="filters-check">' +
                '<input type="checkbox" data-size="' + d.slug + '"' + (checked ? " checked" : "") + '>' +
                d.name + '<span class="n">' + d.count + "</span>" +
              "</label></li>";
            }).join("") +
          "</ul>" +
        "</div>";
    }

    body.innerHTML = subsHtml + coatingHtml + diameterHtml + trosySizeHtml;

    var total = filteredProducts().length;
    if (resultCount) resultCount.textContent = total + " позиций";
    if (filtersCount) {
      var activeCount = (state.subcat ? 1 : 0) + state.coating.length + state.diameter.length + state.size.length;
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

  var GOST_PDF_MAP = [
    ["52132-2003", "documents/GOST-R-52132-2003.pdf", "ГОСТ Р 52132-2003 — Изделия из сетки для габионных конструкций"],
    ["58120-2018", "documents/GOST-R-58120-2018.pdf", "ГОСТ Р 58120-2018 — Габионная сварная сетка"],
    ["13603-89", "documents/GOST-13603-89.pdf", "ГОСТ 13603-89 — Сетки проволочные крученые с шестиугольными ячейками"],
    ["51285-99", "documents/GOST-R-51285-99.pdf", "ГОСТ Р 51285-99 — Сетки проволочные крученые с шестиугольными ячейками для габионов"]
  ];
  var TROSY_GOST_TITLES = {
    "3062-80": "Канат одинарной свивки типа ЛК-О конструкции 1×7 (1+6). Сортамент",
    "3063-80": "Канат одинарной свивки типа ТК конструкции 1×19 (1+6+12). Сортамент",
    "3064-80": "Канат одинарной свивки типа ТК конструкции 1×37 (1+6+12+18). Сортамент",
    "3066-80": "Канат двойной свивки типа ЛК-О конструкции 6×7 (1+6)+1×7(1+6). Сортамент",
    "2688-80": "Канат двойной свивки типа ЛК-Р конструкции 6×19(1+6+6/6)+1 о.с. Сортамент",
    "3069-80": "Канат двойной свивки типа ЛК-О конструкции 6×7 (1+6)+1 о.с. Сортамент",
    "3067-88": "Канат двойной свивки типа ТК конструкции 6×19(1+6+12)+1×19(1+6+12). Сортамент",
    "3077-80": "Канат двойной свивки типа ЛК-О конструкции 6×19 (1+9+9)+1 о.с. Сортамент",
    "2172-80": "Канаты стальные авиационные. Технические условия",
    "3070-88": "Канат двойной свивки типа ТК конструкции 6×19 (1+6+12)+1 о.с. Сортамент",
    "3081-80": "Канат двойной свивки типа ЛК-О конструкции 6×19 (1+9+9)+7×7 (1+6). Сортамент",
    "3068-88": "Канат двойной свивки типа ТК конструкции 6×37(1+6+12+18)+1×37(1+6+12+18). Сортамент",
    "3071-88": "Канат двойной свивки типа ТК конструкции 6×37 (1+6+12+18)+1 о.с. Сортамент",
    "7667-80": "Канат двойной свивки типа ЛК-З конструкции 6×25 (1+6; 6+12)+7×7 (1+6). Сортамент",
    "7668-80": "Канат двойной свивки типа ЛК-РО конструкции 6×36(1+7+7/7+14)+1 о.с. Сортамент",
    "7665-80": "Канат двойной свивки типа ЛК-З конструкции 6×25 (1+6; 6+12)+1 о.с. Сортамент",
    "7669-80": "Канат двойной свивки типа ЛК-РО конструкции 6×36 (1+7+7/7+14)+7×7 (1+6). Сортамент",
    "3083-80": "Канат двойной свивки типа ЛК-О конструкции 6×30 (0+15+15)+7 о.с. Сортамент",
    "3079-80": "Канат двойной свивки типа ТЛК-О конструкции 6×37 (1+6+15+15)+1 о.с. Сортамент",
    "14954-80": "Канат двойной свивки типа ЛК-Р конструкции 6×19 (1+6+6/6)+7×7 (1+6). Сортамент"
  };
  function findGostPdf(p) {
    if (p.group === "trosy") {
      var m = (p.name || "").match(/ГОСТ\s*(\d{3,5}-\d{2,4})/);
      if (m && TROSY_GOST_TITLES[m[1]]) {
        return [m[1], "documents/GOST-" + m[1] + ".pdf", "ГОСТ " + m[1] + " — " + TROSY_GOST_TITLES[m[1]]];
      }
      return null;
    }
    var text = (p.specs && p.specs["Соответствие стандарту"]) || "";
    if (p.group === "gabiony") text += " 52132-2003";
    if (p.group === "setka") {
      if (p.subcat === "svarnaya-v-kartah") text += " 58120-2018";
      else if (p.subcat === "setka-mane") text += " 13603-89";
      else text += " 51285-99";
    }
    for (var i = 0; i < GOST_PDF_MAP.length; i++) {
      if (text.indexOf(GOST_PDF_MAP[i][0]) !== -1) return GOST_PDF_MAP[i];
    }
    return null;
  }

  var ROPE_DIAGRAMS = {
    "odinarnaya-svivka": { src: "images/rope-odinarnaya.png", alt: "Схема сечения троса одинарной свивки 1×19" },
    "dvoynaya-svivka": { src: "images/rope-dvoynaya.png", alt: "Схема сечения троса двойной свивки 6×19" },
    "shestipryadnaya-svivka": { src: "images/rope-shestipryadnaya.png", alt: "Схема сечения троса шестипрядной свивки 6×7" }
  };
  var GABION_REF_PHOTOS = {
    "nasypnogo-tipa": { src: "images/gabion-nasypnogo-tipa.webp?v=3", alt: "Габион насыпного типа — пустой каркас" },
    "korobchatye-dvojnogo-krucheniya": { src: "images/gabion-korobchatye-dvojnogo-krucheniya.webp?v=3", alt: "Коробчатый габион двойного кручения с камнем" },
    "cilindricheskie": { src: "images/gabion-cilindricheskie.webp?v=3", alt: "Цилиндрический габион — пустой каркас" },
    "korobchatye-svarnye": { src: "images/gabion-korobchatye-svarnye.webp?v=3", alt: "Коробчатые сварные габионы" },
    "s-armirujushchej-panelju": { src: "images/gabion-s-armirujushchej-panelju.webp?v=3", alt: "Габионы с армирующей панелью на объекте" },
    "shary": { src: "images/gabion-shary.webp?v=3", alt: "Габион-шар" },
    "kashpo": { src: "images/gabion-kashpo.webp?v=3", alt: "Габион-кашпо с растениями" },
    "klumby": { src: "images/gabion-klumby.webp?v=3", alt: "Габион-клумба с цветами" },
    "matrasno-tyufyachnye": { src: "images/gabion-matrasno-tyufyachnye.webp?v=3", alt: "Матрацно-тюфячный габион — пустой каркас" }
  };
  var SETKA_REF_PHOTOS = {
    "ot-bpla": { src: "images/setka-ot-bpla-wm.webp?v=3", alt: "Защитная сетка от БПЛА над габионной конструкцией" },
    "protivokamnepadnye": { src: "images/setka-protivokamnepadnye-wm.webp?v=3", alt: "Противокамнепадный барьер из стального троса и сетки на склоне" },
    "dvojnogo-krucheniya": { src: "images/setka-dvojnogo-krucheniya-wm.webp?v=4", alt: "Рулоны сетки двойного кручения" },
    "setka-mane": { src: "images/setka-setka-mane-wm.webp?v=4", alt: "Рулоны сетки Манье" },
    "svarnaya-v-kartah": { src: "images/setka-svarnaya-v-kartah-wm.webp?v=4", alt: "Сварная сетка в картах, стопка" }
  };
  function refPhoto(p) {
    if (p.group === "trosy") return ROPE_DIAGRAMS[p.subcat] || null;
    if (p.group === "gabiony") return GABION_REF_PHOTOS[p.subcat] || null;
    if (p.group === "setka") return SETKA_REF_PHOTOS[p.subcat] || null;
    return null;
  }
  function ropeThumbHtml(p) {
    var d = refPhoto(p);
    if (!d) return '<div class="thumb">фото уточняется</div>';
    if (p.group === "trosy") return '<div class="thumb thumb-rope"><img src="' + d.src + '" alt="' + d.alt + '" loading="lazy"></div>';
    return '<div class="thumb thumb-photo"><img src="' + d.src + '" alt="' + d.alt + '" loading="lazy">' +
      '<div class="photo-badge" data-tip="Изображение носит иллюстративный характер">i</div></div>';
  }

  function renderCard(p) {
    var card = el("article", "pcard");
    var specsEntries = Object.entries(p.specs || {}).slice(0, 3);
    var specsHtml = specsEntries.map(function (kv) {
      return "<li><span>" + kv[0] + "</span><span>" + kv[1] + "</span></li>";
    }).join("");
    card.innerHTML =
      ropeThumbHtml(p) +
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
    var gost = findGostPdf(p);
    var gostHtml = gost
      ? '<details class="gost-spoiler"><summary>Нормативный документ: ' + gost[2] + '</summary>' +
        '<a class="btn btn-sm" style="margin-top:10px;" href="' + gost[1] + '" target="_blank" rel="noopener">Скачать PDF</a></details>'
      : "";
    var pdpRef = refPhoto(p);
    var pdpGalleryHtml = pdpRef
      ? (p.group === "trosy"
          ? '<img src="' + pdpRef.src + '" alt="' + pdpRef.alt + '" style="max-width:100%;max-height:100%;object-fit:contain;">'
          : '<img src="' + pdpRef.src + '" alt="' + pdpRef.alt + '" style="width:100%;height:100%;object-fit:contain;">' +
            '<div class="photo-badge" data-tip="Изображение носит иллюстративный характер">i</div>')
      : "фото изделия<br>уточняется у менеджера";
    qs("#pdpBody").innerHTML =
      '<div class="pdp">' +
        '<div class="pdp-gallery">' + pdpGalleryHtml + "</div>" +
        '<div class="pdp-info">' +
          '<div class="sku">Артикул ' + p.sku + " · " + (p.subcat_label || "") + "</div>" +
          "<h2>" + p.name + "</h2>" +
          (p.specs && p.specs["Соответствие стандарту"]
            ? '<div class="gost">Соответствует ' + p.specs["Соответствие стандарту"] + "</div>"
            : (gost ? '<div class="gost">Соответствует ГОСТ ' + gost[0] + "</div>" : "")) +
          '<p class="desc">' + p.description + "</p>" +
          (specRows ? '<table class="spectable">' + specRows + "</table>" : "") +
          gostHtml +
          '<div class="buybox">' +
            '<div class="price-row"><div><div class="price">По расчёту</div><div class="price-note">актуальная цена зависит от партии и курса металла — пришлём точный расчёт быстро</div></div></div>' +
            '<button type="button" class="btn btn-primary btn-full" data-open-order data-sku="' + p.sku + '" data-name="' + p.name.replace(/"/g, "&quot;") + '" data-group="' + p.group + '">Заказать расчёт</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    location.hash = "sku=" + p.sku;
    setProductSeo(p);
  }

  function setProductSeo(p) {
    var canonicalUrl = "https://gabionopt.ru/catalog.html?group=" + p.group +
      (p.subcat ? "&subcat=" + p.subcat : "") + "#sku=" + p.sku;
    document.title = p.name + " — " + (p.subcat_label || GROUP_LABELS[p.group]) + " | ГабионОпт";
    var descTag = qs('meta[name="description"]');
    if (descTag) descTag.setAttribute("content", p.description.slice(0, 300));
    var canonical = qs('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", canonicalUrl);

    var ld = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      sku: p.sku,
      description: p.description,
      category: (p.subcat_label || GROUP_LABELS[p.group]),
      brand: { "@type": "Brand", name: "ГабионОпт" },
      url: canonicalUrl,
      offers: {
        "@type": "Offer",
        priceCurrency: "RUB",
        availability: "https://schema.org/InStock",
        url: canonicalUrl,
      },
    };
    var ldScript = qs("#productLd");
    if (!ldScript) {
      ldScript = document.createElement("script");
      ldScript.type = "application/ld+json";
      ldScript.id = "productLd";
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(ld);
  }

  function clearProductSeo() {
    var ldScript = qs("#productLd");
    if (ldScript) ldScript.remove();
    if (typeof updateSeo === "function") updateSeo();
  }

  function closeProduct() {
    qs("#pdpOverlay").hidden = true;
    document.body.style.overflow = "";
    if (location.hash.indexOf("sku=") === 0 || location.hash.indexOf("#sku=") === 0) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    clearProductSeo();
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
        scrollToGridTop();
      } else if (e.target.matches("[data-diameter]")) {
        var dval = parseFloat(e.target.getAttribute("data-diameter"));
        var didx = state.diameter.indexOf(dval);
        if (e.target.checked && didx === -1) state.diameter.push(dval);
        if (!e.target.checked && didx !== -1) state.diameter.splice(didx, 1);
        renderFilterbar();
        renderGrid();
        scrollToGridTop();
      } else if (e.target.matches("[data-size]")) {
        var szval = parseFloat(e.target.getAttribute("data-size"));
        var szidx = state.size.indexOf(szval);
        if (e.target.checked && szidx === -1) state.size.push(szval);
        if (!e.target.checked && szidx !== -1) state.size.splice(szidx, 1);
        renderFilterbar();
        renderGrid();
        scrollToGridTop();
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
