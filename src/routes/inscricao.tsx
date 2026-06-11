import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { createRegistration } from "@/lib/registration.functions";
import { buildPixPayload } from "@/lib/pix";
import { supabase } from "@/integrations/supabase/client";

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
const PIX_KEY = "11092675418";
const PIX_AMOUNT = 150;
const PIX_VALUE_LABEL = "R$ 150,00";

type Athlete = { name: string };
const emptyAthlete = (): Athlete => ({ name: "" });

function Inscricao() {
  const submit = useServerFn(createRegistration);
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainWhatsapp, setCaptainWhatsapp] = useState("");
  const [athletes, setAthletes] = useState<Athlete[]>([emptyAthlete()]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    const payload = buildPixPayload({
      key: PIX_KEY,
      merchantName: "TORNEIO FUTEBOL",
      merchantCity: "SAO PAULO",
      amount: PIX_AMOUNT,
    });
    QRCode.toDataURL(payload, { width: 240, margin: 1 }).then(setQrDataUrl).catch(() => {});
  }, []);

  const updateAthlete = (idx: number, value: string) => {
    setAthletes((prev) => prev.map((a, i) => (i === idx ? { name: value } : a)));
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
    if (!file) {
      setError("Anexe o comprovante do Pix.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("O comprovante deve ter no máximo 8 MB.");
      return;
    }
    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : "bin";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
      const { error: upErr } = await supabase.storage
        .from("comprovantes")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw new Error("Falha no upload do comprovante: " + upErr.message);

      const result = await submit({
        data: {
          team_name: teamName.trim(),
          captain_name: captainName.trim(),
          captain_whatsapp: captainWhatsapp.trim(),
          athletes: athletes.map((a) => ({ name: a.name.trim() })),
          comprovante_path: path,
        },
      });
      if ("error" in result) throw new Error(result.error);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#fcfbf8", color: TEXT }}>
        <div className="max-w-md text-center bg-white border border-black/10 rounded-lg p-8">
          <h1 className="text-2xl font-extrabold mb-2">Inscrição enviada!</h1>
          <p className="text-sm mb-4">
            Recebemos sua inscrição e o comprovante. Nossa equipe vai conferir o pagamento e aprovar sua participação em breve.
          </p>
          <Link to="/" className="inline-block rounded-full px-6 py-3 font-bold text-white" style={{ backgroundColor: PRIMARY }}>
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fcfbf8", color: TEXT }}>
      <header className="px-6 py-4 border-b border-black/5 flex justify-between items-center">
        <Link to="/" className="text-sm font-medium">← Voltar</Link>
        <div className="text-sm font-bold">Inscrição</div>
      </header>

      <form onSubmit={onSubmit} className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-3xl font-extrabold">
          Inscreva sua <span style={{ color: PRIMARY }}>equipe</span>
        </h1>

        {/* Pix QR */}
        <div className="bg-white rounded-lg p-5 border-2 flex flex-col items-center text-center" style={{ borderColor: PRIMARY }}>
          <h2 className="font-bold text-lg" style={{ color: PRIMARY }}>Pagamento via Pix — {PIX_VALUE_LABEL}</h2>
          <p className="text-sm mt-2">Escaneie o QR Code abaixo com o app do seu banco e anexe o comprovante.</p>
          <div className="mt-4 bg-white p-2 rounded border border-black/10">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code Pix" width={240} height={240} />
            ) : (
              <div className="w-[240px] h-[240px] flex items-center justify-center text-xs opacity-60">Gerando QR Code...</div>
            )}
          </div>
          <p className="text-xs mt-3 opacity-70">Valor: {PIX_VALUE_LABEL}</p>
        </div>

        <div className="space-y-4 bg-white rounded-lg p-5 border border-black/10">
          <div>
            <label className="block text-sm font-semibold mb-1">Nome da equipe *</label>
            <input required value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={120} className="w-full rounded border border-black/15 px-3 py-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Nome do capitão *</label>
              <input required value={captainName} onChange={(e) => setCaptainName(e.target.value)} maxLength={120} className="w-full rounded border border-black/15 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">WhatsApp do capitão *</label>
              <input required value={captainWhatsapp} onChange={(e) => setCaptainWhatsapp(e.target.value)} placeholder="(99) 99999-9999" maxLength={30} className="w-full rounded border border-black/15 px-3 py-2" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: PRIMARY }}>Atletas ({athletes.length}/6)</h2>
            <button type="button" onClick={addAthlete} disabled={athletes.length >= 6} className="text-sm font-semibold disabled:opacity-40" style={{ color: PRIMARY }}>
              + Adicionar atleta
            </button>
          </div>

          {athletes.map((a, idx) => (
            <div key={idx} className="bg-white rounded-lg p-5 border border-black/10 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">Atleta {idx + 1}</h3>
                {athletes.length > 1 && (
                  <button type="button" onClick={() => removeAthlete(idx)} className="text-xs text-red-600 hover:underline">Remover</button>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Nome completo *</label>
                <input required value={a.name} onChange={(e) => updateAthlete(idx, e.target.value)} maxLength={120} className="w-full rounded border border-black/15 px-3 py-2" />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg p-5 border border-black/10">
          <label className="block text-sm font-semibold mb-2">Comprovante do Pix * (imagem ou PDF, até 8 MB)</label>
          <input
            required
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          {file && <p className="text-xs mt-2 opacity-70">{file.name} — {(file.size / 1024).toFixed(0)} KB</p>}
        </div>

        {error && (
          <div className="rounded bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">{error}</div>
        )}

        <button type="submit" disabled={loading} className="w-full rounded-full px-8 py-4 text-lg font-bold text-white shadow hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
          {loading ? "Enviando..." : "Enviar inscrição"}
        </button>

        <p className="text-xs text-center" style={{ color: TEXT }}>
          Sua inscrição será analisada após a confirmação do Pix pelo administrador.
        </p>
      </form>
    </div>
  );
}
