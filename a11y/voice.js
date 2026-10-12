/* ============================================================
 * 乐龄聆听计划 · 朗读（语音）
 * 用浏览器自带的语音合成，离线可用，不联网。
 *
 * 手机上有两个坑，都在这里填平：
 *   1) iOS 和一部分安卓浏览器要求「本页的第一次朗读，必须由用户
 *      亲手点出来」。所以我们借用户的第一次点击，悄悄播一条不出声的
 *      空话，把语音解锁；不然整页一声都不响。
 *   2) 中文语音包是浏览器慢慢加载进来的。要是不挑一下嗓音，常常会
 *      拿英文的嗓去念中文，听起来像哑了。所以监听 voiceschanged，
 *      一有好嗓子就用中文的。
 * 如果这台设备确实没有朗读能力，不再假装能读，直接告诉用户还能怎么办。
 * ============================================================ */
(function (global) {
  "use strict";

  var synth = (typeof window !== "undefined" && "speechSynthesis" in window)
    ? window.speechSynthesis : null;

  var V = {
    supported: !!synth,
    enabled: true,      /* 用户的「朗读」开关 */
    unlocked: false,
    _broken: false,
    zhVoice: null,
    liveEl: null,
    onBroken: null,

    init: function (opts) {
      opts = opts || {};
      this.liveEl = opts.liveEl || null;
      this.onBroken = opts.onBroken || null;
      if (!synth) { this.broken(); return; }
      this.pick();
      if (synth.addEventListener) synth.addEventListener("voiceschanged", this.pick.bind(this));
      else synth.onvoiceschanged = this.pick.bind(this);
      this.bindUnlock();
    },

    pick: function () {
      if (!synth || !synth.getVoices) return;
      var vs = synth.getVoices();
      if (!vs || !vs.length) return;
      var i;
      for (i = 0; i < vs.length; i++) {
        var l = String(vs[i].lang || "").toLowerCase();
        if (l.indexOf("zh") === 0 || l.indexOf("cmn") === 0) { this.zhVoice = vs[i]; return; }
      }
      for (i = 0; i < vs.length; i++) {
        if (/chinese|mandarin|中文|普通话/i.test(vs[i].name || "")) { this.zhVoice = vs[i]; return; }
      }
    },

    /* 借用户第一次的点击/按键，把语音解锁 */
    bindUnlock: function () {
      if (!synth || this.unlocked) return;
      var self = this;
      var events = ["pointerdown", "touchstart", "click", "keydown"];
      function unlock() {
        if (self.unlocked) return;
        self.unlocked = true;
        var i;
        for (i = 0; i < events.length; i++) document.removeEventListener(events[i], unlock, true);
        try {
          var u = new SpeechSynthesisUtterance("　");
          u.volume = 0;
          u.lang = "zh-CN";
          synth.speak(u);
        } catch (e) { /* 解锁失败也不影响后续手动点「读给我听」 */ }
        self.pick();
      }
      var i;
      for (i = 0; i < events.length; i++) document.addEventListener(events[i], unlock, true);
    },

    /* ---------- 念一段话 ---------- */
    speak: function (text) {
      text = (text || "").trim();
      if (!text) return;
      if (!synth) { this.broken(); return; }
      if (!this.enabled) return;
      this.pick();
      try {
        synth.cancel();
        var u = new SpeechSynthesisUtterance(text);
        if (this.zhVoice) u.voice = this.zhVoice;
        u.lang = (this.zhVoice && this.zhVoice.lang) || "zh-CN";
        u.rate = 0.86;
        u.pitch = 1;
        synth.speak(u);
      } catch (e) { this.broken(); }
    },

    stop: function () {
      try { if (synth) synth.cancel(); } catch (e) { }
    },

    setEnabled: function (on) {
      if (on && this._broken) return;
      this.enabled = !!on;
      if (!on) this.stop();
    },

    /* ---------- 读屏播报区（无论朗读开关，都更新） ---------- */
    announce: function (text) {
      if (!this.liveEl) return;
      this.liveEl.textContent = "";
      var t = text || "";
      /* 稍等一下再写，保证连续两屏文字相同时也被读出来 */
      setTimeout(function () { if (V.liveEl) V.liveEl.textContent = t; }, 30);
    },

    /* 说一句 + 播报一句（多数屏都用这个） */
    say: function (text) {
      this.announce(text);
      if (this.enabled) this.speak(text);
    },

    broken: function () {
      if (this._broken) return;
      this._broken = true;
      this.enabled = false;
      if (this.onBroken) this.onBroken();
    }
  };

  global.MZVoice = V;
})(typeof window !== "undefined" ? window : this);