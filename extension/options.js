"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const FIELDS = ["owner", "repo", "workflow", "ref", "token", "cookieKey", "updateOwner", "updateRepo"];
  async function load() {
    const cfg = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
    if (!cfg) return;
    for (const f of FIELDS) $(f).value = cfg[f] || "";
  }
  $("genKeyBtn").onclick = () => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    $("cookieKey").value = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
    $("msg").textContent = "נוצר מפתח COOKIE_KEY חדש! העתק אותו גם ל-GitHub Secrets במאגר שלך.";
  };
  $("save").onclick = async () => {
    const patch = {};
    for (const f of FIELDS) patch[f] = $(f).value.trim();
    await chrome.runtime.sendMessage({ type: "SET_CONFIG", patch });
    $("msg").textContent = "ההגדרות נשמרו בהצלחה!";
  };
  $("reset").onclick = async () => {
    await chrome.runtime.sendMessage({ type: "RESET_CONFIG" });
    await load();
    $("msg").textContent = "אופס לברירת המחדל";
  };
  $("recheck").onclick = async () => {
    $("conn-text").textContent = "בודק חיבור מול GitHub API...";
    const res = await chrome.runtime.sendMessage({ type: "TEST_CONNECTION" });
    $("conn-dot").className = "dot " + (res && res.ok ? "is-ok" : "is-fail");
    $("conn-text").textContent = res && res.ok ? `מחובר בהצלחה: ${res.detail}` : (res && res.error) || "החיבור נכשל";
  };
  $("selfUpdateBtn").onclick = async () => {
    $("msg").textContent = "מפעיל עדכון מהמאגר...";
    const res = await chrome.runtime.sendMessage({ type: "TRIGGER_SELF_UPDATE" });
    $("msg").textContent = res && res.ok ? "התוסף עודכן בהצלחה!" : (res && res.error) || "שגיאה בעדכון";
  };
  void load();
})();