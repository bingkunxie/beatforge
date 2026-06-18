const test = require("node:test");
const assert = require("node:assert");
const S = require("../serialize.js");

const sampleBank = {
  kick:  { steps: [true, false, false, false], vol: 0.85, mute: false },
  snare: { steps: [false, false, true, false], vol: 0.7,  mute: true  },
};
const sampleSettings = { steps: 4, bpm: 128, swing: 10, kit: "tr808" };

test("toBeatData bundles settings + tracks", () => {
  const d = S.toBeatData(sampleBank, sampleSettings);
  assert.strictEqual(d.bpm, 128);
  assert.strictEqual(d.steps, 4);
  assert.strictEqual(d.kit, "tr808");
  assert.deepStrictEqual(d.tracks.kick.steps, [true, false, false, false]);
});

test("toBeatData deep-copies (no shared refs)", () => {
  const d = S.toBeatData(sampleBank, sampleSettings);
  d.tracks.kick.steps[0] = false;
  assert.strictEqual(sampleBank.kick.steps[0], true);
});

test("fromBeatData splits back into {tracks, settings}", () => {
  const d = S.toBeatData(sampleBank, sampleSettings);
  const { tracks, settings } = S.fromBeatData(d);
  assert.deepStrictEqual(settings, sampleSettings);
  assert.deepStrictEqual(tracks.snare.steps, [false, false, true, false]);
});

test("fromBeatData deep-copies (no shared refs)", () => {
  const d = S.toBeatData(sampleBank, sampleSettings);
  const { tracks } = S.fromBeatData(d);
  tracks.kick.steps[0] = false;
  assert.strictEqual(d.tracks.kick.steps[0], true);
});
