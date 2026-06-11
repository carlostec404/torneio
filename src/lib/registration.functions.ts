import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const athleteSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

const registrationSchema = z.object({
  team_name: z.string().trim().min(2).max(120),
  captain_name: z.string().trim().min(2).max(120),
  captain_whatsapp: z.string().trim().min(8).max(30),
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
