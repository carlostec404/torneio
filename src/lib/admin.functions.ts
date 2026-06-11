import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const approveTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("teams")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.teamId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("teams")
      .update({ status: "rejected" })
      .eq("id", data.teamId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getComprovanteSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("comprovantes")
      .createSignedUrl(data.path, 60 * 10);
    if (error || !signed) throw new Error(error?.message ?? "Falha ao gerar URL");
    return { url: signed.signedUrl };
  });

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return { admins: [] as { id: string; email: string }[] };
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .in("id", ids);
    return { admins: (profiles ?? []) as { id: string; email: string }[] };
  });

export const addAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email().max(255) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email.toLowerCase())
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile)
      throw new Error("Usuário não encontrado. Peça que ele crie conta primeiro.");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: profile.id, role: "admin" });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const removeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId)
      throw new Error("Você não pode remover seu próprio acesso de admin.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Bracket generation — single elimination with seeds
export const generateBracket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ seeds: z.array(z.string().uuid()).min(2).max(64) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clear existing matches
    await supabaseAdmin.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const seeds = data.seeds; // ordered 1..n (cabeças de chave primeiro)
    const n = seeds.length;
    // bracket size = next power of 2
    let size = 1;
    while (size < n) size *= 2;

    // Standard seed pairing for single elimination
    // positions in round 1: build via recursive seed pattern
    const buildSeedOrder = (s: number): number[] => {
      let order = [1, 2];
      let round = 2;
      while (round < s) {
        round *= 2;
        const newOrder: number[] = [];
        for (const seed of order) {
          newOrder.push(seed);
          newOrder.push(round + 1 - seed);
        }
        order = newOrder;
      }
      return order;
    };
    const seedOrder = buildSeedOrder(size); // length = size

    // round 1 matches
    const matches: {
      round: number;
      position: number;
      team_a_id: string | null;
      team_b_id: string | null;
    }[] = [];
    const totalRounds = Math.log2(size);
    const round1Count = size / 2;
    for (let i = 0; i < round1Count; i++) {
      const aSeed = seedOrder[i * 2];
      const bSeed = seedOrder[i * 2 + 1];
      const a = aSeed <= n ? seeds[aSeed - 1] : null;
      const b = bSeed <= n ? seeds[bSeed - 1] : null;
      matches.push({ round: 1, position: i + 1, team_a_id: a, team_b_id: b });
    }
    // Empty further rounds (to be filled as winners advance)
    for (let r = 2; r <= totalRounds; r++) {
      const count = size / Math.pow(2, r);
      for (let p = 1; p <= count; p++) {
        matches.push({ round: r, position: p, team_a_id: null, team_b_id: null });
      }
    }

    const { error } = await supabaseAdmin.from("matches").insert(matches);
    if (error) throw new Error(error.message);

    // Auto-advance byes (matches with only one team)
    const { data: round1 } = await supabaseAdmin
      .from("matches")
      .select("id, position, team_a_id, team_b_id")
      .eq("round", 1);
    for (const m of round1 ?? []) {
      if (m.team_a_id && !m.team_b_id) {
        await advanceWinner(supabaseAdmin, m.id, m.team_a_id);
      } else if (!m.team_a_id && m.team_b_id) {
        await advanceWinner(supabaseAdmin, m.id, m.team_b_id);
      }
    }

    return { ok: true, rounds: totalRounds, size };
  });

async function advanceWinner(supabaseAdmin: any, matchId: string, winnerId: string) {
  const { data: m } = await supabaseAdmin
    .from("matches")
    .select("round, position")
    .eq("id", matchId)
    .single();
  if (!m) return;
  await supabaseAdmin.from("matches").update({ winner_id: winnerId }).eq("id", matchId);
  const nextRound = m.round + 1;
  const nextPos = Math.ceil(m.position / 2);
  const { data: next } = await supabaseAdmin
    .from("matches")
    .select("id, team_a_id, team_b_id")
    .eq("round", nextRound)
    .eq("position", nextPos)
    .maybeSingle();
  if (!next) return;
  const slot = m.position % 2 === 1 ? "team_a_id" : "team_b_id";
  await supabaseAdmin
    .from("matches")
    .update({ [slot]: winnerId })
    .eq("id", next.id);
}

export const setMatchWinner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ matchId: z.string().uuid(), winnerId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await advanceWinner(supabaseAdmin, data.matchId, data.winnerId);
    return { ok: true };
  });
