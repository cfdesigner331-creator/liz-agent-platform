"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

// Hand-crafted SVG Icons with premium gradients/strokes
const PlaygroundIcon = ({ className }: { className?: string }) => (
  <svg className={`${className} transition-all duration-300 group-hover:scale-110`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const ChatIcon = ({ className }: { className?: string }) => (
  <svg className={`${className} transition-all duration-300 group-hover:rotate-6`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ConfigIcon = ({ className }: { className?: string }) => (
  <svg className={`${className} transition-all duration-300 group-hover:rotate-45`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg className={`${className} transition-all duration-300 group-hover:translate-x-1`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const menuItems = [
    {
      name: "Playground",
      path: "/",
      icon: PlaygroundIcon,
      description: "Simulador de chat e testes",
    },
    {
      name: "Conversas",
      path: "/conversations",
      icon: ChatIcon,
      description: "Mensagens reais do WhatsApp",
    },
    {
      name: "Configurações",
      path: "/config",
      icon: ConfigIcon,
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
    <aside className="w-80 border-r border-[var(--border)] bg-[#070712] flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto z-10">
      {/* Brand Header */}
      <div className="p-6 border-b border-[var(--border)] bg-[#070712]/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--accent)] font-[var(--font-display)] font-extrabold text-xl shadow-[0_0_15px_rgba(var(--accent-rgb),0.15)] transition-all duration-300 hover:scale-105">
            AP
          </div>
          <div>
            <h2 className="font-[var(--font-display)] font-bold tracking-tight text-[var(--text-1)] text-md leading-tight">
              AssistentePRO
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-2)] font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="status-pulse"></span>
              Plataforma Ativa
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          const IconComponent = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`group flex items-start gap-4 p-3 rounded-xl border transition-all duration-300 ${
                isActive
                  ? "bg-[rgba(var(--accent-rgb),0.06)] border-[rgba(var(--accent-rgb),0.2)] text-[var(--accent)] shadow-[0_4px_12px_rgba(var(--accent-rgb),0.02)]"
                  : "hover:bg-[rgba(238,237,248,0.03)] border-transparent text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border)]"
              }`}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-all duration-300 ${
                  isActive
                    ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                    : "bg-[#101024] text-[var(--text-3)] group-hover:text-[var(--text-2)] group-hover:bg-[#14142d]"
                }`}
              >
                <IconComponent className="w-5 h-5" />
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
            <div className="w-8 h-8 rounded-full bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center text-xs font-bold text-[var(--accent)]">
              AP
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[var(--text-1)] truncate">
                Administrador
              </span>
              <span className="text-[10px] text-[var(--text-3)] truncate">
                Gestão Universal
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
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-[rgba(248,113,113,0.2)] text-[var(--error)] bg-[rgba(248,113,113,0.03)] hover:bg-[rgba(248,113,113,0.08)] hover:border-[rgba(248,113,113,0.4)] transition-all font-semibold text-xs disabled:opacity-40 cursor-pointer group"
        >
          {loggingOut ? (
            <span className="dot-pulse">
              <span></span>
              <span></span>
              <span></span>
            </span>
          ) : (
            <>
              <LogoutIcon className="w-4 h-4" />
              <span>Sair da Plataforma</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
