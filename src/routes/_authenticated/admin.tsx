import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  approveTeam,
  rejectTeam,
  getComprovanteSignedUrl,
  listAdmins,
  addAdmin,
  removeAdmin,
  generateBracket,
  setMatchWinner,
} from "@/lib/admin.functions";
import { getPublicRegistrationInfo, updatePixSettings } from "@/lib/registration.functions";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

const PRIMARY = "#E91425";
const TEXT = "#141414";

type Athlete = { id: string; name: string; whatsapp: string; rg: string; birth_date: string };
type TeamRow = {
  id: string;
  team_name: string;
  captain_name: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  comprovante_url: string | null;
  seed: number | null;
  athletes: Athlete[];
};
type MatchRow = {
  id: string;
  round: number;
  position: number;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
};

type Tab = "pending" | "approved" | "bracket" | "admins" | "settings";

function AdminPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [teams, setTeams] = useState<TeamRow[]>([]);

  const approveFn = useServerFn(approveTeam);
  const rejectFn = useServerFn(rejectTeam);
  const signedUrlFn = useServerFn(getComprovanteSignedUrl);

  const reload = async () => {
    const { data } = await supabase
      .from("teams")
      .select(
        "id, team_name, captain_name, status, paid_at, created_at, comprovante_url, seed, athletes(id, name, whatsapp, rg, birth_date)",
      )
      .order("created_at", { ascending: false });
    if (data) setTeams(data as TeamRow[]);
  };

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate({ to: "/auth" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profile?.must_change_password) {
        navigate({ to: "/change-password" });
        return;
      }
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleRow) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);
      await reload();
      setLoading(false);
    })();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const openComprovante = async (path: string) => {
    try {
      const { url } = await signedUrlFn({ data: { path } });
      window.open(url, "_blank");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    }
  };

  const pending = useMemo(() => teams.filter((t) => t.status === "pending"), [teams]);
  const approved = useMemo(() => teams.filter((t) => t.status === "paid"), [teams]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  if (isAdmin === false) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 text-center" style={{ backgroundColor: "#fcfbf8", color: TEXT }}>
        <div>
          <h1 className="text-2xl font-bold">Acesso negado</h1>
          <p className="mt-2 text-sm">Sua conta não tem permissão de administrador.</p>
          <button onClick={signOut} className="mt-4 rounded-full px-4 py-2 font-bold text-white" style={{ backgroundColor: PRIMARY }}>Sair</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#fcfbf8", color: TEXT }}>
      <header className="px-6 py-4 border-b border-black/5 flex justify-between items-center bg-white">
        <h1 className="text-xl font-extrabold">Admin — <span style={{ color: PRIMARY }}>Torneio</span></h1>
        <button onClick={signOut} className="text-sm font-semibold hover:underline">Sair</button>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <nav className="flex flex-wrap gap-2 mb-6">
          {([
            ["pending", `Pendentes (${pending.length})`],
            ["approved", `Aprovadas (${approved.length})`],
            ["bracket", "Chaveamento"],
            ["admins", "Admins"],
            ["settings", "Configurações"],
          ] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="rounded-full px-4 py-2 text-sm font-bold border"
              style={{
                backgroundColor: tab === k ? PRIMARY : "white",
                color: tab === k ? "white" : TEXT,
                borderColor: tab === k ? PRIMARY : "rgba(0,0,0,0.1)",
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "pending" && (
          <TeamsList
            teams={pending}
            emptyText="Nenhuma inscrição pendente."
            renderActions={(t) => (
              <div className="flex gap-2">
                {t.comprovante_url && (
                  <button onClick={() => openComprovante(t.comprovante_url!)} className="text-xs font-semibold rounded-full px-3 py-1.5 border border-black/20 hover:bg-black/5">
                    Ver comprovante
                  </button>
                )}
                <button
                  onClick={async () => { await approveFn({ data: { teamId: t.id } }); await reload(); }}
                  className="text-xs font-bold rounded-full px-3 py-1.5 text-white"
                  style={{ backgroundColor: "#16a34a" }}
                >
                  Aprovar
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Rejeitar e excluir esta inscrição?")) return;
                    await rejectFn({ data: { teamId: t.id } });
                    await reload();
                  }}
                  className="text-xs font-bold rounded-full px-3 py-1.5 text-white"
                  style={{ backgroundColor: PRIMARY }}
                >
                  Rejeitar
                </button>
              </div>
            )}
          />
        )}

        {tab === "approved" && (
          <TeamsList teams={approved} emptyText="Nenhuma equipe aprovada ainda." renderActions={() => null} />
        )}

        {tab === "bracket" && <BracketTab teams={approved} />}

        {tab === "admins" && <AdminsTab />}

        {tab === "settings" && <SettingsTab />}
      </div>
    </main>
  );
}

function TeamsList({
  teams,
  emptyText,
  renderActions,
}: {
  teams: TeamRow[];
  emptyText: string;
  renderActions: (t: TeamRow) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (teams.length === 0) return <p className="text-sm">{emptyText}</p>;
  return (
    <div className="space-y-3">
      {teams.map((t) => (
        <div key={t.id} className="bg-white rounded-lg border border-black/10 overflow-hidden">
          <div className="px-5 py-4 flex flex-wrap gap-3 justify-between items-center">
            <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="text-left flex-1 min-w-0">
              <div className="font-bold" style={{ color: PRIMARY }}>{t.team_name}</div>
              <div className="text-xs">Capitão: {t.captain_name} • {t.athletes.length} atletas</div>
            </button>
            {renderActions(t)}
          </div>
          {expanded === t.id && (
            <div className="px-5 pb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-left">
                    <th className="py-2">Nome</th>
                    <th className="py-2">WhatsApp</th>
                    <th className="py-2">RG</th>
                    <th className="py-2">Nascimento</th>
                  </tr>
                </thead>
                <tbody>
                  {t.athletes.map((a) => (
                    <tr key={a.id} className="border-b border-black/5">
                      <td className="py-2">{a.name}</td>
                      <td className="py-2">{a.whatsapp}</td>
                      <td className="py-2">{a.rg}</td>
                      <td className="py-2">{new Date(a.birth_date).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminsTab() {
  const [admins, setAdmins] = useState<{ id: string; email: string }[]>([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listFn = useServerFn(listAdmins);
  const addFn = useServerFn(addAdmin);
  const removeFn = useServerFn(removeAdmin);

  const reload = async () => {
    const { admins } = await listFn();
    setAdmins(admins);
  };
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await addFn({ data: { email: email.trim() } });
      setEmail("");
      setMsg("Admin adicionado.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-black/10 p-5">
        <h2 className="font-bold mb-3">Adicionar administrador</h2>
        <p className="text-xs mb-3 opacity-70">A pessoa precisa já ter criado conta na plataforma (e-mail/senha).</p>
        <form onSubmit={onAdd} className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@dominio.com"
            className="flex-1 min-w-[220px] rounded border border-black/15 px-3 py-2"
          />
          <button disabled={busy} className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: PRIMARY }}>
            {busy ? "..." : "Adicionar"}
          </button>
        </form>
        {msg && <p className="mt-2 text-xs">{msg}</p>}
      </div>

      <div className="bg-white rounded-lg border border-black/10 p-5">
        <h2 className="font-bold mb-3">Administradores atuais</h2>
        {admins.length === 0 ? (
          <p className="text-sm">Nenhum.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {admins.map((a) => (
              <li key={a.id} className="py-2 flex justify-between items-center">
                <span className="text-sm">{a.email}</span>
                <button
                  onClick={async () => {
                    if (!confirm(`Remover admin ${a.email}?`)) return;
                    try {
                      await removeFn({ data: { userId: a.id } });
                      await reload();
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "Erro");
                    }
                  }}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BracketTab({ teams }: { teams: TeamRow[] }) {
  const [seeds, setSeeds] = useState<string[]>([]); // ordered team ids
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [busy, setBusy] = useState(false);
  const genFn = useServerFn(generateBracket);
  const winFn = useServerFn(setMatchWinner);

  const teamMap = useMemo(() => {
    const m: Record<string, TeamRow> = {};
    for (const t of teams) m[t.id] = t;
    return m;
  }, [teams]);

  const loadMatches = async () => {
    const { data } = await supabase
      .from("matches")
      .select("id, round, position, team_a_id, team_b_id, winner_id")
      .order("round")
      .order("position");
    if (data) setMatches(data as MatchRow[]);
  };

  useEffect(() => { loadMatches(); }, []);

  useEffect(() => {
    // initialize seeds list with approved teams in their existing order
    setSeeds(teams.map((t) => t.id));
  }, [teams]);

  const move = (idx: number, dir: -1 | 1) => {
    setSeeds((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const generate = async () => {
    if (seeds.length < 2) return alert("Precisa de pelo menos 2 equipes.");
    if (!confirm("Gerar novo chaveamento? Isso apaga o atual.")) return;
    setBusy(true);
    try {
      await genFn({ data: { seeds } });
      await loadMatches();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const pickWinner = async (matchId: string, winnerId: string) => {
    await winFn({ data: { matchId, winnerId } });
    await loadMatches();
  };

  const rounds = useMemo(() => {
    const byRound: Record<number, MatchRow[]> = {};
    for (const m of matches) {
      (byRound[m.round] ??= []).push(m);
    }
    return Object.entries(byRound)
      .map(([r, list]) => ({ round: Number(r), list: list.sort((a, b) => a.position - b.position) }))
      .sort((a, b) => a.round - b.round);
  }, [matches]);

  const teamLabel = (id: string | null) => (id && teamMap[id]?.team_name) || (id ? "(equipe removida)" : "—");

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Chaveamento — Torneio de Futebol de Rua", pageW / 2, 36, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, pageW / 2, 52, { align: "center" });

    const marginX = 30;
    const marginY = 80;
    const colWidth = (pageW - marginX * 2) / Math.max(rounds.length, 1);
    const usableH = pageH - marginY - 30;
    const round1Count = rounds[0]?.list.length ?? 1;
    const boxH = 40;
    const slot = usableH / round1Count;

    rounds.forEach((r, rIdx) => {
      const x = marginX + rIdx * colWidth + 10;
      const colCount = r.list.length;
      const spacing = usableH / colCount;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const roundLabel = rIdx === rounds.length - 1 ? "Final" : rIdx === rounds.length - 2 ? "Semifinal" : `Rodada ${r.round}`;
      doc.text(roundLabel, x + (colWidth - 20) / 2, marginY - 10, { align: "center" });
      r.list.forEach((m, mIdx) => {
        const cy = marginY + spacing * (mIdx + 0.5) - boxH / 2;
        const w = colWidth - 20;
        doc.setDrawColor(180);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, cy, w, boxH, 4, 4, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const a = teamLabel(m.team_a_id);
        const b = teamLabel(m.team_b_id);
        const aWin = m.winner_id && m.winner_id === m.team_a_id;
        const bWin = m.winner_id && m.winner_id === m.team_b_id;
        doc.setFont("helvetica", aWin ? "bold" : "normal");
        doc.text(a.slice(0, 28), x + 6, cy + 16);
        doc.setDrawColor(220);
        doc.line(x + 4, cy + boxH / 2, x + w - 4, cy + boxH / 2);
        doc.setFont("helvetica", bWin ? "bold" : "normal");
        doc.text(b.slice(0, 28), x + 6, cy + boxH - 8);
      });
    });

    doc.save("chaveamento.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-black/10 p-5">
        <h2 className="font-bold mb-1">Definir cabeças de chave</h2>
        <p className="text-xs opacity-70 mb-3">
          A ordem abaixo é a ordem dos seeds (1 = melhor cabeça de chave). Use as setas para reordenar e clique em "Gerar chaveamento".
        </p>
        {seeds.length === 0 ? (
          <p className="text-sm">Nenhuma equipe aprovada ainda.</p>
        ) : (
          <ol className="space-y-1">
            {seeds.map((id, idx) => (
              <li key={id} className="flex items-center gap-2 bg-black/5 rounded px-3 py-2">
                <span className="font-bold text-sm w-8" style={{ color: PRIMARY }}>#{idx + 1}</span>
                <span className="flex-1 text-sm">{teamMap[id]?.team_name ?? id}</span>
                <button onClick={() => move(idx, -1)} className="text-xs px-2 py-1 border border-black/10 rounded">↑</button>
                <button onClick={() => move(idx, 1)} className="text-xs px-2 py-1 border border-black/10 rounded">↓</button>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 flex gap-2 flex-wrap">
          <button
            onClick={generate}
            disabled={busy || seeds.length < 2}
            className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: PRIMARY }}
          >
            {busy ? "Gerando..." : "Gerar chaveamento (sorteio)"}
          </button>
          {matches.length > 0 && (
            <button
              onClick={downloadPdf}
              className="rounded-full px-4 py-2 text-sm font-bold border border-black/20 hover:bg-black/5"
            >
              Baixar chaveamento (PDF)
            </button>
          )}
        </div>
      </div>

      {matches.length > 0 && (
        <div className="bg-white rounded-lg border border-black/10 p-5 overflow-x-auto">
          <h2 className="font-bold mb-4">Chaveamento atual</h2>
          <div className="flex gap-4 min-w-max">
            {rounds.map((r, rIdx) => (
              <div key={r.round} className="flex flex-col gap-3 min-w-[200px]">
                <div className="text-xs font-bold uppercase tracking-wide text-center" style={{ color: PRIMARY }}>
                  {rIdx === rounds.length - 1 ? "Final" : rIdx === rounds.length - 2 ? "Semifinal" : `Rodada ${r.round}`}
                </div>
                {r.list.map((m) => (
                  <div key={m.id} className="border border-black/10 rounded overflow-hidden">
                    {([m.team_a_id, m.team_b_id] as (string | null)[]).map((tid, i) => {
                      const isWinner = m.winner_id && m.winner_id === tid;
                      const canPick = tid && m.team_a_id && m.team_b_id && !m.winner_id;
                      return (
                        <button
                          key={i}
                          disabled={!canPick}
                          onClick={() => tid && pickWinner(m.id, tid)}
                          className="w-full text-left text-xs px-3 py-2 border-b last:border-b-0 border-black/5 disabled:cursor-default"
                          style={{
                            backgroundColor: isWinner ? "#dcfce7" : "white",
                            fontWeight: isWinner ? 700 : 400,
                          }}
                          title={canPick ? "Clique para definir vencedor" : ""}
                        >
                          {teamLabel(tid)}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const loadFn = useServerFn(getPublicRegistrationInfo);
  const saveFn = useServerFn(updatePixSettings);
  const [pixKey, setPixKey] = useState("");
  const [pixAmount, setPixAmount] = useState("150");
  const [merchantName, setMerchantName] = useState("");
  const [merchantCity, setMerchantCity] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadFn().then((d) => {
      setPixKey(d.pixKey);
      setPixAmount(String(d.pixAmount));
      setMerchantName(d.merchantName);
      setMerchantCity(d.merchantCity);
    }).catch(() => {});
  }, [loadFn]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await saveFn({
        data: {
          pixKey: pixKey.trim(),
          pixAmount: Number(pixAmount) || 0,
          merchantName: merchantName.trim().toUpperCase(),
          merchantCity: merchantCity.trim().toUpperCase(),
        },
      });
      setMsg("Configurações salvas. O QR Code da tela de inscrição já reflete a nova chave.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-black/10 p-5 max-w-xl">
      <h2 className="font-bold mb-1">Pagamento Pix</h2>
      <p className="text-xs opacity-70 mb-4">
        Altere a chave Pix e os dados do recebedor. O QR Code da página de inscrição é gerado automaticamente a partir destas informações.
      </p>
      <form onSubmit={onSave} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold mb-1">Chave Pix *</label>
          <input required value={pixKey} onChange={(e) => setPixKey(e.target.value)} maxLength={120} className="w-full rounded border border-black/15 px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Valor da inscrição (R$) *</label>
          <input required type="number" min={0} step="0.01" value={pixAmount} onChange={(e) => setPixAmount(e.target.value)} className="w-full rounded border border-black/15 px-3 py-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Nome do recebedor * (máx 25)</label>
            <input required value={merchantName} onChange={(e) => setMerchantName(e.target.value)} maxLength={25} className="w-full rounded border border-black/15 px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Cidade * (máx 15)</label>
            <input required value={merchantCity} onChange={(e) => setMerchantCity(e.target.value)} maxLength={15} className="w-full rounded border border-black/15 px-3 py-2" />
          </div>
        </div>
        <button disabled={busy} className="rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: PRIMARY }}>
          {busy ? "Salvando..." : "Salvar"}
        </button>
        {msg && <p className="text-xs mt-2">{msg}</p>}
      </form>
    </div>
  );
}
