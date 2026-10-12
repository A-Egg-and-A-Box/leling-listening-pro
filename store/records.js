/* ============================================================
 * 乐龄聆听计划 · 我的聆听（本地记录）
 * 记录只存在这台设备上，不上传、不联网。
 * 用的是本产品自己的存储空间（leling-pro.* 开头），
 * 跟「音乐作品助手」那边完全分开，互不打扰。
 * ============================================================ */
(function (global) {
  "use strict";

  var KEY_LIST = "leling-pro.records.v1";
  var KEY_SESSION = "leling-pro.session.v1";
  var MAX = 50;

  function read(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { global.localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  var R = {
    /* ---------- 记录列表 ---------- */
    list: function () {
      var arr = read(KEY_LIST, []);
      return Array.isArray(arr) ? arr : [];
    },

    add: function (rec) {
      var arr = this.list();
      arr.unshift({
        id: "r" + Date.now(),
        songId: rec.songId || "",
        title: rec.title || "",
        emoji: rec.emoji || "🎵",
        at: new Date().toISOString(),
        answers: rec.answers || []
      });
      if (arr.length > MAX) arr = arr.slice(0, MAX);
      write(KEY_LIST, arr);
      return arr[0];
    },

    count: function () { return this.list().length; },

    clear: function () { write(KEY_LIST, []); },

    /* ---------- 上次听到哪儿（用于「继续上次」） ---------- */
    saveSession: function (snap) {
      if (!snap || !snap.songId) return;
      snap.savedAt = Date.now();
      write(KEY_SESSION, snap);
    },
    lastSession: function () {
      var s = read(KEY_SESSION, null);
      return (s && s.songId) ? s : null;
    },
    clearSession: function () { write(KEY_SESSION, null); },

    /* 把 ISO 时间说成老人听得懂的「今天 / 昨天 / 几月几号」 */
    humanDay: function (iso) {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      var now = new Date();
      var day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
      var diff = Math.round((day(now) - day(d)) / 86400000);
      if (diff <= 0) return "今天";
      if (diff === 1) return "昨天";
      if (diff < 7) return diff + " 天前";
      return (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
    }
  };

  global.MZRecords = R;
})(typeof window !== "undefined" ? window : this);