/* The Ride — a hand-drawn, scroll-driven motorbike journey. No dependencies. */
(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Journey data
  // ------------------------------------------------------------------
  // x = rider world position (px). Scroll progress 1 puts the rider at END.
  var CHECKPOINTS = [
    { id: "start",     x: 0,     label: "Garage" },
    { id: "school",    x: 1500,  label: "Malda",    stone: ["MALDA", "2019"] },
    { id: "college",   x: 3100,  label: "Gwalior",  stone: ["GWALIOR", "2020"] },
    { id: "solytics",  x: 4900,  label: "Pune",     stone: ["PUNE", "2023"] },
    { id: "izoologic", x: 6800,  label: "Jaipur",   stone: ["JAIPUR", "2024"] },
    { id: "garage",    x: 8600,  label: "Pit stop", stone: ["FUEL", "0 km"] },
    { id: "projects",  x: 10200, label: "Projects", stone: ["SIDE", "QUEST"] },
    { id: "finish",    x: 12000, label: "Chai",     stone: ["CHAI", "2026"] }
  ];
  var END = 12000;
  var OFFSET = 1500;           // world x = -OFFSET is the left edge of each layer
  var SCROLL_PER_PX = 0.85;    // page scroll px per world px

  var ACHIEVEMENTS = [
    ["wanderer",  "WANDERER",     "Started the ride"],
    ["kick",      "KICK-STARTER", "Turned the engine sound on"],
    ["honk",      "HONK HONK",    "Honked the horn (click the bike)"],
    ["school",    "FIRST GEAR",   "Reached Malda, 2019"],
    ["college",   "GRADUATE",     "Rode through Gwalior"],
    ["solytics",  "ON THE CLOCK", "First job, Pune"],
    ["izoologic", "LEVEL UP",     "Became SDE III in Jaipur"],
    ["garage",    "FULL TANK",    "Refuelled at the pit stop"],
    ["poster",    "CURIOUS",      "Opened a project poster"],
    ["speed",     "SPEED DEMON",  "Hit 60 km/h"],
    ["night",     "NIGHT RIDER",  "Rode after sunset"],
    ["finish",    "CHAI TIME",    "Made it to the chai stop"]
  ];

  // Sky wash + night amount along the journey.
  var SKY = [
    { p: 0,    wash: "#ffc9a8", night: 0 },
    { p: 0.25, wash: "#bfe0ff", night: 0 },
    { p: 0.55, wash: "#a9d4ff", night: 0 },
    { p: 0.72, wash: "#ffd29a", night: 0 },
    { p: 0.84, wash: "#e7a3b8", night: 0.15 },
    { p: 0.92, wash: "#8f8fd0", night: 0.7 },
    { p: 1,    wash: "#5d6bb5", night: 1 }
  ];

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s) { return document.querySelector(s); };
  var INK = "#1f1f24", PAPER = "#fbfaf6", ACCENT = "#ff6b35";
  var S = 'stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"';
  var HAND = 'font-family="Patrick Hand, cursive"', SKETCH = 'font-family="Cabin Sketch, cursive" font-weight="700"';

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex(c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); }
  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    return "rgb(" + x.map(function (v, i) { return Math.round(v + (y[i] - v) * t); }).join(",") + ")";
  }
  function sky(p) {
    for (var i = 0; i < SKY.length - 1; i++) {
      var a = SKY[i], b = SKY[i + 1];
      if (p <= b.p) {
        var t = (p - a.p) / (b.p - a.p);
        return { wash: mix(a.wash, b.wash, t), night: a.night + (b.night - a.night) * t };
      }
    }
    return { wash: SKY[SKY.length - 1].wash, night: 1 };
  }
  function svg(w, h, inner, rough) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">' +
      (rough === false ? inner : '<g filter="url(#rough)">' + inner + "</g>") + "</svg>";
  }
  function ridge(width, height, step, base, amp, seed) {
    var r = rng(seed), d = "M0 " + height, y = base;
    for (var x = 0; x <= width + step; x += step) {
      y = Math.max(10, Math.min(height - 10, y + (r() - 0.5) * amp));
      d += " L" + x + " " + Math.round(height - y);
    }
    return d + " L" + (width + step) + " " + height + " Z";
  }
  // Puffy outline (clouds, tree canopies): thick strokes underneath, paper fill on top.
  function puffs(circles, fill) {
    var under = "", over = "";
    circles.forEach(function (c) {
      under += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '" fill="none" stroke="' + INK + '" stroke-width="5"/>';
      over += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '" fill="' + (fill || PAPER) + '"/>';
    });
    return under + over;
  }
  function grid(x0, y0, cols, rows, dx, dy, w, h, attrs) {
    var s = "";
    for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++)
      s += '<rect x="' + (x0 + c * dx) + '" y="' + (y0 + r * dy) + '" width="' + w + '" height="' + h + '" ' + attrs + "/>";
    return s;
  }
  function sticker(x, y, rot, label, bg, fg, w) {
    w = w || label.length * 9 + 22;
    return '<g transform="translate(' + x + " " + y + ") rotate(" + rot + ')">' +
      '<rect x="' + (-w / 2) + '" y="-14" width="' + w + '" height="28" rx="12" fill="' + bg + '" ' + S + ' stroke-width="2"/>' +
      '<text y="6" text-anchor="middle" ' + HAND + ' font-size="17" fill="' + fg + '">' + label + "</text></g>";
  }
  var isMobile = function () { return window.innerWidth < 760; };

  // ------------------------------------------------------------------
  // Scenery
  // ------------------------------------------------------------------
  var layers = [].map.call(document.querySelectorAll(".layer"), function (el) {
    return { el: el, f: parseFloat(el.getAttribute("data-f")) };
  });
  function layerWidth(f) { return Math.ceil((END + OFFSET) * f + 2800); }
  function layerU(worldX, f, lead) { return Math.round((worldX + lead + OFFSET) * f); }

  function buildClouds() {
    var w = layerWidth(0.08), r = rng(7), s = "";
    for (var i = 0; i < 22; i++) {
      var x = r() * w, y = 50 + r() * 200, k = 0.5 + r() * 0.7;
      s += '<g transform="translate(' + x.toFixed(0) + " " + y.toFixed(0) + ") scale(" + k.toFixed(2) + ')">' +
        puffs([[-40, 8, 24], [-12, -6, 30], [22, -2, 26], [48, 10, 18], [6, 14, 22]]) +
        '<path d="M-60 30 H66" stroke="' + INK + '" stroke-width="2" opacity=".35"/></g>';
    }
    $("#clouds").innerHTML = svg(w, 300, s);
  }

  function buildFar() {
    var w = layerWidth(0.15), d = ridge(w, 280, 70, 160, 80, 11);
    $("#far").innerHTML = svg(w, 280,
      '<path d="' + d + '" fill="' + PAPER + '"/><path d="' + d + '" fill="url(#hatch-light)" stroke="' + INK + '" stroke-width="1.8" stroke-linejoin="round"/>');
  }

  function fort(x, y, scale) {
    return '<g transform="translate(' + x + " " + y + ") scale(" + scale + ')">' +
      '<path d="M-20 92 h170 v-30 h-10 v-10 h-8 v10 h-12 v-26 h-14 v26 h-30 v-34 a14 14 0 0 0 -28 0 v34 h-20 v-20 h-12 v20 h-16 v-14 h-10 z" fill="' + PAPER + '" ' + S + "/>" +
      '<path d="M-20 92 h170 v-30 h-10 v-10 h-8 v10 h-12 v-26 h-14 v26 h-30 v-34 a14 14 0 0 0 -28 0 v34 h-20 v-20 h-12 v20 h-16 v-14 h-10 z" fill="url(#bricks)"/>' +
      grid(0, 72, 6, 1, 24, 0, 6, 10, 'fill="' + INK + '"') + "</g>";
  }
  function waterTanks(x, seed) {
    var r = rng(seed), s = "";
    for (var i = 0; i < 9; i++) {
      var bx = x + i * 70 + r() * 20, h = 50 + r() * 70, w = 50 + r() * 26;
      s += '<rect x="' + bx + '" y="' + (180 - h) + '" width="' + w + '" height="' + h + '" fill="' + PAPER + '" ' + S + ' stroke-width="2"/>' +
        grid(bx + 8, 190 - h, 2, Math.floor(h / 26), 22, 24, 10, 10, 'fill="url(#hatch)"');
      if (r() < 0.6) { // black Sintex-style water tank
        var tx = bx + w / 2 - 12;
        s += '<path d="M' + tx + " " + (180 - h) + " v-20 q12 -10 24 0 v20 z" + '" fill="' + INK + '"/>';
      }
      if (r() < 0.4) s += '<path d="M' + (bx + w - 10) + " " + (180 - h) + " v-30 m-8 6 h16 m-12 8 h8" + '" ' + S + ' stroke-width="1.6" fill="none"/>';
    }
    return s;
  }
  function buildMid() {
    var f = 0.35, w = layerWidth(f), d = ridge(w, 200, 55, 60, 34, 23);
    var s = '<path d="' + d + '" fill="' + PAPER + '" ' + S + ' stroke-width="2"/>';
    s += fort(layerU(CHECKPOINTS[2].x, f, 1300), 50, 1);              // Gwalior Fort
    s += fort(layerU(CHECKPOINTS[4].x, f, 1500), 66, 0.8);            // Amber Fort, Jaipur
    s += waterTanks(layerU(CHECKPOINTS[3].x, f, 700), 5);             // Pune rooftops
    s += waterTanks(layerU(CHECKPOINTS[6].x, f, 600), 9);             // rooftops behind the washing line
    $("#mid").innerHTML = svg(w, 200, s);
  }

  function buildNear() {
    var w = layerWidth(0.6), r = rng(42), s = "";
    for (var x = 0; x < w; x += 110 + r() * 220) {
      var h = 60 + r() * 60;
      if (r() < 0.45) {
        s += '<path d="M' + x + " 150 l" + h * 0.3 + " -" + h + " l" + h * 0.3 + " " + h + 'z" fill="' + PAPER + '" ' + S + ' stroke-width="2"/>' +
          '<path d="M' + (x + h * 0.3) + " " + (150 - h) + " l" + h * 0.3 + " " + h + " h-" + h * 0.3 + 'z" fill="url(#hatch)"/>';
      } else {
        var cx = x + 30, cy = 150 - h * 0.75, rr = h * 0.26;
        s += '<path d="M' + cx + " 150 V" + (cy + rr * 0.6) + " M" + cx + " " + (cy + rr * 1.1) + " l-10 -12 M" + cx + " " + (cy + rr * 1.3) + ' l9 -10" ' + S + ' stroke-width="2.4" fill="none"/>' +
          puffs([[cx - rr * 0.7, cy + 4, rr * 0.8], [cx, cy - rr * 0.5, rr], [cx + rr * 0.8, cy + 2, rr * 0.75]]) +
          '<path d="M' + (cx + rr * 0.2) + " " + (cy + rr * 0.6) + " q" + rr * 0.6 + " -2 " + rr * 0.9 + ' -10" stroke="' + INK + '" stroke-width="1.4" fill="none" opacity=".6"/>';
      }
    }
    $("#near").innerHTML = svg(w, 150, s);
  }

  // Ground landmarks: [worldX, svg, extraHTML, className]
  function garage() {
    var s = '<rect x="0" y="90" width="640" height="250" fill="' + PAPER + '"/><rect x="0" y="90" width="640" height="250" fill="url(#bricks)" ' + S + "/>" +
      '<path d="M-14 92 H654" ' + S + ' stroke-width="4"/>' +
      '<rect x="170" y="130" width="300" height="210" fill="#efece4" ' + S + "/>" +
      '<rect x="176" y="136" width="288" height="70" fill="' + PAPER + '" ' + S + ' stroke-width="2"/>' +
      [150, 164, 178, 192].map(function (y) { return '<path d="M178 ' + y + ' H462" stroke="' + INK + '" stroke-width="1.3" opacity=".6"/>'; }).join("") +
      '<rect x="176" y="206" width="288" height="134" fill="url(#hatch-light)"/>' +
      // stickers on the shutter
      sticker(220, 160, -8, "Python", "#ffd43b", INK) + sticker(310, 152, 5, "Rust", "#f74c00", "#fff") +
      sticker(410, 160, -4, "K8s", "#326ce5", "#fff") + sticker(250, 190, 7, "Kafka", INK, "#fff") +
      sticker(350, 186, -6, "Docker", "#2496ed", "#fff") + sticker(430, 192, 9, "AWS", "#ff9900", INK) +
      // hanging wooden sign
      '<path d="M220 0 L236 34 M420 0 L404 34" stroke="' + INK + '" stroke-width="2" stroke-dasharray="5 3"/>' +
      '<rect x="190" y="30" width="260" height="56" rx="6" fill="#d9b382" ' + S + "/>" +
      '<path d="M200 46 q60 -6 120 0 t120 0 M204 72 q80 6 230 -2" stroke="' + INK + '" stroke-width="1.2" fill="none" opacity=".45"/>' +
      '<text x="320" y="68" text-anchor="middle" ' + SKETCH + ' font-size="28" fill="' + INK + '">TANMAY\'S GARAGE</text>' +
      // window + plant + oil can + tyre stack
      '<rect x="40" y="140" width="90" height="80" fill="' + PAPER + '" ' + S + '/><path d="M85 140 V220 M40 180 H130" ' + S + "/>" +
      '<rect x="30" y="226" width="110" height="20" fill="#c8a46a" ' + S + "/>" +
      '<path d="M50 226 q-6 -24 6 -30 q2 16 4 30 M76 226 q0 -30 10 -34 q2 18 -2 34 M104 226 q8 -26 20 -26 q-8 12 -10 26" fill="#a3c585" ' + S + ' stroke-width="1.8"/>' +
      '<ellipse cx="530" cy="326" rx="30" ry="12" fill="#55565f" ' + S + '/><ellipse cx="530" cy="326" rx="12" ry="4" fill="' + PAPER + '"/>' +
      '<ellipse cx="530" cy="304" rx="30" ry="12" fill="#55565f" ' + S + '/><ellipse cx="530" cy="304" rx="12" ry="4" fill="' + PAPER + '"/>' +
      '<path d="M582 340 v-40 h30 v40 z M590 300 v-10 h10" fill="#e63946" ' + S + ' stroke-width="2"/>' +
      '<text x="597" y="326" text-anchor="middle" ' + HAND + ' font-size="12" fill="#fff">OIL</text>';
    return svg(660, 340, s);
  }
  function school() {
    return svg(320, 230,
      '<rect x="20" y="80" width="260" height="150" fill="' + PAPER + '" ' + S + '/><rect x="20" y="80" width="260" height="150" fill="url(#bricks)"/>' +
      '<path d="M5 84 L150 26 L295 84 Z" fill="#f2b8a0" ' + S + '/><path d="M5 84 L150 26 L295 84 Z" fill="url(#hatch)"/>' +
      '<rect x="122" y="160" width="56" height="70" fill="' + PAPER + '" ' + S + '/><path d="M150 160 V230" ' + S + "/>" +
      '<rect x="92" y="90" width="116" height="28" rx="4" fill="' + PAPER + '" ' + S + ' stroke-width="2"/>' +
      '<text x="150" y="110" text-anchor="middle" ' + SKETCH + ' font-size="17" fill="' + INK + '">KV MALDA</text>' +
      grid(38, 132, 2, 2, 38, 44, 26, 28, 'fill="#cfe6f5" ' + S + ' stroke-width="2"') + grid(208, 132, 2, 2, 38, 44, 26, 28, 'fill="#cfe6f5" ' + S + ' stroke-width="2"') +
      '<path d="M300 230 V0" ' + S + ' stroke-width="3"/>' +
      '<rect x="301" y="4" width="42" height="9" fill="#ff9933"/><rect x="301" y="13" width="42" height="9" fill="#fff"/><rect x="301" y="22" width="42" height="9" fill="#138808"/>' +
      '<rect x="301" y="4" width="42" height="27" fill="none" ' + S + ' stroke-width="1.6"/><circle cx="322" cy="17.5" r="3" fill="none" stroke="#000080" stroke-width="1.2"/>');
  }
  function college() {
    return svg(430, 280,
      '<rect x="10" y="120" width="410" height="160" fill="#f3e6c4" ' + S + "/>" +
      '<rect x="165" y="36" width="100" height="244" fill="' + PAPER + '" ' + S + '/><rect x="165" y="36" width="100" height="244" fill="url(#bricks)"/>' +
      '<path d="M154 38 L215 0 L276 38 Z" fill="#c1554d" ' + S + '/><path d="M154 38 L215 0 L276 38 Z" fill="url(#hatch)"/>' +
      '<circle cx="215" cy="80" r="25" fill="' + PAPER + '" ' + S + '/><path d="M215 80 V62 M215 80 H229" ' + S + ' stroke-width="3"/>' +
      '<rect x="36" y="128" width="104" height="26" rx="3" fill="' + INK + '"/><text x="88" y="147" text-anchor="middle" ' + SKETCH + ' font-size="17" fill="' + PAPER + '">RITS</text>' +
      '<path d="M190 280 V222 a25 25 0 0 1 50 0 V280" fill="' + PAPER + '" ' + S + "/>" +
      grid(30, 170, 4, 2, 32, 48, 18, 28, 'fill="#cfe6f5" ' + S + ' stroke-width="1.8"') + grid(288, 140, 4, 3, 32, 44, 18, 28, 'fill="#cfe6f5" ' + S + ' stroke-width="1.8"') +
      '<path d="M10 120 H420" stroke="' + INK + '" stroke-width="5"/>');
  }
  function pune() {
    return svg(390, 340,
      '<rect x="20" y="100" width="110" height="240" fill="#d6e4f7" ' + S + "/>" +
      '<rect x="140" y="30" width="120" height="310" fill="' + PAPER + '" ' + S + "/>" +
      '<rect x="270" y="150" width="100" height="190" fill="#e4eef9" ' + S + "/>" +
      '<path d="M140 30 L260 120 M140 80 L260 170" stroke="' + INK + '" stroke-width="1" opacity=".3"/>' +
      grid(32, 114, 4, 9, 24, 24, 14, 12, 'fill="url(#hatch)" ' + S + ' stroke-width="1.2"') +
      grid(152, 50, 5, 12, 22, 24, 12, 14, 'fill="#cfe6f5" ' + S + ' stroke-width="1.2"') +
      grid(282, 164, 3, 7, 30, 24, 16, 12, 'fill="url(#hatch)" ' + S + ' stroke-width="1.2"') +
      '<rect x="146" y="2" width="108" height="30" rx="5" fill="' + ACCENT + '" ' + S + "/>" +
      '<text x="200" y="24" text-anchor="middle" ' + SKETCH + ' font-size="19" fill="#fff">Solytics</text>' +
      // vada pav cart
      '<g transform="translate(-40 270)"><rect x="0" y="16" width="70" height="34" fill="#ffd166" ' + S + ' stroke-width="2"/><path d="M-4 0 H74 L66 16 H4 Z" fill="' + ACCENT + '" ' + S + ' stroke-width="2"/>' +
      '<circle cx="14" cy="60" r="9" fill="' + PAPER + '" ' + S + ' stroke-width="2"/><circle cx="56" cy="60" r="9" fill="' + PAPER + '" ' + S + ' stroke-width="2"/>' +
      '<text x="35" y="38" text-anchor="middle" ' + HAND + ' font-size="12" fill="' + INK + '">VADA PAV</text></g>');
  }
  function jaipur() {
    var s = "", tiers = [[0, 380, 70], [30, 320, 62], [60, 260, 56], [95, 190, 50], [130, 120, 44]], y = 300;
    tiers.forEach(function (t) {
      var x = t[0], w = t[1], h = t[2];
      y -= h;
      s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#f6c4b4" ' + S + "/>";
      for (var wx = x + 10; wx + 20 <= x + w - 4; wx += 26)
        s += '<path d="M' + wx + " " + (y + h - 8) + " v-" + (h - 26) + " a10 10 0 0 1 20 0 v" + (h - 26) + 'z" fill="' + PAPER + '" ' + S + ' stroke-width="1.5"/>' +
          '<path d="M' + (wx + 4) + " " + (y + h - 10) + " v-" + (h - 34) + '" stroke="' + INK + '" stroke-width="1" opacity=".4"/>';
      s += '<path d="M' + (x + w / 2 - 14) + " " + y + " a14 14 0 0 1 28 0 z" + '" fill="#e07a5f" ' + S + ' stroke-width="2"/>';
    });
    s += '<g transform="translate(400 160)"><path d="M22 44 V140" ' + S + ' stroke-width="5"/>' +
      '<rect x="-34" y="0" width="112" height="48" rx="6" fill="' + PAPER + '" ' + S + "/>" +
      '<text x="22" y="22" text-anchor="middle" ' + SKETCH + ' font-size="19" fill="' + INK + '">IzooLogic</text>' +
      '<text x="22" y="40" text-anchor="middle" ' + HAND + ' font-size="13" fill="' + ACCENT + '">JAIPUR · NOW</text></g>';
    return svg(520, 300, s);
  }
  function pitstop() {
    var pump = function (x, name, color) {
      return '<g transform="translate(' + x + ' 130)"><rect x="0" y="0" width="64" height="120" rx="8" fill="' + color + '" ' + S + "/>" +
        '<rect x="10" y="12" width="44" height="30" rx="3" fill="' + PAPER + '" ' + S + ' stroke-width="2"/>' +
        '<text x="32" y="33" text-anchor="middle" ' + HAND + ' font-size="15" fill="' + INK + '">' + name + "</text>" +
        '<path d="M64 60 q22 0 22 30 v30" ' + S + ' stroke-width="3" fill="none"/><rect x="80" y="112" width="12" height="18" fill="' + INK + '"/>' +
        '<rect x="14" y="56" width="36" height="46" fill="url(#hatch)" ' + S + ' stroke-width="1.6"/></g>';
    };
    return svg(470, 260,
      '<path d="M20 60 V260 M440 60 V260" ' + S + ' stroke-width="7"/>' +
      '<rect x="0" y="30" width="460" height="36" fill="' + PAPER + '" ' + S + "/>" +
      '<rect x="0" y="30" width="460" height="10" fill="' + ACCENT + '"/>' +
      '<text x="230" y="61" text-anchor="middle" ' + SKETCH + ' font-size="20" fill="' + INK + '">PIT STOP · FUEL FOR THOUGHT</text>' +
      pump(70, "PY-98", "#ffe08a") + pump(190, "RUST", "#ffb38a") + pump(310, "K8S", "#a8c8ff") +
      '<rect x="160" y="250" width="200" height="10" fill="url(#hatch)"/>');
  }
  var POSTERS = [
    { t: "Sentinel", d: "Plugin-based infra monitoring in Rust. Axum + SQLx, React dashboard, Slack and Kafka alerts.", c: ["Rust", "Axum", "Docker"], u: "https://github.com/Tanmaysarkar2002", x: 110 },
    { t: "Data Harvester", d: "Universal web scraper with CAPTCHA solving, Google News, and RSS. Runs on AWS EC2.", c: ["Django", "React", "AWS"], u: "https://github.com/Tanmaysarkar2002/Universal-Scrapper", x: 420 },
    { t: "LinkedIn Jobs", d: "Scrapes and indexes LinkedIn job listings, filtered by criteria you set.", c: ["Selenium", "Postgres"], u: "https://github.com/Tanmaysarkar2002/Linked__scraping__Database", x: 730 }
  ];
  function ropeY(x) { var t = (x - 10) / 960; return (1 - t) * (1 - t) * 40 + 2 * t * (1 - t) * 170 + t * t * 40; }
  function washingLine() {
    var art = svg(1000, 470,
      '<path d="M10 470 V30 M990 470 V30" ' + S + ' stroke-width="6"/><path d="M-6 36 H26 M974 36 H1006" ' + S + ' stroke-width="4"/>' +
      '<path d="M10 40 Q490 300 970 40" stroke="' + INK + '" stroke-width="2.2" fill="none"/>' +
      '<path d="M200 ' + ropeY(200) + ' l10 18 l10 -16 M640 ' + ropeY(640) + ' l-8 20 l14 -6" stroke="' + INK + '" stroke-width="1.8" fill="#fff"/>');
    var html = POSTERS.map(function (p, i) {
      return '<a class="poster" data-i="' + i + '" href="' + p.u + '" target="_blank" rel="noopener" style="left:' + p.x + "px;top:" + Math.round(ropeY(p.x + 95) + 14) + 'px">' +
        "<h3>" + p.t + "</h3><p>" + p.d + '</p><div class="chips">' + p.c.map(function (c) { return "<span>" + c + "</span>"; }).join("") +
        '</div><span class="go">open code →</span></a>';
    }).join("");
    return art + html;
  }
  function chaiStall() {
    var stripes = "";
    for (var i = 0; i < 10; i++) stripes += '<path d="M' + (i * 32) + " 40 h32 v42 a16 12 0 0 1 -32 0 z" + '" fill="' + (i % 2 ? PAPER : ACCENT) + '" ' + S + ' stroke-width="2"/>';
    var art = svg(560, 290,
      '<rect x="20" y="0" width="280" height="40" rx="4" fill="#d9b382" ' + S + "/>" +
      '<text x="160" y="29" text-anchor="middle" ' + SKETCH + ' font-size="24" fill="' + INK + '">TANMAY KI TAPRI</text>' +
      '<path d="M24 70 V290 M296 70 V290" ' + S + ' stroke-width="6"/>' + stripes +
      '<rect x="10" y="180" width="300" height="110" fill="' + PAPER + '" ' + S + '/><rect x="10" y="180" width="300" height="110" fill="url(#hatch-light)"/>' +
      '<text x="160" y="240" text-anchor="middle" ' + SKETCH + ' font-size="30" fill="' + ACCENT + '">CHAI ☕</text>' +
      // kettle + steam
      '<path d="M70 178 q-6 -40 30 -40 q36 0 30 40 z" fill="#c9ccd1" ' + S + '/><path d="M130 160 l22 -14" ' + S + ' stroke-width="5"/><path d="M84 138 q16 -22 32 0" ' + S + ' fill="none"/>' +
      '<path class="steam" d="M152 140 q-8 -12 2 -22 q10 -10 0 -22" stroke="' + INK + '" stroke-width="2" fill="none" opacity=".6"/>' +
      '<path class="steam s2" d="M160 136 q8 -12 -2 -22 q-10 -10 0 -22" stroke="' + INK + '" stroke-width="2" fill="none" opacity=".5"/>' +
      // cutting chai glasses
      '<path d="M190 178 l4 -22 h16 l4 22 z M222 178 l4 -22 h16 l4 22 z M254 178 l4 -22 h16 l4 22 z" fill="#e8b26a" ' + S + ' stroke-width="1.8"/>' +
      // bench
      '<path d="M340 250 H470 M350 250 V290 M460 250 V290" ' + S + ' stroke-width="6"/>', true);
    var chalk = '<div class="chalk" style="left:330px;top:20px"><h4>MENU</h4>' +
      "<div><span>Cutting chai</span><span>₹10</span></div>" +
      "<div><span>Masala chai</span><span>₹15</span></div>" +
      "<div><span>Bun maska</span><span>₹20</span></div>" +
      "<div><span>Hiring Tanmay</span><span>priceless</span></div></div>";
    return art + chalk;
  }
  function stone(label, year) {
    return svg(80, 96,
      '<path d="M6 96 V40 A34 34 0 0 1 74 40 V96 Z" fill="' + PAPER + '" ' + S + "/>" +
      '<path d="M7 42 A33 33 0 0 1 73 42 Z" fill="' + ACCENT + '"/>' +
      '<path d="M6 42 H74" ' + S + ' stroke-width="2"/>' +
      '<text x="40" y="34" text-anchor="middle" ' + HAND + ' font-size="' + (label.length > 6 ? 12 : 15) + '" fill="#fff">' + label + "</text>" +
      '<text x="40" y="70" text-anchor="middle" ' + SKETCH + ' font-size="19" fill="' + INK + '">' + year + "</text>" +
      '<path d="M2 96 H78" ' + S + "/>");
  }
  function lamp() {
    return svg(70, 230,
      '<path d="M14 230 V20 Q14 8 30 8 H52" ' + S + ' stroke-width="4" fill="none"/>' +
      '<path d="M40 8 h22 l-4 10 h-14 z" fill="' + PAPER + '" ' + S + ' stroke-width="2"/>' +
      '<path d="M6 230 h16" ' + S + ' stroke-width="5"/>');
  }

  var LAMP_XS = [];
  for (var lx = 700; lx < END + 1400; lx += 1100) LAMP_XS.push(lx);

  var LANDMARKS = [
    [-200, garage()],
    [CHECKPOINTS[1].x + 330, school()],
    [CHECKPOINTS[2].x + 320, college()],
    [CHECKPOINTS[3].x + 330, pune()],
    [CHECKPOINTS[4].x + 300, jaipur()],
    [CHECKPOINTS[5].x + 320, pitstop()],
    [CHECKPOINTS[6].x + 120, washingLine(), "line"],
    [END + 200, chaiStall(), "chai"]
  ];
  var CHAI_X = END + 200;

  function buildGround() {
    var g = $("#ground"), html = "";
    g.style.width = (END + OFFSET + 2800) + "px";
    LAMP_XS.forEach(function (x) { html += '<div class="landmark" style="left:' + (x + OFFSET) + 'px;transform:none">' + lamp() + "</div>"; });
    LANDMARKS.forEach(function (l) {
      html += '<div class="landmark ' + (l[2] || "") + '" style="left:' + (l[0] + OFFSET) + 'px">' + l[1] + "</div>";
    });
    CHECKPOINTS.forEach(function (c) {
      if (c.stone) html += '<div class="landmark" style="left:' + (c.x - 170 + OFFSET) + 'px">' + stone(c.stone[0], c.stone[1]) + "</div>";
    });
    g.insertAdjacentHTML("beforeend", html);
    // Size the washing-line container so the HTML posters sit on the rope.
    var line = g.querySelector(".landmark.line");
    line.style.width = "1000px"; line.style.height = "470px";
    var chai = g.querySelector(".landmark.chai");
    chai.style.width = "560px"; chai.style.height = "290px";
  }

  function buildGlow() {
    var k = isMobile() ? 0.6 : 1, html = "";
    LAMP_XS.forEach(function (x) { html += '<div class="lamp" style="left:' + (x + 51 + OFFSET) + 'px"></div>'; });
    // Warm glow + fairy lights over the chai stall.
    var cx = CHAI_X + OFFSET;
    html += '<div class="warm" style="left:' + (cx - 80 * k) + "px;bottom:calc(var(--road-h) + " + (20 * k) + "px);width:" + (480 * k) + "px;height:" + (300 * k) + 'px"></div>';
    for (var i = 0; i <= 12; i++) {
      var bx = i * 25, by = 96 + Math.sin((i / 12) * Math.PI) * 10;
      html += '<i class="bulb" style="left:' + (cx + bx * k - 4) + "px;bottom:calc(var(--road-h) + " + ((290 - by) * k - 4) + "px);animation-delay:" + (i * 0.17).toFixed(2) + 's"></i>';
    }
    $("#glow").innerHTML = html;
    $("#glow").style.width = (END + OFFSET + 2800) + "px";
    $("#glow").style.height = "100%";
  }

  function buildSky() {
    $("#sun").innerHTML = svg(120, 120,
      '<g transform="translate(60 60)">' +
      Array.apply(null, Array(12)).map(function (_, i) {
        var a = (i / 12) * Math.PI * 2;
        return '<path d="M' + (Math.cos(a) * 42).toFixed(1) + " " + (Math.sin(a) * 42).toFixed(1) + " L" + (Math.cos(a) * 56).toFixed(1) + " " + (Math.sin(a) * 56).toFixed(1) + '" ' + S + "/>";
      }).join("") +
      '<circle r="32" fill="#ffe7a3" ' + S + '/><circle r="32" fill="url(#hatch-light)"/></g>');
    $("#moon").innerHTML = svg(90, 90, '<path d="M60 10 A38 38 0 1 0 80 62 A30 30 0 1 1 60 10 Z" fill="#fdf6d8" stroke="#fdf6d8" stroke-width="2"/>');
    var r = rng(99), s = "";
    for (var i = 0; i < 46; i++) {
      s += '<span style="left:' + (r() * 100).toFixed(1) + "%;top:" + (r() * 100).toFixed(1) + "%;animation-delay:" + (r() * 3).toFixed(2) + "s;font-size:" + (10 + r() * 12).toFixed(0) + 'px">' + (r() < 0.5 ? "✳" : "·") + "</span>";
    }
    $("#stars").innerHTML = s;
  }

  function buildSpeedo() {
    var ticks = "", arc;
    for (var a = -120; a <= 120; a += 20) {
      var rad = (a * Math.PI) / 180, r1 = a % 40 === 0 ? 40 : 45;
      ticks += '<line x1="' + (64 + Math.sin(rad) * r1).toFixed(1) + '" y1="' + (64 - Math.cos(rad) * r1).toFixed(1) +
        '" x2="' + (64 + Math.sin(rad) * 52).toFixed(1) + '" y2="' + (64 - Math.cos(rad) * 52).toFixed(1) + '"/>';
    }
    var p = function (deg, r) { var d = (deg * Math.PI) / 180; return (64 + Math.sin(d) * r).toFixed(1) + " " + (64 - Math.cos(d) * r).toFixed(1); };
    arc = "M" + p(-120, 56) + " A56 56 0 1 1 " + p(120, 56);
    $(".speedo svg").setAttribute("viewBox", "0 0 128 120");
    $(".speedo svg").innerHTML =
      '<path d="' + arc + ' Z" fill="#fbfaf6" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round" filter="url(#rough)"/>' +
      '<path d="M' + p(60, 50) + " A50 50 0 0 1 " + p(120, 50) + '" fill="none" stroke="' + ACCENT + '" stroke-width="5" opacity=".7"/>' +
      '<g stroke="' + INK + '" stroke-width="2" stroke-linecap="round">' + ticks + "</g>" +
      '<g class="needle" id="needle"><line x1="64" y1="64" x2="64" y2="20" stroke="' + ACCENT + '" stroke-width="3.5" stroke-linecap="round"/></g>' +
      '<circle cx="64" cy="64" r="6" fill="' + INK + '"/>' +
      '<text x="64" y="112" text-anchor="middle" ' + HAND + ' font-size="16" fill="' + INK + '"><tspan id="speed">0</tspan> km/h · gear <tspan id="gear">N</tspan></text>';
  }

  // ------------------------------------------------------------------
  // Sound (WebAudio, synthesised — no files)
  // ------------------------------------------------------------------
  var audio = { on: false, ctx: null };
  function initAudio() {
    if (audio.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC(), master = ctx.createGain();
    master.gain.value = 0; master.connect(ctx.destination);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320; lp.Q.value = 3; lp.connect(master);
    var chug = ctx.createGain(); chug.gain.value = 0.5; chug.connect(lp);
    var o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 38; o1.connect(chug);
    var o2 = ctx.createOscillator(); o2.type = "square"; o2.frequency.value = 19; var g2 = ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(chug);
    var lfo = ctx.createOscillator(); lfo.type = "square"; lfo.frequency.value = 9; var lfoG = ctx.createGain(); lfoG.gain.value = 0.45; lfo.connect(lfoG); lfoG.connect(chug.gain);
    o1.start(); o2.start(); lfo.start();
    audio.ctx = ctx; audio.master = master; audio.lp = lp; audio.o1 = o1; audio.o2 = o2; audio.lfo = lfo;
  }
  function setSound(on) {
    audio.on = on;
    if (on) { initAudio(); if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume(); }
    if (audio.master) audio.master.gain.setTargetAtTime(on ? 0.05 : 0, audio.ctx.currentTime, 0.1);
    $("#sound-btn .wave").setAttribute("opacity", on ? "1" : ".25");
    $("#sound-btn .mute").style.display = on ? "none" : "";
    [].forEach.call(document.querySelectorAll(".sound-state"), function (el) { el.textContent = on ? "ON" : "OFF"; });
    if (on) { unlock("kick"); }
  }
  function engineSound(kmh, gearFrac) {
    if (!audio.on || !audio.ctx) return;
    var t = audio.ctx.currentTime, f = 34 + kmh * 0.9 + gearFrac * 26;
    audio.o1.frequency.setTargetAtTime(f, t, 0.08);
    audio.o2.frequency.setTargetAtTime(f / 2, t, 0.08);
    audio.lfo.frequency.setTargetAtTime(7 + f / 9, t, 0.08);
    audio.lp.frequency.setTargetAtTime(280 + kmh * 9, t, 0.1);
    audio.master.gain.setTargetAtTime(0.045 + Math.min(kmh, 80) / 1400, t, 0.15);
  }
  function blip(freqs, dur, type, vol) {
    if (!audio.on || !audio.ctx) return;
    var ctx = audio.ctx, t = ctx.currentTime, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(ctx.destination);
    freqs.forEach(function (f, i) {
      var o = ctx.createOscillator(); o.type = type; o.frequency.value = f[0];
      if (f[1]) o.frequency.setValueAtTime(f[1], t + dur * 0.4);
      o.connect(g); o.start(t + (f[2] || 0)); o.stop(t + dur + 0.05);
    });
  }

  // ------------------------------------------------------------------
  // Achievements + toasts
  // ------------------------------------------------------------------
  var got = {};
  try { got = JSON.parse(localStorage.getItem("ride-achievements") || "{}") || {}; } catch (e) { got = {}; }
  var toastQ = [], toastBusy = false, toastEl = $("#toast");
  function showToast(title, html, checked, ms) {
    toastQ.push([title, html, checked, ms]);
    if (!toastBusy) nextToast();
  }
  function nextToast() {
    var t = toastQ.shift();
    if (!t) { toastBusy = false; return; }
    toastBusy = true;
    $("#toast-title").textContent = t[0];
    $("#toast-text").innerHTML = t[1];
    $("#toast-box").textContent = t[2] ? "✓" : "";
    toastEl.classList.add("show");
    clearTimeout(nextToast.t);
    nextToast.t = setTimeout(function () {
      toastEl.classList.remove("show");
      setTimeout(nextToast, 450);
    }, toastQ.length ? 1300 : (t[3] || 2600));
  }
  function renderTrophies() {
    var n = 0;
    $("#trophy-list").innerHTML = ACHIEVEMENTS.map(function (a) {
      var ok = !!got[a[0]]; if (ok) n++;
      return '<li class="' + (ok ? "" : "locked") + '"><span class="box">' + (ok ? "✓" : "") + "</span><div><b>" + (ok ? a[1] : "???") + "</b><small>" + a[2] + "</small></div></li>";
    }).join("");
    $("#trophy-count").textContent = n + "/" + ACHIEVEMENTS.length;
  }
  function unlock(id) {
    if (got[id]) return;
    var a = ACHIEVEMENTS.filter(function (x) { return x[0] === id; })[0];
    if (!a) return;
    got[id] = 1;
    try { localStorage.setItem("ride-achievements", JSON.stringify(got)); } catch (e) { /* storage unavailable */ }
    renderTrophies();
    showToast(a[1], a[2], true);
    blip([[880], [1320, 0, 0.09]], 0.35, "sine", 0.12);
  }

  // ------------------------------------------------------------------
  // Rider
  // ------------------------------------------------------------------
  var spokes = "";
  for (var i = 0; i < 6; i++) {
    var a = (i / 6) * Math.PI * 2;
    spokes += '<line x1="0" y1="0" x2="' + (Math.cos(a) * 22).toFixed(1) + '" y2="' + (Math.sin(a) * 22).toFixed(1) + '" stroke="' + INK + '" stroke-width="2.4"/>';
  }
  [].forEach.call(document.querySelectorAll(".rider .spokes"), function (g) { g.innerHTML = spokes; });
  var wheelR = $("#wheel-r"), wheelF = $("#wheel-f"), bikeG = $("#bike"), riderEl = $("#rider");

  function honk() {
    unlock("honk");
    blip([[392], [494]], 0.45, "square", 0.08);
    var b = document.createElement("div");
    b.textContent = "beep beep!";
    b.style.cssText = "position:absolute;right:-30px;top:-38px;font:22px var(--sketch);background:#fbfaf6;border:2px solid #1f1f24;border-radius:14px 14px 14px 2px;padding:2px 10px;transform:rotate(-6deg)";
    riderEl.appendChild(b);
    setTimeout(function () { b.remove(); }, 1100);
  }
  riderEl.addEventListener("click", honk);
  riderEl.addEventListener("keydown", function (e) { if (e.key === "Enter") honk(); });

  // Exhaust puffs
  var puffLayer = $("#puffs"), puffPool = [], puffT = 0;
  for (var pi = 0; pi < 22; pi++) {
    var d = document.createElement("div"); d.className = "puff"; d.style.opacity = 0; puffLayer.appendChild(d);
    puffPool.push({ el: d, life: 0 });
  }
  function spawnPuff() {
    var p = puffPool.filter(function (q) { return q.life <= 0; })[0];
    if (!p) return;
    var r = riderEl.getBoundingClientRect(), k = r.width / 240;
    p.x = r.left + 18 * k - 9; p.y = r.top + 120 * k - 9; p.life = 1; p.vx = -20 - Math.random() * 30; p.vy = -14 - Math.random() * 14;
  }
  function updatePuffs(dt, camDx) {
    puffPool.forEach(function (p) {
      if (p.life <= 0) return;
      p.life -= dt / 1.1;
      p.x += p.vx * dt - camDx; p.y += p.vy * dt;
      var s = 0.6 + (1 - p.life) * 1.8;
      p.el.style.transform = "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px) scale(" + s.toFixed(2) + ")";
      p.el.style.opacity = Math.max(0, p.life * 0.8).toFixed(2);
    });
  }

  // ------------------------------------------------------------------
  // HUD: route + panels + controls
  // ------------------------------------------------------------------
  var route = $(".route"), fill = $(".route-fill"), routeBike = $(".route-bike"), dots = [];
  CHECKPOINTS.forEach(function (c) {
    var b = document.createElement("button");
    b.type = "button";
    b.style.left = (c.x / END) * 100 + "%";
    b.setAttribute("aria-label", "Ride to " + c.label);
    b.innerHTML = "<span>" + c.label + "</span>";
    b.addEventListener("click", function () { jumpTo(c.x === 0 ? 0 : c.x + 60); });
    route.appendChild(b);
    dots.push(b);
  });

  var cards = {};
  [].forEach.call(document.querySelectorAll(".card"), function (el) { cards[el.getAttribute("data-cp")] = el; });

  var space = $("#scroll-space");
  function maxScroll() { return Math.max(1, document.documentElement.scrollHeight - window.innerHeight); }
  function layout() { space.style.height = Math.round(END * SCROLL_PER_PX + window.innerHeight) + "px"; }
  function jumpTo(worldX) { window.scrollTo({ top: (worldX / END) * maxScroll(), behavior: reduceMotion ? "auto" : "smooth" }); }
  [].forEach.call(document.querySelectorAll("[data-jump]"), function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); jumpTo(parseFloat(el.getAttribute("data-jump"))); });
  });

  $("#sound-btn").addEventListener("click", function () { setSound(!audio.on); });
  var panel = $("#trophy-panel");
  $("#trophy-btn").addEventListener("click", function (e) { e.stopPropagation(); panel.classList.toggle("open"); });
  document.addEventListener("click", function (e) { if (!panel.contains(e.target)) panel.classList.remove("open"); });
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".poster")) unlock("poster");
    if (e.target.classList && e.target.classList.contains("sound-toggle")) setSound(!audio.on);
  });

  // Throttle with W / ↑ / → / Space, brake with S / ↓ / ←. Shift = boost.
  var throttle = 0, boost = false, throttleVel = 0;
  var FWD = { w: 1, arrowup: 1, arrowright: 1, d: 1, " ": 1 }, BACK = { s: 1, arrowdown: 1, arrowleft: 1, a: 1 };
  window.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase(), tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || ((tag === "button" || tag === "a") && k === " ")) return;
    boost = e.shiftKey;
    if (FWD[k]) { throttle = 1; e.preventDefault(); }
    else if (BACK[k]) { throttle = -1; e.preventDefault(); }
  });
  window.addEventListener("keyup", function (e) {
    var k = e.key.toLowerCase();
    boost = e.shiftKey;
    if ((FWD[k] && throttle > 0) || (BACK[k] && throttle < 0)) throttle = 0;
  });
  window.addEventListener("blur", function () { throttle = 0; });

  // ------------------------------------------------------------------
  // Frame loop
  // ------------------------------------------------------------------
  var hero = $("#hero"), doodles = $("#doodles"), skyWash = $("#sky-wash"), sun = $("#sun"), moon = $("#moon");
  var beam = $("#beam"), speedlines = $("#speedlines"), root = document.documentElement;
  var posters = [].slice.call(document.querySelectorAll(".poster"));
  var cur = 0, last = performance.now(), dist = 0, lastNight = -1, lastActive = null;
  var speed = 0, prevSpeed = 0, wheelie = 0, clock = 0, lastRs = null;

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now; clock += dt;
    var vw = window.innerWidth, vh = window.innerHeight, mobile = vw < 760;

    // Keyboard throttle drives the page scroll.
    var targetVel = throttle * (boost ? 1700 : 950);
    throttleVel += (targetVel - throttleVel) * Math.min(1, dt * 3);
    if (Math.abs(throttleVel) > 5) window.scrollBy(0, throttleVel * dt * SCROLL_PER_PX);

    var target = Math.min(1, Math.max(0, window.scrollY / maxScroll())) * END;
    var prev = cur;
    cur = reduceMotion ? target : cur + (target - cur) * Math.min(1, dt * 4.5);
    if (Math.abs(target - cur) < 0.05) cur = target;
    var dx = cur - prev;
    dist += dx;

    var riderW = mobile ? 160 : 240, k = riderW / 240;
    var rs = mobile ? 10 : vw * 0.13;
    var camX = cur - rs;

    layers.forEach(function (l) { l.el.style.transform = "translate3d(" + (-(camX + OFFSET) * l.f).toFixed(1) + "px,0,0)"; });
    if (rs !== lastRs) {
      riderEl.style.transform = "translate3d(" + rs.toFixed(1) + "px,0,0)";
      // Headlight sits at (182, 66) in the 240x170 bike drawing.
      var headY = (mobile ? -42 : -62) + (170 - 66) * k;
      beam.style.bottom = "calc(var(--road-h) + " + (headY - 90).toFixed(1) + "px)";
      beam.style.transform = "translate3d(" + (rs + 186 * k).toFixed(1) + "px,0,0)";
      speedlines.style.left = (rs - 120 * k) + "px";
      lastRs = rs;
    }

    // Speed, wheelie, vibration.
    var v = Math.abs(dx) / Math.max(dt, 0.001);
    speed += (v - speed) * Math.min(1, dt * 4);
    var kmh = Math.min(120, speed / 22);
    var accel = (speed - prevSpeed) / Math.max(dt, 0.001); prevSpeed = speed;
    var wTarget = kmh > 6 && dx > 0 ? Math.max(0, Math.min(11, (accel - 900) / 220)) : 0;
    wheelie += (wTarget - wheelie) * Math.min(1, dt * (wTarget > wheelie ? 5 : 3));
    var vib = kmh > 1 ? Math.sin(clock * 70) * 0.6 : Math.sin(clock * 38) * 0.35;
    bikeG.setAttribute("transform", "translate(0 " + vib.toFixed(2) + ") rotate(" + (-wheelie).toFixed(2) + " 58 165)");
    var wheelDeg = ((dist / (33 * k)) * 180) / Math.PI;
    wheelR.setAttribute("transform", "rotate(" + wheelDeg.toFixed(1) + ")");
    wheelF.setAttribute("transform", "rotate(" + wheelDeg.toFixed(1) + ")");
    riderEl.classList.toggle("moving", kmh > 3);
    speedlines.style.opacity = Math.max(0, Math.min(1, (kmh - 35) / 30)).toFixed(2);

    var gear = kmh < 1 ? 0 : Math.min(5, 1 + Math.floor(kmh / 20));
    var gearFrac = gear ? (kmh % 20) / 20 : 0;
    $("#speed").textContent = Math.round(kmh);
    $("#gear").textContent = gear ? gear : "N";
    $("#needle").style.transform = "rotate(" + (-120 + kmh * 2).toFixed(1) + "deg)";
    engineSound(kmh, gearFrac);
    if (kmh >= 60) unlock("speed");

    // Exhaust
    puffT -= dt;
    if (puffT <= 0) { spawnPuff(); puffT = kmh > 3 ? Math.max(0.05, 0.14 - kmh / 900) : 0.55; }
    updatePuffs(dt, dx);

    // Sky / time of day.
    var p = cur / END, sk = sky(p);
    skyWash.style.background = "linear-gradient(" + sk.wash + ", transparent 75%)";
    if (Math.abs(sk.night - lastNight) > 0.004) { root.style.setProperty("--night", sk.night.toFixed(3)); lastNight = sk.night; }
    if (sk.night > 0.6) unlock("night");
    var sp = Math.min(1, p / 0.9);
    sun.style.transform = "translate(" + (vw * (0.12 + sp * 0.76) - 60).toFixed(0) + "px," + (vh * (0.5 - Math.sin(sp * Math.PI) * 0.4) + Math.max(0, p - 0.82) * vh * 3).toFixed(0) + "px)";
    var mp = Math.max(0, (p - 0.8) / 0.2);
    moon.style.transform = "translate(" + (vw * (0.86 - mp * 0.16)).toFixed(0) + "px," + (vh * (0.55 - mp * 0.4)).toFixed(0) + "px)";

    // Hero fades as you leave the garage.
    var h = Math.max(0, 1 - cur / 600);
    hero.style.opacity = doodles.style.opacity = h.toFixed(3);
    hero.style.transform = "translateY(" + (-(1 - h) * 50).toFixed(1) + "px)";
    hero.style.visibility = doodles.style.visibility = h <= 0 ? "hidden" : "visible";
    if (cur > 120) unlock("wanderer");

    // Washing-line posters swing with speed.
    var amp = 1.5 + Math.min(10, kmh / 6);
    posters.forEach(function (el, i) { el.style.setProperty("--swing", (Math.sin(clock * 2.4 + i * 1.7) * amp).toFixed(2)); });

    // Active checkpoint note.
    var active = null;
    for (var i = 1; i < CHECKPOINTS.length; i++) {
      var c = CHECKPOINTS[i], next = CHECKPOINTS[i + 1];
      var end = next ? Math.min(next.x - 420, c.x + 1100) : Infinity;
      if (cur >= c.x - 300 && cur <= end) active = c.id;
    }
    if (active !== lastActive) {
      if (lastActive && cards[lastActive]) cards[lastActive].classList.remove("active");
      if (active && cards[active]) cards[active].classList.add("active");
      if (active) unlock(active);
      lastActive = active;
    }

    fill.style.width = (p * 100).toFixed(2) + "%";
    routeBike.style.left = (p * 100).toFixed(2) + "%";
    dots.forEach(function (d, i) {
      d.classList.toggle("done", cur >= CHECKPOINTS[i].x - 300);
      d.classList.toggle("current", CHECKPOINTS[i].id === active);
    });

    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  buildSky(); buildClouds(); buildFar(); buildMid(); buildNear(); buildGround(); buildGlow(); buildSpeedo();
  renderTrophies();
  layout();
  var wasMobile = isMobile();
  window.addEventListener("resize", function () {
    layout();
    if (isMobile() !== wasMobile) { wasMobile = isMobile(); buildGlow(); }
  });
  setSound(false);
  showToast("RIDER", 'Scroll or hold <b>W / ↑</b> to ride. Engine sound is <button class="sound-toggle sound-state" type="button">OFF</button>', false, 6500);
  requestAnimationFrame(frame);
})();
