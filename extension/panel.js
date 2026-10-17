"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const formatSelect = $("formatSelect");
  for (const p of self.YTPROXY_PRESETS) {
    const opt = document.createElement("option");
    opt.value = p.quality;
    opt.textContent = p.label;
    formatSelect.append(opt);
  }

  let currentPreview = null;
  let previewDebounce = null;

  $("urlInput").addEventListener("input", () => {
    clearTimeout(previewDebounce);
    const val = $("urlInput").value.trim();
    if (!val.startsWith("http")) {
      $("videoPreview").style.display = "none";
      currentPreview = null;
      return;
    }
    previewDebounce = setTimeout(async () => {
      const firstUrl = val.split(/[\s,]+/)[0];
      const meta = await self.fetchYoutubeOembed(firstUrl);
      if (meta) {
        currentPreview = meta;
        $("previewThumb").src = meta.thumbnail;
        $("previewTitle").textContent = meta.title;
        $("previewAuthor").textContent = meta.author ? `ערוץ: ${meta.author}` : "";
        $("videoPreview").style.display = "flex";
      } else {
        $("videoPreview").style.display = "none";
      }
    }, 350);
  });

  $("settingsBtn").onclick = () => chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });

  $("cleanCloudBtn").onclick = async () => {
    $("hint").textContent = "מפעיל ניקוי ענן ב-GitHub...";
    const res = await chrome.runtime.sendMessage({ type: "RUN_CLEANUP" });
    $("hint").textContent = res && res.ok ? "ניקוי הענן הופעל בהצלחה!" : (res && res.error) || "שגיאה בניקוי";
  };

  $("clearJobsBtn").onclick = async () => {
    await chrome.runtime.sendMessage({ type: "CLEAR_COMPLETED_JOBS" });
    void refresh();
  };

  $("downloadBtn").onclick = async () => {
    const raw = $("urlInput").value.trim();
    if (!raw) return;
    const urls = raw.split(/[\s,]+/).filter((u) => u.startsWith("http"));
    if (!urls.length) { $("hint").textContent = "נא להזין קישור תקין המתחיל ב-http"; return; }
    const baseOpts = {
      quality: formatSelect.value,
      subtitles: $("subsSelect").value,
      clipStart: $("clipStart").value.trim(),
      clipEnd: $("clipEnd").value.trim(),
      sponsorblock: $("sponsorToggle").checked,
      title: (currentPreview && currentPreview.title) || urls[0],
      thumbnail: (currentPreview && currentPreview.thumbnail) || ""
    };
    const payload = urls.length > 1
      ? { ...baseOpts, urls, mode: "list" }
      : { ...baseOpts, url: urls[0], mode: $("collectionToggle").checked ? "collection" : "video" };

    $("hint").textContent = "מצפין עוגיות ושולח בקשה ל-GitHub Actions...";
    const res = await chrome.runtime.sendMessage({ type: "START_DOWNLOAD", payload });
    if (res && res.ok) {
      $("urlInput").value = "";
      $("videoPreview").style.display = "none";
      currentPreview = null;
      $("hint").textContent = "נשלח ל-GitHub Actions! ההורדה תישמר אוטומטית בסיום.";
      void refresh();
    } else {
      $("hint").textContent = (res && res.error) || "שגיאה בשליחה";
    }
  };

  function extractTopicsFromHistory(historyList) {
    const seen = new Set();
    const topics = [];
    for (const item of historyList || []) {
      const cleaned = String(item.title || "")
        .replace(/\[[a-zA-Z0-9_-]{11}\]/g, "")
        .replace(/\.(mp4|mp3|mkv|flac|wav|m4a)$/i, "")
        .replace(/[|•\-–—_()\[\]]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!cleaned || cleaned.length < 4) continue;
      const words = cleaned.split(" ").slice(0, 4).join(" ");
      const key = words.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        topics.push(words);
      }
      if (topics.length >= 6) break;
    }
    return topics;
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString("he-IL");
  }

  function formatDuration(sec) {
    const s = Number(sec || 0);
    if (!s) return "";
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function renderRecommendations(recState, historyList) {
    const chipsWrap = $("topicChips");
    const topics = extractTopicsFromHistory(historyList);
    chipsWrap.replaceChildren();
    if (topics.length) {
      const lbl = document.createElement("span");
      lbl.className = "small muted";
      lbl.textContent = "נושאים מההורדות האחרונות שלך:";
      lbl.style.alignSelf = "center";
      chipsWrap.append(lbl);
      for (const t of topics) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "btn small";
        chip.style.padding = "4px 10px";
        chip.textContent = t;
        chip.onclick = () => {
          $("recQueryInput").value = t;
        };
        chipsWrap.append(chip);
      }
      if (!$("recQueryInput").value) {
        $("recQueryInput").value = topics[0];
      }
    }

    const statusEl = $("recStatusText");
    statusEl.textContent = (recState && recState.detail) || "";

    const recList = $("recList");
    recList.replaceChildren();
    const items = (recState && recState.items) || [];
    for (const item of items) {
      const row = document.createElement("div");
      row.style.cssText = "background:var(--surface-2);padding:10px;border-radius:12px;border:1px solid var(--border);display:flex;gap:12px;align-items:center;";
      if (item.thumbnail) {
        const img = document.createElement("img");
        img.src = item.thumbnail;
        img.style.cssText = "width:110px;height:62px;object-fit:cover;border-radius:8px;flex-shrink:0;";
        row.append(img);
      }
      const meta = document.createElement("div");
      meta.style.cssText = "flex:1;overflow:hidden;display:flex;flex-direction:column;gap:4px;";
      const tEl = document.createElement("div");
      tEl.style.cssText = "font-weight:600;font-size:13.5px;";
      tEl.textContent = item.title;
      const subEl = document.createElement("div");
      subEl.className = "small muted";
      subEl.textContent = `${item.channel} • 👁 ${formatNumber(item.views)} צפיות ${item.duration ? "• ⏱ " + formatDuration(item.duration) : ""}`;
      meta.append(tEl, subEl);

      const dlBtn = document.createElement("button");
      dlBtn.type = "button";
      dlBtn.className = "btn btn--primary small";
      dlBtn.textContent = "⬇ הורד עכשיו";
      dlBtn.onclick = async () => {
        dlBtn.disabled = true;
        dlBtn.textContent = "שולח...";
        await chrome.runtime.sendMessage({
          type: "START_DOWNLOAD",
          payload: {
            url: item.url,
            title: item.title,
            quality: formatSelect.value,
            subtitles: $("subsSelect").value,
            sponsorblock: $("sponsorToggle").checked,
            mode: "video"
          }
        });
        dlBtn.textContent = "✓ בתור ההורדות";
        void refresh();
      };
      row.append(meta, dlBtn);
      recList.append(row);
    }
  }

  $("findRecsBtn").onclick = async () => {
    const query = $("recQueryInput").value.trim();
    if (!query) {
      $("recStatusText").textContent = "נא להקלד נושא לחיפוש (למשל: בניית בתים מעץ)";
      return;
    }
    $("recStatusText").textContent = "משגר חיפוש קשיח ל-GitHub Actions...";
    const res = await chrome.runtime.sendMessage({
      type: "START_RECOMMEND",
      payload: {
        query,
        minViews: $("recMinViewsSelect").value
      }
    });
    if (!res || !res.ok) {
      $("recStatusText").textContent = (res && res.error) || "שגיאה בהפעלת מנוע ההמלצות";
    }
  };

  function renderJobs(jobsObj) {
    const list = $("jobList");
    list.replaceChildren();
    const ids = Object.keys(jobsObj || {}).sort((a, b) => (jobsObj[b].startedAt || 0) - (jobsObj[a].startedAt || 0));
    if (!ids.length) {
      list.textContent = "אין הורדות פעילות כרגע";
      return;
    }
    for (const id of ids) {
      const j = jobsObj[id];
      const card = document.createElement("div");
      card.style.cssText = "background:var(--surface-2);padding:12px;border-radius:12px;border:1px solid var(--border);display:flex;flex-direction:column;gap:8px;";
      
      const topRow = document.createElement("div");
      topRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;";
      const title = document.createElement("div");
      title.style.fontWeight = "600";
      title.textContent = (j.files && j.files[0]) || j.title || j.url;
      const badge = document.createElement("span");
      badge.className = "small muted";
      badge.textContent = `${j.quality} • ${j.percent || 0}%`;
      topRow.append(title, badge);

      const progTrack = document.createElement("div");
      progTrack.className = "progress-track";
      const progBar = document.createElement("div");
      progBar.className = "progress-bar";
      progBar.style.width = `${j.percent || 5}%`;
      progTrack.append(progBar);

      const info = document.createElement("div");
      info.className = "small muted";
      info.textContent = j.detail || j.status;

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
      if (j.runId) {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = "צפה בריצה ב-GitHub";
        b.onclick = () => chrome.runtime.sendMessage({ type: "OPEN_RUN", jobId: j.id });
        actions.append(b);
      }
      if (j.status === "completed") {
        const b = document.createElement("button");
        b.className = "btn btn--primary";
        b.textContent = "פתח תיקיית הורדות";
        b.onclick = () => chrome.runtime.sendMessage({ type: "OPEN_DOWNLOADS" });
        actions.append(b);
      } else if (j.status !== "failed" && j.status !== "cancelled") {
        const b = document.createElement("button");
        b.className = "btn btn--danger";
        b.textContent = "בטל";
        b.onclick = () => chrome.runtime.sendMessage({ type: "CANCEL_JOB", jobId: j.id });
        actions.append(b);
      }
      card.append(topRow, progTrack, info, actions);
      list.append(card);
    }
  }

  async function refresh() {
    const prefs = await chrome.runtime.sendMessage({ type: "GET_PREFS" });
    $("conn-dot").className = "dot " + (prefs && prefs.configured ? "is-ok" : "is-fail");
    $("conn-text").textContent = prefs && prefs.configured ? `מחובר אל ${prefs.owner}/${prefs.repo}` : "לא מוגדר — לחץ על הגדרות";
    const res = await chrome.runtime.sendMessage({ type: "LIST_JOBS" });
    if (res && res.jobs) renderJobs(res.jobs);
    const recRes = await chrome.runtime.sendMessage({ type: "GET_RECOMMENDATIONS" });
    if (recRes && recRes.ok) renderRecommendations(recRes.state, recRes.history);
  }

  chrome.runtime.onMessage.addListener((m) => {
    if (m && m.type === "JOBS_CHANGED") renderJobs(m.jobs);
    if (m && m.type === "RECS_CHANGED") void refresh();
  });
  setInterval(refresh, 3000);
  void refresh();
})();
