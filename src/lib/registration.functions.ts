import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

function normalizeBirthDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  // ISO: YYYY-MM-DD
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // DD/MM/YYYY or DD-MM-YYYY
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
  birth_date: z
    .string()
    .transform((v, ctx) => {
      const norm = normalizeBirthDate(v);
      if (!norm) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe uma data de nascimento válida" });
        return z.NEVER;
      }
      return norm;
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
  | { clientSecret: string; teamId: string }
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

      const session = await stripe.checkout.sessions.create({
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
        payment_method_types: ["pix"],
        payment_method_options: {
          pix: { expires_after_seconds: 3600 },
        },
        payment_intent_data: { description: `Inscrição equipe: ${data.team_name}` },
        metadata: { teamId: team.id, team_name: data.team_name },
      });

      const gatewayError = session as unknown as { type?: string; message?: string };
      if (!session.id && gatewayError.message) {
        throw new Error(gatewayError.message);
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
      throw new Error("Stripe não retornou client_secret para abrir a tela de pagamento");
    } catch (error) {
      console.error("createRegistrationCheckout error:", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

