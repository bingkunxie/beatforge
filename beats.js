/* beats.js — data access for beats & likes. window.BF.beats */
(() => {
  "use strict";
  window.BF = window.BF || {};
  const auth = window.BF.auth;
  const c = () => auth.client();

  async function uid() { return (await auth.currentUser())?.id || null; }

  const beats = {
    async save({ title, data, isPublic, remixOf = null }) {
      const user_id = await uid();
      if (!user_id) throw new Error("Not signed in");
      const row = { user_id, title, data, is_public: !!isPublic, remix_of: remixOf };
      const { data: out, error } = await c().from("beats").insert(row).select().single();
      if (error) throw error;
      return out;
    },
    async update(id, patch) {
      const { data, error } = await c().from("beats").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await c().from("beats").delete().eq("id", id);
      if (error) throw error;
    },
    async mine() {
      const user_id = await uid();
      if (!user_id) return [];
      const { data, error } = await c().from("beats")
        .select("*").eq("user_id", user_id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    async gallery({ sort = "new", limit = 50 } = {}) {
      let q = c().from("beats_with_likes").select("*").eq("is_public", true).limit(limit);
      q = sort === "popular"
        ? q.order("like_count", { ascending: false })
        : q.order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    async byId(id) {
      const { data, error } = await c().from("beats").select("*").eq("id", id).single();
      if (error) return null;
      return data;
    },
    async like(beatId) {
      const user_id = await uid();
      if (!user_id) throw new Error("Not signed in");
      const { error } = await c().from("likes").insert({ beat_id: beatId, user_id });
      if (error && error.code !== "23505") throw error; // ignore duplicate
    },
    async unlike(beatId) {
      const user_id = await uid();
      if (!user_id) return;
      const { error } = await c().from("likes").delete().eq("beat_id", beatId).eq("user_id", user_id);
      if (error) throw error;
    },
    async likedByMe(beatIds) {
      const user_id = await uid();
      if (!user_id || !beatIds.length) return new Set();
      const { data } = await c().from("likes").select("beat_id").eq("user_id", user_id).in("beat_id", beatIds);
      return new Set((data || []).map((r) => r.beat_id));
    },
  };

  window.BF.beats = beats;
})();
