/* serialize.js — pure pattern/share helpers. UMD: browser + Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.BF = root.BF || {}; root.BF.serialize = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function toBeatData(tracks, settings) {
    return {
      steps: settings.steps,
      bpm: settings.bpm,
      swing: settings.swing,
      kit: settings.kit,
      tracks: clone(tracks),
    };
  }

  function fromBeatData(data) {
    return {
      tracks: clone(data.tracks),
      settings: { steps: data.steps, bpm: data.bpm, swing: data.swing, kit: data.kit },
    };
  }

  // base64 of JSON, URL-safe. Browser uses btoa/atob; Node uses Buffer.
  function b64encode(s) {
    if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(s)));
    return Buffer.from(s, "utf8").toString("base64");
  }
  function b64decode(s) {
    if (typeof atob === "function") return decodeURIComponent(escape(atob(s)));
    return Buffer.from(s, "base64").toString("utf8");
  }

  function encodeShare(data) {
    return b64encode(JSON.stringify(data)).replace(/\+/g, "-").replace(/\//g, "_");
  }
  function decodeShare(str) {
    try {
      const b = str.replace(/-/g, "+").replace(/_/g, "/");
      const obj = JSON.parse(b64decode(b));
      if (!obj || typeof obj !== "object" || !obj.tracks) return null;
      return obj;
    } catch { return null; }
  }

  return { toBeatData, fromBeatData, encodeShare, decodeShare };
});
