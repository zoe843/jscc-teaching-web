/* ============================================================
   viz.js — Deep JSCC 教学页交互可视化（原生 SVG 手排坐标）
   1. viz-pipeline  JSCC 数据流水线（点击模块）
   2. viz-awgn      悬崖效应 vs 平滑退化（SNR 滑块）
   3. viz-shapes    V0 形状流水（k/n 联动）
   ============================================================ */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var BRAND = "#0e7490", BRAND_SOFT = "#e0f2f7", LINE = "#e3e9f1",
      INK = "#1c2733", INK2 = "#45566b", RED = "#dc2626";

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, str, opts) {
    opts = opts || {};
    var t = el("text", {
      x: x, y: y,
      "font-size": opts.size || 13,
      "font-family": opts.mono ? "Consolas, Menlo, monospace" : "'Segoe UI','Microsoft YaHei',sans-serif",
      fill: opts.fill || INK,
      "font-weight": opts.bold ? 700 : 400,
      "text-anchor": opts.anchor || "start"
    }, parent);
    t.textContent = str;
    return t;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function gauss(rand) { // Box-Muller，固定种子下可复现
    var u = Math.max(rand(), 1e-9), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ============ 交互 1 · JSCC 数据流水线 ============ */
  var PIPE = [
    { name: "图像 x",    shape: "(B,3,32,32)", desc: "原图 3072 个像素值，ToTensor 压到 [0,1]。标签用不上——重建是无监督任务。",
      io: "输入 CIFAR 图像" },
    { name: "编码器",    shape: "(B,256)",     desc: "三层 stride=2 卷积 + 展平 + 全连接：3072 维压成 256 个连续符号（实数 k/n=1/12）。改 k 即改压缩率。",
      io: "输出 k=256 个原始信道符号" },
    { name: "功率归一化", shape: "(B,256)",     desc: "每张图的符号除以该行 RMS，平均功率归一到 1。没有它 SNR 无从定义，网络会靠放大符号作弊。",
      io: "输出功率≈1 的符号 s" },
    { name: "信道",      shape: "(B,256)",     desc: "AWGN：y = s + n，σ² = 10^(−SNR/10)；瑞利：再乘随机增益 h 并在接收端均衡。就是你单元4 写过的加噪。",
      io: "输出被污染的 y" },
    { name: "解码器",    shape: "(B,3,32,32)", desc: "先拼 2 个 SNR 特征（知道信道多差），再全连接 + 三层转置卷积 + Sigmoid 还原图像。",
      io: "输出重建图 x̂" },
    { name: "重建 x̂ + 任务", shape: "(B,3,32,32)", desc: "与原图算 MSE/PSNR（图1 曲线）；寒假后接论文1 的 YOLO26m 测 mAP-SNR（图3，原创点）。",
      io: "评测：PSNR / SSIM / mAP" }
  ];
  function initPipeline() {
    var svg = document.getElementById("svg-pipeline");
    if (!svg) return;
    svg.setAttribute("viewBox", "0 0 850 280");
    var bw = 118, bh = 74, gap = 18, x0 = 26, y0 = 34;
    var rects = [], sel = -1;

    var infoG = el("g", {}, svg);
    function drawInfo(i) {
      while (infoG.firstChild) infoG.removeChild(infoG.firstChild);
      if (i < 0) {
        txt(infoG, 425, 205, "👆 点击任一模块：看它吃什么、吐什么、为什么在", { anchor: "middle", fill: INK2, size: 13.5 });
        return;
      }
      var m = PIPE[i];
      txt(infoG, 26, 165, m.name + " — " + m.io, { bold: true, fill: BRAND, size: 14.5 });
      var lines = m.desc.match(/.{1,54}/g) || [];
      lines.forEach(function(line,j) { txt(infoG,26,190+j*21,line,{fill:INK,size:13}); });
      txt(infoG, 26, 250, "张量形状: " + m.shape, { mono: true, fill: INK2, size: 12.5 });
    }
    PIPE.forEach(function (m, i) {
      var x = x0 + i * (bw + gap);
      var g = el("g", { cursor: "pointer", tabindex: "0", role: "button", "aria-label": m.name }, svg);
      var r = el("rect", { x: x, y: y0, width: bw, height: bh, rx: 10,
        fill: "#fff", stroke: LINE, "stroke-width": 1.5 }, g);
      rects.push(r);
      txt(g, x + bw / 2, y0 + 30, m.name, { anchor: "middle", bold: true, size: 14 });
      txt(g, x + bw / 2, y0 + 52, m.shape, { anchor: "middle", mono: true, size: 11, fill: INK2 });
      g.addEventListener("click", function () {
        sel = (sel === i ? -1 : i);
        rects.forEach(function (rr, j) {
          rr.setAttribute("fill", j === sel ? BRAND_SOFT : "#fff");
          rr.setAttribute("stroke", j === sel ? BRAND : LINE);
        });
        drawInfo(sel);
      });
      g.addEventListener("keydown", function(e) { if(e.key === "Enter" || e.key === " ") { e.preventDefault(); g.dispatchEvent(new Event("click")); } });
      if (i < PIPE.length - 1) {
        var ax = x + bw + 2;
        el("line", { x1: ax, y1: y0 + bh / 2, x2: ax + gap - 4, y2: y0 + bh / 2,
          stroke: INK2, "stroke-width": 1.5 }, svg);
        el("path", { d: "M " + (ax + gap - 4) + " " + (y0 + bh / 2 - 4) + " L " + (ax + gap) + " " + (y0 + bh / 2) + " L " + (ax + gap - 4) + " " + (y0 + bh / 2 + 4) + " Z", fill: INK2 }, svg);
      }
    });
    // 数据流副标注
    txt(svg, x0, y0 - 12, "数据流（左→右）：", { size: 12, fill: INK2 });
    txt(svg, x0, y0 + bh + 22, "训练目标：MSE(x̂, x) —— 梯度穿过噪声层流回编码器，「抗噪的编码方式」是被逼出来的", { size: 12.5, fill: INK2 });
    drawInfo(-1);
  }

  /* ============ 交互 2 · 悬崖效应 vs 平滑退化 ============ */
  var ARROW = [
    [  0,   0,   0, 255, 255,   0,   0,   0],
    [  0,   0, 255, 255, 255, 255,   0,   0],
    [  0, 255, 255, 255, 255, 255, 255,   0],
    [255, 255, 255, 255, 255, 255, 255, 255],
    [  0,   0,   0, 255, 255,   0,   0,   0],
    [  0,   0,   0, 255, 255,   0,   0,   0],
    [  0,   0,   0, 255, 255,   0,   0,   0],
    [  0,   0,   0, 255, 255,   0,   0,   0]
  ];
  var CELL = 30, GX = 305;
  function grayRect(svg, x, y, v, broken) {
    var r = el("rect", { x: x, y: y, width: CELL - 1, height: CELL - 1,
      fill: "rgb(" + v + "," + v + "," + v + ")" }, svg);
    if (broken) {
      r.setAttribute("stroke", RED);
      r.setAttribute("stroke-width", 2);
    }
    return r;
  }
  function drawJSCCRaw(svg, y0, snr) {
    var rand = mulberry32(42);
    var sigma = Math.sqrt(Math.pow(10, -snr / 10));   // σ²=10^(-SNR/10)，与算法 1-2 同式
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var v = ARROW[r][c] / 255 + gauss(rand) * sigma;
      grayRect(svg, GX + c * CELL, y0 + r * CELL, Math.round(clamp(v, 0, 1) * 255), false);
    }
  }
  function drawSeparate(svg, y0, snr) {
    var rand = mulberry32(77);
    // 块崩坏概率：低 SNR 侧陡增（sigmoid 门限 5dB）——模拟压缩码流关键比特被打坏
    var pBroken = 1 / (1 + Math.exp((snr - 5) / 1.2));
    for (var br = 0; br < 4; br++) for (var bc = 0; bc < 4; bc++) {
      var broken = rand() < pBroken;
      for (var r = 0; r < 2; r++) for (var c = 0; c < 2; c++) {
        var rr = br * 2 + r, cc = bc * 2 + c;
        var v = broken ? 128 : ARROW[rr][cc];       // 崩坏块=整块均值灰
        grayRect(svg, GX + cc * CELL, y0 + rr * CELL, v, broken);
      }
    }
  }
  function initAwgn() {
    var svg = document.getElementById("svg-awgn");
    if (!svg) return;
    svg.setAttribute("viewBox", "0 0 850 610");
    var slider = document.getElementById("awgn-snr");
    var label = document.getElementById("awgn-snr-val");
    txt(svg, 20, 22, "连续污染示意：像素直接加噪（没有 JSCC 网络）", { size: 13.5, bold: true, fill: INK });
    txt(svg, 20, 300, "门限失效示意：人为概率填灰（没有 JPEG/BPSK 实验）", { size: 13.5, bold: true, fill: INK });
    txt(svg, 20, 322, "（红框 = 崩坏块，填均值灰；崩坏概率随 SNR 陡降——悬崖）", { size: 12, fill: INK2 });
    function redraw() {
      while (svg.childNodes.length > 3) svg.removeChild(svg.lastChild);
      var snr = +slider.value;
      label.textContent = snr;
      drawJSCCRaw(svg, 34, snr);
      drawSeparate(svg, 336, snr);
      txt(svg, GX + 240 + 24, 34 + 110, "SNR = " + snr + " dB", { size: 13.5, mono: true, fill: BRAND, bold: true });
      txt(svg, GX + 240 + 24, 34 + 132, "σ² = " + Math.pow(10, -snr / 10).toFixed(2), { size: 12.5, mono: true, fill: INK2 });
      var pB = 1 / (1 + Math.exp((snr - 5) / 1.2));
      txt(svg, GX + 240 + 24, 336 + 120, "设定崩坏概率 ≈ " + Math.round(pB * 100) + "%", { size: 13, mono: true, fill: RED, bold: true });
    }
    slider.addEventListener("input", redraw);
    redraw();
  }

  /* ============ 交互 3 · V0 形状流水 ============ */
  var ROWS = [
    { name: "1  输入图像 x",        kn: false, shape: function () { return "(B, 3, 32, 32)"; }, from: "ToTensor" },
    { name: "2  编码器·卷积组",      kn: false, shape: function () { return "(B, 256, 4, 4)"; }, from: "算法 2-1" },
    { name: "3  展平",              kn: false, shape: function () { return "(B, 4096)"; },      from: "reshape" },
    { name: "4  全连接 → 原始符号",  kn: true,  shape: function (k) { return "(B, " + k + ")"; }, from: "nn.Linear(4096, k)" },
    { name: "5  功率归一化",         kn: true,  shape: function (k) { return "(B, " + k + ")"; }, from: "算法 1-1" },
    { name: "6  过信道",            kn: true,  shape: function (k) { return "(B, " + k + ")"; }, from: "算法 1-2 / 1-3" },
    { name: "7  拼 SNR 特征",        kn: true,  shape: function (k) { return "(B, " + (k + 2) + ")"; }, from: "算法 2-2" },
    { name: "8  全连接 → 重排",      kn: false, shape: function () { return "(B, 256, 4, 4)"; }, from: "算法 2-3" },
    { name: "9  转置卷积组+Sigmoid", kn: false, shape: function () { return "(B, 3, 32, 32)"; }, from: "算法 2-3" }
  ];
  function initShapes() {
    var svg = document.getElementById("svg-shapes");
    if (!svg) return;
    svg.setAttribute("viewBox", "0 0 850 500");
    var sel = document.getElementById("shapes-kn");
    var y0 = 14, rh = 40;

    function redraw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var k = +sel.value;
      ROWS.forEach(function (row, i) {
        var y = y0 + i * rh;
        if (row.kn) el("rect", { x: 16, y: y, width: 700, height: rh - 8, rx: 8, fill: BRAND_SOFT }, svg);
        txt(svg, 30, y + 22, row.name, { size: 13.5, bold: true, fill: row.kn ? BRAND : INK });
        txt(svg, 440, y + 22, row.shape(k), { mono: true, size: 13, fill: INK });
        txt(svg, 730, y + 22, row.from, { mono: true, size: 11.5, fill: INK2 });
      });
      // 底部：k 个符号的示意条
      var by = y0 + 9 * rh + 18;
      txt(svg, 30, by + 10, "k = " + k + " 个信道符号：", { size: 13, bold: true, fill: INK });
      var n = Math.min(k, 256), w = 560 / 256;
      var rand = mulberry32(k);
      for (var i = 0; i < n; i++) {
        var v = Math.round(60 + rand() * 160);
        el("rect", { x: 230 + i * w, y: by, width: Math.max(w - 0.6, 1), height: 18,
          fill: "rgb(" + v + "," + v + "," + v + ")" }, svg);
      }
      txt(svg, 30, by + 48, "实数使用 k=" + k + "；n=3072；k/n=" + (k/3072).toFixed(4) + "；维度比约 " + (3072/k).toFixed(2) + ":1", { size: 12, fill: INK2 });
    }
    sel.addEventListener("change", redraw);
    redraw();
  }


  function initMetrics() {
    var input = document.getElementById("psnr-mse"), out = document.getElementById("psnr-result");
    if (!input || !out) return;
    function draw() { var exponent=Number(input.value), mse=Math.pow(10,exponent); out.textContent="MSE = " + mse.toFixed(5) + " → PSNR = " + (-10*exponent).toFixed(2) + " dB"; }
    input.addEventListener("input",draw); draw();
  }
  function initPatches() {
    var grid=document.getElementById("patch-grid"), out=document.getElementById("patch-result");
    if (!grid || !out) return;
    var buttons=[];
    function select(i) {
      buttons.forEach(function(b,j) { b.setAttribute("aria-pressed", String(i===j)); });
      var r=Math.floor(i/8), c=i%8;
      out.textContent="token " + i + " = " + r + "×8+" + c + "；原图行 " + r*4 + "–" + (r*4+3) + "、列 " + c*4 + "–" + (c*4+3) + "；RGB 共 3×4×4=48 个数 → 64 维特征。";
    }
    for (var i=0;i<64;i++) {
      var b=document.createElement("button"); b.type="button"; b.textContent=i;
      b.setAttribute("aria-label","选择第 " + i + " 个图像块");
      (function(index,button) { button.addEventListener("click",function(){select(index);}); })(i,b);
      grid.appendChild(b); buttons.push(b);
    }
    select(0);
  }

  /* ============ boot ============ */
  function boot() {
    initPipeline();
    initAwgn();
    initShapes();
    initMetrics();
    initPatches();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
