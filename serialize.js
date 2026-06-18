/* serialize.js — pure pattern (de)serialization helpers. UMD: browser + Node. */
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

  return { toBeatData, fromBeatData };
});
