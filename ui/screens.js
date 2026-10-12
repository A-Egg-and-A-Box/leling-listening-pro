/* ============================================================
 * 乐龄聆听计划 · 屏幕渲染
 * 一屏只做一件事：整屏重建，不留上一屏的影子。
 * 每屏都是「几句话 + 几个铺满行宽的大按钮」，
 * 按钮左上角挂 1 / 2 / 3 的数字，键盘、遥控器、读屏都能用。
 * ============================================================ */
(function (global) {
  "use strict";

  var Catalog = global.MZCatalog;
  var Guide = global.MZGuide;
  var Player = global.MZPlayer;
  var Voice = global.MZVoice;
  var Companion = global.MZCompanion;
  var Records = global.MZRecords;
  var Wizard = global.MZWizard;
  var STEP = global.MZStep;

  var dom = {};
  var wizard = null;
  var currentSay = "";     /* 本屏该念的话，按空格可重念 */
  var pendingSay = null;   /* 本屏要优先念的一句（比如刚给出的提示） */
  var lastStep = null;
  var askState = { open: false, hint: false, ack: "" };
  var segStart = {};       /* 自选曲子的每句起点（手填） */

  /* ---------------- 小工具 ---------------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* 铺满行宽的大按钮：左边一个数字键标，右边是主文案和一行小字 */
  function bigBtn(key, label, sub, onClick, opt) {
    opt = opt || {};
    var b = el("button", "big-btn" + (opt.primary ? " primary" : "") + (opt.ghost ? " ghost" : ""));
    b.type = "button";
    if (key) {
      b.appendChild(el("span", "btn-key", String(key)));
      b.setAttribute("data-key", String(key));
    }
    var m = el("span", "btn-main");
    m.appendChild(el("span", "btn-label", label));
    if (sub) m.appendChild(el("span", "btn-sub", sub));
    b.appendChild(m);
    if (opt.primary) b.setAttribute("data-primary", "1");
    b.onclick = function () { onClick(b); };
    return b;
  }

  function head(title, sub) {
    var h = el("div", "sc-head");
    h.appendChild(el("h2", "sc-title", title));
    if (sub) h.appendChild(el("div", "sc-sub", sub));
    return h;
  }

  /* 进入某一屏：清空、重建、把该说的话念出来 */
  function frame(stepName, sayText) {
    clear(dom.screen);
    dom.screen.className = "screen s-" + stepName;
    dom.screen.scrollTop = 0;
    var say = (pendingSay != null) ? pendingSay : (sayText || "");
    pendingSay = null;
    currentSay = say;
    if (say) Voice.say(say);
  }

  /* ---------------- S0 首页 ---------------- */
  function renderHome() {
    Companion.hide();
    var last = Records.lastSession();
    frame(STEP.HOME, Guide.homeSay());

    var hero = el("div", "hero");
    hero.appendChild(el("div", "hero-logo", "🎵"));
    hero.appendChild(el("h1", "hero-title", "乐龄聆听计划"));
    hero.appendChild(el("p", "hero-sub", "不用看谱、不用懂乐理。一句一句地听，听完说一说，最后才揭晓。"));
    dom.screen.appendChild(hero);

    var steps = el("div", "home-steps");
    [["①", "选一首曲子"], ["②", "一句一句地听"], ["③", "听完说一说"], ["④", "记下我的聆听"]].forEach(function (s) {
      var row = el("div", "hs-row");
      row.appendChild(el("span", "hs-n", s[0]));
      row.appendChild(el("span", "hs-t", s[1]));
      steps.appendChild(row);
    });
    dom.screen.appendChild(steps);

    var box = el("div", "btn-col");
    box.appendChild(bigBtn(1, "▶ 开始聆听", "从「入门」那一档挑一首", function () { wizard.start(); }, { primary: true }));
    var n = 2;
    if (last) {
      var song = Catalog.byId(last.songId);
      box.appendChild(bigBtn(n++, "↺ 继续上次", song ? ("接着听《" + song.title + "》") : "接着上次听", function () {
        if (!wizard.restore(last)) { wizard.start(); }
      }));
    }
    box.appendChild(bigBtn(n++, "📖 我的聆听", "看看以前听过哪些、说过什么", function () { openRecords(); }));
    box.appendChild(bigBtn(n++, "🔍 这里没有？帮我搜一首", "曲库以外的歌，也能陪着听", function () { wizard.openTool(); }, { ghost: true }));
    dom.screen.appendChild(box);

    if (!Voice.supported) {
      dom.screen.appendChild(el("div", "note",
        "这台设备暂时没法朗读。可以让旁边的家人照着屏幕念；也可以用手机自带的「屏幕朗读」（设置 → 辅助功能）。"));
    }
  }

  /* ---------------- S1a 选难度 ---------------- */
  function renderPickLevel() {
    Companion.hide();
    frame(STEP.PICK_LEVEL, Guide.pickLevelSay());
    dom.screen.appendChild(head("想从哪一档开始？", "听不惯，随时按 Esc，或点「上一步」退回来换。"));

    var box = el("div", "btn-col");
    box.appendChild(bigBtn(1, "入门 · 一听就耳熟", Guide.levelBlurb("入门"), function () { wizard.pickLevel("入门"); }, { primary: true }));
    box.appendChild(bigBtn(2, "进阶 · 听两遍才有味道", Guide.levelBlurb("进阶"), function () { wizard.pickLevel("进阶"); }));
    box.appendChild(bigBtn(3, "欣赏 · 名曲慢慢听", Guide.levelBlurb("欣赏"), function () { wizard.pickLevel("欣赏"); }));
    dom.screen.appendChild(box);
  }

  /* ---------------- S1b 选曲 ---------------- */
  function renderPickSong() {
    Companion.hide();
    var level = wizard.level || "入门";
    frame(STEP.PICK_SONG, Guide.pickSongSay(level));
    dom.screen.appendChild(head("选一首，我陪你听", "点一下名字就开始。按 Esc 可以换难度。"));

    var box = el("div", "btn-col");
    Catalog.byLevel(level).forEach(function (s, idx) {
      box.appendChild(bigBtn(idx + 1, s.emoji + " " + s.title, s.composer + " · " + s.era, function () { wizard.pickSong(s.id); }));
    });
    box.appendChild(bigBtn(null, "🔍 这里没有？帮我搜一首", "去 B 站找一首别的歌", function () { wizard.openTool(); }, { ghost: true }));
    dom.screen.appendChild(box);
  }

  /* ---------------- 工具屏：帮我搜一首 ---------------- */
  function renderTool() {
    Companion.hide();
    frame(STEP.TOOL, Guide.toolSay());
    dom.screen.appendChild(head("帮我搜一首", "曲库里没有的曲子，可以这样听："));
    dom.screen.appendChild(el("div", "note",
      "第一步，去 B 站找到它；第二步，看一眼页面顶上的地址栏，把里面那串「BV」开头的字符复制下来；第三步，粘到下面，我就把真正的录音嵌在这一页里，陪你一句一句地听。"));

    var card = el("div", "tool-card");

    card.appendChild(el("div", "tc-label", "① 先去 B 站找这首歌"));
    var line1 = el("div", "tc-line");
    var q = el("input", "tc-in");
    q.type = "text"; q.placeholder = "写个歌名，比如：映山红";
    q.setAttribute("aria-label", "要搜的歌名");
    line1.appendChild(q);
    var goSearch = el("button", "tc-btn", "🎬 去 B 站搜");
    goSearch.type = "button";
    goSearch.onclick = function () {
      var kw = (q.value || "").trim() || "音乐";
      global.open("https://search.bilibili.com/all?keyword=" + encodeURIComponent(kw), "_blank", "noopener");
    };
    line1.appendChild(goSearch);
    card.appendChild(line1);

    card.appendChild(el("div", "tc-label", "② 把 BV 号粘在这里"));
    var line2 = el("div", "tc-line");
    var bv = el("input", "tc-in");
    bv.type = "text"; bv.placeholder = "粘贴链接，或直接填 BV 号";
    bv.setAttribute("aria-label", "B 站链接或 BV 号");
    line2.appendChild(bv);
    var goListen = el("button", "tc-btn", "▶ 就这样听");
    goListen.type = "button";
    line2.appendChild(goListen);
    card.appendChild(line2);

    card.appendChild(el("div", "tc-label small", "③（可填可不填）写上歌名，听着更亲切"));
    var titleRow = el("div", "tc-line");
    var t = el("input", "tc-in");
    t.type = "text"; t.placeholder = "这首歌叫什么名字";
    t.setAttribute("aria-label", "歌名（可填可不填）");
    titleRow.appendChild(t);
    card.appendChild(titleRow);

    var err = el("div", "tc-err", "");
    card.appendChild(err);
    dom.screen.appendChild(card);

    goListen.onclick = function () {
      var id = Guide.parseBvid(bv.value);
      if (!id) {
        err.textContent = "没认出 BV 号。请在 B 站页面的地址栏里找一串「BV」开头的字符，整段链接粘过来也行。";
        Voice.say("没认出 B V 号。你可以把整个链接粘过来，我来找。");
        return;
      }
      err.textContent = "";
      wizard.startCustom(id, (t.value || "").trim());
    };

    dom.screen.appendChild(bigBtn(null, "← 回去挑别的", "回到选曲", function () { wizard.prev(); }, { ghost: true }));
  }

  /* ---------------- S2 分段聆听 ---------------- */
  function renderSeg() {
    var song = wizard.song();
    var i = wizard.i;
    var part = song.parts[i];
    var n = song.parts.length;
    var key = song.id + "#" + i;

    frame(STEP.SEG, Guide.segSay(song, i));
    dom.screen.appendChild(head(song.emoji + " " + song.title + " · " + Guide.segLead(song, i),
      "第 " + (i + 1) + " 句，一共 " + n + " 句。" + Guide.segTip(song, i)));

    var box = el("div", "btn-col");

    /* 手填起点：只在自选曲子上出现（曲库里的曲子都已对准录音） */
    var input = null;
    if (part.t == null) {
      var manual = el("div", "manual");
      manual.appendChild(el("div", "manual-t", "这首歌我们没配时间点，你自己定这一句从哪儿开始："));
      var line = el("div", "manual-line");
      input = el("input", "manual-in");
      input.type = "text"; input.setAttribute("inputmode", "numeric");
      input.placeholder = "秒，例如 80";
      input.setAttribute("aria-label", "这一句从第几秒开始");
      if (segStart[key] != null) input.value = String(segStart[key]);
      line.appendChild(input);
      line.appendChild(el("span", "manual-hint", "想不出就填 0，从头听。"));
      manual.appendChild(line);
      box.appendChild(manual);
    }

    var status = el("div", "seg-status", "");

    function start() {
      Voice.stop();
      var t = part.t;
      if (t == null) {
        var v = input ? Guide.parseMMSS(input.value) : null;
        t = (v == null) ? (segStart[key] || 0) : v;
        segStart[key] = t;
      }
      var ok = Player.play(t, part.dur, song.source && song.source.page, function () {
        status.textContent = "听完了 ✓ 到这儿它会自己停下来。";
        status.className = "seg-status done";
        if (Companion.on) Companion.show("陪听提示 · 听完了", "先别急着揭晓，问问他心里想到什么。", "");
      });
      if (!ok) {
        status.textContent = "这首歌现在放不出来，可以点上面的「新窗口打开」，直接去 B 站听。";
        status.className = "seg-status bad";
      } else {
        status.textContent = "正在放……大概 " + Math.round(part.dur) + " 秒，听完它会自己停。";
        status.className = "seg-status on";
      }
    }

    var mainBtn = bigBtn(1, "▶ 听这一句" + (part.t == null ? "" : "（约 " + Math.round(part.dur) + " 秒）"),
      part.t == null ? "从你填的时间开始听" : "从 " + Guide.mmss(part.t) + " 开始，听完自动停", start, { primary: true });
    box.appendChild(mainBtn);
    box.appendChild(bigBtn(2, "↺ 再听一遍", "同一句，再放一次", start));
    box.appendChild(bigBtn(3, "✓ 听完了，接着聊", "听完这一句，我们来说说", function () { wizard.segDone(); }));
    dom.screen.appendChild(box);
    dom.screen.appendChild(status);

    if (Companion.on) Companion.show("陪听提示 · 一起听这一段", "按下「听这一句」，陪他把这段听完。听完了先别急着说答案。", Guide.segTip(song, i));

    mainBtn.focus();
  }

  /* ---------------- S3 引导提问 ---------------- */
  function renderAsk() {
    var song = wizard.song();
    var i = wizard.i;
    var qa = Guide.ask(song, i);

    frame(STEP.ASK, Guide.askSay(song, i));
    dom.screen.appendChild(head(Guide.segLead(song, i) + " · 说说看", "说对说错都不要紧，我只要你的感觉。"));

    var qbox = el("div", "ask-q");
    qbox.appendChild(el("div", "ask-mark", "？"));
    qbox.appendChild(el("div", "ask-text", qa.question));
    dom.screen.appendChild(qbox);

    if (askState.ack) dom.screen.appendChild(el("div", "ask-ack", "🎵 " + askState.ack));
    if (askState.hint) dom.screen.appendChild(el("div", "ask-hint", "💡 " + qa.hint));

    var box = el("div", "btn-col");
    if (!askState.open) {
      box.appendChild(bigBtn(1, "💬 我说说", "把想到的说出来（打字，或直接说给旁边人听）", function () {
        askState.open = true;
        pendingSay = "你慢慢说，说完按下面那个「说完了」的按钮。";
        render();
      }, { primary: true }));
      var k = 2;
      if (!askState.hint) {
        box.appendChild(bigBtn(k++, "💡 给点提示", "想不出了？我提示你一下", function () {
          askState.hint = true;
          pendingSay = qa.hint;
          render();
        }));
      }
      box.appendChild(bigBtn(k++, "→ 这句先跳过", "不想说也没关系，接着听下一句", function () { wizard.skip(); }, { ghost: true }));
      dom.screen.appendChild(box);
    } else {
      var wrap = el("div", "ask-input");
      var ta = el("textarea", "ask-ta");
      ta.rows = 3;
      ta.placeholder = "在这儿写下来；不写也行，直接按「说完了」。";
      ta.setAttribute("aria-label", "你的想法");
      wrap.appendChild(ta);
      box.appendChild(wrap);
      box.appendChild(bigBtn(1, "✓ 说完了", "记下我说的，接着往下", function () {
        var ack = wizard.setAnswer(ta.value);
        askState.open = false;
        askState.ack = ack;
        pendingSay = ack;
        render();
      }, { primary: true }));
      box.appendChild(bigBtn(2, "← 还没说完", "先回到问题", function () { askState.open = false; render(); }, { ghost: true }));
      dom.screen.appendChild(box);
      setTimeout(function () { try { ta.focus(); } catch (e) { } }, 0);
    }

    if (Companion.on) Companion.show("陪听提示 · 请把这句话念给他听", qa.question, askState.hint ? qa.hint : "");
  }

  /* ---------------- S4 揭晓 ---------------- */
  function renderReveal() {
    var song = wizard.song();
    frame(STEP.REVEAL, Guide.revealSay(song));
    dom.screen.appendChild(head("现在我们揭晓答案", "前面只让你听、让你说；答案，现在才给。"));

    var r = el("div", "reveal-big");
    r.appendChild(el("div", "reveal-mark", "🎁"));
    r.appendChild(el("div", "reveal-text", song.reveal));
    dom.screen.appendChild(r);

    if (song.extend) dom.screen.appendChild(el("div", "extend-box", "延伸一小句 · " + song.extend));

    var box = el("div", "btn-col");
    box.appendChild(bigBtn(1, "▶ 从头再听一遍", "整段放给你听，这回不再自动停", function () {
      Voice.stop();
      var t = song.parts[0].t == null ? 0 : song.parts[0].t;
      Player.seek(t, song.source && song.source.page);
    }, { primary: true }));
    box.appendChild(bigBtn(2, "✓ 好，我知道了", "看看我这次听下来的记录", function () { wizard.toRecord(); }));
    dom.screen.appendChild(box);

    if (Companion.on) Companion.show("陪听提示 · 请念出答案", song.reveal, song.extend || "");
  }

  /* ---------------- S5 我的聆听 ---------------- */
  function renderRecord() {
    Companion.hide();
    var song = wizard.song();
    frame(STEP.RECORD, Guide.recordSay(song, wizard.answers));

    var key = "sid" + wizard.sid;
    if (!renderRecord.done) renderRecord.done = {};
    if (!renderRecord.done[key]) {
      renderRecord.done[key] = true;
      Records.add({ songId: song.id, title: song.title, emoji: song.emoji, answers: wizard.answers.slice() });
      Records.clearSession();
    }

    dom.screen.appendChild(head("我的聆听 · " + song.emoji + " " + song.title, "这次你听下来的，都给你留着。"));
    dom.screen.appendChild(el("div", "reveal-box", song.reveal));

    var list = el("div", "rec-list");
    song.parts.forEach(function (p, idx) {
      var row = el("div", "rec-row");
      row.appendChild(el("div", "rec-q", "第 " + (idx + 1) + " 句 · " + p.label + "：" + p.guide));
      var a = wizard.answers[idx];
      row.appendChild(el("div", "rec-a" + (a ? "" : " empty"), a ? ("你说：" + a) : "这一句你没有说，也不要紧。"));
      list.appendChild(row);
    });
    dom.screen.appendChild(list);

    var box = el("div", "btn-col");
    box.appendChild(bigBtn(1, "▶ 再听一首", "回到选曲，换一首", function () { wizard.again(); }, { primary: true }));
    box.appendChild(bigBtn(2, "🏠 回到首页", "歇一歇", function () { wizard.goHome(); }));
    dom.screen.appendChild(box);
  }

  /* ---------------- 我的聆听（历史） ---------------- */
  function openRecords() {
    var list = Records.list();
    dom.sheetTitle.textContent = list.length ? "我的聆听（共 " + list.length + " 次）" : "我的聆听";
    clear(dom.sheetBody);
    if (!list.length) {
      dom.sheetBody.appendChild(el("div", "note", "还没有记录。听第一首的时候，我会在这儿替你留一笔。"));
    } else {
      list.forEach(function (r) {
        var row = el("div", "rec");
        row.appendChild(el("div", "rec-t", r.emoji + " " + r.title));
        row.appendChild(el("div", "rec-d", Records.humanDay(r.at)));
        var answers = (r.answers || []).filter(function (a) { return a; });
        row.appendChild(el("div", "rec-a", answers.length ? "你说：" + answers.join("；") : "这次没有留下话。"));
        dom.sheetBody.appendChild(row);
      });
    }
    dom.sheet.classList.add("on");
    Voice.say(list.length ? ("一共有 " + list.length + " 次聆听记录。") : "还没有记录。");
  }
  function closeSheet() { dom.sheet.classList.remove("on"); }

  /* ---------------- 播放器坞的挂载 / 收起 ---------------- */
  function syncDock() {
    var song = wizard.song();
    var keep = (wizard.step === STEP.SEG || wizard.step === STEP.ASK || wizard.step === STEP.REVEAL);
    if (keep && song) {
      if (Player.song !== song) Player.dock(dom.dock, song);
    } else if (Player.el) {
      Player.undock();
    }
  }

  /* ---------------- 渲染分发 ---------------- */
  function render() {
    var s = wizard.step;
    if (s === STEP.ASK && lastStep !== STEP.ASK) askState = { open: false, hint: false, ack: "" };
    lastStep = s;

    syncDock();
    if (s === STEP.HOME) renderHome();
    else if (s === STEP.PICK_LEVEL) renderPickLevel();
    else if (s === STEP.PICK_SONG) renderPickSong();
    else if (s === STEP.TOOL) renderTool();
    else if (s === STEP.SEG) renderSeg();
    else if (s === STEP.ASK) renderAsk();
    else if (s === STEP.REVEAL) renderReveal();
    else if (s === STEP.RECORD) renderRecord();
    else renderHome();

    if (s === STEP.SEG || s === STEP.ASK || s === STEP.REVEAL) Records.saveSession(wizard.snapshot());
    dom.homeBtn.classList.toggle("hidden", s === STEP.HOME);
  }

  /* ---------------- 键盘全流程 ---------------- */
  function onKey(e) {
    var tag = (e.target && e.target.tagName) || "";
    var typing = tag === "INPUT" || tag === "TEXTAREA";

    if (e.key === "Escape") {
      if (dom.sheet.classList.contains("on")) closeSheet();
      else wizard.prev();
      e.preventDefault();
      return;
    }
    if (typing) return;   /* 在输入框里，交给输入框自己处理 */

    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (currentSay) { Voice.stop(); Voice.speak(currentSay); }
      return;
    }
    if (e.key === "Enter") {
      var p = dom.screen.querySelector("[data-primary]") || dom.screen.querySelector("[data-key]");
      if (p) { e.preventDefault(); p.click(); }
      return;
    }
    if (/^[1-9]$/.test(e.key)) {
      var b = dom.screen.querySelector('[data-key="' + e.key + '"]');
      if (b) { e.preventDefault(); b.click(); }
    }
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    dom.screen = document.getElementById("screen");
    dom.dock = document.getElementById("dock");
    dom.companion = document.getElementById("companion");
    dom.live = document.getElementById("live");
    dom.sheet = document.getElementById("sheet");
    dom.sheetTitle = document.getElementById("sheetTitle");
    dom.sheetBody = document.getElementById("sheetBody");
    dom.voiceBtn = document.getElementById("voiceBtn");
    dom.cpBtn = document.getElementById("cpBtn");
    dom.bigBtn = document.getElementById("bigBtn");
    dom.homeBtn = document.getElementById("homeBtn");
    dom.fsBar = document.getElementById("fsBar");

    Voice.init({ liveEl: dom.live, onBroken: markVoiceBroken });
    Companion.init({ el: dom.companion });

    wizard = new Wizard({ onChange: render });

    dom.voiceBtn.onclick = function () {
      if (Voice._broken) return;
      Voice.setEnabled(!Voice.enabled);
      setToggle(dom.voiceBtn, Voice.enabled, "🔊 朗读", "🔇 朗读关");
      if (Voice.enabled) Voice.speak("朗读开着呢。");
    };
    dom.cpBtn.onclick = function () {
      Companion.setOn(!Companion.on);
      setToggle(dom.cpBtn, Companion.on, "👥 陪听", "👥 陪听");
      pendingSay = Companion.on ? "陪听开着，屏幕会把该念的话放大。" : "陪听关了。";
      render();
    };
    dom.bigBtn.onclick = function () {
      var on = Companion.toggleBig();
      setToggle(dom.bigBtn, on, "📺 大屏", "📺 大屏");
      Voice.say(on ? "大屏模式开着，字也放大了。" : "回到平常的大小。");
    };
    dom.homeBtn.onclick = function () { wizard.goHome(); };

    Array.prototype.forEach.call(dom.fsBar.querySelectorAll("button"), function (b) {
      b.onclick = function () {
        setFont(b.getAttribute("data-fs"));
        Array.prototype.forEach.call(dom.fsBar.querySelectorAll("button"), function (x) {
          x.classList.toggle("active", x === b);
        });
      };
    });
    var savedFont = safeGet("leling-pro.font") || "2";
    setFont(savedFont);
    Array.prototype.forEach.call(dom.fsBar.querySelectorAll("button"), function (x) {
      x.classList.toggle("active", x.getAttribute("data-fs") === savedFont);
    });

    dom.sheet.addEventListener("click", function (e) { if (e.target === dom.sheet) closeSheet(); });
    var closeBtn = document.getElementById("sheetClose");
    if (closeBtn) closeBtn.onclick = closeSheet;

    document.addEventListener("keydown", onKey);

    setToggle(dom.voiceBtn, Voice.enabled, "🔊 朗读", "🔇 朗读关");
    if (!Voice.supported) markVoiceBroken();

    render();
  }

  function setToggle(btn, on, onText, offText) {
    btn.classList.toggle("on", !!on);
    btn.textContent = on ? onText : offText;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  function setFont(level) {
    var h = document.documentElement;
    h.classList.remove("fs-1", "fs-2", "fs-3");
    h.classList.add("fs-" + level);
    safeSet("leling-pro.font", level);
  }
  function markVoiceBroken() {
    if (!dom.voiceBtn) return;
    dom.voiceBtn.textContent = "🔇 本机无朗读";
    dom.voiceBtn.disabled = true;
    dom.voiceBtn.title = "这台设备的浏览器没有语音朗读，可以让家人照着念，或打开手机的读屏功能";
  }
  function safeGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { global.localStorage.setItem(k, v); } catch (e) { } }

  global.MZScreens = { init: init, render: render };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : this);