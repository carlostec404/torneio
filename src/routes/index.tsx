import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Torneio de Futebol de Rua — Inscrições Abertas" },
      {
        name: "description",
        content:
          "Inscreva sua equipe no Torneio de Futebol de Rua. Vagas limitadas. Inscrição R$ 150 por equipe.",
      },
      { property: "og:title", content: "Torneio de Futebol de Rua" },
      {
        property: "og:description",
        content: "Inscreva sua equipe agora. R$ 150 por equipe, 3 a 6 atletas.",
      },
    ],
  }),
  component: Index,
});

const PRIMARY = "#E91425";
const TEXT = "#141414";

function Index() {
  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: "#fcfbf8", color: TEXT }}>
      <header className="px-6 py-4 flex items-center justify-between border-b border-black/5">
        <div className="text-lg font-bold tracking-tight">
          <span style={{ color: PRIMARY }}>⚽ </span>
          Torneio de Rua
        </div>
        <Link to="/auth" className="text-sm font-medium hover:underline" style={{ color: TEXT }}>
          Entrar
        </Link>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <p className="uppercase text-xs tracking-widest font-semibold mb-4" style={{ color: PRIMARY }}>
          Inscrições abertas
        </p>
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight max-w-3xl">
          Torneio de{" "}
          <span style={{ color: PRIMARY }}>Futebol de Rua</span>
        </h1>
        <p className="mt-6 max-w-xl text-base md:text-lg" style={{ color: TEXT }}>
          Monte sua equipe com 3 a 6 atletas e dispute o título. Inscrição única de{" "}
          <strong style={{ color: PRIMARY }}>R$ 150</strong> por equipe.
        </p>

        <Link
          to="/inscricao"
          className="mt-10 inline-flex items-center justify-center rounded-full px-10 py-4 text-lg font-bold text-white shadow-lg hover:opacity-90 transition"
          style={{ backgroundColor: PRIMARY }}
        >
          Inscreva-se
        </Link>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full text-left">
          {[
            { t: "Equipes", d: "De 3 até 6 atletas por equipe." },
            { t: "Pagamento", d: "Inscrição confirmada apenas após pagamento." },
            { t: "Premiação", d: "Troféu para os campeões da temporada." },
          ].map((b) => (
            <div key={b.t} className="rounded-lg border border-black/10 bg-white p-5">
              <h3 className="font-bold mb-1" style={{ color: PRIMARY }}>
                {b.t}
              </h3>
              <p className="text-sm" style={{ color: TEXT }}>
                {b.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-xs" style={{ color: TEXT }}>
        © {new Date().getFullYear()} Torneio de Futebol de Rua
      </footer>
    </main>
  );
}
