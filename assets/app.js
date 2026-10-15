/* ============================================================
   app.js — 公式渲染 / 代码卡片 / 导航 / 页面机制
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 1. KaTeX 公式渲染 ---------- */
  function renderMath() {
    if (typeof katex === "undefined") return;
    document.querySelectorAll(".math-display").forEach(function (el) {
      try { katex.render(el.textContent, el, { displayMode: true, throwOnError: false }); } catch (e) { el.textContent = el.textContent; }
    });
    document.querySelectorAll(".math").forEach(function (el) {
      try { katex.render(el.textContent, el, { throwOnError: false }); } catch (e) {}
    });
  }

  /* ---------- 2. 语法高亮（轻量 tokenizer：python / c） ---------- */
  var KW_PY = "def return for in if else elif import from class with as not and or None True False lambda while break continue pass yield global assert try except finally raise is";
  var KW_C = "int float double void char long short unsigned const static struct for while if else return sizeof do switch case break continue default";
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function hlLine(line, lang) {
    var kw = new RegExp("\\b(" + (lang === "c" ? KW_C : KW_PY).split(" ").join("|") + ")\\b");
    var re = new RegExp(
      [ "(\\/\\/[^\\n]*|#[^\\n]*)",                        // 1 comment
        "(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*')", // 2 string
        "(@[A-Za-z_]\\w*)",                                // 3 decorator
        "(\\b\\d+\\.?\\d*(?:e-?\\d+)?\\b)",                // 4 number
        "(\\b[A-Za-z_]\\w*)(?=\\s*\\()",                   // 5 function call
        "(\\bself\\b|\\bcls\\b)"                           // 6 self
      ].join("|"), "g");
    var out = "", last = 0, m;
    while ((m = re.exec(line)) !== null) {
      out += esc(line.slice(last, m.index));
      var t = m[0];
      if (m[1]) out += '<span class="tok-com">' + esc(t) + "</span>";
      else if (m[2]) out += '<span class="tok-str">' + esc(t) + "</span>";
      else if (m[3]) out += '<span class="tok-dec">' + esc(t) + "</span>";
      else if (m[4]) out += '<span class="tok-num">' + esc(t) + "</span>";
      else if (m[5]) out += (kw.test(t) ? '<span class="tok-kw">' + esc(t) + "</span>" : '<span class="tok-fn">' + esc(t) + "</span>");
      else if (m[6]) out += '<span class="tok-self">' + esc(t) + "</span>";
      else out += esc(t);
      last = m.index + t.length;
    }
    out += esc(line.slice(last));
    return out || "&nbsp;";
  }

  /* ---------- 3. 代码卡片渲染：行号 + 高亮 + 逐行注解 ---------- */
  function renderCodeCards() {
    document.querySelectorAll(".code-card").forEach(function (card) {
      var pre = card.querySelector("pre");
      if (!pre) return;
      var lang = pre.getAttribute("data-lang") || "python";
      var lines = pre.textContent.replace(/^\n+/, "").replace(/\s+$/, "").split("\n");
      var notes = null;
      var notesEl = card.querySelector("script.cc-notes");
      if (notesEl) {
        try { notes = JSON.parse(notesEl.textContent); } catch (e) {}
        if (notes) {
          // 展开范围键 "a-b"：同一注解应用到 a..b 每一行
          Object.keys(notes).forEach(function (k) {
            var m = k.match(/^(\d+)-(\d+)$/);
            if (m) {
              for (var i = +m[1]; i <= +m[2]; i++) if (notes[i] == null) notes[i] = notes[k];
              delete notes[k];
            }
          });
        }
      }

      var frag = document.createDocumentFragment();
      lines.forEach(function (ln, i) {
        var hasNote = notes && notes[i] != null;
        var row = document.createElement("span");
        row.className = "cl" + (hasNote ? " has-note" : "");
        row.innerHTML = '<span class="cl-no">' + (i + 1) + '</span><span class="cl-code">' + hlLine(ln, lang) + "</span>";
        frag.appendChild(row);
        if (hasNote) {
          var note = document.createElement("span");
          note.className = "cl-note";
          note.textContent = notes[i];
          frag.appendChild(note);
        }
      });
      pre.textContent = "";
      pre.appendChild(frag);

      var btn = card.querySelector('[data-role="toggle-notes"]');
      if (btn) {
        btn.addEventListener("click", function () {
          card.classList.toggle("notes-on");
          btn.textContent = "逐行讲解：" + (card.classList.contains("notes-on") ? "开" : "关");
        });
      }
    });
  }

  /* ---------- 4. scrollspy：侧栏高亮当前章节 ---------- */
  function initSpy() {
    var items = Array.prototype.slice.call(document.querySelectorAll(".sidebar a.nav-item"));
    var secs = items.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    function onScroll() {
      var pos = window.scrollY + window.innerHeight * 0.28;
      var cur = 0;
      secs.forEach(function (s, i) { if (s && s.offsetTop <= pos) cur = i; });
      items.forEach(function (a, i) { a.classList.toggle("active", i === cur); });
      // 进度条
      var doc = document.documentElement;
      var p = doc.scrollTop / Math.max(1, doc.scrollHeight - doc.clientHeight);
      document.getElementById("progress").style.width = (p * 100).toFixed(2) + "%";
      // 返回顶部
      document.getElementById("backtop").classList.toggle("show", doc.scrollTop > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 5. 移动端抽屉 / 返回顶部 ---------- */
  function initChrome() {
    var sidebar = document.getElementById("sidebar");
    var overlay = document.getElementById("overlay");
    document.getElementById("menuBtn").addEventListener("click", function () {
      sidebar.classList.toggle("open"); overlay.classList.toggle("show");
    });
    overlay.addEventListener("click", function () { sidebar.classList.remove("open"); overlay.classList.remove("show"); });
    sidebar.addEventListener("click", function (e) {
      if (e.target.closest("a")) { sidebar.classList.remove("open"); overlay.classList.remove("show"); }
    });
    document.getElementById("backtop").addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    renderCodeCards();
    renderMath();
    initSpy();
    initChrome();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
