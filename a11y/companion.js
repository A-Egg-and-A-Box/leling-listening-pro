/* ============================================================
 * 乐龄聆听计划 · 陪听提示 / 大屏模式
 *
 * 陪听模式：给旁边帮忙的人（子女、志愿者）看的。把「这一屏该念给他听的
 *           那句话」整屏放大，照着念就行，不用重新组织语言。
 * 大屏模式：给活动室、日间照料中心的大电视/投影用的。字更大、留白更多、
 *           顶栏收起来，坐在三四米外也看得见。
 * ============================================================ */
(function (global) {
  "use strict";

  var C = {
    on: false,
    big: false,
    el: null,

    init: function (opts) {
      opts = opts || {};
      this.el = opts.el || null;
    },

    setOn: function (on) {
      this.on = !!on;
      if (!this.on && this.el) this.el.classList.remove("on");
    },

    /* 把当前这一屏该说的话摆到提示条上 */
    show: function (title, question, hint) {
      if (!this.el) return;
      this.el.innerHTML = "";
      var t = document.createElement("div"); t.className = "cp-t"; t.textContent = title || "陪听提示";
      this.el.appendChild(t);
      var q = document.createElement("div"); q.className = "cp-q"; q.textContent = question || "";
      this.el.appendChild(q);
      if (hint) {
        var h = document.createElement("div"); h.className = "cp-h"; h.textContent = hint;
        this.el.appendChild(h);
      }
      if (this.on) this.el.classList.add("on");
    },

    hide: function () {
      if (this.el) this.el.classList.remove("on");
    },

    /* ---------- 大屏模式 ---------- */
    setBig: function (on) {
      this.big = !!on;
      var root = document.documentElement;
      if (this.big) root.classList.add("big");
      else root.classList.remove("big");
    },

    toggleBig: function () {
      this.setBig(!this.big);
      return this.big;
    }
  };

  global.MZCompanion = C;
})(typeof window !== "undefined" ? window : this);