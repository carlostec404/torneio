import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const PRIMARY = "#E91425";
const TEXT = "#141414";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin" });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#fcfbf8", color: TEXT }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-lg border border-black/10 p-6 space-y-4"
      >
        <Link to="/" className="text-xs hover:underline">← Voltar</Link>
        <h1 className="text-2xl font-extrabold">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="text-xs" style={{ color: TEXT }}>
          Acesso administrativo do torneio.
        </p>
        <div>
          <label className="block text-sm font-semibold mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-black/15 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Senha</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-black/15 px-3 py-2"
          />
        </div>
        {error && (
          <div className="rounded bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full px-6 py-3 font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: PRIMARY }}
        >
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-sm hover:underline"
        >
          {mode === "login" ? "Criar uma conta" : "Já tenho conta"}
        </button>
      </form>
    </main>
  );
}
