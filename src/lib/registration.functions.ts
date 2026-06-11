import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

const athleteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().min(8).max(30),
  rg: z.string().trim().min(3).max(30),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const registrationSchema = z.object({
  team_name: z.string().trim().min(2).max(120),
  captain_name: z.string().trim().min(2).max(120),
  athletes: z.array(athleteSchema).min(1).max(6),
  environment: z.enum(["sandbox", "live"]),
  returnUrl: z.string().url(),
});

type Result = { clientSecret: string; teamId: string } | { error: string };

export const createRegistrationCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registrationSchema.parse(data))
  .handler(async ({ data }): Promise<Result> => {
    try {
      // Use admin client to insert pending team (RLS allows anon insert anyway,
      // but admin is needed to read back & link properly).
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Insert pending team
      const { data: team, error: teamError } = await supabaseAdmin
        .from("teams")
        .insert({
          team_name: data.team_name,
          captain_name: data.captain_name,
          status: "pending",
        })
        .select("id")
        .single();
      if (teamError || !team) throw new Error(teamError?.message ?? "Falha ao criar equipe");

      // Insert athletes
      const athleteRows = data.athletes.map((a) => ({
        team_id: team.id,
        name: a.name,
        whatsapp: a.whatsapp,
        rg: a.rg,
        birth_date: a.birth_date,
      }));
      const { error: athletesError } = await supabaseAdmin.from("athletes").insert(athleteRows);
      if (athletesError) throw new Error(athletesError.message);

      // Create Stripe Checkout Session
      const env = data.environment as StripeEnv;
      const stripe = createStripeClient(env);
      const prices = await stripe.prices.list({ lookup_keys: ["inscricao_torneio_150"] });
      if (!prices.data.length) throw new Error("Preço de inscrição não encontrado");
      const price = prices.data[0];

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        payment_intent_data: { description: `Inscrição equipe: ${data.team_name}` },
        metadata: { teamId: team.id, team_name: data.team_name },
      });

      // Save session id for later reconciliation
      await supabaseAdmin
        .from("teams")
        .update({ stripe_session_id: session.id })
        .eq("id", team.id);

      return { clientSecret: session.client_secret ?? "", teamId: team.id };
    } catch (error) {
      console.error("createRegistrationCheckout error:", error);
      return { error: getStripeErrorMessage(error) };
    }
  });
