import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function normalizeBirthDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(v);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

const athleteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().min(8).max(30),
  rg: z.string().trim().min(3).max(30),
  birth_date: z.string().transform((v, ctx) => {
    const norm = normalizeBirthDate(v);
    if (!norm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data de nascimento inválida" });
      return z.NEVER;
    }
    return norm;
  }),
});

const registrationSchema = z.object({
  team_name: z.string().trim().min(2).max(120),
  captain_name: z.string().trim().min(2).max(120),
  athletes: z.array(athleteSchema).min(1).max(6),
  comprovante_path: z.string().trim().min(3).max(500),
});

type Result = { teamId: string } | { error: string };

export const createRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registrationSchema.parse(data))
  .handler(async ({ data }): Promise<Result> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: team, error: teamError } = await supabaseAdmin
        .from("teams")
        .insert({
          team_name: data.team_name,
          captain_name: data.captain_name,
          status: "pending",
          comprovante_url: data.comprovante_path,
        })
        .select("id")
        .single();
      if (teamError || !team) throw new Error(teamError?.message ?? "Falha ao criar equipe");

      const athleteRows = data.athletes.map((a) => ({
        team_id: team.id,
        name: a.name,
        whatsapp: a.whatsapp,
        rg: a.rg,
        birth_date: a.birth_date,
      }));
      const { error: athletesError } = await supabaseAdmin.from("athletes").insert(athleteRows);
      if (athletesError) throw new Error(athletesError.message);

      return { teamId: team.id };
    } catch (error) {
      console.error("createRegistration error:", error);
      return { error: error instanceof Error ? error.message : "Erro inesperado" };
    }
  });
