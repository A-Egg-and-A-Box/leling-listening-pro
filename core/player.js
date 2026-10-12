/* ============================================================
 * 乐龄聆听计划 · 播放器
 * 把 B 站的真实录音嵌进页面里，点一下就在原地听，不用跳走。
 *
 * 为什么是嵌 B 站，而不是自己发声？
 *   听众要听到的是「真的有人拉的二胡」「真的钢琴」。
 *   用电子音合成一段相似的调子冒充，是骗人。我们不做。
 *
 * B 站播放器不给我们控制接口，所以这里的做法是——
 *   「跳到某一句」＝ 重新载入 iframe，带上 t=秒 参数；
 *   「只听这一句」＝ 起播后掐好时间，到点把 iframe 重新载入成
 *                    暂停状态，旧页面一卸载，声音就停了。
 *   全程不需要用户自己按暂停，也不会一路放到曲终。
 * ============================================================ */
(function (global) {
  "use strict";

  var PLAYER = "https://player.bilibili.com/player.html";
  var SEARCH = "https://search.bilibili.com/all?keyword=";
  var WATCH = "https://www.bilibili.com/video/";

  var P = {
    el: null,        /* 播放器坞所在容器 */
    song: null,
    iframe: null,
    at: 0,           /* 当前跳到了第几秒 */
    page: 1,         /* 分 P */
    timer: null,

    /* ---------- 把播放器挂到页面顶部的坞里 ---------- */
    dock: function (container, song) {
      this.stop();
      this.el = container;
      this.song = song || null;
      this.at = 0;
      this.page = (song && song.source && song.source.page) || 1;
      this.iframe = null;
      if (!container) return;
      container.innerHTML = "";
      container.classList.remove("min");
      container.classList.add("on");
      if (song && song.source && song.source.bvid) {
        container.appendChild(this._card(song));
      } else {
        container.appendChild(this._fallback(song));
      }
    },

    undock: function () {
      this.stop();
      if (this.el) {
        this.el.innerHTML = "";
        this.el.classList.remove("on", "min");
      }
      this.el = null;
      this.song = null;
      this.iframe = null;
      this.at = 0;
      this.page = 1;
    },

    /* ---------- 拼一个播放地址 ---------- */
    src: function (bvid, sec, autoplay, page) {
      var url = PLAYER + "?bvid=" + bvid + "&high_quality=1&danmaku=0" +
        "&autoplay=" + (autoplay ? 1 : 0);
      if (page && page > 1) url += "&p=" + page;
      if (sec) url += "&t=" + sec;
      return url;
    },

    /* ---------- 「只听这一句」 ----------
     * 从 sec 秒起播，听 dur 秒，到时候自动停。
     * 停的办法：把 iframe 重新载入成 autoplay=0 停在句尾 —— 旧页面一卸载，
     * 声音立刻断掉。计时是从「iframe 重新载入」那一刻起算的，所以网络慢时
     * 句尾会有一点点偏差，文案里我们统一只说「约 N 秒」。 */
    play: function (sec, dur, page, onEnd) {
      if (!this.iframe || !this.song || !this.song.source || !this.song.source.bvid) return false;
      this.stop();
      this.at = Math.max(0, Math.floor(sec) || 0);
      var d = Math.max(4, Math.floor(dur) || 30);
      if (page) this.page = page;
      this.iframe.src = this.src(this.song.source.bvid, this.at, true, this.page);
      var self = this;
      this.timer = setTimeout(function () {
        self.timer = null;
        /* 停在句尾：重载成不自动播放 */
        self.iframe.src = self.src(self.song.source.bvid, self.at + d, false, self.page);
        if (typeof onEnd === "function") onEnd(d);
      }, d * 1000);
      return true;
    },

    /* 自由地听：跳到第 sec 秒，然后一直放下去 */
    seek: function (sec, page) {
      if (!this.iframe || !this.song || !this.song.source || !this.song.source.bvid) return false;
      this.stop();
      this.at = Math.max(0, Math.floor(sec) || 0);
      if (page) this.page = page;
      this.iframe.src = this.src(this.song.source.bvid, this.at, true, this.page);
      return true;
    },

    /* 停掉「只听这一句」的计时器（不卸载 iframe） */
    stop: function () {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    },

    current: function () { return this.at; },

    /* ---------- 渲染：正常播放卡片 ---------- */
    _card: function (song) {
      var self = this;

      var card = el("div", "pl-card");

      var box = el("div", "pl-frame");
      var f = document.createElement("iframe");
      f.setAttribute("scrolling", "no");
      f.setAttribute("frameborder", "0");
      f.setAttribute("allowfullscreen", "true");
      f.setAttribute("loading", "lazy");
      /* allow 里必须有 autoplay：手机浏览器靠它才肯出声 */
      f.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
      f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-presentation");
      f.src = this.src(song.source.bvid, 0, false, this.page);
      f.title = (song.source.title || song.title) + " 的播放器";
      box.appendChild(f);
      card.appendChild(box);
      this.iframe = f;

      var bar = el("div", "pl-bar");
      bar.appendChild(el("span", "pl-title", "🎧 " + (song.source.title || song.title)));

      var open = document.createElement("a");
      open.className = "pl-link";
      open.href = WATCH + song.source.bvid + (this.page > 1 ? "?p=" + this.page : "");
      open.target = "_blank";
      open.rel = "noopener";
      open.textContent = "新窗口打开 ↗";
      bar.appendChild(open);

      var fold = el("button", "pl-fold", "收起");
      fold.type = "button";
      fold.onclick = function () {
        var min = self.el.classList.toggle("min");
        fold.textContent = min ? "展开" : "收起";
      };
      bar.appendChild(fold);
      card.appendChild(bar);

      /* 手动微调：万一自动跳的落点不对，老人（或家人）可以自己填个时间 */
      var det = document.createElement("details");
      det.className = "pl-tune";
      var sum = document.createElement("summary");
      sum.textContent = "这一段不对？自己填个时间";
      det.appendChild(sum);
      var line = el("div", "pl-tune-line");
      line.appendChild(el("span", "pl-lb", "跳到"));
      var mi = el("input", "pl-in");
      mi.type = "text"; mi.placeholder = "分"; mi.setAttribute("inputmode", "numeric");
      var si = el("input", "pl-in");
      si.type = "text"; si.placeholder = "秒"; si.setAttribute("inputmode", "numeric");
      line.appendChild(mi);
      line.appendChild(el("span", "pl-colon", "："));
      line.appendChild(si);
      var go = el("button", "pl-go", "跳过去听");
      go.type = "button";
      go.onclick = function () {
        var m = parseInt(mi.value || "0", 10) || 0;
        var s = parseInt(si.value || "0", 10) || 0;
        self.seek(m * 60 + s);
      };
      line.appendChild(go);
      det.appendChild(line);
      card.appendChild(det);

      return card;
    },

    /* ---------- 渲染：曲库里没有录音时的兜底 ---------- */
    _fallback: function (song) {
      var card = el("div", "pl-card pl-fallback");
      var q = (song && (song.searchTerm || song.title)) || "";
      card.appendChild(el("div", "pl-fb-line",
        q ? "🔍 曲库里没有《" + q + "》的录音，先去 B 站找一段来听：" : "🔍 先去 B 站找一段来听："));

      var a = document.createElement("a");
      a.className = "pl-link strong";
      a.href = SEARCH + encodeURIComponent(q || "音乐");
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "🎬 去 B 站搜这首歌";
      card.appendChild(a);

      card.appendChild(el("div", "pl-fb-tip",
        "找到以后，把页面地址栏里的「BV 号」复制下来，回到「帮我搜一首」里粘上，就能在这里直接听。"));
      return card;
    }
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  global.MZPlayer = P;
})(typeof window !== "undefined" ? window : this);