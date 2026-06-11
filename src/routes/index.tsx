import { createFileRoute, Link } from "@tanstack/react-router";
import flyer from "@/assets/barrinha-street.jpeg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barrinha Street — 12 de Julho na Arena Bolivar" },
      {
        name: "description",
        content:
          "Barrinha Street: 12 de julho na Arena Bolivar. Até 32 times, 3-6 jogadores, R$150 inscrição. Premiação: mil reais no PIX + 6 camisas.",
      },
      { property: "og:title", content: "Barrinha Street — Torneio de Futebol de Rua" },
      {
        property: "og:description",
        content: "12 de julho na Arena Bolivar. Inscrições abertas: R$150 por equipe.",
      },
      { property: "og:image", content: flyer.url },
    ],
  }),
  component: Index,
});

const PRIMARY = "#E91425";

function Index() {
  return (
    <main className="min-h-screen flex flex-col items-center bg-[#f2f0eb] text-black">
      <header className="w-full max-w-3xl px-6 py-4 flex items-center justify-end">
        <Link to="/auth" className="text-sm font-semibold hover:underline">
          Entrar
        </Link>
      </header>

      <section className="w-full max-w-3xl flex-1 flex flex-col items-center text-center px-6 pb-12">
        <img
          src={flyer.url}
          alt="Barrinha Street — 12 de julho na Arena Bolivar"
          className="w-full max-w-xl rounded-lg shadow-2xl"
        />

        <Link
          to="/inscricao"
          className="mt-10 inline-flex items-center justify-center rounded-full px-12 py-4 text-lg font-extrabold uppercase tracking-wider text-white shadow-lg hover:opacity-90 transition"
          style={{ backgroundColor: PRIMARY }}
        >
          Inscreva sua equipe
        </Link>

        <p className="mt-6 text-sm font-medium text-black/70 max-w-md">
          Inscrição única de <strong style={{ color: PRIMARY }}>R$ 150</strong> por equipe. Vagas limitadas a 32 times.
        </p>
      </section>

      <footer className="w-full px-6 py-6 text-center text-xs text-black/60">
        © {new Date().getFullYear()} Barrinha Street · Arena Bolivar · Recife - PE
      </footer>
    </main>
  );
}
