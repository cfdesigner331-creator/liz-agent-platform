"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Senha incorreta");
      }
    } catch (err: any) {
      setError("Falha ao tentar se conectar ao servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#06060E] px-4 relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-[radial-gradient(circle,rgba(240,160,32,0.08)_0%,rgba(0,0,0,0)_70%)] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[45vw] h-[45vw] rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.08)_0%,rgba(0,0,0,0)_75%)] pointer-events-none" />

      <div className="w-full max-w-[420px] card animate-fade-up border-[var(--border)] bg-[rgba(13,13,28,0.7)]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--accent)] font-[var(--font-display)] font-extrabold text-2xl shadow-[0_0_20px_rgba(240,160,32,0.15)] mb-4">
            CF
          </div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-[var(--text-1)]">
            LIZ PLATFORM
          </h1>
          <p className="text-sm text-[var(--text-2)] mt-1">
            Painel administrativo Criações Freitas
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-2)]">
              Senha de Acesso
            </label>
            <input
              type="password"
              className="field-input w-full"
              placeholder="Digite a senha de administrador"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="text-sm text-[var(--error)] bg-[var(--error-dim)] border border-[rgba(248,113,113,0.15)] rounded-lg p-3 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="dot-pulse">
                <span></span>
                <span></span>
                <span></span>
              </span>
            ) : (
              <>
                <span>Acessar Painel</span>
                <i className="fa-solid fa-right-to-bracket text-xs"></i>
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
