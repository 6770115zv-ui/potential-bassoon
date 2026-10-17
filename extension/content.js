"use strict";
(() => {
  function inject() {
    if (location.pathname !== "/watch") return;
    if (document.querySelector(".ytproxy-bar")) return;
    const bar = document.querySelector("ytd-watch-metadata #top-level-buttons-computed") || document.querySelector("#top-level-buttons-computed");
    if (!bar) return;

    const wrap = document.createElement("div");
    wrap.className = "ytproxy-bar";

    const sel = document.createElement("select");
    sel.className = "ytproxy-select";
    for (const p of (self.YTPROXY_PRESETS || [{ quality: "best", label: "Best" }])) {
      const opt = document.createElement("option");
      opt.value = p.quality;
      opt.textContent = p.label;
      sel.appendChild(opt);
    }

    const btn = document.createElement("button");
    btn.className = "ytproxy-btn";
    btn.textContent = "⬇ הורד בענן";
    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = "שולח ל-GitHub...";
      const res = await chrome.runtime.sendMessage({
        type: "START_DOWNLOAD",
        payload: {
          url: location.href,
          title: document.title.replace(/\s*-\s*YouTube$/i, ""),
          quality: sel.value,
          mode: "video"
        }
      }).catch(() => null);
      btn.textContent = res && res.ok ? "✓ נשלח להורדה!" : "✕ שגיאה";
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "⬇ הורד בענן";
      }, 2800);
    };

    wrap.append(sel, btn);
    bar.appendChild(wrap);
  }
  setInterval(inject, 2000);
})();