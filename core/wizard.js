/* ============================================================
 * 乐龄聆听计划 · 向导状态机
 * 只管「现在是哪一屏、下一步去哪」，一点 DOM 都不碰。
 *
 * 一屏一步，走完一遍是：
 *   HOME 首页
 *     → PICK_LEVEL 选难度
 *     → PICK_SONG  选曲目
 *     → SEG(0) 听第一句 → ASK(0) 聊第一句
 *     → SEG(1) 听第二句 → ASK(1) 聊第二句
 *     → SEG(2) 听第三句 → ASK(2) 聊第三句
 *     → REVEAL 揭晓
 *     → RECORD 我的聆听
 * 每一句都是「先听，再说」，不把结论提前抖出来。
 * ============================================================ */
(function (global) {
  "use strict";

  var Catalog = global.MZCatalog;

  var STEP = {
    HOME: "HOME",
    PICK_LEVEL: "PICK_LEVEL",
    PICK_SONG: "PICK_SONG",
    SEG: "SEG",
    ASK: "ASK",
    REVEAL: "REVEAL",
    RECORD: "RECORD",
    TOOL: "TOOL"
  };

  function Wizard(opts) {
    opts = opts || {};
    this.onChange = opts.onChange || function () { };
    this.custom = null;   /* 「帮我搜一首」时临时拼出来的曲子 */
    this.sid = 0;         /* 每一次「开始听一首」的编号，用来防重复记流水 */
    this.reset();
  }

  Wizard.prototype.reset = function () {
    this.step = STEP.HOME;
    this.level = null;
    this.songId = null;
    this.i = 0;
    this.answers = [];
    this.acked = false;
    this._ackSeq = 0;
  };

  /* ---------- 读 ---------- */
  Wizard.prototype.song = function () {
    if (this.songId === "__custom__") return this.custom;
    return Catalog.byId(this.songId);
  };

  Wizard.prototype.partCount = function () {
    var s = this.song();
    return s && s.parts ? s.parts.length : 0;
  };

  Wizard.prototype.isLastPart = function () { return this.i >= this.partCount() - 1; };

  Wizard.prototype._changed = function () { this.onChange(this.step); };

  /* ---------- 走 ---------- */
  Wizard.prototype.start = function () {
    this.reset();
    this.step = STEP.PICK_LEVEL;
    this._changed();
  };

  Wizard.prototype.goHome = function () {
    this.step = STEP.HOME;
    this._changed();
  };

  Wizard.prototype.openTool = function () {
    this.step = STEP.TOOL;
    this._changed();
  };

  Wizard.prototype.pickLevel = function (level) {
    this.level = level;
    this.step = STEP.PICK_SONG;
    this._changed();
  };

  Wizard.prototype.pickSong = function (id) {
    this.songId = id;
    this.custom = (id === "__custom__") ? this.custom : null;
    this.i = 0;
    this.answers = [];
    this.acked = false;
    this._ackSeq = 0;
    this.sid += 1;
    this.step = STEP.SEG;
    this._changed();
  };

  /* 「帮我搜一首」：把用户粘贴的 BV 号拼成一首可以陪听的曲子 */
  Wizard.prototype.startCustom = function (bvid, title) {
    var base = Catalog.generic;
    this.custom = {
      id: "__custom__",
      title: title || base.title,
      composer: "",
      era: base.era,
      level: base.level,
      emoji: base.emoji,
      hue: base.hue,
      intro: base.intro,
      source: { bvid: bvid, title: title || ("B 站视频 " + bvid), page: 1 },
      parts: base.parts.map(function (p) { return { label: p.label, t: null, dur: p.dur, guide: p.guide, hint: p.hint }; }),
      reveal: base.reveal,
      extend: base.extend
    };
    this.pickSong("__custom__");
  };

  /* SEG(i) 「听完了」→ 进入 ASK(i) */
  Wizard.prototype.segDone = function () {
    this.step = STEP.ASK;
    this._changed();
  };

  /* ASK(i) 记下这一句的回答；返回系统的一句回应 */
  Wizard.prototype.setAnswer = function (text) {
    this.answers[this.i] = (text || "").trim();
    var ack = global.MZGuide.ack(this._ackSeq++);
    return ack;
  };

  /* ASK(i) 「说完了」→ 下一句，或去揭晓 */
  Wizard.prototype.askDone = function () {
    if (this.isLastPart()) {
      this.step = STEP.REVEAL;
    } else {
      this.i += 1;
      this.step = STEP.SEG;
    }
    this._changed();
  };

  /* ASK(i) 「跳过这句」→ 同样前进，只是不留回答 */
  Wizard.prototype.skip = function () {
    this.answers[this.i] = "";
    this.askDone();
  };

  Wizard.prototype.toRecord = function () {
    this.step = STEP.RECORD;
    this._changed();
  };

  /* 再听一首：回到选曲，保留难度 */
  Wizard.prototype.again = function () {
    this.songId = null;
    this.i = 0;
    this.answers = [];
    this.step = this.level ? STEP.PICK_SONG : STEP.PICK_LEVEL;
    this._changed();
  };

  /* ---------- 上一步 ---------- */
  Wizard.prototype.prev = function () {
    if (this.step === STEP.PICK_LEVEL) { this.step = STEP.HOME; }
    else if (this.step === STEP.PICK_SONG) { this.step = STEP.PICK_LEVEL; }
    else if (this.step === STEP.TOOL) { this.step = STEP.PICK_LEVEL; }
    else if (this.step === STEP.SEG) {
      this.step = this.i > 0 ? STEP.ASK : STEP.PICK_SONG;
      if (this.i > 0) this.i -= 1;
    } else if (this.step === STEP.ASK) {
      this.step = STEP.SEG;
    } else if (this.step === STEP.REVEAL) {
      this.step = STEP.ASK;
    } else if (this.step === STEP.RECORD) {
      this.step = STEP.REVEAL;
    }
    this._changed();
  };

  /* ---------- 存 / 续 ---------- */
  Wizard.prototype.snapshot = function () {
    return {
      step: this.step === STEP.RECORD ? STEP.REVEAL : this.step,
      level: this.level,
      songId: this.songId,
      i: this.i,
      answers: this.answers.slice()
    };
  };

  Wizard.prototype.restore = function (snap) {
    if (!snap || !snap.songId) return false;
    this.level = snap.level || null;
    this.songId = snap.songId;
    this.custom = null;
    if (this.songId === "__custom__") return false;
    if (!Catalog.byId(this.songId)) return false;
    this.i = Math.min(snap.i || 0, Math.max(0, this.partCount() - 1));
    this.answers = (snap.answers || []).slice();
    this.step = (snap.step === STEP.ASK || snap.step === STEP.SEG) ? snap.step : STEP.SEG;
    this._changed();
    return true;
  };

  global.MZWizard = Wizard;
  global.MZStep = STEP;
})(typeof window !== "undefined" ? window : this);