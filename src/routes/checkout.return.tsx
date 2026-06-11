import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

const PRIMARY = "#E91425";
const TEXT = "#141414";

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#fcfbf8", color: TEXT }}
    >
      <div className="max-w-md text-center">
        {session_id ? (
          <>
            <div className="text-5xl mb-4">🏆</div>
            <h1 className="text-3xl font-extrabold" style={{ color: PRIMARY }}>
              Inscrição confirmada!
            </h1>
            <p className="mt-4 text-base">
              Recebemos o pagamento da sua equipe. Em breve enviaremos as próximas informações pelo
              WhatsApp do capitão.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Sessão não encontrada</h1>
            <p className="mt-3 text-sm">Tente novamente a partir da página de inscrição.</p>
          </>
        )}
        <Link
          to="/"
          className="mt-8 inline-block rounded-full px-6 py-3 font-bold text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
