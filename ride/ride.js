/* The Ride — scroll-driven bike journey. No dependencies. */
(function () {
  "use strict";

  // Rider world position (px) of each checkpoint. p = 1 puts the rider at END.
  var CHECKPOINTS = [
    { id: "start",     x: 0,     label: "Start",     year: "" },
    { id: "school",    x: 1400,  label: "Malda",     year: "2019" },
    { id: "college",   x: 2900,  label: "Gwalior",   year: "2020" },
    { id: "solytics",  x: 4700,  label: "Pune",      year: "2023" },
    { id: "izoologic", x: 6600,  label: "Jaipur",    year: "2024" },
    { id: "garage",    x: 8300,  label: "Pit stop",  year: "" },
    { id: "projects",  x: 9700,  label: "Projects",  year: "" },
    { id: "finish",    x: 11200, label: "Finish",    year: "2026" }
  ];
  var END = 11200;
  var OFFSET = 1500;          // world x = -OFFSET is the left edge of every layer
  var SCROLL_PER_PX = 0.9;    // page scroll px per world px

  // Sky / scenery palette keyframes along the journey (dawn -> night).
  var PALETTE = [
    { p: 0,    top: "#ff9a76", bot: "#ffe1b8", far: "#d08c8c", mid: "#8fae6a", near: "#4f8a4b", night: 0 },
    { p: 0.22, top: "#6ec3f4", bot: "#d8f1ff", far: "#8fb0d0", mid: "#7fb069", near: "#3f7d4a", night: 0 },
    { p: 0.5,  top: "#4aa8ec", bot: "#c9ecff", far: "#7f9fc4", mid: "#6fa25e", near: "#3a7444", night: 0 },
    { p: 0.6,  top: "#7cbfe8", bot: "#ffe6c4", far: "#9aa9c6", mid: "#76a660", near: "#3f7444", night: 0 },
    { p: 0.72, top: "#f7a35c", bot: "#ffd9a0", far: "#b58a9a", mid: "#79915a", near: "#46663b", night: 0.05 },
    { p: 0.84, top: "#6d4c8f", bot: "#f08a6c", far: "#5b4b78", mid: "#3f5a46", near: "#2b4331", night: 0.45 },
    { p: 1,    top: "#0b1030", bot: "#28305e", far: "#232a52", mid: "#1b2e2a", near: "#12201a", night: 1 }
  ];

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s) { return document.querySelector(s); };
  var SVGNS = "http://www.w3.org/2000/svg";

  // ---------- helpers ----------
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    return "rgb(" + x.map(function (v, i) { return Math.round(v + (y[i] - v) * t); }).join(",") + ")";
  }
  function palette(p) {
    for (var i = 0; i < PALETTE.length - 1; i++) {
      var a = PALETTE[i], b = PALETTE[i + 1];
      if (p <= b.p) {
        var t = (p - a.p) / (b.p - a.p);
        return {
          top: mix(a.top, b.top, t), bot: mix(a.bot, b.bot, t),
          far: mix(a.far, b.far, t), mid: mix(a.mid, b.mid, t), near: mix(a.near, b.near, t),
          night: a.night + (b.night - a.night) * t
        };
      }
    }
    return palette(1 - 1e-6);
  }
  function svg(w, h, inner) {
    return '<svg xmlns="' + SVGNS + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">' + inner + "</svg>";
  }
  function ridge(width, height, step, base, amp, seed) {
    var r = rng(seed), d = "M0 " + height, y = base;
    for (var x = 0; x <= width + step; x += step) {
      y = Math.max(8, Math.min(height - 10, y + (r() - 0.5) * amp));
      d += " L" + x + " " + Math.round(height - y);
    }
    return d + " L" + (width + step) + " " + height + " Z";
  }

  // ---------- build scenery ----------
  var layers = [].map.call(document.querySelectorAll(".layer"), function (el) {
    return { el: el, f: parseFloat(el.getAttribute("data-f")) };
  });
  var paint = {};

  function layerWidth(f) { return Math.ceil((END + OFFSET) * f + 2800); }

  function buildClouds() {
    var w = layerWidth(0.08), r = rng(7), s = "";
    for (var i = 0; i < 26; i++) {
      var x = r() * w, y = 40 + r() * 220, k = 0.6 + r() * 0.9;
      s += '<g transform="translate(' + x.toFixed(0) + " " + y.toFixed(0) + ") scale(" + k.toFixed(2) + ')">' +
        '<ellipse cx="0" cy="0" rx="60" ry="22"/><ellipse cx="-34" cy="6" rx="36" ry="16"/><ellipse cx="36" cy="4" rx="40" ry="18"/><ellipse cx="6" cy="-14" rx="34" ry="20"/></g>';
    }
    $("#clouds").innerHTML = svg(w, 320, '<g id="cloud-g" fill="#fff" opacity=".85">' + s + "</g>");
    paint.clouds = $("#cloud-g");
  }

  function buildFar() {
    var w = layerWidth(0.15);
    $("#far").innerHTML = svg(w, 300, '<path id="far-p" d="' + ridge(w, 300, 60, 170, 70, 11) + '"/>');
    paint.far = $("#far-p");
  }

  function buildMid() {
    var w = layerWidth(0.35), f = 0.35;
    // Gwalior Fort silhouette on a hill, appears while riding through Gwalior.
    var fx = Math.round((CHECKPOINTS[2].x + 1300 + OFFSET) * f);
    var fort =
      '<g transform="translate(' + fx + ' 52)">' +
      '<path d="M-90 148 Q0 40 200 148 Z"/>' +
      '<path d="M-20 92 h170 v-30 h-10 v-10 h-8 v10 h-12 v-26 h-14 v26 h-30 v-34 a14 14 0 0 0 -28 0 v34 h-20 v-20 h-12 v20 h-16 v-14 h-10 z"/>' +
      '<g class="lights" fill="#ffd166"><rect x="10" y="74" width="5" height="7"/><rect x="40" y="70" width="5" height="7"/><rect x="92" y="72" width="5" height="7"/><rect x="120" y="76" width="5" height="7"/></g>' +
      "</g>";
    $("#mid").innerHTML = svg(w, 200, '<g id="mid-g"><path d="' + ridge(w, 200, 50, 70, 30, 23) + '"/>' + fort + "</g>");
    paint.mid = $("#mid-g");
  }

  function buildNear() {
    var w = layerWidth(0.6), r = rng(42), s = "";
    for (var x = 0; x < w; x += 70 + r() * 160) {
      var h = 50 + r() * 70;
      if (r() < 0.55) {
        s += '<path d="M' + x + " 140 l" + h * 0.32 + " -" + h + " l" + h * 0.32 + " " + h + 'z"/>';
      } else {
        s += '<rect x="' + (x + 12) + '" y="' + (140 - h * 0.45) + '" width="6" height="' + h * 0.45 + '"/>' +
          '<circle cx="' + (x + 15) + '" cy="' + (140 - h * 0.6) + '" r="' + h * 0.3 + '"/>';
      }
    }
    $("#near").innerHTML = svg(w, 140, '<g id="near-g">' + s + "</g>");
    paint.near = $("#near-g");
  }

  // Ground-level landmarks (factor 1). Each returns [worldX, svgMarkup].
  var win = function (x, y, w, h) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>'; };
  function windowsGrid(x0, y0, cols, rows, dx, dy, w, h) {
    var s = "";
    for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) s += win(x0 + c * dx, y0 + r * dy, w, h);
    return s;
  }
  function arch(label, colorA, colorB) {
    var checks = "";
    for (var i = 0; i < 14; i++) checks += '<rect x="' + (20 + i * 20) + '" y="' + (i % 2 ? 26 : 10) + '" width="20" height="16" fill="' + colorB + '"/>';
    return svg(320, 240,
      '<rect x="10" y="10" width="10" height="230" fill="#2b2d42"/><rect x="300" y="10" width="10" height="230" fill="#2b2d42"/>' +
      '<rect x="20" y="10" width="280" height="32" fill="' + colorA + '"/>' + checks +
      '<rect x="60" y="42" width="200" height="34" rx="6" fill="#fffaf2" stroke="#14162b" stroke-width="3"/>' +
      '<text x="160" y="66" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="20" fill="#14162b">' + label + "</text>");
  }

  var LANDMARKS = [
    [-60, arch("START · 2019", "#fff", "#14162b")],
    [CHECKPOINTS[1].x + 330, svg(300, 210,
      '<rect x="20" y="70" width="260" height="140" fill="#f2cc8f" stroke="#14162b" stroke-width="3"/>' +
      '<path d="M5 74 L150 18 L295 74 Z" fill="#c8553d" stroke="#14162b" stroke-width="3"/>' +
      '<rect x="120" y="140" width="60" height="70" fill="#7a4e2d" stroke="#14162b" stroke-width="3"/>' +
      '<rect x="95" y="80" width="110" height="26" rx="4" fill="#fffaf2" stroke="#14162b" stroke-width="2"/>' +
      '<text x="150" y="99" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="600" font-size="13" fill="#14162b">KV MALDA</text>' +
      '<g fill="#a8dadc" stroke="#14162b" stroke-width="2">' + windowsGrid(40, 120, 2, 2, 36, 40, 24, 24) + windowsGrid(200, 120, 2, 2, 36, 40, 24, 24) + "</g>" +
      '<g class="lights" fill="#ffd166">' + windowsGrid(40, 120, 2, 2, 36, 40, 24, 24) + windowsGrid(200, 120, 2, 2, 36, 40, 24, 24) + "</g>" +
      '<rect x="292" y="0" width="4" height="210" fill="#14162b"/><path d="M296 4 h34 l-8 10 l8 10 h-34 z" fill="#ff9933"/>')],
    [CHECKPOINTS[2].x + 320, svg(420, 260,
      '<rect x="10" y="110" width="400" height="150" fill="#e9d8a6" stroke="#14162b" stroke-width="3"/>' +
      '<rect x="160" y="30" width="100" height="230" fill="#d4a373" stroke="#14162b" stroke-width="3"/>' +
      '<path d="M150 32 L210 0 L270 32 Z" fill="#9b2226" stroke="#14162b" stroke-width="3"/>' +
      '<circle cx="210" cy="72" r="24" fill="#fffaf2" stroke="#14162b" stroke-width="3"/><path d="M210 72 V56 M210 72 H222" stroke="#14162b" stroke-width="3" stroke-linecap="round"/>' +
      '<rect x="40" y="118" width="100" height="22" rx="3" fill="#14162b"/><text x="90" y="134" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="600" font-size="13" fill="#fff">RITS</text>' +
      '<rect x="185" y="200" width="50" height="60" fill="#6b4226" stroke="#14162b" stroke-width="3"/>' +
      '<g fill="#a8dadc" stroke="#14162b" stroke-width="2">' + windowsGrid(30, 160, 4, 2, 32, 46, 18, 26) + windowsGrid(280, 130, 4, 3, 32, 42, 18, 26) + "</g>" +
      '<g class="lights" fill="#ffd166">' + windowsGrid(30, 160, 4, 2, 32, 46, 18, 26) + windowsGrid(280, 130, 4, 3, 32, 42, 18, 26) + "</g>")],
    [CHECKPOINTS[3].x + 320, svg(380, 330,
      '<rect x="20" y="90" width="110" height="240" fill="#5e7ce2" stroke="#14162b" stroke-width="3"/>' +
      '<rect x="140" y="20" width="120" height="310" fill="#3d5a80" stroke="#14162b" stroke-width="3"/>' +
      '<rect x="270" y="140" width="90" height="190" fill="#98c1d9" stroke="#14162b" stroke-width="3"/>' +
      '<rect x="146" y="0" width="108" height="26" rx="4" fill="#ff6b35" stroke="#14162b" stroke-width="3"/>' +
      '<text x="200" y="18" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="15" fill="#fff">Solytics</text>' +
      '<g fill="#cfe3f5" opacity=".6">' + windowsGrid(32, 104, 4, 9, 24, 24, 14, 12) + windowsGrid(152, 40, 5, 12, 22, 24, 12, 14) + windowsGrid(282, 154, 3, 7, 26, 24, 14, 12) + "</g>" +
      '<g class="lights" fill="#ffd166">' + windowsGrid(32, 104, 4, 9, 24, 24, 14, 12) + windowsGrid(152, 40, 5, 12, 22, 24, 12, 14) + windowsGrid(282, 154, 3, 7, 26, 24, 14, 12) + "</g>" +
      '<text x="200" y="326" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#fff">PUNE</text>')],
    [CHECKPOINTS[4].x + 300, (function () {
      // Hawa Mahal-inspired tiered pink facade, Jaipur.
      var s = "", tiers = [[0, 380, 70], [30, 320, 62], [60, 260, 56], [95, 190, 50], [130, 120, 44]], y = 300;
      tiers.forEach(function (t) {
        var x = t[0], w = t[1], h = t[2];
        y -= h;
        s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#e07a5f" stroke="#14162b" stroke-width="3"/>';
        for (var wx = x + 10; wx + 20 <= x + w - 4; wx += 26) {
          s += '<path d="M' + wx + " " + (y + h - 8) + " v-" + (h - 26) + " a10 10 0 0 1 20 0 v" + (h - 26) + 'z" fill="#f2cc8f" stroke="#14162b" stroke-width="1.5"/>';
          s += '<path class="lights" d="M' + wx + " " + (y + h - 8) + " v-" + (h - 26) + " a10 10 0 0 1 20 0 v" + (h - 26) + 'z" fill="#ffd166"/>';
        }
        s += '<path d="M' + (x + w / 2 - 14) + " " + y + " a14 14 0 0 1 28 0 z" + '" fill="#c8553d" stroke="#14162b" stroke-width="2"/>';
      });
      var sign = '<g transform="translate(400 170)"><rect x="18" y="40" width="6" height="90" fill="#14162b"/>' +
        '<rect x="-30" y="0" width="104" height="44" rx="6" fill="#fffaf2" stroke="#14162b" stroke-width="3"/>' +
        '<text x="22" y="20" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="15" fill="#14162b">IzooLogic</text>' +
        '<text x="22" y="36" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#ff6b35">JAIPUR · NOW</text></g>';
      return svg(500, 300, '<g transform="translate(0 0)">' + s + "</g>" + sign);
    })()],
    [CHECKPOINTS[5].x + 320, svg(340, 200,
      '<rect x="10" y="50" width="250" height="150" fill="#adb5bd" stroke="#14162b" stroke-width="3"/>' +
      '<path d="M0 56 L135 10 L270 56 Z" fill="#495057" stroke="#14162b" stroke-width="3"/>' +
      '<rect x="40" y="90" width="170" height="110" fill="#6c757d" stroke="#14162b" stroke-width="3"/>' +
      '<g stroke="#495057" stroke-width="3">' + [100, 115, 130, 145, 160, 175, 190].map(function (y) { return '<line x1="40" x2="210" y1="' + y + '" y2="' + y + '"/>'; }).join("") + "</g>" +
      '<rect x="60" y="60" width="130" height="24" rx="4" fill="#ff6b35" stroke="#14162b" stroke-width="2"/>' +
      '<text x="125" y="78" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="600" font-size="14" fill="#fff">PIT STOP</text>' +
      '<g fill="#14162b"><circle cx="290" cy="186" r="16"/><circle cx="290" cy="160" r="16"/><circle cx="290" cy="134" r="16"/></g>' +
      '<g fill="#6c757d"><circle cx="290" cy="186" r="7"/><circle cx="290" cy="160" r="7"/><circle cx="290" cy="134" r="7"/></g>' +
      '<rect x="310" y="174" width="30" height="26" fill="#e63946" stroke="#14162b" stroke-width="2"/>' +
      '<g class="lights"><circle cx="40" cy="70" r="5" fill="#ffd166"/><circle cx="230" cy="70" r="5" fill="#ffd166"/></g>')],
    [CHECKPOINTS[6].x + 320, (function () {
      var names = [["Sentinel", "Rust"], ["Data Harvester", "Django"], ["LinkedIn Jobs", "Selenium"]], s = "";
      names.forEach(function (n, i) {
        var x = i * 170;
        s += '<rect x="' + (x + 70) + '" y="110" width="8" height="120" fill="#14162b"/>' +
          '<rect x="' + x + '" y="' + (40 + (i % 2) * 20) + '" width="150" height="76" rx="6" fill="#fffaf2" stroke="#14162b" stroke-width="3"/>' +
          '<text x="' + (x + 75) + '" y="' + (76 + (i % 2) * 20) + '" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="17" fill="#14162b">' + n[0] + "</text>" +
          '<text x="' + (x + 75) + '" y="' + (98 + (i % 2) * 20) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#ff6b35">' + n[1] + "</text>" +
          '<circle class="lights" cx="' + (x + 75) + '" cy="' + (36 + (i % 2) * 20) + '" r="6" fill="#ffd166"/>';
      });
      return svg(500, 230, s);
    })()],
    [END - 60, arch("FINISH · 2026", "#fff", "#14162b")],
    [END + 420, svg(160, 170,
      '<rect x="60" y="40" width="8" height="130" fill="#14162b"/>' +
      '<path d="M0 20 h130 l20 20 l-20 20 h-130 z" fill="#2ec4b6" stroke="#14162b" stroke-width="3"/>' +
      '<text x="65" y="46" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="600" font-size="13" fill="#14162b">still riding →</text>')]
  ];

  function buildGround() {
    var g = $("#ground");
    g.style.width = (END + OFFSET + 2800) + "px";
    var html = "";
    LANDMARKS.forEach(function (l) {
      html += '<div class="landmark" style="left:' + (l[0] + OFFSET) + 'px">' + l[1] + "</div>";
    });
    CHECKPOINTS.forEach(function (c) {
      if (c.year) html += '<div class="kmpost" style="left:' + (c.x - 140 + OFFSET) + 'px">' + c.year + "</div>";
    });
    g.insertAdjacentHTML("beforeend", html);
  }

  function buildStars() {
    var r = rng(99), s = "";
    for (var i = 0; i < 140; i++) {
      s += '<i style="left:' + (r() * 100).toFixed(2) + "%;top:" + (r() * 62).toFixed(2) + "%;animation-delay:" + (r() * 3).toFixed(2) + "s;opacity:" + (0.4 + r() * 0.6).toFixed(2) + '"></i>';
    }
    $("#stars").innerHTML = s;
  }

  // ---------- rider ----------
  var spokesHTML = "";
  for (var i = 0; i < 12; i++) {
    var a = (i / 12) * Math.PI * 2;
    spokesHTML += '<line x1="0" y1="0" x2="' + (Math.cos(a) * 29).toFixed(2) + '" y2="' + (Math.sin(a) * 29).toFixed(2) + '"/>';
  }
  [].forEach.call(document.querySelectorAll(".rider .spokes"), function (g) { g.innerHTML = spokesHTML; });

  var wheelR = $("#wheel-r .spokes"), wheelF = $("#wheel-f .spokes");
  var crankG = $("#crank"), nearLeg = $("#bike-near-leg"), farLeg = $("#bike-far-leg"), body = $("#body");
  var CRANK = { x: 95, y: 112, r: 13 }, HIP = { x: 82, y: 56 }, THIGH = 36, SHIN = 38;

  function knee(hip, foot) {
    var dx = foot.x - hip.x, dy = foot.y - hip.y;
    var d = Math.min(Math.hypot(dx, dy), THIGH + SHIN - 0.5);
    var base = Math.atan2(dy, dx);
    var alpha = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d));
    var a1 = base - alpha, a2 = base + alpha;
    var k1 = { x: hip.x + Math.cos(a1) * THIGH, y: hip.y + Math.sin(a1) * THIGH };
    var k2 = { x: hip.x + Math.cos(a2) * THIGH, y: hip.y + Math.sin(a2) * THIGH };
    return k1.x > k2.x ? k1 : k2; // knee points forward
  }
  function legMarkup(angle, hipY) {
    var foot = { x: CRANK.x + Math.cos(angle) * CRANK.r, y: CRANK.y + Math.sin(angle) * CRANK.r };
    var hip = { x: HIP.x, y: hipY };
    var k = knee(hip, foot);
    return '<path class="leg" d="M' + hip.x + " " + hip.y + " L" + k.x.toFixed(1) + " " + k.y.toFixed(1) + " L" + foot.x.toFixed(1) + " " + foot.y.toFixed(1) + '"/>' +
      '<ellipse class="shoe" cx="' + (foot.x + 3).toFixed(1) + '" cy="' + (foot.y + 1).toFixed(1) + '" rx="8" ry="3.5"/>';
  }
  function drawRider(wheelDeg, crankRad, bob) {
    wheelR.setAttribute("transform", "rotate(" + wheelDeg.toFixed(1) + ")");
    wheelF.setAttribute("transform", "rotate(" + wheelDeg.toFixed(1) + ")");
    var hipY = HIP.y + bob;
    farLeg.innerHTML = legMarkup(crankRad + Math.PI, hipY);
    nearLeg.innerHTML = legMarkup(crankRad, hipY);
    var ex = CRANK.x + Math.cos(crankRad) * CRANK.r, ey = CRANK.y + Math.sin(crankRad) * CRANK.r;
    crankG.innerHTML = '<circle cx="95" cy="112" r="9" fill="none" stroke="#222" stroke-width="2.5"/><line x1="95" y1="112" x2="' + ex.toFixed(1) + '" y2="' + ey.toFixed(1) + '"/>';
    body.setAttribute("transform", "translate(0 " + bob.toFixed(2) + ")");
  }

  // ---------- HUD route ----------
  var route = $(".route"), fill = $(".route-fill"), dots = [];
  CHECKPOINTS.forEach(function (c) {
    var b = document.createElement("button");
    b.type = "button";
    b.style.left = (c.x / END) * 100 + "%";
    b.setAttribute("aria-label", "Ride to " + c.label);
    b.innerHTML = "<span>" + c.label + "</span>";
    b.addEventListener("click", function () { jumpTo(c.x === 0 ? 0 : c.x + 80); });
    route.appendChild(b);
    dots.push(b);
  });

  var cards = {};
  [].forEach.call(document.querySelectorAll(".card"), function (el) { cards[el.getAttribute("data-cp")] = el; });

  // ---------- scroll mapping ----------
  var space = $("#scroll-space");
  function maxScroll() { return Math.max(1, document.documentElement.scrollHeight - window.innerHeight); }
  function layout() {
    space.style.height = Math.round(END * SCROLL_PER_PX + window.innerHeight) + "px";
  }
  function jumpTo(worldX) {
    window.scrollTo({ top: (worldX / END) * maxScroll(), behavior: reduceMotion ? "auto" : "smooth" });
  }
  [].forEach.call(document.querySelectorAll("[data-jump]"), function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); jumpTo(parseFloat(el.getAttribute("data-jump"))); });
  });
  window.addEventListener("keydown", function (e) {
    if (e.target.closest && e.target.closest("input,textarea")) return;
    if (e.key === "ArrowRight") { window.scrollBy({ top: 260 }); e.preventDefault(); }
    if (e.key === "ArrowLeft") { window.scrollBy({ top: -260 }); e.preventDefault(); }
  });

  // ---------- frame loop ----------
  var riderEl = $("#rider"), hero = $("#hero"), sky = $("#sky"), sun = $("#sun"), moon = $("#moon");
  var speedEl = $("#speed"), root = document.documentElement;
  var cur = 0, last = performance.now(), dist = 0, lastNight = -1, lastActive = null, speedSmooth = 0;

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var vw = window.innerWidth, vh = window.innerHeight;
    var target = Math.min(1, Math.max(0, window.scrollY / maxScroll())) * END;
    var prev = cur;
    cur = reduceMotion ? target : cur + (target - cur) * Math.min(1, dt * 5);
    if (Math.abs(target - cur) < 0.05) cur = target;
    var dx = cur - prev;
    dist += dx;

    var mobile = vw < 760;
    var riderW = mobile ? 140 : 200;
    var rs = mobile ? 16 : vw * 0.16;
    var camX = cur - rs;

    layers.forEach(function (l) {
      l.el.style.transform = "translate3d(" + (-(camX + OFFSET) * l.f).toFixed(1) + "px,0,0)";
    });
    riderEl.style.transform = "translate3d(" + rs.toFixed(1) + "px,0,0)";

    // Rider animation: wheels roll with distance, pedals turn with the wheels.
    var scale = riderW / 200;
    var wheelRad = dist / (34 * scale);
    var crank = wheelRad / 2.4;
    drawRider((wheelRad * 180) / Math.PI, crank, Math.abs(dx) > 0.2 ? Math.sin(crank * 2) * 1.2 : 0);
    var v = Math.abs(dx) / Math.max(dt, 0.001);
    speedSmooth += (v - speedSmooth) * Math.min(1, dt * 4);
    speedEl.textContent = speedSmooth > 40 ? Math.round(Math.min(68, speedSmooth / 14)) : 0;
    riderEl.classList.toggle("moving", speedSmooth > 40);

    // Sky / time of day.
    var p = cur / END, pal = palette(p);
    sky.style.background = "linear-gradient(" + pal.top + "," + pal.bot + ")";
    paint.far.setAttribute("fill", pal.far);
    paint.mid.setAttribute("fill", pal.mid);
    paint.near.setAttribute("fill", pal.near);
    paint.clouds.setAttribute("opacity", (0.85 - pal.night * 0.7).toFixed(2));
    if (Math.abs(pal.night - lastNight) > 0.005) { root.style.setProperty("--night", pal.night.toFixed(3)); lastNight = pal.night; }
    var sp = Math.min(1, p / 0.86);
    sun.style.opacity = Math.max(0, 1 - pal.night * 2.2).toFixed(2);
    sun.style.transform = "translate(" + (vw * (0.08 + sp * 0.84) - 65).toFixed(0) + "px," + (vh * (0.62 - Math.sin(sp * Math.PI) * 0.5 + Math.max(0, p - 0.8) * 2)).toFixed(0) + "px)";
    var mp = Math.max(0, (p - 0.78) / 0.22);
    moon.style.transform = "translate(" + (vw * (0.92 - mp * 0.2)).toFixed(0) + "px," + (vh * (0.7 - mp * 0.55)).toFixed(0) + "px)";

    // Hero fades as you leave the start line.
    var h = Math.max(0, 1 - cur / 650);
    hero.style.opacity = h.toFixed(3);
    hero.style.transform = "translateY(" + (-(1 - h) * 40).toFixed(1) + "px)";
    hero.style.visibility = h <= 0 ? "hidden" : "visible";

    // Active checkpoint card.
    var active = null;
    for (var i = 1; i < CHECKPOINTS.length; i++) {
      var c = CHECKPOINTS[i], next = CHECKPOINTS[i + 1];
      var end = next ? Math.min(next.x - 420, c.x + 1100) : Infinity;
      if (cur >= c.x - 320 && cur <= end) active = c.id;
    }
    if (active !== lastActive) {
      if (lastActive && cards[lastActive]) cards[lastActive].classList.remove("active");
      if (active && cards[active]) cards[active].classList.add("active");
      lastActive = active;
    }

    fill.style.width = (p * 100).toFixed(2) + "%";
    dots.forEach(function (d, i) {
      d.classList.toggle("done", cur >= CHECKPOINTS[i].x - 320);
      d.classList.toggle("current", CHECKPOINTS[i].id === active);
    });

    requestAnimationFrame(frame);
  }

  buildClouds(); buildFar(); buildMid(); buildNear(); buildGround(); buildStars();
  layout();
  window.addEventListener("resize", layout);
  requestAnimationFrame(frame);
})();
