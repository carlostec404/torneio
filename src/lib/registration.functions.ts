import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MAX_TEAMS = 32;

function normalizeBirthDate(): null {
  return null;
}

const athleteSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

const registrationSchema = z.object({
  team_name: z.string().trim().min(2).max(120),
  captain_name: z.string().trim().min(2).max(120),
  captain_whatsapp: z.string().trim().min(8).max(30),
  athletes: z.array(athleteSchema).min(3, "Informe pelo menos 3 atletas").max(6),
  comprovante_path: z.string().trim().min(3).max(500),
});

type Result = { teamId: string } | { error: string };

export const createRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registrationSchema.parse(data))
  .handler(async ({ data }): Promise<Result> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { count, error: countErr } = await supabaseAdmin
        .from("teams")
        .select("id", { count: "exact", head: true });
      if (countErr) throw new Error(countErr.message);
      if ((count ?? 0) >= MAX_TEAMS) {
        return { error: "As inscrições estão encerradas: limite de 32 equipes atingido." };
      }

      const { data: team, error: teamError } = await supabaseAdmin
        .from("teams")
        .insert({
          team_name: data.team_name,
          captain_name: data.captain_name,
          captain_whatsapp: data.captain_whatsapp,
          status: "pending",
          comprovante_url: data.comprovante_path,
        })
        .select("id")
        .single();
      if (teamError || !team) throw new Error(teamError?.message ?? "Falha ao criar equipe");

      const athleteRows = data.athletes.map((a) => ({
        team_id: team.id,
        name: a.name,
      }));
      const { error: athletesError } = await supabaseAdmin.from("athletes").insert(athleteRows);
      if (athletesError) throw new Error(athletesError.message);

      return { teamId: team.id };
    } catch (error) {
      console.error("createRegistration error:", error);
      return { error: error instanceof Error ? error.message : "Erro inesperado" };
    }
  });

// Public settings (Pix info + current team count). No auth required.
export const getPublicRegistrationInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin.from("app_settings").select("key, value");
  const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
  const { count } = await supabaseAdmin
    .from("teams")
    .select("id", { count: "exact", head: true });
  return {
    pixKey: map.get("pix_key") ?? "",
    pixAmount: Number(map.get("pix_amount") ?? "150"),
    merchantName: map.get("pix_merchant_name") ?? "TORNEIO FUTEBOL",
    merchantCity: map.get("pix_merchant_city") ?? "SAO PAULO",
    teamCount: count ?? 0,
    maxTeams: MAX_TEAMS,
  };
});

// Admin: update Pix settings
const pixSettingsSchema = z.object({
  pixKey: z.string().trim().min(3).max(120),
  pixAmount: z.number().min(0).max(100000),
  merchantName: z.string().trim().min(1).max(25),
  merchantCity: z.string().trim().min(1).max(15),
});

export const updatePixSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pixSettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = [
      { key: "pix_key", value: data.pixKey },
      { key: "pix_amount", value: String(data.pixAmount) },
      { key: "pix_merchant_name", value: data.merchantName },
      { key: "pix_merchant_city", value: data.merchantCity },
    ];
    for (const r of rows) {
      const { error } = await supabaseAdmin
        .from("app_settings")
        .upsert({ ...r, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
