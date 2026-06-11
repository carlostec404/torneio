import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

const PRIMARY = "#E91425";
const TEXT = "#141414";

type TeamRow = {
  id: string;
  team_name: string;
  captain_name: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  athletes: {
    id: string;
    name: string;
    whatsapp: string;
    rg: string;
    birth_date: string;
  }[];
};

function AdminPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate({ to: "/auth" });
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

      const { data: teamsData, error } = await supabase
        .from("teams")
        .select("id, team_name, captain_name, status, paid_at, created_at, athletes(id, name, whatsapp, rg, birth_date)")
        .eq("status", "paid")
        .order("paid_at", { ascending: false });
      if (!error && teamsData) setTeams(teamsData as TeamRow[]);
      setLoading(false);
    })();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (isAdmin === false) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4 text-center"
        style={{ backgroundColor: "#fcfbf8", color: TEXT }}
      >
        <div>
          <h1 className="text-2xl font-bold">Acesso negado</h1>
          <p className="mt-2 text-sm">
            Sua conta não tem permissão de administrador.
          </p>
          <button
            onClick={signOut}
            className="mt-4 rounded-full px-4 py-2 font-bold text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            Sair
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#fcfbf8", color: TEXT }}>
      <header className="px-6 py-4 border-b border-black/5 flex justify-between items-center bg-white">
        <h1 className="text-xl font-extrabold">
          Admin — <span style={{ color: PRIMARY }}>Torneio</span>
        </h1>
        <button onClick={signOut} className="text-sm font-semibold hover:underline">
          Sair
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Equipes inscritas</h2>
          <span className="text-sm" style={{ color: PRIMARY }}>
            Total pagas: <strong>{teams.length}</strong>
          </span>
        </div>

        {teams.length === 0 ? (
          <p className="text-sm">Nenhuma inscrição paga até o momento.</p>
        ) : (
          <div className="space-y-3">
            {teams.map((t) => (
              <div key={t.id} className="bg-white rounded-lg border border-black/10 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  className="w-full px-5 py-4 flex justify-between items-center text-left hover:bg-black/5"
                >
                  <div>
                    <div className="font-bold" style={{ color: PRIMARY }}>
                      {t.team_name}
                    </div>
                    <div className="text-xs">
                      Capitão: {t.captain_name} • {t.athletes.length} atletas
                    </div>
                  </div>
                  <div className="text-xs text-right">
                    <div className="font-semibold">Paga</div>
                    <div>{t.paid_at ? new Date(t.paid_at).toLocaleString("pt-BR") : "-"}</div>
                  </div>
                </button>

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
                            <td className="py-2">
                              {new Date(a.birth_date).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
