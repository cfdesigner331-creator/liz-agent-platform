"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const menuItems = [
    {
      name: "Playground",
      path: "/",
      icon: "fa-solid fa-terminal",
      description: "Simulador de chat e testes",
    },
    {
      name: "Conversas",
      path: "/conversations",
      icon: "fa-solid fa-comments",
      description: "Mensagens reais do WhatsApp",
    },
    {
      name: "Configurações",
      path: "/config",
      icon: "fa-solid fa-sliders",
      description: "Parâmetros e chaves de API",
    },
  ];

  const handleLogout = async () => {
    if (confirm("Deseja realmente sair da plataforma?")) {
      setLoggingOut(true);
      try {
        const res = await fetch("/api/auth", {
          method: "DELETE",
        });
        if (res.ok) {
          router.push("/login");
          router.refresh();
        }
      } catch (err) {
        console.error("Erro ao deslogar:", err);
      } finally {
        setLoggingOut(false);
      }
    }
  };

  return (
    <aside className="w-80 border-r border-[var(--border)] bg-[#070712] flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto">
      {/* Brand Header */}
      <div className="p-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--accent)] font-[var(--font-display)] font-extrabold text-lg shadow-[0_0_15px_rgba(240,160,32,0.1)]">
            CF
          </div>
          <div>
            <h2 className="font-[var(--font-display)] font-bold tracking-tight text-[var(--text-1)] text-md leading-tight">
              LIZ PLATFORM
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-2)] font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="status-pulse"></span>
              Agente Comercial
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`group flex items-start gap-4 p-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-[rgba(240,160,32,0.08)] border border-[rgba(240,160,32,0.2)] text-[var(--accent-text)]"
                  : "hover:bg-[rgba(238,237,248,0.03)] border border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"
              }`}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors ${
                  isActive
                    ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                    : "bg-[#101024] text-[var(--text-3)] group-hover:text-[var(--text-2)]"
                }`}
              >
                <i className={`${item.icon} text-md`}></i>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm leading-normal">
                  {item.name}
                </span>
                <span className="text-[11px] text-[var(--text-3)] truncate mt-0.5">
                  {item.description}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile / Logout */}
      <div className="p-4 border-t border-[var(--border)] bg-[#05050f] mt-auto">
        <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[rgba(13,13,28,0.4)] border border-[var(--border)] mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#1A1A3A] flex items-center justify-center text-sm font-bold text-[var(--text-2)]">
              A
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[var(--text-1)] truncate">
                Administrador
              </span>
              <span className="text-[10px] text-[var(--text-3)] truncate">
                Criações Freitas
              </span>
            </div>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.2)] text-[var(--success)] font-bold">
            ONLINE
          </span>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-[rgba(248,113,113,0.2)] text-[var(--error)] bg-[rgba(248,113,113,0.03)] hover:bg-[rgba(248,113,113,0.08)] transition-all font-semibold text-xs disabled:opacity-40 cursor-pointer"
        >
          {loggingOut ? (
            <span className="dot-pulse">
              <span></span>
              <span></span>
              <span></span>
            </span>
          ) : (
            <>
              <i className="fa-solid fa-right-from-bracket"></i>
              <span>Sair da Plataforma</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
