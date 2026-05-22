"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Hand-crafted SVGs
const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const WarningIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const LoginIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

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
      {/* Dynamic Glowing Accent Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-[radial-gradient(circle,rgba(var(--accent-rgb),0.08)_0%,rgba(0,0,0,0)_70%)] pointer-events-none transition-all duration-500" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[45vw] h-[45vw] rounded-full bg-[radial-gradient(circle,rgba(var(--accent-rgb),0.06)_0%,rgba(0,0,0,0)_75%)] pointer-events-none transition-all duration-500" />

      <div className="w-full max-w-[420px] card animate-fade-up border-[var(--border)] bg-[rgba(13,13,28,0.7)] p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--accent)] font-[var(--font-display)] font-extrabold text-2xl shadow-[0_0_20px_rgba(var(--accent-rgb),0.15)] mb-4 transition-all duration-300 hover:scale-105">
            AP
          </div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-[var(--text-1)]">
            AssistentePRO
          </h1>
          <p className="text-sm text-[var(--text-2)] mt-1">
            Plataforma Universal de Configuração
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-2)]">
                Senha de Acesso
              </label>
              <LockIcon className="w-3.5 h-3.5 text-[var(--text-3)]" />
            </div>
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
            <div className="text-sm text-[var(--error)] bg-[var(--error-dim)] border border-[rgba(248,113,113,0.15)] rounded-xl p-3.5 flex items-start gap-2.5">
              <WarningIcon className="w-5 h-5 shrink-0 text-[var(--error)] mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full cursor-pointer group"
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
                <LoginIcon className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
