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
    { id: "ladakh",    x: 10000, label: "Ladakh",   stone: ["LADAKH", "SOLO"] },
    { id: "projects",  x: 11800, label: "Projects", stone: ["SIDE", "QUEST"] },
    { id: "finish",    x: 13600, label: "Chai",     stone: ["CHAI", "2026"] }
  ];
  var CP = {};
  CHECKPOINTS.forEach(function (c) { CP[c.id] = c; });
  var END = 13600;
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
    ["ladakh",    "HIGH ALTITUDE", "Rode up to Ladakh"],
    ["finish",    "CHAI TIME",    "Made it to the chai stop"],
    // Hidden easter eggs (4th field = hidden until found).
    ["cow",       "COW WHISPERER", "Honked at the cow", true],
    ["backwards", "BACK TO SCHOOL", "Rode backwards past the school", true],
    ["sudo",      "ROOT ACCESS",   "Typed sudo ride", true],
    ["moon",      "MOONLIGHTER",   "Clicked the moon", true],
    ["think",     "DEEP THOUGHTS", "Stopped long enough for the rider to think", true]
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

  var root = document.documentElement;
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
  // `live` content sits outside the rough filter so animating it doesn't re-filter the whole layer.
  function svg(w, h, inner, rough, live) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">' +
      (rough === false ? inner : '<g filter="url(#rough)">' + inner + "</g>") + (live || "") + "</svg>";
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

  // Rough region of the journey for a given world x — scenery changes with it.
  function region(wx) {
    return wx < 2300 ? "bengal" : wx < 4000 ? "gwalior" : wx < 5900 ? "pune" : wx < 7700 ? "jaipur" : wx < 9300 ? "highway" : wx < 11000 ? "ladakh" : "city";
  }
  // Layer coordinate -> the world x the rider is at when it passes mid-screen.
  function worldAt(u, f) { return (u - 520) / f - OFFSET + 190; }
  function uAt(worldX, f, screenX) { return Math.round((worldX + OFFSET - 190) * f + (screenX || 520)); }

  // Smooth hand-drawn ridge. profile(wx) gives the target height per region.
  function smoothRidge(width, height, step, f, profile, amp, seed) {
    var r = rng(seed), pts = [], y = profile(worldAt(0, f));
    for (var x = -step; x <= width + step * 2; x += step) {
      y += (profile(worldAt(x, f)) - y) * 0.35 + (r() - 0.5) * amp;
      y = Math.max(12, Math.min(height - 8, y));
      pts.push([x, Math.round(height - y)]);
    }
    var line = "M" + pts[0][0] + " " + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      line += " Q" + pts[i - 1][0] + " " + pts[i - 1][1] + " " + (pts[i - 1][0] + pts[i][0]) / 2 + " " + (pts[i - 1][1] + pts[i][1]) / 2;
    }
    var last = pts[pts.length - 1][0];
    return { line: line, area: "M" + pts[0][0] + " " + height + " L" + line.slice(1) + " L" + last + " " + height + " Z", pts: pts, step: step };
  }
  function ridgeY(rd, u) {
    var i = Math.max(0, Math.min(rd.pts.length - 2, Math.floor((u + rd.step) / rd.step)));
    var a = rd.pts[i], b = rd.pts[i + 1], t = (u - a[0]) / (b[0] - a[0]);
    return a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, t));
  }
  function ridgeArt(rd, fill, hatch) {
    return '<path d="' + rd.area + '" fill="' + fill + '"/>' +
      (hatch ? '<path d="' + rd.area + '" fill="url(#' + hatch + ')"/>' : "") +
      '<path d="' + rd.line + '" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="' + rd.line + '" transform="translate(0 16)" fill="none" stroke="' + INK + '" stroke-width="1.1" stroke-dasharray="14 10 4 10" opacity=".35"/>';
  }

  function buildClouds() {
    var w = layerWidth(0.08), r = rng(7), s = "";
    for (var i = 0; i < 22; i++) {
      var x = r() * w, y = 50 + r() * 200, k = 0.5 + r() * 0.7;
      s += '<g transform="translate(' + x.toFixed(0) + " " + y.toFixed(0) + ") scale(" + k.toFixed(2) + ')">' +
        puffs([[-40, 8, 24], [-12, -6, 30], [22, -2, 26], [48, 10, 18], [6, 14, 22]]) +
        '<path d="M-44 22 q10 6 22 2 M4 26 q14 4 30 -2" stroke="' + INK + '" stroke-width="1.6" fill="none" opacity=".4"/>' +
        '<path d="M-60 32 H66" stroke="' + INK + '" stroke-width="2" opacity=".3"/></g>';
    }
    var balloons = "";
    [[uAt(800, 0.08, 1100), 200, "#ff6b35"], [uAt(4400, 0.08, 1150), 160, "#3a86ff"], [uAt(7600, 0.08, 1100), 230, "#e63946"]].forEach(function (b, i) {
      balloons += '<g class="balloon" style="animation-delay:-' + i * 2 + 's"><g transform="translate(' + b[0] + " " + b[1] + ')">' +
        '<path d="M0 0 C-34 0 -40 -50 0 -62 C40 -50 34 0 0 0 Z" fill="' + b[2] + '" stroke="' + INK + '" stroke-width="2.2"/>' +
        '<path d="M0 0 C-14 -10 -16 -48 0 -62 C16 -48 14 -10 0 0" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="1.6"/>' +
        '<path d="M-10 2 L-7 18 M10 2 L7 18" stroke="' + INK + '" stroke-width="1.4"/>' +
        '<rect x="-9" y="18" width="18" height="13" rx="2" fill="#c8a46a" stroke="' + INK + '" stroke-width="1.8"/></g></g>';
    });
    $("#clouds").innerHTML = svg(w, 300, s, true, balloons);
  }

  var HEIGHTS_FAR = { bengal: 100, gwalior: 180, pune: 300, jaipur: 140, highway: 170, ladakh: 350, city: 160 };
  var HEIGHTS_MID = { bengal: 40, gwalior: 100, pune: 180, jaipur: 70, highway: 80, ladakh: 120, city: 60 };

  function buildFar() {
    var f = 0.15, w = layerWidth(f);
    var rd = smoothRidge(w, 380, 60, f, function (wx) { return HEIGHTS_FAR[region(wx)]; }, 40, 11);
    var snow = "";
    for (var i = 1; i < rd.pts.length - 1; i++) {
      var pt = rd.pts[i];
      if (region(worldAt(pt[0], f)) !== "ladakh" || pt[1] > 120) continue;
      if (pt[1] > rd.pts[i - 1][1] || pt[1] > rd.pts[i + 1][1]) continue; // peaks only
      var x = pt[0], y = pt[1] + 3;
      snow += '<path d="M' + (x - 34) + " " + (y + 30) + " Q" + (x - 14) + " " + (y + 4) + " " + x + " " + y + " Q" + (x + 14) + " " + (y + 4) + " " + (x + 34) + " " + (y + 30) +
        " l-9 -7 l-8 8 l-9 -9 l-8 9 l-9 -9 l-8 8 l-9 -7 z" + '" fill="#fff" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/>';
    }
    $("#far").innerHTML = svg(w, 380, ridgeArt(rd, PAPER, "hatch-light") + snow);
  }

  // --- mid-layer set pieces -------------------------------------------------
  function fort(x, y, scale) {
    var d = "M-20 92 h170 v-30 h-10 v-10 h-8 v10 h-12 v-26 h-14 v26 h-30 v-34 a14 14 0 0 0 -28 0 v34 h-20 v-20 h-12 v20 h-16 v-14 h-10 z";
    return '<g transform="translate(' + x + " " + y + ") scale(" + scale + ')">' +
      '<path d="' + d + '" fill="' + PAPER + '" ' + S + '/><path d="' + d + '" fill="url(#bricks)"/>' +
      grid(0, 72, 6, 1, 24, 0, 6, 10, 'fill="' + INK + '"') +
      '<path d="M40 0 V-26 l16 6 l-16 6" fill="' + ACCENT + '" ' + S + ' stroke-width="1.6"/></g>';
  }
  function waterTanks(x, seed, base) {
    var r = rng(seed), s = "";
    for (var i = 0; i < 9; i++) {
      var bx = x + i * 70 + r() * 20, h = 50 + r() * 70, w = 50 + r() * 26;
      s += '<rect x="' + bx + '" y="' + (base - h) + '" width="' + w + '" height="' + h + '" fill="' + ["#fbfaf6", "#f6dccb", "#dfe9f5", "#f3e6c4"][i % 4] + '" ' + S + ' stroke-width="2"/>' +
        grid(bx + 8, base + 10 - h, 2, Math.floor(h / 26), 22, 24, 10, 10, 'fill="url(#hatch)"');
      if (r() < 0.6) s += '<path d="M' + (bx + w / 2 - 12) + " " + (base - h) + ' v-20 q12 -10 24 0 v20 z" fill="' + INK + '"/>';
      if (r() < 0.4) s += '<path d="M' + (bx + w - 10) + " " + (base - h) + ' v-30 m-8 6 h16 m-12 8 h8" ' + S + ' stroke-width="1.6" fill="none"/>';
      if (r() < 0.3) s += '<path d="M' + (bx + 4) + " " + (base - h + 14) + " q" + w / 2 + " 10 " + (w - 8) + ' 0" stroke="' + INK + '" stroke-width="1.2" fill="none"/>' +
        '<rect x="' + (bx + 10) + '" y="' + (base - h + 17) + '" width="8" height="10" fill="' + ACCENT + '"/><rect x="' + (bx + 24) + '" y="' + (base - h + 19) + '" width="8" height="9" fill="#3a86ff"/>';
    }
    return s;
  }
  function mesa(x, b, w, h) {
    var d = "M" + x + " " + b + " L" + (x + w * 0.18) + " " + (b - h) + " H" + (x + w * 0.82) + " L" + (x + w) + " " + b + " Z";
    return '<path d="' + d + '" fill="#f2e2cc" ' + S + '/><path d="' + d + '" fill="url(#hatch-light)"/>' +
      '<path d="M' + (x + w * 0.22) + " " + (b - h * 0.6) + " H" + (x + w * 0.78) + " M" + (x + w * 0.12) + " " + (b - h * 0.3) + " H" + (x + w * 0.88) + '" stroke="' + INK + '" stroke-width="1.2" opacity=".5"/>';
  }
  function waterfall(x, top, b) {
    var lines = "";
    for (var i = 0; i < 4; i++) lines += '<path d="M' + (x + 4 + i * 6) + " " + top + " q4 " + (b - top) / 3 + " -2 " + (b - top) / 1.6 + " t2 " + (b - top) / 2.6 + '" stroke="#5aa9e6" stroke-width="1.6" fill="none"/>';
    return '<path d="M' + x + " " + top + " h28 l6 " + (b - top) + " h-40 z" + '" fill="#e6f2fb"/>' + lines +
      puffs([[x + 2, b - 4, 9], [x + 16, b - 8, 11], [x + 30, b - 3, 9]], "#f4f9fd");
  }
  function windmill(x, b, k, dur) {
    var hx = x, hy = b - 130 * k, blades = "";
    for (var i = 0; i < 3; i++) blades += '<path d="M' + hx + " " + hy + " l" + (-4 * k) + " " + (-48 * k) + " q" + 4 * k + " " + -6 * k + " " + 8 * k + ' 0 z" fill="' + PAPER + '" ' + S + ' stroke-width="1.6" transform="rotate(' + i * 120 + " " + hx + " " + hy + ')"/>';
    return {
      art: '<path d="M' + (x - 5 * k) + " " + b + " L" + (x - 2 * k) + " " + hy + " H" + (x + 2 * k) + " L" + (x + 5 * k) + " " + b + ' Z" fill="' + PAPER + '" ' + S + ' stroke-width="1.8"/>',
      live: '<g class="blades" style="transform-origin:' + hx + "px " + hy + "px;animation-duration:" + dur + 's">' + blades +
        '<circle cx="' + hx + '" cy="' + hy + '" r="' + 4 * k + '" fill="' + INK + '"/></g>'
    };
  }
  function truck(x, b) {
    var tri = "";
    for (var i = 0; i < 9; i++) tri += '<path d="M' + (x + 4 + i * 11) + " " + (b - 70) + " l5.5 8 l5.5 -8" + '" fill="' + ["#e63946", "#ffd166", "#3a86ff"][i % 3] + '" stroke="' + INK + '" stroke-width="1"/>';
    return '<rect x="' + x + '" y="' + (b - 72) + '" width="104" height="54" rx="4" fill="#ffe08a" ' + S + "/>" + tri +
      '<text x="' + (x + 52) + '" y="' + (b - 38) + '" text-anchor="middle" ' + SKETCH + ' font-size="12" fill="#e63946">HORN OK</text>' +
      '<text x="' + (x + 52) + '" y="' + (b - 25) + '" text-anchor="middle" ' + SKETCH + ' font-size="12" fill="#2a9d8f">PLEASE</text>' +
      '<path d="M' + (x + 104) + " " + (b - 18) + " V" + (b - 58) + " h22 l12 18 v22 z" + '" fill="#2a9d8f" ' + S + "/>" +
      '<path d="M' + (x + 110) + " " + (b - 52) + ' h14 l8 12 h-22 z" fill="' + PAPER + '" ' + S + ' stroke-width="1.5"/>' +
      '<circle cx="' + (x + 24) + '" cy="' + (b - 12) + '" r="11" fill="' + INK + '"/><circle cx="' + (x + 118) + '" cy="' + (b - 12) + '" r="11" fill="' + INK + '"/>' +
      '<circle cx="' + (x + 24) + '" cy="' + (b - 12) + '" r="4" fill="' + PAPER + '"/><circle cx="' + (x + 118) + '" cy="' + (b - 12) + '" r="4" fill="' + PAPER + '"/>';
  }
  function boat(x, y) {
    return '<g class="bob" transform="translate(' + x + " " + y + ')">' +
      '<path d="M0 0 h70 q-6 14 -18 16 h-34 q-12 -2 -18 -16 z" fill="#c8a46a" ' + S + ' stroke-width="2"/>' +
      '<path d="M30 0 v-24 M30 -18 l-8 10 M30 -18 l10 6 l14 -22" ' + S + ' stroke-width="2" fill="none"/><circle cx="30" cy="-29" r="5" fill="' + PAPER + '" ' + S + ' stroke-width="1.8"/>' +
      '<path d="M22 -33 h16 l-8 -6 z" fill="#ffd166" ' + S + ' stroke-width="1.4"/>' +
      '<path d="M54 -22 l26 40" stroke="' + INK + '" stroke-width="1.4"/></g>';
  }
  function kite(x, top, b, color, delay) {
    return '<g class="kite" style="transform-origin:' + (x - 40) + "px " + b + "px;animation-delay:" + delay + 's">' +
      '<path d="M' + (x - 40) + " " + b + " Q" + (x - 50) + " " + (top + (b - top) * 0.5) + " " + x + " " + (top + 16) + '" stroke="' + INK + '" stroke-width="1" fill="none" opacity=".6"/>' +
      '<path d="M' + x + " " + top + " l14 16 l-14 18 l-14 -18 z" + '" fill="' + color + '" ' + S + ' stroke-width="1.6"/>' +
      '<path d="M' + x + " " + top + " v34 M" + (x - 14) + " " + (top + 16) + " h28" + '" stroke="' + INK + '" stroke-width="1"/>' +
      '<path d="M' + x + " " + (top + 34) + " q6 8 0 14 q-6 6 2 12" + '" stroke="' + INK + '" stroke-width="1.4" fill="none"/></g>';
  }
  function snowPeak(x, b, w, h) {
    var d = "M" + x + " " + b + " L" + (x + w / 2) + " " + (b - h) + " L" + (x + w) + " " + b + " Z";
    var cx = x + w / 2, sy = b - h, cw = w * 0.17, ch = h * 0.28;
    return '<path d="' + d + '" fill="#eef0f4" ' + S + '/><path d="M' + cx + " " + sy + " L" + (x + w) + " " + b + " H" + cx + ' Z" fill="url(#hatch-light)"/>' +
      '<path d="M' + (cx - cw) + " " + (sy + ch) + " L" + cx + " " + sy + " L" + (cx + cw) + " " + (sy + ch) + " l-" + cw / 3 + " -7 l-" + cw / 3 + " 9 l-" + cw / 3 + " -6 l-" + cw / 3 + " 8 l-" + cw / 3 + " -9 z" + '" fill="#fff" ' + S + ' stroke-width="1.8"/>';
  }
  function stupa(x, b) {
    return '<path d="M' + (x - 22) + " " + b + " h44 v-10 h-44 z M" + (x - 16) + " " + (b - 10) + " q16 -30 32 0 z M" + (x - 5) + " " + (b - 25) + " h10 v-6 h-10 z M" + x + " " + (b - 31) + ' v-16" fill="#fff" ' + S + ' stroke-width="1.8"/>' +
      '<circle cx="' + x + '" cy="' + (b - 49) + '" r="2.5" fill="#e6c35c"/>';
  }
  function prayerFlags(x0, y0, x1, y1) {
    var cols = ["#3a86ff", "#fbfaf6", "#e63946", "#2a9d8f", "#ffd166"], s = "", n = 11, mx = (x0 + x1) / 2, my = Math.max(y0, y1) + 26;
    s += '<path d="M' + x0 + " " + y0 + " Q" + mx + " " + my + " " + x1 + " " + y1 + '" stroke="' + INK + '" stroke-width="1.2" fill="none"/>';
    for (var i = 1; i < n; i++) {
      var t = i / n, px = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * mx + t * t * x1, py = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * my + t * t * y1;
      s += '<rect class="flag" x="' + (px - 7).toFixed(1) + '" y="' + py.toFixed(1) + '" width="14" height="17" fill="' + cols[i % 5] + '" stroke="' + INK + '" stroke-width="1.2" style="animation-delay:-' + (i * 0.23).toFixed(2) + 's"/>';
    }
    return s;
  }
  function dunes(x0, x1, b) {
    var s = "";
    for (var x = x0; x < x1; x += 140) s += '<path d="M' + x + " " + b + " q60 -34 120 -6 q20 6 40 6" + '" stroke="' + INK + '" stroke-width="1.4" fill="#f6e3c3"/>';
    return s;
  }

  function buildMid() {
    var f = 0.5, w = layerWidth(f), H = 260, art = "", live = "";
    var rd = smoothRidge(w, H, 50, f, function (wx) { return HEIGHTS_MID[region(wx)]; }, 18, 23);
    art += ridgeArt(rd, PAPER);
    // Bengal: river with a fishing boat, paddy rows.
    var b0 = uAt(-800, f, 0), b1 = uAt(2300, f, 900);
    art += '<path d="M' + b0 + " " + (H - 14) + " H" + b1 + " V" + H + " H" + b0 + ' Z" fill="#dcecf7"/>';
    for (var rx = b0; rx < b1; rx += 46) art += '<path d="M' + rx + " " + (H - 8) + ' q8 -4 16 0" stroke="#5aa9e6" stroke-width="1.4" fill="none"/>';
    live += boat(uAt(300, f, 1000), H - 16) + boat(uAt(1300, f, 1300), H - 14);
    for (var px = uAt(-600, f, 200); px < uAt(2000, f, 400); px += 9) art += '<path d="M' + px + " " + (ridgeY(rd, px) + 10) + ' l2 -7 l2 7" stroke="#7aa35b" stroke-width="1.2" fill="none"/>';
    // Gwalior: ravine mesas + the fort.
    art += mesa(uAt(2300, f, 1500), H, 190, 56) + mesa(uAt(2900, f, 1700), H, 150, 44);
    art += fort(uAt(CP.college.x, f, 820), ridgeY(rd, uAt(CP.college.x, f, 880)) - 84, 1);
    // Pune: Western Ghats waterfall, then rooftops.
    var wfx = uAt(4300, f, 1300), wtop = ridgeY(rd, wfx + 14);
    art += waterfall(wfx, wtop, H);
    art += waterTanks(uAt(CP.solytics.x, f, 900), 5, H);
    // Jaipur: dunes, Amber fort, kites.
    art += dunes(uAt(5900, f, 1450), uAt(7400, f, 1450), H);
    art += fort(uAt(CP.izoologic.x, f, 1100), ridgeY(rd, uAt(CP.izoologic.x, f, 1160)) - 70, 0.8);
    // Region-only pieces live in groups that fade in/out with the rider's position (see frame()).
    var rg = function (from, to, inner) { return '<g class="rg" data-from="' + from + '" data-to="' + to + '">' + inner + "</g>"; };
    var kitesJ = "", kitesC = "";
    [["#e63946", 5900, 1500, 20], ["#ffd166", 6200, 1600, 46], ["#3a86ff", 6600, 1500, 10], ["#2a9d8f", 7000, 1600, 34]].forEach(function (k, i) {
      kitesJ += kite(uAt(k[1], f, k[2]), k[3], H - 60, k[0], (i * 0.7).toFixed(1));
    });
    [["#ff6b35", 11400, 1500, 24], ["#e63946", 11800, 1600, 8]].forEach(function (k, i) {
      kitesC += kite(uAt(k[1], f, k[2]), k[3], H - 60, k[0], (i * 0.7).toFixed(1));
    });
    live += rg(5600, 7900, kitesJ) + rg(11000, 99999, kitesC);
    // Highway: wind farm + a painted truck.
    var farm = "";
    [[7700, 1500, 0.9, 5], [7900, 1700, 1.1, 6.5], [8500, 1550, 0.8, 4.2], [8900, 1700, 1, 5.6]].forEach(function (m) {
      var mx = uAt(m[0], f, m[1]), wm = windmill(mx, ridgeY(rd, mx) + 4, m[2], m[3]);
      farm += wm.art + wm.live;
    });
    live += rg(7500, 9500, farm + truck(uAt(8700, f, 1500), H));
    // Ladakh: snow peaks, a turquoise lake, stupas and prayer flags.
    [[9300, 1450, 260, 190], [9550, 1650, 220, 150], [9900, 1500, 300, 210], [10300, 1600, 240, 170]].forEach(function (m) {
      art += snowPeak(uAt(m[0], f, m[1]), H, m[2], m[3]);
    });
    var l0 = uAt(9500, f, 1300), l1 = uAt(10700, f, 1500);
    art += '<path d="M' + l0 + " " + (H - 4) + " Q" + (l0 + 40) + " " + (H - 26) + " " + (l0 + 140) + " " + (H - 24) + " H" + (l1 - 140) + " Q" + (l1 - 40) + " " + (H - 26) + " " + l1 + " " + (H - 4) + ' Z" fill="#7fd1d8" stroke="' + INK + '" stroke-width="1.8"/>';
    for (var lx2 = l0 + 60; lx2 < l1 - 60; lx2 += 70) art += '<path d="M' + lx2 + " " + (H - 14) + ' h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/>';
    art += stupa(uAt(9700, f, 1500), H - 22) + stupa(uAt(10400, f, 1550), H - 20);
    live += rg(9100, 11300, prayerFlags(uAt(9450, f, 1450), H - 120, uAt(9450, f, 1450) + 260, H - 60) + prayerFlags(uAt(10100, f, 1500), H - 110, uAt(10100, f, 1500) + 220, H - 70));

    // City rooftops behind the washing line.
    art += waterTanks(uAt(CP.projects.x, f, 1000), 9, H);
    $("#mid").innerHTML = svg(w, H, art, true, live);
  }

  // --- near-layer flora + power line ---------------------------------------
  function trunk(x, b, top, k) {
    return '<path d="M' + x + " " + b + " C" + (x - 2 * k) + " " + (b - 20 * k) + " " + (x + 3 * k) + " " + (top + 10 * k) + " " + x + " " + top +
      " M" + x + " " + (top + 16 * k) + " l" + -12 * k + " " + -12 * k + " M" + x + " " + (top + 24 * k) + " l" + 10 * k + " " + -10 * k + '" ' + S + ' stroke-width="' + (2.6 * k).toFixed(1) + '" fill="none"/>';
  }
  function mango(x, b, k) {
    var cy = b - 74 * k, s = trunk(x, b, cy + 18 * k, k) +
      puffs([[x - 28 * k, cy + 8 * k, 22 * k], [x, cy - 12 * k, 30 * k], [x + 28 * k, cy + 6 * k, 23 * k], [x + 2 * k, cy + 14 * k, 22 * k]], "#eef3e2");
    [[-24, 14], [-6, 2], [14, 18], [26, -2], [-14, -16], [8, -26]].forEach(function (o) {
      s += '<ellipse cx="' + (x + o[0] * k) + '" cy="' + (cy + o[1] * k) + '" rx="' + 3.6 * k + '" ry="' + 4.8 * k + '" fill="#ffb627" stroke="' + INK + '" stroke-width="1"/>';
    });
    return s;
  }
  function banana(x, b, k) {
    var top = b - 62 * k, s = '<path d="M' + x + " " + b + " Q" + (x + 4 * k) + " " + (b - 30 * k) + " " + x + " " + top + '" ' + S + ' stroke-width="' + 5 * k + '" fill="none"/>';
    [[-1, -8], [1, -12], [-1, 6], [1, 4]].forEach(function (l) {
      var dx = l[0] * 46 * k, dy = l[1] * k;
      s += '<path d="M' + x + " " + top + " q" + dx * 0.5 + " " + (dy - 22 * k) + " " + dx + " " + (dy + 8 * k) + " q" + -dx * 0.6 + " " + -6 * k + " " + -dx + " " + (-dy - 8 * k) + '" fill="#cfe3b4" ' + S + ' stroke-width="1.6"/>';
    });
    return s;
  }
  function palm(x, b, k) {
    var tx = x + 18 * k, ty = b - 110 * k, s = '<path d="M' + x + " " + b + " Q" + (x - 6 * k) + " " + (b - 60 * k) + " " + tx + " " + ty + '" ' + S + ' stroke-width="' + 5 * k + '" fill="none"/>';
    for (var i = 1; i < 6; i++) s += '<path d="M' + (x - 4 * k + i * 2 * k) + " " + (b - i * 18 * k) + " h" + 9 * k + '" stroke="' + INK + '" stroke-width="1.2"/>';
    [-150, -110, -60, -20, 20].forEach(function (a) {
      var r = (a * Math.PI) / 180, ex = tx + Math.cos(r) * 46 * k, ey = ty + Math.sin(r) * 30 * k + 18 * k;
      s += '<path d="M' + tx + " " + ty + " Q" + (tx + Math.cos(r) * 26 * k) + " " + (ty + Math.sin(r) * 30 * k - 14 * k) + " " + ex + " " + ey + '" stroke="' + INK + '" stroke-width="' + 2.4 * k + '" fill="none"/>' +
        '<path d="M' + tx + " " + ty + " Q" + (tx + Math.cos(r) * 26 * k) + " " + (ty + Math.sin(r) * 30 * k - 8 * k) + " " + ex + " " + ey + '" stroke="#7aa35b" stroke-width="' + 5 * k + '" fill="none" opacity=".55"/>';
    });
    return s + '<circle cx="' + (tx - 4 * k) + '" cy="' + (ty + 6 * k) + '" r="' + 4 * k + '" fill="#8a6a43"/><circle cx="' + (tx + 4 * k) + '" cy="' + (ty + 7 * k) + '" r="' + 4 * k + '" fill="#8a6a43"/>';
  }
  function acacia(x, b, k) {
    var top = b - 70 * k;
    return '<path d="M' + x + " " + b + " L" + (x + 4 * k) + " " + (top + 26 * k) + " L" + (x - 14 * k) + " " + top + " M" + (x + 4 * k) + " " + (top + 26 * k) + " L" + (x + 22 * k) + " " + (top + 4 * k) + '" ' + S + ' stroke-width="' + 3 * k + '" fill="none"/>' +
      '<path d="M' + (x - 54 * k) + " " + (top + 4 * k) + " q14 -22 " + 40 * k + " " + -16 * k + " q20 -16 " + 44 * k + " " + -4 * k + " q20 -2 " + 26 * k + " " + 20 * k + ' z" fill="#e3ead0" ' + S + ' stroke-width="2"/>' +
      '<path d="M' + (x - 44 * k) + " " + (top + 2 * k) + " h" + 80 * k + '" stroke="' + INK + '" stroke-width="1" opacity=".5" stroke-dasharray="4 4"/>';
  }
  function roundTree(x, b, k) {
    var cy = b - 70 * k, rr = 24 * k;
    return trunk(x, b, cy + 16 * k, k) + puffs([[x - rr * 0.7, cy + 4, rr * 0.8], [x, cy - rr * 0.5, rr], [x + rr * 0.8, cy + 2, rr * 0.75]], "#e9f0dc") +
      '<path d="M' + (x + rr * 0.2) + " " + (cy + rr * 0.6) + " q" + rr * 0.6 + " -2 " + rr * 0.9 + ' -10" stroke="' + INK + '" stroke-width="1.4" fill="none" opacity=".6"/>';
  }
  function pine(x, b, k) {
    var h = 90 * k;
    return '<path d="M' + x + " " + b + " l" + h * 0.3 + " " + -h + " l" + h * 0.3 + " " + h + 'z" fill="#e3ecd8" ' + S + ' stroke-width="2"/>' +
      '<path d="M' + (x + h * 0.3) + " " + (b - h) + " l" + h * 0.3 + " " + h + " h" + -h * 0.3 + 'z" fill="url(#hatch)"/>';
  }
  function bush(x, b, k, fill) { return puffs([[x - 12 * k, b - 8 * k, 11 * k], [x + 4 * k, b - 14 * k, 14 * k], [x + 18 * k, b - 7 * k, 10 * k]], fill || "#e9f0dc"); }
  function rock(x, b, k) {
    var d = "M" + x + " " + b + " l" + 6 * k + " " + -18 * k + " l" + 18 * k + " " + -8 * k + " l" + 16 * k + " " + 10 * k + " l" + 6 * k + " " + 16 * k + " z";
    return '<path d="' + d + '" fill="#efe9dc" ' + S + ' stroke-width="2"/><path d="' + d + '" fill="url(#hatch-light)"/>';
  }
  function camel(x, b) {
    return '<g transform="translate(' + x + " " + (b - 86) + ')">' +
      '<path d="M30 54 L28 86 M38 54 L41 86 M64 54 L62 86 M72 52 L76 86" ' + S + ' stroke-width="3" fill="none"/>' +
      '<path d="M22 42 Q32 18 46 32 Q60 14 74 36 Q82 46 72 54 L30 56 Q18 52 22 42 Z" fill="#e8c99a" ' + S + "/>" +
      '<path d="M40 30 q8 -4 16 4 l-4 14 h-14 z" fill="#e07a5f" stroke="' + INK + '" stroke-width="1.4"/>' +
      '<path d="M26 44 Q10 34 10 20 L2 18 Q0 10 8 10 L16 12 Q20 30 32 40" fill="#e8c99a" ' + S + "/>" +
      '<circle cx="7" cy="14" r="1.3" fill="' + INK + '"/><path d="M80 40 q6 6 3 14" ' + S + ' stroke-width="1.6" fill="none"/></g>';
  }
  function yak(x, b) {
    return '<g transform="translate(' + x + " " + (b - 70) + ')">' +
      '<path d="M18 46 L16 70 M28 48 L30 70 M62 48 L60 70 M72 46 L75 70" ' + S + ' stroke-width="3.2" fill="none"/>' +
      '<path d="M10 30 Q14 8 44 10 Q74 8 82 26 Q86 44 76 52 L70 48 L64 54 L56 48 L48 54 L40 48 L32 54 L24 48 L16 54 Q8 46 10 30 Z" fill="#5a4636" ' + S + "/>" +
      '<path d="M12 28 Q0 26 -2 38 Q4 46 12 42 Z" fill="#5a4636" ' + S + ' stroke-width="2"/>' +
      '<path d="M4 26 q-6 -10 2 -16 M12 24 q2 -12 12 -12" stroke="#efe9dc" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<circle cx="2" cy="33" r="1.4" fill="#fff"/><path d="M84 30 q8 4 6 16" ' + S + ' stroke-width="2" fill="none"/></g>';
  }
  function maniStones(x, b, k) {
    return '<ellipse cx="' + x + '" cy="' + (b - 6 * k) + '" rx="' + 18 * k + '" ry="' + 7 * k + '" fill="#efe9dc" ' + S + ' stroke-width="1.8"/>' +
      '<ellipse cx="' + (x + 2 * k) + '" cy="' + (b - 16 * k) + '" rx="' + 13 * k + '" ry="' + 6 * k + '" fill="#f6f3ea" ' + S + ' stroke-width="1.8"/>' +
      '<ellipse cx="' + x + '" cy="' + (b - 25 * k) + '" rx="' + 8 * k + '" ry="' + 4.5 * k + '" fill="#efe9dc" ' + S + ' stroke-width="1.8"/>' +
      '<text x="' + (x - 7 * k) + '" y="' + (b - 3 * k) + '" font-size="' + 7 * k + '" fill="#2a9d8f">ॐ</text>';
  }
  function haystack(x, b, k) {
    var d = "M" + x + " " + b + " q" + 4 * k + " " + -46 * k + " " + 26 * k + " " + -48 * k + " q" + 22 * k + " " + 2 * k + " " + 26 * k + " " + 48 * k + " z";
    return '<path d="' + d + '" fill="#f3dc9b" ' + S + ' stroke-width="2"/><path d="' + d + '" fill="url(#hatch-light)"/>' +
      '<path d="M' + (x + 26 * k) + " " + (b - 48 * k) + " v" + -12 * k + '" ' + S + ' stroke-width="2"/>';
  }
  function house(x, b, k, color) {
    var w = 70 * k, h = 66 * k;
    return '<rect x="' + x + '" y="' + (b - h) + '" width="' + w + '" height="' + h + '" fill="' + color + '" ' + S + ' stroke-width="2"/>' +
      '<rect x="' + (x + 8 * k) + '" y="' + (b - h + 12 * k) + '" width="' + 16 * k + '" height="' + 14 * k + '" fill="' + PAPER + '" ' + S + ' stroke-width="1.6"/>' +
      '<path d="M' + (x + 34 * k) + " " + (b - h + 30 * k) + " h" + 30 * k + " M" + (x + 36 * k) + " " + (b - h + 30 * k) + " v" + -12 * k + " M" + (x + 46 * k) + " " + (b - h + 30 * k) + " v" + -12 * k + " M" + (x + 56 * k) + " " + (b - h + 30 * k) + " v" + -12 * k + " M" + (x + 34 * k) + " " + (b - h + 18 * k) + " h" + 30 * k + '" stroke="' + INK + '" stroke-width="1.6"/>' +
      '<rect x="' + (x + 40 * k) + '" y="' + (b - 26 * k) + '" width="' + 16 * k + '" height="' + 26 * k + '" fill="#8a6a43" ' + S + ' stroke-width="1.6"/>' +
      '<path d="M' + (x - 4 * k) + " " + (b - h) + " h" + (w + 8 * k) + '" ' + S + ' stroke-width="3"/>';
  }

  function buildNear() {
    var f = 0.75, w = layerWidth(f), H = 200, b = H, r = rng(42), art = "", poles = "";
    // Power line along the road, with a few birds sitting on it.
    var tops = [];
    for (var x = 40; x < w; x += 300) {
      var py = b - 150;
      poles += '<path d="M' + x + " " + b + " V" + py + " M" + (x - 16) + " " + (py + 8) + " H" + (x + 16) + '" ' + S + ' stroke-width="3" fill="none"/>' +
        '<circle cx="' + (x - 12) + '" cy="' + (py + 5) + '" r="2.4" fill="' + INK + '"/><circle cx="' + (x + 12) + '" cy="' + (py + 5) + '" r="2.4" fill="' + INK + '"/>';
      tops.push(x);
    }
    [-12, 12].forEach(function (off, wi) {
      var d = "";
      for (var i = 0; i < tops.length - 1; i++) {
        var a = tops[i] + off, c = tops[i + 1] + off, y = b - 145;
        d += (i ? " " : "M" + a + " " + y) + " Q" + (a + c) / 2 + " " + (y + 34) + " " + c + " " + y;
        if (wi === 0 && r() < 0.18) {
          for (var bi = 0; bi < 2 + Math.floor(r() * 3); bi++) {
            var t = 0.3 + bi * 0.09, bx = a + (c - a) * t, by = y + 4 * 17 * t * (1 - t) - 4;
            poles += '<g transform="translate(' + bx.toFixed(0) + " " + by.toFixed(0) + ')"><ellipse rx="5" ry="3.6" fill="' + INK + '"/><circle cx="4" cy="-3.4" r="2.6" fill="' + INK + '"/><path d="M-5 0 l-4 2" stroke="' + INK + '" stroke-width="1.6"/></g>';
          }
        }
      }
      poles += '<path d="' + d + '" stroke="' + INK + '" stroke-width="1.2" fill="none" opacity=".75"/>';
    });
    // Region flora.
    var camelDone = false, yakDone = false;
    for (x = 20; x < w; x += 90 + r() * 170) {
      var reg = region(worldAt(x, f)), k = 0.95 + r() * 0.5, roll = r();
      if (reg === "bengal") art += roll < 0.4 ? mango(x, b, k) : roll < 0.65 ? banana(x, b, k) : roll < 0.85 ? palm(x, b, k) : bush(x, b, k);
      else if (reg === "gwalior") art += roll < 0.5 ? acacia(x, b, k) : roll < 0.75 ? rock(x, b, k) : bush(x, b, k, "#efe9dc");
      else if (reg === "pune") art += roll < 0.45 ? roundTree(x, b, k * 1.1) : roll < 0.75 ? pine(x, b, k) : bush(x, b, k);
      else if (reg === "jaipur") {
        if (!camelDone && worldAt(x, f) > 6100) { art += camel(x, b); camelDone = true; x += 60; }
        else art += roll < 0.4 ? acacia(x, b, k * 0.8) : roll < 0.7 ? rock(x, b, k * 0.8) : bush(x, b, k * 0.7, "#efe2c4");
      }
      else if (reg === "ladakh") {
        if (!yakDone && worldAt(x, f) > 9700) { art += yak(x, b); yakDone = true; x += 60; }
        else art += roll < 0.45 ? rock(x, b, k) : roll < 0.75 ? maniStones(x, b, k) : bush(x, b, k * 0.6, "#efe9dc");
      }
      else if (reg === "highway") art += roll < 0.4 ? haystack(x, b, k) : roll < 0.75 ? roundTree(x, b, k) : bush(x, b, k);
      else art += roll < 0.6 ? house(x, b, k, ["#f6dccb", "#dfe9f5", "#f3e6c4", "#e3f0d9", "#f2d0e0"][Math.floor(r() * 5)]) : roundTree(x, b, k);
    }
    $("#near").innerHTML = svg(w, H, poles + art);
  }

  // Grass, flowers and pebbles that pass in front of the rider.
  function buildFront() {
    var f = 1.25, w = layerWidth(f), r = rng(77), s = "";
    for (var x = 0; x < w; x += 40 + r() * 140) {
      var roll = r();
      if (roll < 0.55) {
        s += '<path d="M' + x + " 44 q2 -18 -6 -26 M" + (x + 5) + " 44 q0 -22 6 -30 M" + (x + 10) + " 44 q4 -14 12 -18" + '" ' + S + ' stroke-width="2" fill="none"/>';
      } else if (roll < 0.8) {
        var c = ["#ff6b35", "#ffd166", "#e63946", "#b892ff"][Math.floor(r() * 4)];
        s += '<path d="M' + x + " 44 q2 -14 0 -24" + '" ' + S + ' stroke-width="1.6" fill="none"/>' +
          '<circle cx="' + x + '" cy="18" r="5" fill="' + c + '" ' + S + ' stroke-width="1.4"/><circle cx="' + x + '" cy="18" r="1.6" fill="' + INK + '"/>';
      } else {
        s += '<ellipse cx="' + x + '" cy="40" rx="' + (8 + r() * 8).toFixed(0) + '" ry="5" fill="#efe9dc" ' + S + ' stroke-width="1.6"/>';
      }
    }
    $("#front").innerHTML = svg(w, 46, s, false);
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
    var art = "", live = "", i;
    // Blackboard on an easel — where the coding started.
    art += '<path d="M24 260 L40 150 M104 260 L88 150 M64 150 V260" ' + S + ' stroke-width="3" fill="none"/>' +
      '<rect x="10" y="146" width="112" height="72" rx="3" fill="#2f4f3a" stroke="#8a6a43" stroke-width="5"/>' +
      '<text x="18" y="166" ' + HAND + ' font-size="13" fill="#f1f1e6">print("hello,</text>' +
      '<text x="30" y="182" ' + HAND + ' font-size="13" fill="#f1f1e6">world")</text>' +
      '<text x="18" y="202" ' + HAND + ' font-size="12" fill="#ffd166">PCM + CS ✓</text>' +
      '<path d="M88 196 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M84 196 q12 -12 24 0 q-12 12 -24 0" stroke="#f1f1e6" stroke-width="1" fill="none"/>';
    // Two-storey school with an arched verandah (cream + brick red, KV style).
    art += '<rect x="140" y="92" width="320" height="168" fill="#f6e7c8" ' + S + "/>" +
      '<rect x="132" y="82" width="336" height="14" fill="#c1554d" ' + S + "/>" +
      '<rect x="140" y="170" width="320" height="9" fill="#c1554d" ' + S + ' stroke-width="1.6"/>';
    for (i = 0; i < 6; i++) {
      var wx = 156 + i * 50;
      art += '<rect x="' + wx + '" y="106" width="28" height="36" fill="#cfe6f5" ' + S + ' stroke-width="1.8"/>' +
        '<path d="M' + (wx + 14) + " 106 V142 M" + wx + ' 124 H' + (wx + 28) + '" stroke="' + INK + '" stroke-width="1.2"/>' +
        '<path d="M' + (wx - 4) + " 146 H" + (wx + 32) + '" ' + S + ' stroke-width="2"/>';
      art += '<path d="M' + (wx - 4) + " 260 V212 a18 18 0 0 1 36 0 V260 Z" + '" fill="#e9d3a8" ' + S + ' stroke-width="2"/>' +
        '<path d="M' + (wx - 4) + " 260 V212 a18 18 0 0 1 36 0 V260 Z" + '" fill="url(#hatch-light)"/>';
    }
    art += '<path d="M150 184 v10 M146 194 q4 10 8 0 z" ' + S + ' stroke-width="1.8" fill="#e6c35c"/>';
    // Name board on the parapet.
    art += '<rect x="196" y="38" width="208" height="44" rx="6" fill="' + PAPER + '" ' + S + "/>" +
      '<text x="300" y="58" text-anchor="middle" ' + SKETCH + ' font-size="15" fill="' + INK + '">KENDRIYA VIDYALAYA</text>' +
      '<text x="300" y="75" text-anchor="middle" ' + HAND + ' font-size="14" fill="' + ACCENT + '">MALDA</text>' +
      '<path d="M214 82 V94 M386 82 V94" ' + S + ' stroke-width="2"/>';
    // Flagpole with the tricolour.
    art += '<path d="M482 260 V20" ' + S + ' stroke-width="3"/><path d="M474 260 h16" ' + S + ' stroke-width="4"/>' +
      '<rect x="483" y="24" width="42" height="9" fill="#ff9933"/><rect x="483" y="33" width="42" height="9" fill="#fff"/><rect x="483" y="42" width="42" height="9" fill="#138808"/>' +
      '<rect x="483" y="24" width="42" height="27" fill="none" ' + S + ' stroke-width="1.6"/><circle cx="504" cy="37.5" r="3" fill="none" stroke="#000080" stroke-width="1.2"/>';
    // Yellow school bus.
    art += '<rect x="510" y="184" width="170" height="60" rx="10" fill="#ffc93c" ' + S + "/>" +
      grid(522, 194, 6, 1, 24, 0, 18, 18, 'fill="#cfe6f5" ' + S + ' stroke-width="1.6"') +
      '<path d="M510 222 H680" stroke="' + INK + '" stroke-width="2"/>' +
      '<text x="590" y="238" text-anchor="middle" ' + SKETCH + ' font-size="13" fill="' + INK + '">SCHOOL BUS</text>' +
      '<circle cx="540" cy="246" r="13" fill="' + INK + '"/><circle cx="650" cy="246" r="13" fill="' + INK + '"/>' +
      '<circle cx="540" cy="246" r="5" fill="#c9ccd1"/><circle cx="650" cy="246" r="5" fill="#c9ccd1"/>' +
      '<circle cx="676" cy="230" r="4" fill="#fff6d8" ' + S + ' stroke-width="1.4"/>';
    // Paper planes drifting out of an upper window.
    var plane = function (x, y, d) {
      return '<g class="plane" style="animation-delay:' + d + 's"><path d="M' + x + " " + y + " l22 -6 l-14 12 z M" + x + " " + y + " l8 2 l-2 8 z" + '" fill="#fff" ' + S + ' stroke-width="1.4"/></g>';
    };
    live += plane(370, 120, 0) + plane(220, 118, -2.6);
    return svg(690, 260, art, true, live);
  }

  function college() {
    var art = "", live = "", i;
    // Wings + clock tower.
    art += '<rect x="10" y="130" width="180" height="170" fill="#f3e6c4" ' + S + "/>" +
      '<rect x="300" y="130" width="180" height="170" fill="#f3e6c4" ' + S + "/>" +
      '<path d="M4 130 H196 M294 130 H486" stroke="' + INK + '" stroke-width="5"/>' +
      '<rect x="190" y="40" width="110" height="260" fill="' + PAPER + '" ' + S + '/><rect x="190" y="40" width="110" height="260" fill="url(#bricks)"/>' +
      '<path d="M180 42 L245 0 L310 42 Z" fill="#c1554d" ' + S + '/><path d="M180 42 L245 0 L310 42 Z" fill="url(#hatch)"/>' +
      '<circle cx="245" cy="84" r="25" fill="' + PAPER + '" ' + S + '/><path d="M245 84 V66 M245 84 H257" ' + S + ' stroke-width="3"/>' +
      '<path d="M220 300 V244 a25 25 0 0 1 50 0 V300" fill="#6b4226" ' + S + "/>" +
      '<rect x="206" y="118" width="78" height="24" rx="3" fill="' + INK + '"/><text x="245" y="136" text-anchor="middle" ' + SKETCH + ' font-size="17" fill="' + PAPER + '">RIT</text>';
    // Left wing: class-of banner + windows.
    art += '<path d="M24 176 H176 L170 192 L176 208 H24 L30 192 Z" fill="' + ACCENT + '" ' + S + ' stroke-width="2"/>' +
      '<text x="100" y="198" text-anchor="middle" ' + SKETCH + ' font-size="14" fill="#fff">ECE · CLASS OF 2024</text>' +
      grid(26, 142, 5, 1, 32, 0, 18, 24, 'fill="#cfe6f5" ' + S + ' stroke-width="1.6"') +
      grid(26, 222, 5, 2, 32, 38, 18, 26, 'fill="#cfe6f5" ' + S + ' stroke-width="1.6"');
    // Right wing: an ECE lab with circuit traces running across the wall.
    art += '<rect x="318" y="146" width="144" height="26" rx="3" fill="' + PAPER + '" ' + S + ' stroke-width="2"/>' +
      '<text x="390" y="164" text-anchor="middle" ' + HAND + ' font-size="15" fill="' + INK + '">ELECTRONICS LAB</text>' +
      '<path d="M300 200 H340 V230 H390 V210 H440 M300 260 H360 V240 H420 V270 H480 M340 300 V280 H380" stroke="#2a9d8f" stroke-width="2.4" fill="none"/>' +
      '<rect x="400" y="222" width="34" height="14" rx="2" fill="#e6c35c" ' + S + ' stroke-width="1.4"/><path d="M408 222 v14 M416 222 v14 M424 222 v14" stroke="#c1554d" stroke-width="2"/>' +
      '<rect x="436" y="250" width="30" height="30" fill="' + INK + '"/><path d="M436 256 h-5 M436 264 h-5 M436 272 h-5 M466 256 h5 M466 264 h5 M466 272 h5" stroke="' + INK + '" stroke-width="2"/>';
    [[340, 200, "#ff6b35", 0], [440, 210, "#2ec4b6", 0.4], [360, 260, "#ffd166", 0.8], [480, 270, "#e63946", 0.2], [380, 280, "#2ec4b6", 1]].forEach(function (l) {
      live += '<circle class="led" cx="' + l[0] + '" cy="' + l[1] + '" r="5" fill="' + l[2] + '" stroke="' + INK + '" stroke-width="1.6" style="animation-delay:' + l[3] + 's"/>';
    });
    // Satellite dish on the roof — the "Communication" in ECE.
    art += '<path d="M420 130 V112 M412 130 h16" ' + S + ' stroke-width="3"/>' +
      '<path d="M400 112 Q420 76 446 98 Z" fill="' + PAPER + '" ' + S + "/>" + '<path d="M423 103 l12 -14" ' + S + ' stroke-width="2"/>';
    for (i = 0; i < 3; i++) live += '<path class="wave" d="M' + (440 + i * 9) + " " + (82 - i * 9) + " q" + (8 + i * 4) + " " + (4 + i * 3) + " " + (6 + i * 3) + " " + (16 + i * 6) + '" stroke="' + INK + '" stroke-width="2" fill="none" style="animation-delay:' + i * 0.35 + 's"/>';
    // Canteen kiosk.
    art += '<rect x="500" y="214" width="110" height="86" fill="#ffe08a" ' + S + "/>";
    for (i = 0; i < 5; i++) art += '<path d="M' + (494 + i * 24.4) + " 200 h24.4 v18 a12.2 8 0 0 1 -24.4 0 z" + '" fill="' + (i % 2 ? PAPER : "#2a9d8f") + '" ' + S + ' stroke-width="1.8"/>';
    art += '<rect x="510" y="176" width="90" height="24" rx="3" fill="' + PAPER + '" ' + S + ' stroke-width="2"/>' +
      '<text x="555" y="193" text-anchor="middle" ' + SKETCH + ' font-size="14" fill="' + INK + '">CANTEEN</text>' +
      '<text x="555" y="250" text-anchor="middle" ' + HAND + ' font-size="14" fill="' + INK + '">chai · maggi</text>' +
      '<text x="555" y="268" text-anchor="middle" ' + HAND + ' font-size="14" fill="' + INK + '">samosa ₹10</text>' +
      '<path d="M540 300 V284 h30 v16" ' + S + ' stroke-width="2" fill="none"/>';
    // Graduation caps tossed in the air.
    var cap = function (x, y, d) {
      return '<g class="cap" style="animation-delay:' + d + 's"><g transform="translate(' + x + " " + y + ')">' +
        '<path d="M-16 0 L0 -7 L16 0 L0 7 Z" fill="' + INK + '"/><path d="M-9 3 V9 Q0 14 9 9 V3" fill="' + INK + '"/>' +
        '<path d="M0 0 L12 4 V12" stroke="#ffd166" stroke-width="1.6" fill="none"/></g></g>';
    };
    live += cap(130, 112, 0) + cap(345, 104, -0.9) + cap(165, 92, -1.8);
    return svg(620, 300, art, true, live);
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
    { t: "breakyouragent", d: "Crash-test your AI agent: hundreds of jailbreaks, prompt injections and tool-abuse attacks to show exactly where it breaks.", c: ["AI security", "LLMs"], u: "https://github.com/Tanmaysarkar2002/Breakyouragentlanginpage" },
    { t: "StatLense", d: "Sentinel, productised. Open-source monitoring for Docker, databases and APIs, with a lightweight Rust agent.", c: ["Rust", "Axum", "React"], u: "https://github.com/Tanmaysarkar2002/SentinalLandingPage" },
    { t: "docker-watchdog", d: "Real-time Docker monitor in Rust. Captures crash logs, auto-restarts containers, and has pluggable Slack/Kafka notifiers.", c: ["Rust", "Docker", "async"], u: "https://github.com/Tanmaysarkar2002/DockerWatchdog" },
    { t: "Data Harvester", d: "Universal web scraper with CAPTCHA solving, Google News and RSS aggregation. Runs on AWS EC2.", c: ["Django", "React", "AWS"], u: "https://github.com/Tanmaysarkar2002/Universal-Scrapper" }
  ];
  var LINE_W = 1340;
  function ropeY(x) { var t = (x - 10) / (LINE_W - 40); return (1 - t) * (1 - t) * 40 + 2 * t * (1 - t) * 300 + t * t * 40; }
  function washingLine() {
    var R = LINE_W - 10;
    var art = svg(LINE_W, 470,
      '<path d="M10 470 V30 M' + R + ' 470 V30" ' + S + ' stroke-width="6"/><path d="M-6 36 H26 M' + (R - 16) + " 36 H" + (R + 16) + '" ' + S + ' stroke-width="4"/>' +
      '<path d="M10 40 Q' + LINE_W / 2 + " 300 " + (R - 20) + ' 40" stroke="' + INK + '" stroke-width="2.2" fill="none"/>' +
      // a sock and a T-shirt drying between the posters
      '<path d="M' + 282 + " " + ropeY(290) + " v26 q0 8 10 8 h8 v-8 h-6 v-26 z" + '" fill="#ffd166" ' + S + ' stroke-width="1.8"/>' +
      '<path d="M' + 905 + " " + (ropeY(930) - 2) + " l-14 10 l6 8 l6 -4 v28 h34 v-28 l6 4 l6 -8 l-14 -10 q-8 6 -18 0 z" + '" fill="#a8c8ff" ' + S + ' stroke-width="1.8"/>');
    var html = POSTERS.map(function (p, i) {
      var x = 40 + i * 320 + (i === 3 ? 10 : 0);
      return '<a class="poster" data-i="' + i + '" href="' + p.u + '" target="_blank" rel="noopener" style="left:' + x + "px;top:" + Math.round(ropeY(x + 95) + 14) + 'px">' +
        "<h3>" + p.t + "</h3><p>" + p.d + '</p><div class="chips">' + p.c.map(function (c) { return "<span>" + c + "</span>"; }).join("") +
        '</div><span class="go">open code →</span></a>';
    }).join("");
    return art + html;
  }
  function cow() {
    return svg(140, 74,
      '<path d="M14 72 Q8 40 36 34 L88 32 Q106 32 106 54 L106 72 Z" fill="' + PAPER + '" ' + S + "/>" +
      '<ellipse cx="50" cy="46" rx="11" ry="7" fill="' + INK + '"/><ellipse cx="82" cy="56" rx="8" ry="6" fill="' + INK + '"/>' +
      '<path d="M30 72 q4 -9 16 -7 M74 72 q6 -9 18 -5" ' + S + ' fill="none"/>' +
      '<path d="M100 38 Q110 22 124 26 Q134 34 128 48 Q120 54 110 50 Z" fill="' + PAPER + '" ' + S + "/>" +
      '<ellipse cx="128" cy="44" rx="6" ry="5" fill="#f2b8a0" ' + S + ' stroke-width="1.6"/><circle cx="116" cy="34" r="1.8" fill="' + INK + '"/>' +
      '<path d="M108 26 q-4 -10 2 -14 M118 22 q2 -10 10 -10 M104 32 l-10 -2 l6 9" ' + S + ' stroke-width="2" fill="none"/>' +
      '<circle cx="106" cy="58" r="4" fill="#ffd166" ' + S + ' stroke-width="1.4"/>', true,
      '<path class="tail" d="M16 50 q-14 4 -12 20 l-3 4" stroke="' + INK + '" stroke-width="2.4" fill="none" stroke-linecap="round" style="transform-origin:16px 50px"/>');
  }
  function sleepyDog() {
    return svg(110, 70,
      '<ellipse cx="50" cy="52" rx="36" ry="15" fill="#e8c99a" ' + S + "/>" +
      '<path d="M16 52 q-12 -2 -8 -12" ' + S + ' fill="none"/>' +
      '<circle cx="82" cy="50" r="13" fill="#e8c99a" ' + S + "/>" +
      '<path d="M76 40 q-4 -10 6 -10 q2 6 0 10" fill="#b8865a" ' + S + ' stroke-width="1.8"/>' +
      '<path d="M84 50 q4 3 8 0" ' + S + ' stroke-width="1.6" fill="none"/><circle cx="94" cy="56" r="2.4" fill="' + INK + '"/>' +
      '<path d="M30 46 q8 -6 16 0 M52 44 q8 -6 16 0" stroke="' + INK + '" stroke-width="1.2" fill="none" opacity=".5"/>', true,
      '<g class="zzz" ' + HAND + ' font-size="16" fill="' + INK + '"><text x="92" y="28">z</text><text x="100" y="16" font-size="12">z</text><text x="106" y="6" font-size="9">z</text></g>');
  }
  var COW_X = 4150;

  function khardungLa() {
    var art = '<path d="M40 300 V28 M200 300 V28" ' + S + ' stroke-width="6"/>' +
      '<rect x="20" y="70" width="200" height="96" rx="6" fill="#ffd60a" ' + S + ' stroke-width="3"/>' +
      '<rect x="28" y="78" width="184" height="80" rx="4" fill="none" stroke="' + INK + '" stroke-width="1.6"/>' +
      '<text x="120" y="106" text-anchor="middle" ' + SKETCH + ' font-size="24" fill="' + INK + '">KHARDUNG LA</text>' +
      '<text x="120" y="128" text-anchor="middle" ' + HAND + ' font-size="15" fill="' + INK + '">LADAKH · TOP OF THE PASS</text>' +
      '<text x="120" y="150" text-anchor="middle" ' + SKETCH + ' font-size="18" fill="#c1121f">JULLEY!</text>' +
      // solo camp: tent + campfire logs
      '<path d="M300 300 L370 196 L440 300 Z" fill="#ff8c42" ' + S + '/><path d="M370 196 L392 300 H350 Z" fill="#c8551e" ' + S + ' stroke-width="2"/>' +
      '<path d="M370 196 V184 l14 5 l-14 5" fill="#e63946" stroke="' + INK + '" stroke-width="1.4"/>' +
      '<path d="M470 298 l40 -12 M472 286 l38 12" ' + S + ' stroke-width="6"/>' +
      '<ellipse cx="490" cy="300" rx="34" ry="6" fill="#efe9dc" ' + S + ' stroke-width="1.6"/>';
    var live = '<g class="fire"><path d="M490 288 q-14 -14 -4 -34 q2 14 10 10 q-4 -14 8 -26 q2 20 10 28 q8 12 -6 22 z" fill="#ffb627" stroke="' + INK + '" stroke-width="1.6"/>' +
      '<path d="M492 286 q-6 -8 0 -18 q4 8 8 6 q2 8 -4 12 z" fill="#e63946"/></g>';
    var flags = prayerFlags(40, 30, 200, 30) + prayerFlags(200, 32, 370, 186);
    return svg(540, 300, art, true, live + flags);
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

  // Roadside quote boards (wooden) and mountain-road warning signs (yellow).
  function quoteBoard(lines, by) {
    var h = 34 + lines.length * 22, w = 236, text = "";
    lines.forEach(function (l, i) { text += '<text x="' + w / 2 + '" y="' + (32 + i * 22) + '" text-anchor="middle" ' + HAND + ' font-size="18" fill="' + INK + '">' + l + "</text>"; });
    return svg(w, h + 92,
      '<path d="M44 ' + h + " V" + (h + 92) + " M" + (w - 44) + " " + h + " V" + (h + 92) + '" ' + S + ' stroke-width="6"/>' +
      '<rect x="4" y="4" width="' + (w - 8) + '" height="' + h + '" rx="6" fill="#d9b382" ' + S + "/>" +
      '<rect x="14" y="12" width="' + (w - 28) + '" height="' + (h - 16) + '" rx="3" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="1.6"/>' +
      '<circle cx="11" cy="11" r="2.4" fill="' + INK + '"/><circle cx="' + (w - 11) + '" cy="11" r="2.4" fill="' + INK + '"/>' + text +
      '<text x="' + (w - 22) + '" y="' + (h - 10) + '" text-anchor="end" ' + HAND + ' font-size="14" fill="' + ACCENT + '">— ' + by + "</text>");
  }
  function warningSign(lines, tag) {
    var h = 40 + lines.length * 26, w = 230, text = "";
    var longest = Math.max.apply(null, lines.map(function (l) { return l.length; }));
    var fs = Math.min(23, Math.floor(200 / (longest * 0.5)));
    lines.forEach(function (l, i) { text += '<text x="' + w / 2 + '" y="' + (35 + i * 26) + '" text-anchor="middle" ' + HAND + ' font-size="' + fs + '" fill="' + INK + '" letter-spacing=".5">' + l + "</text>"; });
    return svg(w, h + 100,
      '<path d="M' + w / 2 + " " + h + " V" + (h + 100) + '" ' + S + ' stroke-width="6"/>' +
      '<rect x="4" y="4" width="' + (w - 8) + '" height="' + h + '" rx="8" fill="#ffd60a" ' + S + ' stroke-width="3"/>' +
      '<rect x="12" y="12" width="' + (w - 24) + '" height="' + (h - 16) + '" rx="5" fill="none" stroke="' + INK + '" stroke-width="1.6"/>' + text +
      '<text x="' + w / 2 + '" y="' + (h - 12) + '" text-anchor="middle" ' + HAND + ' font-size="12" fill="' + INK + '">' + (tag || "BRO") + "</text>");
  }
  // Spaced so no two boards share the screen with a landmark crammed in between.
  var ROADSIDE = [
    [950,   warningSign(["LIFE IS SHORT", "DON'T MAKE IT SHORTER"])],
    [2650,  quoteBoard(["Arise, awake, and stop", "not till the goal", "is reached."], "Swami Vivekananda")],
    [4600,  warningSign(["IF YOU LOVE HER", "DIVORCE SPEED"])],
    [5650,  warningSign(["ROAD IS HILLY", "DON'T DRIVE SILLY"])],
    [6380,  quoteBoard(["Talk is cheap.", "Show me the code."], "Linus Torvalds")],
    [7760,  warningSign(["PEEP PEEP", "DON'T SLEEP"])],
    [8500,  warningSign(["THIS IS A HIGHWAY", "NOT A RUNWAY"])],
    [9560,  warningSign(["BE GENTLE ON", "MY CURVES"], "BRO · HIMANK")],
    [10930, warningSign(["WE CUT MOUNTAINS", "BUT CONNECT HEARTS"], "BRO · HIMANK")],
    [11420, quoteBoard(["Life is like riding a", "bicycle. To keep your", "balance, you must", "keep moving."], "Albert Einstein")]
  ];

  var LAMP_XS = [];
  for (var lx = 700; lx < END + 1400; lx += 1100) LAMP_XS.push(lx);

  var LANDMARKS = [
    [-200, garage()],
    [CP.school.x + 330, school()],
    [CP.college.x + 320, college()],
    [CP.solytics.x + 330, pune()],
    [CP.izoologic.x + 300, jaipur()],
    [CP.garage.x + 320, pitstop()],
    [CP.ladakh.x + 300, khardungLa(), "ladakh"],
    [CP.projects.x + 120, washingLine(), "line"],
    [COW_X, cow() + '<div class="bubble">moo!</div>', "cow"]
  ].concat(ROADSIDE).concat([
    [CP.garage.x + 820, sleepyDog(), "dog"],
    [END + 200, chaiStall(), "chai"]
  ]);
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
    line.style.width = LINE_W + "px"; line.style.height = "470px";
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
  // Smooth parallel-twin drone: detuned saws + sub, soft-clipped, gently pulsed by a sine.
  function initAudio() {
    if (audio.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC(), master = ctx.createGain();
    master.gain.value = 0; master.connect(ctx.destination);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = 0.8; lp.connect(master);
    var shaper = ctx.createWaveShaper(), curve = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(2.2 * x); }
    shaper.curve = curve; shaper.connect(lp);
    var body = ctx.createGain(); body.gain.value = 0.7; body.connect(shaper);
    var mk = function (type, f, g) {
      var o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = type; o.frequency.value = f; gn.gain.value = g; o.connect(gn); gn.connect(body); o.start(); return o;
    };
    var o1 = mk("sawtooth", 32, 0.5), o2 = mk("sawtooth", 32.4, 0.35), sub = mk("sine", 16, 0.8);
    var lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.type = "sine"; lfo.frequency.value = 16; lfoG.gain.value = 0.22; lfo.connect(lfoG); lfoG.connect(body.gain); lfo.start();
    audio.ctx = ctx; audio.master = master; audio.lp = lp; audio.o1 = o1; audio.o2 = o2; audio.sub = sub; audio.lfo = lfo;
    audio.last = 0; audio.rev = 0;
  }
  function setSound(on) {
    audio.on = on;
    if (on) { initAudio(); if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume(); }
    if (audio.master) audio.master.gain.setTargetAtTime(on ? 0.06 : 0, audio.ctx.currentTime, 0.15);
    $("#sound-btn .wave").setAttribute("opacity", on ? "1" : ".25");
    $("#sound-btn .mute").style.display = on ? "none" : "";
    [].forEach.call(document.querySelectorAll(".sound-state"), function (el) { el.textContent = on ? "ON" : "OFF"; });
    if (on) { unlock("kick"); }
  }
  function engineSound(kmh, gearFrac) {
    if (!audio.on || !audio.ctx) return;
    var t = audio.ctx.currentTime;
    if (t - audio.last < 0.05) return; // ~20 updates/s keeps the pitch from jittering
    audio.last = t;
    audio.rev *= 0.86;
    var f = 30 + kmh * 0.85 + gearFrac * 16 + audio.rev * 45;
    audio.o1.frequency.setTargetAtTime(f, t, 0.12);
    audio.o2.frequency.setTargetAtTime(f * 1.012, t, 0.12);
    audio.sub.frequency.setTargetAtTime(f / 2, t, 0.12);
    audio.lfo.frequency.setTargetAtTime(f / 2, t, 0.12);
    audio.lp.frequency.setTargetAtTime(380 + kmh * 8 + audio.rev * 500, t, 0.15);
    audio.master.gain.setTargetAtTime(0.06 + Math.min(kmh, 80) / 1600 + audio.rev * 0.03, t, 0.2);
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
      var secret = a[3] && !ok;
      return '<li class="' + (ok ? "" : "locked") + '"><span class="box">' + (ok ? "✓" : "") + "</span><div><b>" + (ok ? a[1] : "???") + "</b><small>" + (secret ? "Hidden easter egg" : a[2]) + "</small></div></li>";
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
  // Cross-laced wire spokes.
  var spokes = "";
  for (var i = 0; i < 20; i++) {
    var a = (i / 20) * Math.PI * 2, b2 = a + (i % 2 ? 0.55 : -0.55);
    spokes += '<line x1="' + (Math.cos(a) * 5).toFixed(1) + '" y1="' + (Math.sin(a) * 5).toFixed(1) + '" x2="' + (Math.cos(b2) * 27).toFixed(1) + '" y2="' + (Math.sin(b2) * 27).toFixed(1) + '" stroke="#55565f" stroke-width="1.1"/>';
  }
  [].forEach.call(document.querySelectorAll(".rider .spokes"), function (g) { g.innerHTML = spokes; });
  var wheelR = $("#wheel-r"), wheelF = $("#wheel-f"), bikeG = $("#bike"), riderEl = $("#rider");

  // Pause for a few seconds and the rider starts thinking out loud.
  var THOUGHTS = [
    ["Better Mr. Late than late Mr.", "BRO road sign"],
    ["The journey of a thousand miles begins with a single step.", "Lao Tzu"],
    ["Speed thrills but often kills.", "BRO road sign"],
    ["Dream is not that which you see while sleeping, it is something that does not let you sleep.", "A.P.J. Abdul Kalam"],
    ["All will wait, better be late.", "BRO road sign"],
    ["Drive like hell and you will be there.", "BRO road sign"],
    ["Don't gossip, let him drive.", "BRO road sign"],
    ["I am curvaceous, be slow.", "BRO road sign"],
    ["Darling I like you, but not so fast.", "BRO road sign"],
    ["Safety on road is safe tea at home.", "BRO road sign"]
  ];
  var thoughtEl = document.createElement("div"), thoughtI = 0, idleSince = 0, thinking = false;
  thoughtEl.className = "thought";
  thoughtEl.setAttribute("aria-live", "polite");
  riderEl.appendChild(thoughtEl);
  function updateThought(now, kmh) {
    var idle = kmh < 1 && !introOpen && cur > 300 && cur < END - 300 && !(isMobile() && lastActive);
    if (!idle) idleSince = 0; else if (!idleSince) idleSince = now;
    if (idle && now - idleSince > 3500 && !thinking) {
      var q = THOUGHTS[thoughtI++ % THOUGHTS.length];
      thoughtEl.innerHTML = "<p>“" + q[0] + "”</p><small>— " + q[1] + "</small>";
      thoughtEl.classList.add("show");
      thinking = true;
      unlock("think");
    } else if (!idle && thinking) {
      thoughtEl.classList.remove("show");
      thinking = false;
    }
  }

  function honk() {
    unlock("honk");
    if (cowBubble && cowBubble.classList.contains("show")) {
      unlock("cow");
      cowBubble.textContent = "MOOOO!";
      setTimeout(function () { cowBubble.textContent = "moo!"; }, 1600);
      blip([[180, 120]], 0.7, "sawtooth", 0.05);
    }
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
    p.x = r.left + 18 * k - 9; p.y = r.top + 129 * k - 9; p.life = 1; p.vx = -20 - Math.random() * 30; p.vy = -14 - Math.random() * 14;
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
  // Weather: monsoon rain in Pune, dust in Jaipur, snow in Ladakh
  // ------------------------------------------------------------------
  var wCanvas = $("#weather"), wctx = wCanvas.getContext("2d"), haze = $("#haze"), roadH = 100, dpr = 1;
  var drops = [], flakes = [], dust = [], splashes = [];
  function sizeWeather() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    wCanvas.width = Math.round(window.innerWidth * dpr); wCanvas.height = Math.round(window.innerHeight * dpr);
    roadH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--road-h")) || 100;
  }
  function band(a, b, edge) { return Math.max(0, Math.min(1, (cur - a) / edge, (b - cur) / edge)); }
  function fillPool(arr, target, make) {
    while (arr.length < target) arr.push(make(true));
    if (arr.length > target) arr.length = Math.max(0, target);
  }
  function updateWeather(dt, dx, vw, vh) {
    var rain = band(4100, 5800, 300), sand = band(6000, 7600, 300), snow = band(9300, 10900, 300);
    haze.style.background = rain > 0 ? "rgba(70, 90, 120," + (rain * 0.16).toFixed(3) + ")" : sand > 0 ? "rgba(240, 170, 90," + (sand * 0.14).toFixed(3) + ")" : "transparent";
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.clearRect(0, 0, vw, vh);
    if (reduceMotion || (rain + sand + snow) === 0) { drops.length = flakes.length = dust.length = splashes.length = 0; return; }
    var ground = vh - roadH + 26;
    fillPool(drops, Math.round(rain * 170), function () { return { x: Math.random() * (vw + 200), y: Math.random() * vh, l: 12 + Math.random() * 14, v: 700 + Math.random() * 300 }; });
    fillPool(flakes, Math.round(snow * 110), function () { return { x: Math.random() * (vw + 200), y: Math.random() * vh, r: 1.6 + Math.random() * 2.6, v: 30 + Math.random() * 50, p: Math.random() * 6 }; });
    fillPool(dust, Math.round(sand * 80), function () { return { x: Math.random() * vw, y: vh * 0.45 + Math.random() * vh * 0.5, r: 1 + Math.random() * 2, v: 80 + Math.random() * 120 }; });
    wctx.lineCap = "round";
    wctx.strokeStyle = "rgba(31, 31, 36, .42)"; wctx.lineWidth = 1.4;
    wctx.beginPath();
    drops.forEach(function (d) {
      d.y += d.v * dt; d.x += -d.v * 0.22 * dt - dx;
      if (d.y > ground) { if (Math.random() < 0.35) splashes.push({ x: d.x, y: ground + Math.random() * 40, t: 0 }); d.y = -20; d.x = Math.random() * (vw + 200); }
      if (d.x < -20) d.x += vw + 200;
      wctx.moveTo(d.x, d.y); wctx.lineTo(d.x - d.l * 0.22, d.y + d.l);
    });
    wctx.stroke();
    wctx.strokeStyle = "rgba(31, 31, 36, .5)"; wctx.lineWidth = 1.2;
    splashes = splashes.filter(function (sp) {
      sp.t += dt; sp.x -= dx;
      var r = 3 + sp.t * 30;
      wctx.globalAlpha = Math.max(0, 1 - sp.t / 0.3);
      wctx.beginPath(); wctx.ellipse(sp.x, sp.y, r, r * 0.3, 0, Math.PI, 2 * Math.PI); wctx.stroke();
      return sp.t < 0.3;
    });
    wctx.globalAlpha = 1;
    wctx.fillStyle = "#fff"; wctx.strokeStyle = "rgba(31, 31, 36, .45)"; wctx.lineWidth = 1;
    flakes.forEach(function (f) {
      f.p += dt * 2; f.y += f.v * dt; f.x += Math.sin(f.p) * 20 * dt - dx;
      if (f.y > ground + 30) { f.y = -10; f.x = Math.random() * (vw + 200); }
      if (f.x < -20) f.x += vw + 200;
      wctx.beginPath(); wctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); wctx.fill(); wctx.stroke();
    });
    wctx.fillStyle = "rgba(200, 160, 100, .6)";
    dust.forEach(function (p) {
      p.x -= p.v * dt + dx; p.y += Math.sin(p.x / 40) * 0.4;
      if (p.x < -10) { p.x = vw + Math.random() * 60; p.y = vh * 0.45 + Math.random() * vh * 0.5; }
      wctx.fillRect(p.x, p.y, p.r * 2.4, p.r);
    });
  }

  // ------------------------------------------------------------------
  // Oncoming traffic: autos, buses, trucks and fellow riders
  // ------------------------------------------------------------------
  var WHEEL = function (cx, cy, r) {
    return '<g class="w" style="transform-origin:' + cx + "px " + cy + 'px"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#1f1f24"/>' +
      '<path d="M' + (cx - r + 3) + " " + cy + " H" + (cx + r - 3) + " M" + cx + " " + (cy - r + 3) + " V" + (cy + r - 3) + '" stroke="#fbfaf6" stroke-width="2"/></g>';
  };
  var VEHICLES = {
    auto: { w: 140, speed: 240, svg: "<svg viewBox=\"0 0 140 100\" width=\"140\" height=\"100\">\n        <g filter=\"url(#rough)\" stroke=\"#1f1f24\" stroke-width=\"2.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\">\n          <path d=\"M34 10 Q78 -2 124 10 L126 50 L34 50 Z\" fill=\"#2b2d42\"/>\n          <path d=\"M34 10 Q78 -2 124 10\" fill=\"none\" stroke=\"#ffd166\" stroke-width=\"4\"/>\n          <path d=\"M14 80 L20 40 Q24 26 36 24 L36 80 Z\" fill=\"#ffd166\"/>\n          <rect x=\"36\" y=\"50\" width=\"92\" height=\"30\" rx=\"4\" fill=\"#7cc36a\"/>\n          <path d=\"M24 40 L32 26 L36 26 L36 50 L26 50 Z\" fill=\"#fbfaf6\"/>\n          <path d=\"M60 50 V22 M100 50 V18\" fill=\"none\"/>\n          <circle cx=\"56\" cy=\"36\" r=\"6\" fill=\"#e8c99a\"/>\n          <circle cx=\"18\" cy=\"58\" r=\"4.5\" fill=\"#fff6d8\"/>\n          <path d=\"M40 62 H120\" stroke-width=\"1.4\" fill=\"none\"/>\n        </g>\n        <g class=\"w\" style=\"transform-origin:28px 84px\"><circle cx=\"28\" cy=\"84\" r=\"11\" fill=\"#1f1f24\"/><path d=\"M20 84 H36 M28 76 V92\" stroke=\"#fbfaf6\" stroke-width=\"2\"/></g>\n        <g class=\"w\" style=\"transform-origin:108px 84px\"><circle cx=\"108\" cy=\"84\" r=\"13\" fill=\"#1f1f24\"/><path d=\"M98 84 H118 M108 74 V94\" stroke=\"#fbfaf6\" stroke-width=\"2\"/></g>\n      </svg>" },
    bus: { w: 270, speed: 300, svg: '<svg viewBox="0 0 270 120" width="270" height="120"><g filter="url(#rough)" stroke="#1f1f24" stroke-width="2.4" stroke-linejoin="round">' +
      '<path d="M10 100 V34 Q10 14 32 12 H258 V100 Z" fill="#f6e7c8"/><path d="M10 72 H258 V100 H10 Z" fill="#c1121f"/>' +
      '<path d="M16 64 V36 Q16 22 34 20 H48 V64 Z" fill="#cfe6f5"/>' +
      grid(58, 24, 7, 1, 28, 0, 22, 30, 'fill="#cfe6f5"') +
      '<rect x="40" y="2" width="80" height="12" rx="2" fill="#1f1f24"/>' +
      '<path d="M10 80 H258" stroke-width="1.4"/><circle cx="16" cy="88" r="5" fill="#fff6d8"/>' +
      '<rect x="104" y="76" width="112" height="18" rx="3" fill="#fbfaf6" stroke-width="1.6"/></g>' +
      '<text x="80" y="11.5" text-anchor="middle" font-family="Patrick Hand, cursive" font-size="10" fill="#ffd166">EXPRESS</text>' +
      '<text x="160" y="89.5" text-anchor="middle" font-family="Patrick Hand, cursive" font-size="11.5" fill="#1f1f24">STATE TRANSPORT</text>' +
      WHEEL(56, 104, 15) + WHEEL(214, 104, 15) + "</svg>" },
    truck: { w: 250, speed: 220, svg: '<svg viewBox="0 0 250 120" width="250" height="120"><g filter="url(#rough)" stroke="#1f1f24" stroke-width="2.4" stroke-linejoin="round">' +
      '<path d="M8 100 V52 L20 34 H62 V100 Z" fill="#2a9d8f"/><path d="M14 54 L24 40 H54 V58 H14 Z" fill="#cfe6f5"/>' +
      '<rect x="62" y="16" width="180" height="84" rx="4" fill="#ffe08a"/>' +
      '<path d="M62 26 H242 M62 90 H242" stroke-width="1.6"/><circle cx="12" cy="88" r="5" fill="#fff6d8"/></g>' +
      '<g stroke="#1f1f24" stroke-width="1">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(function (i) {
        return '<path d="M' + (64 + i * 12) + ' 16 l6 9 l6 -9" fill="' + ["#e63946", "#3a86ff", "#2a9d8f"][i % 3] + '"/>';
      }).join("") + "</g>" +
      '<text x="152" y="52" text-anchor="middle" font-family="Cabin Sketch, cursive" font-weight="700" font-size="17" fill="#e63946">HORN OK PLEASE</text>' +
      '<text x="152" y="74" text-anchor="middle" font-family="Patrick Hand, cursive" font-size="13" fill="#1f1f24">use dipper at night</text>' +
      WHEEL(36, 104, 14) + WHEEL(170, 104, 14) + WHEEL(206, 104, 14) + "</svg>" },
    biker: { w: 150, speed: 380, svg: '<svg viewBox="0 0 150 120" width="150" height="120">' +
      '<g filter="url(#rough)" stroke="#1f1f24" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="M90 84 L136 78 L140 84 L92 90 Z" fill="#e6e8eb"/>' +
      '<path d="M32 94 L52 50 M118 94 L96 70 L62 66 L52 50" fill="none" stroke-width="4.5"/>' +
      '<rect x="60" y="64" width="32" height="22" rx="5" fill="#9aa0a8"/>' +
      '<path d="M54 54 Q70 40 92 46 L94 58 Q74 62 56 60 Z" fill="#2a4fb5"/>' +
      '<path d="M92 50 Q110 46 124 54 L122 60 L94 60 Z" fill="#3b2a20"/>' +
      '<circle cx="44" cy="52" r="7" fill="#fff6d8"/><path d="M50 44 L58 40" stroke-width="4"/>' +
      '<path d="M102 52 L80 64 L86 84" fill="none" stroke="#3a4a6b" stroke-width="8"/>' +
      '<path d="M102 52 L88 26" fill="none" stroke="#2f3a55" stroke-width="15"/>' +
      '<path d="M88 30 L66 40 L56 42" fill="none" stroke="#2f3a55" stroke-width="6"/>' +
      '<circle cx="84" cy="12" r="11" fill="#2a9d8f"/><path d="M74 13 h10" stroke-width="3"/></g>' +
      '<g class="wave-hand"><path d="M88 28 L102 12 L105 -2" fill="none" stroke="#2f3a55" stroke-width="6" stroke-linecap="round"/><circle cx="105" cy="-5" r="4.2" fill="#e0a982" stroke="#1f1f24" stroke-width="1.6"/></g>' +
      WHEEL(32, 94, 20) + WHEEL(118, 94, 20) + "</svg>" }
  };
  var trafficEl = $("#traffic"), TYPES = Object.keys(VEHICLES);
  var traffic = [0, 1].map(function (i) {
    var el = document.createElement("div");
    el.className = "vehicle";
    trafficEl.appendChild(el);
    return { el: el, x: 2600 + i * 3200, type: null, bubble: null };
  });
  function setVehicle(v, type) {
    v.type = type;
    v.el.innerHTML = VEHICLES[type].svg + (type === "biker" ? '<div class="bubble">Ride safe!</div>' : "");
    v.bubble = v.el.querySelector(".bubble");
  }
  traffic.forEach(function (v, i) { setVehicle(v, i ? "bus" : "auto"); });
  function updateTraffic(dt, camX, vw, rs, mobile) {
    traffic.forEach(function (v, i) {
      v.x -= VEHICLES[v.type].speed * dt;
      var sx = v.x - camX;
      if (sx < -320 || sx > vw + 4200) {
        var other = traffic[1 - i], type;
        do { type = TYPES[Math.floor(Math.random() * TYPES.length)]; } while (type === other.type);
        setVehicle(v, type);
        v.x = Math.max(camX + vw + 400 + Math.random() * 2200, other.x + 1800);
        sx = v.x - camX;
      }
      v.el.style.transform = "translate3d(" + sx.toFixed(1) + "px,0,0) scale(" + (mobile ? 0.62 : 1) + ")";
      if (v.bubble) v.bubble.classList.toggle("show", sx > rs + 120 && sx < rs + 520);
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
  var typed = "", turboUntil = 0;
  var throttle = 0, boost = false, throttleVel = 0, introOpen = !!document.getElementById("intro");
  var FWD = { w: 1, arrowup: 1, arrowright: 1, d: 1, " ": 1 }, BACK = { s: 1, arrowdown: 1, arrowleft: 1, a: 1 };
  window.addEventListener("keydown", function (e) {
    if (introOpen) return;
    var k = e.key.toLowerCase(), tag = (e.target.tagName || "").toLowerCase();
    if (k.length === 1) {
      typed = (typed + k).slice(-9);
      if (typed === "sudo ride") {
        unlock("sudo");
        turboUntil = performance.now() + 8000;
        showToast("TURBO", "Root access granted. Hold <b>W</b> for 8 seconds of turbo.", false, 3000);
      }
    }
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
  var beam = $("#beam"), speedlines = $("#speedlines");
  var posters = [].slice.call(document.querySelectorAll(".poster"));
  var cur = 0, last = performance.now(), dist = 0, lastNight = -1, lastActive = null;
  var cowBubble = null, regionGroups = [];
  var speed = 0, prevSpeed = 0, wheelie = 0, clock = 0, lastRs = null;

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now; clock += dt;
    var vw = window.innerWidth, vh = window.innerHeight, mobile = vw < 760;

    // Keyboard throttle drives the page scroll.
    var targetVel = throttle * (now < turboUntil ? 2800 : boost ? 1700 : 950);
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
      // Headlight sits at (182, 64) in the 240x170 bike drawing.
      var headY = (mobile ? -42 : -62) + (170 - 64) * k;
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

    // Oncoming traffic in the far lane.
    updateTraffic(dt, camX, vw, rs, mobile);
    if (cowBubble) cowBubble.classList.toggle("show", Math.abs(cur - (COW_X - 480)) < 260);

    regionGroups.forEach(function (g) { g.el.classList.toggle("off", cur < g.from || cur > g.to); });
    if (dx < -1.5 && cur > CP.school.x - 200 && cur < CP.school.x + 700) unlock("backwards");
    updateWeather(dt, dx, vw, vh);
    updateThought(now, kmh);

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
    moon.style.transform = "translate(" + (vw * (0.86 - mp * 0.5)).toFixed(0) + "px," + (vh * (0.55 - mp * 0.4)).toFixed(0) + "px)";

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
  buildSky(); buildClouds(); buildFar(); buildMid(); buildNear(); buildFront(); buildGround(); buildGlow(); buildSpeedo();
  cowBubble = document.querySelector(".cow .bubble");
  regionGroups = [].map.call(document.querySelectorAll(".rg"), function (el) {
    return { el: el, from: +el.getAttribute("data-from"), to: +el.getAttribute("data-to") };
  });
  renderTrophies();
  layout();
  var wasMobile = isMobile();
  sizeWeather();
  window.addEventListener("resize", function () {
    layout(); sizeWeather();
    if (isMobile() !== wasMobile) { wasMobile = isMobile(); buildGlow(); }
  });
  setSound(false);
  // Tab title nudges you back while you're away.
  var baseTitle = document.title;
  document.addEventListener("visibilitychange", function () {
    document.title = document.hidden ? "🏍️ Engine's still running…" : baseTitle;
  });
  // ------------------------------------------------------------------
  // Intro: "Why a motorbike?" + fuel-gauge loader, then kick-start.
  // ------------------------------------------------------------------
  function riderHint() {
    showToast("RIDER", (isMobile() ? "Swipe up" : "Scroll or hold <b>W / ↑</b>") + ' to ride. Engine sound is <button class="sound-toggle sound-state" type="button">' + (audio.on ? "ON" : "OFF") + "</button>", false, 6500);
  }
  moon.addEventListener("click", function () {
    if (lastNight < 0.3) return;
    unlock("moon");
    showToast("THE MOON SAYS", "Ship it. Then go for a night ride.", false, 2600);
  });
  var intro = $("#intro");
  if (!intro) { riderHint(); }
  else {
    root.style.overflow = "hidden";
    var STATUS = ["Checking tyre pressure…", "Filling the tank with cutting chai…", "Polishing the chrome…", "Paving the road from Malda to Jaipur…", "Warming up the parallel twin…"];
    var minMs = reduceMotion ? 300 : 2600, t0 = performance.now(), fontsDone = false, ready = false;
    var needle = $("#fuel-needle"), statusEl = $("#intro-status"), actions = $("#intro-actions");
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { fontsDone = true; }, function () { fontsDone = true; });
    setTimeout(function () { fontsDone = true; }, 4000);
    var tick = function (now) {
      var p = Math.min(1, (now - t0) / minMs);
      if (!fontsDone) p = Math.min(p, 0.9);
      needle.setAttribute("transform", "rotate(" + (-70 + p * 140).toFixed(1) + " 80 80)");
      if (p < 1) {
        statusEl.textContent = STATUS[Math.min(STATUS.length - 1, Math.floor(p * STATUS.length))];
        requestAnimationFrame(tick);
      } else if (!ready) {
        ready = true;
        statusEl.textContent = "Tank's full. Ready to ride.";
        actions.classList.add("ready");
        $("#kick-btn").focus({ preventScroll: true });
      }
    };
    requestAnimationFrame(tick);
    var startRide = function (withSound) {
      if (!ready) return;
      if (withSound) { setSound(true); audio.rev = 1; blip([[90, 140]], 0.5, "sawtooth", 0.05); }
      intro.classList.add("gone");
      root.style.overflow = "";
      introOpen = false;
      setTimeout(function () { intro.hidden = true; }, 700);
      setTimeout(riderHint, 500);
    };
    $("#kick-btn").addEventListener("click", function () { startRide(true); });
    $("#mute-btn").addEventListener("click", function () { startRide(false); });
  }
  requestAnimationFrame(frame);
})();
