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
  birth_date: z
    .string()
    .trim()
    .refine(
      (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{2}\/\d{2}\/\d{4}$/.test(value),
      "Informe uma data de nascimento válida",
    )
    .transform((value) => {
      const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
      return match ? `${match[3]}-${match[1]}-${match[2]}` : value;
    }),
});

const registrationSchema = z.object({
  team_name: z.string().trim().min(2).max(120),
  captain_name: z.string().trim().min(2).max(120),
  athletes: z.array(athleteSchema).min(1).max(6),
  environment: z.enum(["sandbox", "live"]),
  returnUrl: z.string().url(),
});

type Result =
  | { clientSecret: string; redirectUrl?: string; teamId: string }
  | { clientSecret?: string; redirectUrl: string; teamId: string }
  | { error: string };

export const createRegistrationCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registrationSchema.parse(data))
  .handler(async ({ data }): Promise<Result> => {
    try {
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

      // Try embedded mode first; if gateway/API rejects ui_mode, fall back to hosted redirect.
      let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
      try {
        session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "brl",
                unit_amount: 15000,
                product_data: { name: "Inscrição — Torneio de Futebol de Rua" },
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          ui_mode: "embedded_page",
          return_url: data.returnUrl,
          payment_intent_data: { description: `Inscrição equipe: ${data.team_name}` },
          metadata: { teamId: team.id, team_name: data.team_name },
        });
      } catch (innerErr) {
        console.warn("Embedded checkout failed, falling back to hosted:", innerErr);
        session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "brl",
                unit_amount: 15000,
                product_data: { name: "Inscrição — Torneio de Futebol de Rua" },
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: data.returnUrl,
          cancel_url: data.returnUrl.split("?")[0],
          payment_intent_data: { description: `Inscrição equipe: ${data.team_name}` },
          metadata: { teamId: team.id, team_name: data.team_name },
        });
      }

      console.log("Stripe session created:", {
        id: session.id,
        ui_mode: session.ui_mode,
        hasClientSecret: !!session.client_secret,
        hasUrl: !!session.url,
      });

      // Save session id for later reconciliation
      await supabaseAdmin
        .from("teams")
        .update({ stripe_session_id: session.id })
        .eq("id", team.id);

      if (session.client_secret) {
        return { clientSecret: session.client_secret, teamId: team.id };
      }
      if (session.url) {
        return { redirectUrl: session.url, teamId: team.id };
      }
      throw new Error("Stripe não retornou client_secret nem URL de checkout");
    } catch (error) {
      console.error("createRegistrationCheckout error:", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

