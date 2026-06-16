import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { clearMustChangePassword } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/change-password")({
  component: ChangePasswordPage,
});

const PRIMARY = "#E91425";
const TEXT = "#141414";

function ChangePasswordPage() {
  const navigate = useNavigate();
  const clearFlag = useServerFn(clearMustChangePassword);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw upErr;
      await clearFlag();
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
        <h1 className="text-2xl font-extrabold">Definir nova senha</h1>
        <p className="text-xs opacity-70">
          Este é seu primeiro acesso. Por segurança, defina uma nova senha para continuar.
        </p>
        <div>
          <label className="block text-sm font-semibold mb-1">Nova senha</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-black/15 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Confirmar nova senha</label>
          <input
            type="password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </main>
  );
}
