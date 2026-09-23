/*
 * Listings: loads deals from the Google Sheet CSV (SITE_CONFIG.LISTINGS_CSV_URL)
 * or the bundled data/listings.csv, then renders the home page, the listings
 * page and the single property page.
 */
(function () {
  "use strict";

  var RPD = window.RPD || (window.RPD = {});
  var ROOT = RPD.ROOT || "";
  var ICONS = RPD.ICONS || {};
  var esc = RPD.esc;
  var money = RPD.money;
  var CFG = window.SITE_CONFIG || {};
  var BUNDLED_CSV = ROOT + "data/listings.csv";

  /* ---------- CSV parsing (RFC 4180: quotes, escaped quotes, commas and newlines inside quotes) ---------- */
  function parseCSV(text) {
    text = String(text || "").replace(/^﻿/, "");
    var rows = [], row = [], field = "", i = 0, inQuotes = false, c, n = text.length;
    while (i < n) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ""; }); });
  }

  function headerKey(h) {
    return String(h || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function num(v) {
    if (v == null) return null;
    var s = String(v).trim().toLowerCase();
    if (!s) return null;
    var mult = 1;
    if (/\d\s*k$/.test(s)) { mult = 1000; s = s.replace(/k$/, ""); }
    else if (/\d\s*m$/.test(s)) { mult = 1000000; s = s.replace(/m$/, ""); }
    s = s.replace(/[^0-9.\-]/g, "");
    if (!s || s === "-" || s === ".") return null;
    var x = parseFloat(s) * mult;
    return isFinite(x) ? x : null;
  }

  function slugify(s) {
    return String(s || "").toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function driveId(u) {
    var m = u.match(/drive\.google\.com\/file\/d\/([^/?#]+)/) ||
            u.match(/(?:drive|docs)\.google\.com\/(?:open|uc|thumbnail)\?(?:[^#]*&)?id=([^&#]+)/) ||
            u.match(/drive\.usercontent\.google\.com\/(?:download|u\/\d+\/uc)\?(?:[^#]*&)?id=([^&#]+)/);
    return m ? m[1] : null;
  }

  function resolvePhoto(u, size) {
    u = String(u || "").trim().replace(/^["'<]+|["'>]+$/g, "");
    if (!u) return null;
    var id = driveId(u);
    if (id) return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=" + (size || "w1600");
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (/^(data|blob):/i.test(u)) return u;
    return ROOT + u.replace(/^\.?\//, "");
  }

  function splitPhotos(v) {
    // Separated by newlines, or by commas that start a new URL/path (so commas inside a URL survive).
    return String(v || "")
      .split(/\s*[\r\n]+\s*|\s*[,;]\s*(?=(?:https?:\/\/|\/\/|\.{0,2}\/|assets\/|data\/))/i)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function normStatus(s) {
    s = String(s || "").trim().toLowerCase();
    if (!s) return "Available";
    if (/hidden|draft|off\s*market|remove/.test(s)) return "Hidden";
    if (/sold|closed/.test(s)) return "Sold";
    if (/pend|contract|assign/.test(s)) return "Pending";
    return "Available";
  }

  function truthy(s) { return /^(y|yes|true|1|x|featured)$/i.test(String(s || "").trim()); }

  function toListing(o) {
    var address = (o.address || "").trim();
    var id = slugify(o.id) || slugify(address);
    if (!id || !address && !o.id) return null;
    var status = normStatus(o.status);
    if (status === "Hidden") return null;
    var rawPhotos = splitPhotos(o.photos);
    var photos = rawPhotos.map(function (p) { return resolvePhoto(p); }).filter(Boolean);
    var thumbs = rawPhotos.map(function (p) { return resolvePhoto(p, "w400"); }).filter(Boolean);
    var d = (o.date_listed || "").trim();
    var t = d ? Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + "T12:00:00" : d) : NaN;
    return {
      id: id,
      status: status,
      address: address,
      city: (o.city || "").trim(),
      state: (o.state || "").trim(),
      zip: (o.zip || "").trim(),
      price: num(o.price),
      arv: num(o.arv),
      rehab: num(o.rehab_estimate),
      beds: num(o.beds),
      baths: num(o.baths),
      sqft: num(o.sqft),
      year_built: (o.year_built || "").trim(),
      lot_size: (o.lot_size || "").trim(),
      property_type: (o.property_type || "").trim(),
      garage: (o.garage || "").trim(),
      description: (o.description || "").trim(),
      photos: photos,
      thumbs: thumbs,
      featured: truthy(o.featured),
      date_listed: d,
      date_ts: isNaN(t) ? 0 : t
    };
  }

  // Returns an array of listings, or null when the text is not a listings CSV.
  function parseListings(text) {
    if (/^\s*</.test(text || "")) return null; // HTML (e.g. a Google login page), not CSV
    var rows = parseCSV(text);
    if (!rows.length) return null;
    var head = rows[0].map(headerKey);
    if (head.indexOf("address") < 0 && head.indexOf("id") < 0) return null;
    var out = [], seen = {};
    for (var r = 1; r < rows.length; r++) {
      var o = {};
      for (var c = 0; c < head.length; c++) if (head[c]) o[head[c]] = rows[r][c] == null ? "" : rows[r][c];
      var l = toListing(o);
      if (!l) continue;
      if (seen[l.id]) { l.id = l.id + "-" + r; }
      seen[l.id] = 1;
      out.push(l);
    }
    return out;
  }

  function fetchText(url, ms) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 8000) : null;
    return fetch(url, { cache: "no-cache", signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    });
  }

  var loading = null;
  function loadListings() {
    if (loading) return loading;
    var remote = (CFG.LISTINGS_CSV_URL || "").trim();
    var p = remote
      ? fetchText(remote, 8000).then(function (t) {
          var l = parseListings(t);
          if (!l) throw new Error("Sheet did not return listings CSV");
          RPD.listingsSource = "sheet";
          return l;
        })
      : Promise.reject(new Error("no sheet configured"));
    loading = p.catch(function (err) {
      if (remote) console.warn("[listings] Google Sheet unavailable, using bundled data/listings.csv:", err && err.message);
      return fetchText(BUNDLED_CSV, 8000).then(function (t) {
        RPD.listingsSource = "bundled";
        return parseListings(t) || [];
      });
    }).catch(function (err) {
      console.error("[listings] could not load listings:", err);
      RPD.listingsSource = "none";
      return [];
    });
    return loading;
  }

  /* ---------- helpers ---------- */
  var STATUS_RANK = { Available: 0, Pending: 1, Sold: 2 };
  function byNewest(a, b) {
    return (STATUS_RANK[a.status] - STATUS_RANK[b.status]) || (b.date_ts - a.date_ts);
  }
  function fmtNum(n) { return n == null ? "" : (Math.round(n * 10) / 10).toLocaleString("en-US"); }
  function cityLine(l) {
    var s = [l.city, [l.state, l.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return s;
  }
  function fullAddress(l) { return [l.address, cityLine(l)].filter(Boolean).join(", "); }
  function propUrl(l) { return ROOT + "property/?id=" + encodeURIComponent(l.id); }
  function badge(status) { return '<span class="badge badge--' + status.toLowerCase() + '">' + esc(status) + "</span>"; }
  function spreadOf(l) {
    if (l.price == null || l.arv == null) return null;
    if (l.rehab != null) return { kind: "equity", value: l.arv - l.price - l.rehab };
    return { kind: "spread", value: l.arv - l.price };
  }

  function cardHTML(l, opts) {
    opts = opts || {};
    var img = l.photos[0]
      ? '<img src="' + esc(l.photos[0]) + '" alt="' + esc(l.address) + '" loading="' + (opts.eager ? "eager" : "lazy") + '" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true">'
      : '<div class="no-photo">Photos coming soon</div>';
    var specs = [];
    if (l.beds != null) specs.push("<span>" + ICONS.bed + fmtNum(l.beds) + " bd</span>");
    if (l.baths != null) specs.push("<span>" + ICONS.bath + fmtNum(l.baths) + " ba</span>");
    if (l.sqft != null) specs.push("<span>" + ICONS.area + fmtNum(l.sqft) + " sq ft</span>");
    if (l.property_type) specs.push("<span>" + ICONS.home + esc(l.property_type) + "</span>");
    var chips = [];
    if (l.arv != null) chips.push('<span class="chip">ARV ' + money(l.arv) + "</span>");
    if (l.rehab != null) chips.push('<span class="chip chip--muted">Rehab ' + money(l.rehab) + "</span>");
    var price = l.price != null
      ? money(l.price)
      : '<small>Contact for price</small>';
    if (l.status === "Sold" && l.price == null) price = '<small>Sold</small>';
    return '<a class="deal-card' + (l.status === "Sold" ? " is-sold" : "") + '" href="' + propUrl(l) + '">' +
      '<div class="deal-media">' + img + badge(l.status) +
        (l.status === "Sold" ? '<div class="ribbon" aria-hidden="true">SOLD</div>' : "") +
        (l.photos.length > 1 ? '<span class="photo-count">' + ICONS.camera + l.photos.length + "</span>" : "") +
      "</div>" +
      '<div class="deal-body">' +
        '<div class="deal-price">' + price + "</div>" +
        '<div class="deal-address">' + esc(l.address) + "</div>" +
        (cityLine(l) ? '<div class="deal-city">' + esc(cityLine(l)) + "</div>" : "") +
        (chips.length ? '<div class="deal-numbers">' + chips.join("") + "</div>" : "") +
        (specs.length ? '<div class="deal-specs">' + specs.join("") + "</div>" : "") +
      "</div></a>";
  }

  function emptyHTML(title, text) {
    return '<div class="empty-state"><h3>' + esc(title || "New deals coming soon") + "</h3><p>" +
      esc(text || "Join the buyers list and we'll text and email you the moment the next off-market deal is ready.") +
      '</p><a class="btn btn--primary" href="' + ROOT + 'buyers-list/">Join the buyers list</a></div>';
  }

  function promoHTML() {
    return '<a class="promo-card" href="' + ROOT + 'buyers-list/"><span class="eyebrow">More deals coming</span>' +
      "<h3>Get the next one before it&rsquo;s posted</h3><p>Buyers list members hear about new off-market deals first, by text and email.</p>" +
      '<span class="btn btn--light">Join the buyers list</span></a>';
  }

  /* ---------- Home page ---------- */
  function initHome() {
    var grid = document.getElementById("featured-deals");
    var hero = document.getElementById("hero-deal");
    var soldWrap = document.getElementById("sold-section");
    var soldGrid = document.getElementById("sold-deals");
    loadListings().then(function (all) {
      var available = all.filter(function (l) { return l.status === "Available"; })
        .sort(function (a, b) { return (b.featured - a.featured) || (b.date_ts - a.date_ts); });
      var active = all.filter(function (l) { return l.status !== "Sold"; })
        .sort(function (a, b) { return (STATUS_RANK[a.status] - STATUS_RANK[b.status]) || (b.featured - a.featured) || (b.date_ts - a.date_ts); });
      var sold = all.filter(function (l) { return l.status === "Sold"; }).sort(byNewest);

      if (hero) {
        var top = available[0] || active[0];
        if (top) {
          hero.innerHTML = '<div class="hero-card-label"><span class="pulse"></span>' + (top.status === "Available" ? "Available now" : esc(top.status)) + "</div>" + cardHTML(top, { eager: true });
        } else {
          hero.innerHTML = promoHTML();
        }
      }
      if (grid) {
        var list = active.slice(0, 6);
        grid.innerHTML = list.length ? list.map(function (l) { return cardHTML(l); }).join("") + (list.length < 3 ? promoHTML() : "") : emptyHTML();
      }
      if (soldWrap && soldGrid) {
        if (sold.length) {
          soldGrid.innerHTML = sold.slice(0, 3).map(function (l) { return cardHTML(l); }).join("");
          soldWrap.hidden = false;
        }
      }
    });
  }

  /* ---------- Listings page ---------- */
  function initListings() {
    var grid = document.getElementById("listings-grid");
    var countEl = document.getElementById("results-count");
    var form = document.getElementById("filters");
    var seg = document.getElementById("status-seg");
    var params = new URLSearchParams(location.search);
    var state = {
      status: (params.get("status") || "all").toLowerCase(),
      beds: params.get("beds") || "",
      baths: params.get("baths") || "",
      min: params.get("min") || "",
      max: params.get("max") || "",
      sort: params.get("sort") || "newest"
    };
    var all = [];

    function syncControls() {
      seg.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-status") === state.status ? "true" : "false");
      });
      form.beds.value = state.beds;
      form.baths.value = state.baths;
      form.min.value = state.min;
      form.max.value = state.max;
      form.sort.value = state.sort;
    }

    function writeUrl() {
      var p = new URLSearchParams();
      if (state.status !== "all") p.set("status", state.status);
      ["beds", "baths", "min", "max"].forEach(function (k) { if (state[k]) p.set(k, state[k]); });
      if (state.sort !== "newest") p.set("sort", state.sort);
      var q = p.toString();
      history.replaceState(null, "", location.pathname + (q ? "?" + q : ""));
    }

    function render() {
      var minP = num(state.min), maxP = num(state.max), minB = num(state.beds), minBa = num(state.baths);
      var list = all.filter(function (l) {
        if (state.status !== "all" && l.status.toLowerCase() !== state.status) return false;
        if (minB != null && (l.beds == null || l.beds < minB)) return false;
        if (minBa != null && (l.baths == null || l.baths < minBa)) return false;
        if (minP != null && (l.price == null || l.price < minP)) return false;
        if (maxP != null && (l.price == null || l.price > maxP)) return false;
        return true;
      });
      if (state.sort === "price-asc" || state.sort === "price-desc") {
        var dir = state.sort === "price-asc" ? 1 : -1;
        list.sort(function (a, b) {
          if (a.price == null && b.price == null) return 0;
          if (a.price == null) return 1;
          if (b.price == null) return -1;
          return (a.price - b.price) * dir;
        });
      } else {
        list.sort(byNewest);
      }
      countEl.textContent = list.length === 1 ? "1 deal" : list.length + " deals";
      if (list.length) {
        grid.innerHTML = list.map(function (l) { return cardHTML(l); }).join("") + (list.length < 3 ? promoHTML() : "");
      } else if (!all.length) {
        grid.innerHTML = emptyHTML();
      } else {
        grid.innerHTML = emptyHTML("No deals match those filters", "Try widening your filters — or join the buyers list and we'll send matching deals straight to your phone.");
      }
      writeUrl();
    }

    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-status]");
      if (!b) return;
      state.status = b.getAttribute("data-status");
      syncControls(); render();
    });
    form.addEventListener("input", function () {
      state.beds = form.beds.value; state.baths = form.baths.value;
      state.min = form.min.value.trim(); state.max = form.max.value.trim();
      state.sort = form.sort.value;
      render();
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    document.getElementById("reset-filters").addEventListener("click", function () {
      state = { status: "all", beds: "", baths: "", min: "", max: "", sort: "newest" };
      syncControls(); render();
    });

    syncControls();
    loadListings().then(function (l) { all = l; render(); });
  }

  /* ---------- Property page ---------- */
  function initProperty() {
    var root = document.getElementById("property-root");
    var id = (new URLSearchParams(location.search).get("id") || "").trim().toLowerCase();
    loadListings().then(function (all) {
      var l = null;
      for (var i = 0; i < all.length; i++) if (all[i].id === id) { l = all[i]; break; }
      if (!l && id) {
        // Tolerate old/long slugs that start with a current id (e.g. links from the old site).
        for (var j = 0; j < all.length; j++) if (id.indexOf(all[j].id) === 0) { l = all[j]; break; }
      }
      if (!l) {
        root.innerHTML = '<section class="section"><div class="wrap center"><h1>We couldn’t find that deal</h1>' +
          '<p class="lede">It may have sold or been taken down. Browse what’s available now, or join the buyers list so you hear about the next one first.</p>' +
          '<p><a class="btn btn--primary" href="' + ROOT + 'listings/">See all deals</a> <a class="btn btn--ghost" href="' + ROOT + 'buyers-list/">Join the buyers list</a></p></div></section>';
        document.getElementById("inquiry-section").hidden = true;
        return;
      }
      renderProperty(root, l);
    });
  }

  function renderProperty(root, l) {
    var addr = fullAddress(l);
    document.title = l.address + (l.city ? ", " + l.city : "") + " | Off-Market Deal | Right Price Dispositions";
    var md = document.querySelector('meta[name="description"]');
    var summary = [l.beds != null ? fmtNum(l.beds) + " bed" : "", l.baths != null ? fmtNum(l.baths) + " bath" : "", l.property_type].filter(Boolean).join(" · ");
    if (md) md.setAttribute("content", "Off-market deal: " + addr + (summary ? " — " + summary : "") + (l.price != null ? ". Asking " + money(l.price) : "") + (l.arv != null ? ", ARV " + money(l.arv) : "") + ".");
    var canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.setAttribute("href", (CFG.SITE_URL || "https://www.cledispo.com/") + "property/?id=" + encodeURIComponent(l.id));

    // Gallery
    var photos = l.photos, n = photos.length, galleryHTML = "";
    if (n) {
      var sold = l.status === "Sold" ? '<div class="ribbon" aria-hidden="true">SOLD</div>' : "";
      galleryHTML = '<div class="gallery' + (n < 3 ? " single" : "") + '">' +
        '<button type="button" class="g-main" data-index="0" aria-label="Open photo 1 of ' + n + '"><img src="' + esc(photos[0]) + '" alt="' + esc(l.address) + ' — photo 1" fetchpriority="high" referrerpolicy="no-referrer" onerror="this.hidden=true">' + sold +
        (n > 1 ? '<span class="g-all">' + ICONS.grid + "See all " + n + " photos</span>" : "") + "</button>" +
        (n >= 3 ? '<button type="button" class="g-side" data-index="1" aria-label="Open photo 2"><img src="' + esc(photos[1]) + '" alt="' + esc(l.address) + ' — photo 2" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true"></button>' +
                  '<button type="button" class="g-side" data-index="2" aria-label="Open photo 3"><img src="' + esc(photos[2]) + '" alt="' + esc(l.address) + ' — photo 3" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true"></button>' : "") +
        "</div>";
    } else {
      galleryHTML = '<div class="gallery single"><div class="deal-media" style="aspect-ratio:auto;height:100%"><div class="no-photo">Photos coming soon</div></div></div>';
    }

    // Numbers
    var nums = [];
    if (l.arv != null) nums.push("<li><span>After-repair value (ARV)</span><span>" + money(l.arv) + "</span></li>");
    if (l.rehab != null) nums.push("<li><span>Rehab estimate</span><span>" + money(l.rehab) + "</span></li>");
    var sp = spreadOf(l), spreadHTML = "";
    if (sp) {
      spreadHTML = sp.kind === "equity"
        ? '<div class="spread"><div class="label">Estimated equity</div><div class="val">' + money(sp.value) + "</div><small>ARV " + money(l.arv) + " − price " + money(l.price) + " − rehab " + money(l.rehab) + "</small></div>"
        : '<div class="spread"><div class="label">Estimated spread</div><div class="val">' + money(sp.value) + "</div><small>ARV " + money(l.arv) + " − price " + money(l.price) + ", before rehab and closing costs</small></div>";
    }
    var priceLabel = l.status === "Sold" ? "Sold" : "Asking price";
    var bigPrice = l.price != null ? money(l.price) : (l.status === "Sold" ? "Sold" : "Contact for price");
    var phoneHref = "tel:" + (CFG.PHONE_E164 || "+12169303281");
    var ctas = l.status === "Sold"
      ? '<a class="btn btn--primary btn--block" href="' + ROOT + 'buyers-list/">Get the next deal first</a>'
      : '<a class="btn btn--primary btn--block" href="#inquire" data-intent="offer">Request info / make an offer</a>';
    ctas += '<a class="btn btn--ghost btn--block" href="' + phoneHref + '">' + ICONS.phone + "Call or text " + esc(CFG.PHONE_DISPLAY || "(216) 930-3281") + "</a>";

    // Facts
    var facts = [];
    function fact(icon, label, value) { if (value !== "" && value != null) facts.push('<div class="fact">' + ICONS[icon] + "<div><small>" + label + "</small><strong>" + esc(value) + "</strong></div></div>"); }
    fact("bed", "Bedrooms", l.beds != null ? fmtNum(l.beds) : "");
    fact("bath", "Bathrooms", l.baths != null ? fmtNum(l.baths) : "");
    fact("area", "Living area", l.sqft != null ? fmtNum(l.sqft) + " sq ft" : "");
    fact("calendar", "Year built", l.year_built);
    fact("lot", "Lot size", l.lot_size ? (/^[\d,.\s]+$/.test(l.lot_size) ? fmtNum(num(l.lot_size)) + " sq ft" : l.lot_size) : "");
    fact("home", "Property type", l.property_type);
    fact("garage", "Garage", l.garage);
    fact("tag", "Status", l.status);

    var paras = l.description ? l.description.split(/\n\s*\n|\r?\n/).map(function (p) { return p.trim(); }).filter(Boolean) : [];

    // Map: when the house number is masked (e.g. "41** E 173rd St") show the street instead of a wrong pin.
    var masked = /\*/.test(l.address);
    var mapAddr = masked ? [l.address.replace(/^\S*\*\S*\s+/, ""), cityLine(l)].filter(Boolean).join(", ") : addr;
    var mapHTML = mapAddr
      ? '<div class="prop-section"><h2>Location</h2><div class="map-frame"><iframe title="Map of ' + esc(mapAddr) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=' + encodeURIComponent(mapAddr) + "&z=" + (masked ? 15 : 16) + '&output=embed"></iframe></div>' +
        (masked ? '<p class="map-note">The map shows the street. We share the exact address when you request info.</p>' : "") + "</div>"
      : "";

    root.innerHTML =
      '<div class="wrap prop-top">' +
        '<nav class="crumbs" aria-label="Breadcrumb"><a href="' + ROOT + '">Home</a> / <a href="' + ROOT + 'listings/">Deals</a> / ' + esc(l.address) + "</nav>" +
        '<div class="prop-title"><div>' + badge(l.status) + "<h1>" + esc(l.address) + '</h1><div class="deal-city">' + esc(cityLine(l)) + "</div></div>" +
          '<div class="prop-actions"><button type="button" class="btn btn--ghost btn--sm js-share">' + ICONS.share + "Share</button></div></div>" +
        galleryHTML +
      "</div>" +
      '<div class="wrap"><div class="prop-layout">' +
        '<div class="prop-main">' +
          (facts.length ? '<div class="facts">' + facts.join("") + "</div>" : "") +
          (paras.length ? '<div class="prop-section description"><h2>About this deal</h2>' + paras.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>" : "") +
          mapHTML +
          '<p class="disclaimer">Opinions of value / rents are given as a courtesy and no guarantees are expressed or implied. Buyers should verify all numbers and do their own due diligence. Our properties move fast, so contact us quickly if this is one you want.</p>' +
        "</div>" +
        '<aside class="prop-side">' +
          '<div class="price-card"><div class="label">' + priceLabel + '</div><div class="big">' + bigPrice + "</div>" +
            (nums.length ? '<ul class="numbers">' + nums.join("") + "</ul>" : "") +
            spreadHTML + ctas +
          "</div>" +
          '<p class="side-note">Prefer email? <a href="mailto:' + esc(CFG.EMAIL || "sales@rightpricehomebuyers.com") + "?subject=" + encodeURIComponent("Deal: " + addr) + '">' + esc(CFG.EMAIL || "sales@rightpricehomebuyers.com") + "</a></p>" +
        "</aside>" +
      "</div></div>";

    // Inquiry form context
    var form = document.getElementById("inquiry-form");
    if (form) {
      form.querySelector('[name="property_id"]').value = l.id;
      form.querySelector('[name="property_address"]').value = addr;
      var h = document.getElementById("inquiry-address");
      if (h) h.textContent = addr;
      if (l.status === "Sold") {
        var t = document.getElementById("inquiry-title");
        if (t) t.textContent = "This one sold — want deals like it?";
      }
    }
    document.querySelectorAll("[data-intent=offer]").forEach(function (a) {
      a.addEventListener("click", function () {
        var r = form && form.querySelector('input[name="request_type"][value="Make an offer"]');
        if (r) r.checked = true;
      });
    });

    // Mobile action bar
    var bar = document.createElement("div");
    bar.className = "mobile-bar";
    bar.innerHTML = '<a class="btn btn--ghost" href="' + phoneHref + '">' + ICONS.phone + "Call</a>" +
      (l.status === "Sold" ? '<a class="btn btn--primary" href="' + ROOT + 'buyers-list/">Join buyers list</a>' : '<a class="btn btn--primary" href="#inquire">Request info</a>');
    document.body.appendChild(bar);
    document.body.classList.add("has-mobile-bar");

    // Share
    root.querySelector(".js-share").addEventListener("click", function () {
      var data = { title: l.address + " — Right Price Dispositions", text: "Off-market deal: " + addr + (l.price != null ? " — " + money(l.price) : ""), url: location.href };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(location.href).then(function () { RPD.toast("Link copied"); }, function () { window.prompt("Copy this link:", location.href); });
      } else { window.prompt("Copy this link:", location.href); }
    });

    // Lightbox
    if (n) {
      var lb = buildLightbox(l);
      root.querySelectorAll(".gallery button[data-index]").forEach(function (b) {
        b.addEventListener("click", function () { lb.open(parseInt(b.getAttribute("data-index"), 10) || 0); });
      });
    }
  }

  function buildLightbox(l) {
    var photos = l.photos, thumbs = l.thumbs.length === photos.length ? l.thumbs : photos, n = photos.length, idx = 0, lastFocus = null;
    var el = document.createElement("div");
    el.className = "lightbox";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Photos of " + l.address);
    el.innerHTML = '<div class="lb-top"><span class="lb-count"></span><button type="button" class="lb-btn lb-close" aria-label="Close photos">' + ICONS.close + "</button></div>" +
      '<div class="lb-stage"><button type="button" class="lb-btn lb-prev" aria-label="Previous photo">' + ICONS.left + '</button><img alt="" referrerpolicy="no-referrer" onerror="this.hidden=true"><button type="button" class="lb-btn lb-next" aria-label="Next photo">' + ICONS.right + "</button></div>" +
      '<div class="lb-thumbs">' + thumbs.map(function (t, i) { return '<button type="button" data-i="' + i + '" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(t) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true"></button>'; }).join("") + "</div>";
    document.body.appendChild(el);
    var img = el.querySelector(".lb-stage img"), count = el.querySelector(".lb-count"), strip = el.querySelector(".lb-thumbs");

    function show(i) {
      idx = (i + n) % n;
      img.src = photos[idx];
      img.alt = l.address + " — photo " + (idx + 1) + " of " + n;
      count.textContent = (idx + 1) + " / " + n;
      strip.querySelectorAll("button").forEach(function (b, k) { b.classList.toggle("active", k === idx); });
      var active = strip.children[idx];
      if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest", inline: "center" });
      [idx + 1, idx - 1].forEach(function (k) { var p = new Image(); p.src = photos[(k + n) % n]; });
    }
    function open(i) { lastFocus = document.activeElement; el.classList.add("open"); document.body.style.overflow = "hidden"; show(i); el.querySelector(".lb-close").focus(); }
    function close() { el.classList.remove("open"); document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }

    el.querySelector(".lb-close").addEventListener("click", close);
    el.querySelector(".lb-prev").addEventListener("click", function () { show(idx - 1); });
    el.querySelector(".lb-next").addEventListener("click", function () { show(idx + 1); });
    strip.addEventListener("click", function (e) { var b = e.target.closest("button[data-i]"); if (b) show(parseInt(b.getAttribute("data-i"), 10)); });
    el.addEventListener("click", function (e) { if (e.target.classList.contains("lb-stage")) close(); });
    document.addEventListener("keydown", function (e) {
      if (!el.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") show(idx + 1);
      else if (e.key === "ArrowLeft") show(idx - 1);
    });
    var sx = 0, sy = 0, tracking = false;
    var stage = el.querySelector(".lb-stage");
    stage.addEventListener("touchstart", function (e) { if (e.touches.length !== 1) return; tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      if (!tracking) return; tracking = false;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx < 0 ? 1 : -1));
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
    }, { passive: true });
    return { open: open, close: close };
  }

  /* ---------- Old-URL redirect helper (used by 404.html) ---------- */
  function redirectOldPropertyUrl(slug) {
    return loadListings().then(function (all) {
      slug = String(slug || "").toLowerCase();
      for (var i = 0; i < all.length; i++) if (slug === all[i].id || slug.indexOf(all[i].id) === 0) return propUrl(all[i]);
      return ROOT + "listings/";
    });
  }

  RPD.parseCSV = parseCSV;
  RPD.parseListings = parseListings;
  RPD.resolvePhoto = resolvePhoto;
  RPD.loadListings = loadListings;
  RPD.resetListings = function () { loading = null; };
  RPD.redirectOldPropertyUrl = redirectOldPropertyUrl;

  var page = document.body.getAttribute("data-page");
  if (page === "home") initHome();
  else if (page === "listings") initListings();
  else if (page === "property") initProperty();
})();
