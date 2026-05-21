"use client";

import { useState, useEffect, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "model" | string;
  content: string;
  tokens: number | null;
  createdAt: string;
}

interface Conversation {
  id: string;
  source: string;
  phone: string | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async (search = "") => {
    setError("");
    try {
      const url = search.trim() !== ""
        ? `/api/conversations?phone=${encodeURIComponent(search.trim())}`
        : "/api/conversations";
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        
        // Auto-select or maintain selection
        if (data.length > 0) {
          if (activeChat) {
            const current = data.find((c: Conversation) => c.id === activeChat.id);
            if (current) {
              setActiveChat(current);
            } else {
              setActiveChat(data[0]);
            }
          } else {
            setActiveChat(data[0]);
          }
        } else {
          setActiveChat(null);
        }
      } else {
        setError("Erro ao carregar dados do histórico.");
      }
    } catch (err) {
      setError("Falha ao se conectar com o servidor.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    fetchConversations(searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setLoading(true);
    fetchConversations("");
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations(searchTerm);
  };

  const formatBrazilianDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return isoString;
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "Desconhecido";
    // standard WhatsApp formatting e.g. 5511999999999
    if (phone.startsWith("55") && phone.length >= 12) {
      const ddd = phone.substring(2, 4);
      const isMobile = phone.length === 13;
      const firstPart = isMobile ? phone.substring(4, 9) : phone.substring(4, 8);
      const secondPart = isMobile ? phone.substring(9) : phone.substring(8);
      return `+55 (${ddd}) ${firstPart}-${secondPart}`;
    }
    return `+${phone}`;
  };

  return (
    <div className="flex-1 flex h-full min-h-0">
      {/* Real WhatsApp Contacts Sidebar */}
      <div className="w-80 border-r border-[var(--border)] bg-[rgba(13,13,28,0.35)] flex flex-col shrink-0">
        {/* Search Header */}
        <div className="p-4 border-b border-[var(--border)] space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-[var(--font-display)] font-bold text-sm tracking-wide text-[var(--text-1)] uppercase">
              Contatos WA
            </h3>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[var(--text-2)] hover:text-[var(--text-1)] disabled:opacity-40 transition-colors cursor-pointer"
              title="Atualizar conversas"
            >
              <i className={`fa-solid fa-arrows-rotate text-xs ${refreshing ? "animate-spin text-[var(--accent)]" : ""}`}></i>
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Filtrar por telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="field-input py-1.5 pl-8 pr-8 text-xs font-mono"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-[10px] text-[var(--text-3)]"></i>
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-2.5 text-[10px] text-[var(--text-3)] hover:text-[var(--text-1)]"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </form>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 text-[var(--text-3)] text-xs gap-2">
              <span className="dot-pulse">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span>Buscando contatos...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <i className="fa-solid fa-magnifying-glass-chart text-2xl text-[var(--text-3)] mb-2"></i>
              <p className="text-xs text-[var(--text-2)]">Nenhum registro encontrado</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const lastMsg = conv.messages[conv.messages.length - 1];
              const isSelected = activeChat?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveChat(conv)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-[rgba(240,160,32,0.06)] border-[rgba(240,160,32,0.2)] text-[var(--text-1)]"
                      : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] text-[var(--text-2)]"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-bold text-xs font-mono text-[var(--text-1)] truncate">
                      {formatPhone(conv.phone)}
                    </span>
                    <span className="text-[9px] text-[var(--text-3)] whitespace-nowrap">
                      {new Date(conv.updatedAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-2)] truncate line-clamp-1">
                    {lastMsg ? lastMsg.content : "Sem mensagens..."}
                  </p>
                  <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-[rgba(255,255,255,0.03)] text-[10px] text-[var(--text-3)]">
                    <span>{conv.messages.length} mensagens</span>
                    {isSelected && (
                      <span className="text-[var(--accent)] font-semibold flex items-center gap-1">
                        Selecionado
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Real WhatsApp Messages Logs Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#06060c]">
        {activeChat ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] bg-[#080814] flex justify-between items-center gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[rgba(240,160,32,0.06)] border border-[rgba(240,160,32,0.15)] flex items-center justify-center text-[var(--accent)] font-mono font-bold text-sm">
                  WA
                </div>
                <div className="min-w-0">
                  <h2 className="font-[var(--font-mono)] font-bold text-sm text-[var(--text-1)] truncate">
                    {formatPhone(activeChat.phone)}
                  </h2>
                  <p className="text-[10px] text-[var(--text-3)] mt-0.5">
                    ID: {activeChat.id} | Início em {formatBrazilianDate(activeChat.createdAt)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] px-2 py-1 rounded bg-[rgba(45,212,191,0.06)] border border-[rgba(45,212,191,0.15)] text-[var(--ai)] font-[var(--font-mono)]">
                  AUTOMATIZADO VIA EVOLUTION
                </span>
              </div>
            </div>

            {/* Message Viewport */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {error && (
                <div className="mx-auto max-w-xl text-center text-xs text-[var(--error)] bg-[var(--error-dim)] border border-[rgba(248,113,113,0.15)] rounded-lg p-3 flex items-center justify-center gap-2 mb-4">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>{error}</span>
                </div>
              )}

              <div className="max-w-3xl mx-auto space-y-4">
                {activeChat.messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 max-w-[85%] ${
                        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                      } animate-fade-up`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold ${
                          isUser
                            ? "bg-[#101024] text-[var(--text-2)] border border-[var(--border)]"
                            : "bg-[var(--ai-dim)] text-[var(--ai)] border border-[var(--ai-border)]"
                        }`}
                      >
                        {isUser ? <i className="fa-brands fa-whatsapp"></i> : "L"}
                      </div>

                      {/* Bubble */}
                      <div className="flex flex-col">
                        <div
                          className={`rounded-2xl px-4 py-3 border text-sm leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? "bg-[#0c0c1e] border-[var(--border-2)] text-[var(--text-1)]"
                              : "bg-[rgba(13,13,28,0.7)] border-[var(--border)] text-[var(--text-1)] shadow-md"
                          }`}
                        >
                          {msg.content}
                        </div>
                        
                        {/* Message Metadata */}
                        <div className="flex items-center gap-2 mt-1.5 px-2 text-[9px] text-[var(--text-3)] font-[var(--font-mono)]">
                          <span>{formatBrazilianDate(msg.createdAt)}</span>
                          {!isUser && msg.tokens && (
                            <>
                              <span>•</span>
                              <span className="text-[var(--ai)] flex items-center gap-0.5">
                                <i className="fa-solid fa-bolt text-[8px]"></i>
                                {msg.tokens} tokens
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Bottom Info Status bar */}
            <div className="p-3 border-t border-[var(--border)] bg-[#070712] text-center text-[10px] text-[var(--text-3)] shrink-0">
              <i className="fa-solid fa-shield-halved text-[9px] mr-1 text-[var(--success)]"></i>
              <span>Esta conversa está sendo sincronizada em tempo real via webhook Evolution API</span>
            </div>
          </>
        ) : (
          /* Empty / Instructions state */
          <div className="max-w-xl mx-auto flex flex-col items-center justify-center h-full text-center px-4 animate-fade-up">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)] text-2xl mb-6 shadow-[0_0_20px_rgba(240,160,32,0.1)]">
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <h1 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-[var(--text-1)] mb-2">
              Histórico Real do WhatsApp
            </h1>
            <p className="text-sm text-[var(--text-2)] max-w-sm mb-6 leading-relaxed">
              Nenhuma conversa real foi recebida no banco SQLite ainda.
            </p>
            <div className="card text-left text-xs bg-[#090914] border-[var(--border)] p-4 space-y-3">
              <span className="font-bold text-[var(--text-1)] uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <i className="fa-solid fa-circle-info text-[var(--accent)]"></i> Como receber mensagens reais aqui?
              </span>
              <ol className="list-decimal list-inside space-y-2 text-[var(--text-2)] leading-relaxed">
                <li>Configure o pool de conexão do WhatsApp na sua <strong>Evolution API</strong>.</li>
                <li>Adicione seu número à lista de permitidos ou deixe vazia na aba de <strong>Configurações</strong>.</li>
                <li>Copie a URL do Webhook do painel e cole-a no painel do Evolution para eventos de mensagens.</li>
                <li>Mande uma mensagem para o número do WhatsApp configurado! O webhook processará e salvará o histórico automaticamente.</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
