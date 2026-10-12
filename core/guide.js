/* ============================================================
 * 乐龄聆听计划 · 引导脚本（全部内置，离线可用）
 *
 * 立场：先让人听，再让人说，最后才给结论。
 * 所以这里准备了「怎么说」的每一句话，但唯独不准备「答案」——
 * 答案只写在每首曲子的 reveal 里，只在最后一屏揭晓。
 *
 * 运行时不联网、不接大模型：老人这里要的是稳，不是花。
 * 文案都按「说给耳朵听」来写，短句、口语，方便朗读也方便家人照念。
 * ============================================================ */
(function (global) {
  "use strict";

  var ACK = [
    "嗯，你听到的这个点很重要。",
    "有意思。你注意到的地方，很多人都会漏掉。",
    "谢谢你说出来，这已经是听得很细了。",
    "对，就是这个感觉。",
    "你的耳朵挺灵的。",
    "好，我记下了。"
  ];

  var LEVEL_BLURB = {
    "入门": "一开始，我们挑几首你一听就觉得耳熟的。",
    "进阶": "这几首稍微要听两遍才听得出味道。",
    "欣赏": "这几首名曲，多听几遍，才慢慢听得出好处。"
  };

  function mmss(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  var Guide = {
    ACK: ACK,
    mmss: mmss,

    /* 把「1:20」或「80」这类的输入，转成秒；认不出返回 null */
    parseMMSS: function (v) {
      v = (v || "").trim();
      if (!v) return null;
      var m = v.match(/^(\d+)\s*[:：]\s*(\d{1,2})$/);
      if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      if (/^\d{1,5}$/.test(v)) return parseInt(v, 10);
      return null;
    },

    /* 从 B 站链接或纯 BV 号里，把 bvid 抠出来 */
    parseBvid: function (text) {
      var m = String(text || "").match(/BV[0-9A-Za-z]{10}/);
      return m ? m[0] : null;
    },

    ack: function (seq) {
      return ACK[seq % ACK.length];
    },

    levelBlurb: function (level) { return LEVEL_BLURB[level] || ""; },

    /* ---------- S1 选曲 ---------- */
    pickLevelSay: function () {
      return "想从哪一档开始？听不惯就退回来换，不要紧。";
    },
    pickSongSay: function (level) {
      return (LEVEL_BLURB[level] || "") + "选一首，我陪你听。";
    },

    /* ---------- S2 分段聆听 ---------- */
    segSay: function (song, i) {
      var p = song.parts[i];
      var total = song.parts.length;
      return "我们来听" + song.title + "的「" + p.label + "」，这是第 " + (i + 1) + " 句，一共 " + total + " 句。" +
        "点一下按钮，它就开始放。";
    },
    segTip: function (song, i) {
      var p = song.parts[i];
      var d = Math.max(4, Math.round(p.dur || 30));
      return "这一段大约 " + d + " 秒。听完了，它会自己停下来，不用你管。";
    },
    segLead: function (song, i) {
      return "第 " + (i + 1) + " 句 · " + song.parts[i].label;
    },

    /* ---------- S3 引导提问 ---------- */
    ask: function (song, i) {
      var p = song.parts[i];
      return { question: p.guide, hint: p.hint };
    },
    askSay: function (song, i) {
      return "听完了。我想问你一句：" + song.parts[i].guide +
        " 你心里怎么想，就说出来；答不上来也没关系，可以让我给点提示，也可以先跳过去。";
    },

    /* ---------- S4 揭晓（只有这一屏给结论） ---------- */
    revealSay: function (song) {
      return "现在我告诉你，刚才听的是什么。" + song.reveal;
    },

    /* ---------- S5 我的聆听 ---------- */
    recordSay: function (song, answers) {
      var n = 0;
      for (var i = 0; i < answers.length; i++) if (answers[i]) n++;
      var s = "这一段就听完了。";
      if (n > 0) s += "你一共说出了 " + n + " 个想法，都给你记下来了。";
      else s += "这次你没有说话，也没关系，听到了就好。";
      return s;
    },

    /* ---------- 首页 / 工具屏 ---------- */
    homeSay: function () {
      return "欢迎来到乐龄聆听计划。按第一个按钮，我们从第一首开始听。";
    },
    toolSay: function () {
      return "想听曲库以外的一首歌？我告诉你怎么把它找出来，然后我陪你听。";
    }
  };

  global.MZGuide = Guide;
})(typeof window !== "undefined" ? window : this);