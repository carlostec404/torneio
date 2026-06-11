import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createRegistrationCheckout } from "@/lib/registration.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { StripeEmbeddedCheckoutBox } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/inscricao")({
  head: () => ({
    meta: [
      { title: "Inscrição — Torneio de Futebol de Rua" },
      { name: "description", content: "Cadastre sua equipe no Torneio de Futebol de Rua." },
    ],
  }),
  component: Inscricao,
});

const PRIMARY = "#E91425";
const TEXT = "#141414";

type Athlete = { name: string; whatsapp: string; rg: string; birth_date: string };

const emptyAthlete = (): Athlete => ({ name: "", whatsapp: "", rg: "", birth_date: "" });

function Inscricao() {
  const submit = useServerFn(createRegistrationCheckout);
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [athletes, setAthletes] = useState<Athlete[]>([emptyAthlete()]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateAthlete = (idx: number, field: keyof Athlete, value: string) => {
    setAthletes((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  };

  const addAthlete = () => {
    if (athletes.length >= 6) return;
    setAthletes([...athletes, emptyAthlete()]);
  };

  const removeAthlete = (idx: number) => {
    if (athletes.length <= 1) return;
    setAthletes(athletes.filter((_, i) => i !== idx));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const env = getStripeEnvironment();
      const result = await submit({
        data: {
          team_name: teamName.trim(),
          captain_name: captainName.trim(),
          athletes: athletes.map((a) => ({
            name: a.name.trim(),
            whatsapp: a.whatsapp.trim(),
            rg: a.rg.trim(),
            birth_date: a.birth_date,
          })),
          environment: env,
          returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        },
      });
      if ("error" in result) throw new Error(result.error);
      if ("redirectUrl" in result && result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      if (result.clientSecret) {
        setClientSecret(result.clientSecret);
      } else {
        throw new Error("Resposta inesperada do servidor de pagamento");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  if (clientSecret) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#fcfbf8" }}>
        <PaymentTestModeBanner />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-4" style={{ color: TEXT }}>
            Finalize o pagamento — <span style={{ color: PRIMARY }}>R$ 150</span>
          </h1>
          <StripeEmbeddedCheckoutBox clientSecret={clientSecret} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fcfbf8", color: TEXT }}>
      <PaymentTestModeBanner />
      <header className="px-6 py-4 border-b border-black/5 flex justify-between items-center">
        <Link to="/" className="text-sm font-medium">
          ← Voltar
        </Link>
        <div className="text-sm font-bold">Inscrição</div>
      </header>

      <form onSubmit={onSubmit} className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-3xl font-extrabold">
          Inscreva sua <span style={{ color: PRIMARY }}>equipe</span>
        </h1>

        <div className="space-y-4 bg-white rounded-lg p-5 border border-black/10">
          <div>
            <label className="block text-sm font-semibold mb-1">Nome da equipe *</label>
            <input
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={120}
              className="w-full rounded border border-black/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Nome do capitão *</label>
            <input
              required
              value={captainName}
              onChange={(e) => setCaptainName(e.target.value)}
              maxLength={120}
              className="w-full rounded border border-black/15 px-3 py-2"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: PRIMARY }}>
              Atletas ({athletes.length}/6)
            </h2>
            <button
              type="button"
              onClick={addAthlete}
              disabled={athletes.length >= 6}
              className="text-sm font-semibold disabled:opacity-40"
              style={{ color: PRIMARY }}
            >
              + Adicionar atleta
            </button>
          </div>

          {athletes.map((a, idx) => (
            <div key={idx} className="bg-white rounded-lg p-5 border border-black/10 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">Atleta {idx + 1}</h3>
                {athletes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAthlete(idx)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Nome completo *</label>
                  <input
                    required
                    value={a.name}
                    onChange={(e) => updateAthlete(idx, "name", e.target.value)}
                    maxLength={120}
                    className="w-full rounded border border-black/15 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">WhatsApp *</label>
                  <input
                    required
                    value={a.whatsapp}
                    onChange={(e) => updateAthlete(idx, "whatsapp", e.target.value)}
                    placeholder="(99) 99999-9999"
                    maxLength={30}
                    className="w-full rounded border border-black/15 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">RG *</label>
                  <input
                    required
                    value={a.rg}
                    onChange={(e) => updateAthlete(idx, "rg", e.target.value)}
                    maxLength={30}
                    className="w-full rounded border border-black/15 px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Data de nascimento *</label>
                  <input
                    required
                    type="date"
                    value={a.birth_date}
                    onChange={(e) => updateAthlete(idx, "birth_date", e.target.value)}
                    className="w-full rounded border border-black/15 px-3 py-2"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full px-8 py-4 text-lg font-bold text-white shadow hover:opacity-90 disabled:opacity-50 transition"
          style={{ backgroundColor: PRIMARY }}
        >
          {loading ? "Processando..." : "Ir para pagamento — R$ 150"}
        </button>

        <p className="text-xs text-center" style={{ color: TEXT }}>
          A inscrição só é confirmada após a aprovação do pagamento.
        </p>
      </form>
    </div>
  );
}
