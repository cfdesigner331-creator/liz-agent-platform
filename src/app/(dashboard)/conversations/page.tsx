"use client";

import { useState, useEffect, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "model" | string;
  content: string;
  tokens: number | null;
  mediaType?: string | null;
  mediaCaption?: string | null;
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

interface ConvSummary {
  conversationId: string;
  phone: string | null;
  totalMessages: number;
  userMessages: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
  summary: {
    nome?: string | null;
    interesse?: string | null;
    quantidade?: string | null;
    status?: string;
    pontosPrincipais?: string[];
    proximosPassos?: string | null;
    resumo?: string;
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  em_andamento: { label: "Em Andamento", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25" },
  fechado: { label: "Fechado ✓", color: "text-green-400 bg-green-400/10 border-green-400/25" },
  perdido: { label: "Perdido", color: "text-red-400 bg-red-400/10 border-red-400/25" },
  qualificado: { label: "Qualificado", color: "text-blue-400 bg-blue-400/10 border-blue-400/25" },
  pendente: { label: "Pendente", color: "text-purple-400 bg-purple-400/10 border-purple-400/25" },
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "summary">("chat");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ConvSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

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
        if (data.length > 0) {
          if (activeChat) {
            const current = data.find((c: Conversation) => c.id === activeChat.id);
            setActiveChat(current || data[0]);
          } else {
            setActiveChat(data[0]);
          }
        } else {
          setActiveChat(null);
        }
      } else {
        setError("Erro ao carregar dados do histórico.");
      }
    } catch {
      setError("Falha ao se conectar com o servidor.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchConversations(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeChat?.messages]);

  // Quando muda de conversa, limpa o resumo
  useEffect(() => {
    setSummary(null);
    setSummaryError("");
    setActiveTab("chat");
  }, [activeChat?.id]);

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

  const handleLoadSummary = async () => {
    if (!activeChat) return;
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const res = await fetch(`/api/conversations/${activeChat.id}/summary`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        const err = await res.json();
        setSummaryError(err.error || "Erro ao gerar resumo.");
      }
    } catch {
      setSummaryError("Falha ao conectar com o servidor.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const formatBrazilianDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return isoString; }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "Desconhecido";
    if (phone.startsWith("55") && phone.length >= 12) {
      const ddd = phone.substring(2, 4);
      const isMobile = phone.length === 13;
      const firstPart = isMobile ? phone.substring(4, 9) : phone.substring(4, 8);
      const secondPart = isMobile ? phone.substring(9) : phone.substring(8);
      return `+55 (${ddd}) ${firstPart}-${secondPart}`;
    }
    return `+${phone}`;
  };

  const mediaIcon = (type: string | null | undefined) => {
    if (type === "audio") return <i className="fa-solid fa-microphone text-[9px] text-green-400 mr-1"></i>;
    if (type === "image") return <i className="fa-solid fa-image text-[9px] text-blue-400 mr-1"></i>;
    if (type === "document") return <i className="fa-solid fa-file-pdf text-[9px] text-red-400 mr-1"></i>;
    return null;
  };

  return (
    <div className="flex-1 flex h-full min-h-0 min-w-0">
      {/* Sidebar */}
      <div className="w-80 border-r border-[var(--border)] bg-[rgba(13,13,28,0.35)] flex flex-col shrink-0">
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
              <button type="button" onClick={handleClearSearch}
                className="absolute right-3 top-2.5 text-[10px] text-[var(--text-3)] hover:text-[var(--text-1)]">
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 text-[var(--text-3)] text-xs gap-2">
              <span className="dot-pulse"><span></span><span></span><span></span></span>
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
                      {new Date(conv.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-2)] truncate line-clamp-1">
                    {lastMsg ? lastMsg.content : "Sem mensagens..."}
                  </p>
                  <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-[rgba(255,255,255,0.03)] text-[10px] text-[var(--text-3)]">
                    <span>{conv.messages.length} mensagens</span>
                    {isSelected && (
                      <span className="text-[var(--accent)] font-semibold">Selecionado</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#06060c]">
        {activeChat ? (
          <>
            {/* Header com abas */}
            <div className="px-6 pt-4 border-b border-[var(--border)] bg-[#080814] shrink-0">
              <div className="flex justify-between items-center gap-4 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(240,160,32,0.06)] border border-[rgba(240,160,32,0.15)] flex items-center justify-center text-[var(--accent)] font-mono font-bold text-sm shrink-0">
                    WA
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-[var(--font-mono)] font-bold text-sm text-[var(--text-1)] truncate">
                      {formatPhone(activeChat.phone)}
                    </h2>
                    <p className="text-[10px] text-[var(--text-3)] mt-0.5 font-mono">
                      {activeChat.phone} &nbsp;·&nbsp; {activeChat.messages.length} msgs &nbsp;·&nbsp; desde {formatBrazilianDate(activeChat.createdAt)}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-1 rounded bg-[rgba(45,212,191,0.06)] border border-[rgba(45,212,191,0.15)] text-[var(--ai)] font-[var(--font-mono)] shrink-0">
                  WHATSAPP
                </span>
              </div>

              {/* Tabs */}
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                    activeTab === "chat"
                      ? "border-[var(--accent)] text-[var(--accent-text)]"
                      : "border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"
                  }`}
                >
                  <i className="fa-solid fa-comments mr-1.5 text-[10px]"></i>
                  Histórico
                </button>
                <button
                  onClick={() => { setActiveTab("summary"); if (!summary && !summaryLoading) handleLoadSummary(); }}
                  className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                    activeTab === "summary"
                      ? "border-purple-500 text-purple-400"
                      : "border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"
                  }`}
                >
                  <i className="fa-solid fa-sparkles mr-1.5 text-[10px]"></i>
                  Resumo IA
                </button>
              </div>
            </div>

            {/* TAB: CHAT HISTORY */}
            {activeTab === "chat" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {error && (
                  <div className="mx-auto max-w-xl text-center text-xs text-[var(--error)] bg-[var(--error-dim)] border border-[rgba(248,113,113,0.15)] rounded-lg p-3 flex items-center justify-center gap-2">
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
                        className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"} animate-fade-up`}
                      >
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold ${
                          isUser
                            ? "bg-[#101024] text-[var(--text-2)] border border-[var(--border)]"
                            : "bg-[var(--ai-dim)] text-[var(--ai)] border border-[var(--ai-border)]"
                        }`}>
                          {isUser ? <i className="fa-brands fa-whatsapp"></i> : "L"}
                        </div>

                        <div className="flex flex-col min-w-0">
                          {/* Badge de mídia se houver */}
                          {msg.mediaType && (
                            <div className={`inline-flex items-center gap-1 text-[10px] font-semibold mb-1 px-2 py-0.5 rounded-full w-fit ${
                              msg.mediaType === "audio" ? "bg-green-400/10 text-green-400 border border-green-400/20" :
                              msg.mediaType === "image" ? "bg-blue-400/10 text-blue-400 border border-blue-400/20" :
                              "bg-red-400/10 text-red-400 border border-red-400/20"
                            }`}>
                              {mediaIcon(msg.mediaType)}
                              {msg.mediaType === "audio" ? "🎙️ Áudio transcrito" : msg.mediaType === "image" ? "📷 Imagem analisada" : "📄 Documento lido"}
                            </div>
                          )}

                          <div className={`rounded-2xl px-4 py-3 border text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            isUser
                              ? "bg-[#0c0c1e] border-[var(--border-2)] text-[var(--text-1)]"
                              : "bg-[rgba(13,13,28,0.7)] border-[var(--border)] text-[var(--text-1)] shadow-md"
                          }`}>
                            {msg.content}
                          </div>

                          {/* Contexto de mídia (transcrição/descrição) */}
                          {msg.mediaCaption && (
                            <div className="mt-1.5 px-3 py-2 rounded-xl bg-[rgba(168,85,247,0.05)] border border-[rgba(168,85,247,0.15)] text-[10px] text-[var(--text-3)] leading-relaxed max-w-sm">
                              <span className="text-purple-400 font-semibold text-[9px] uppercase tracking-wide block mb-0.5">
                                {msg.mediaType === "audio" ? "Transcrição" : msg.mediaType === "image" ? "Análise visual" : "Conteúdo do documento"}
                              </span>
                              {msg.mediaCaption.substring(0, 200)}{msg.mediaCaption.length > 200 ? "..." : ""}
                            </div>
                          )}

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
            )}

            {/* TAB: SUMMARY */}
            {activeTab === "summary" && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto space-y-4">

                  {summaryLoading && (
                    <div className="flex flex-col items-center justify-center py-16 gap-4 text-[var(--text-3)]">
                      <div className="w-14 h-14 rounded-2xl bg-[rgba(168,85,247,0.08)] border border-[rgba(168,85,247,0.2)] flex items-center justify-center">
                        <i className="fa-solid fa-sparkles text-purple-400 text-xl animate-pulse"></i>
                      </div>
                      <div className="space-y-1 text-center">
                        <p className="text-sm text-[var(--text-2)] font-semibold">Gemini analisando a conversa...</p>
                        <p className="text-xs text-[var(--text-3)]">Isso pode levar alguns segundos</p>
                      </div>
                    </div>
                  )}

                  {summaryError && (
                    <div className="p-4 rounded-xl bg-[var(--error-dim)] border border-[rgba(248,113,113,0.2)] text-xs text-[var(--error)] flex items-center gap-2">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span>{summaryError}</span>
                    </div>
                  )}

                  {summary && !summaryLoading && (
                    <>
                      {/* Client card */}
                      <div className="card border-[rgba(240,160,32,0.15)] bg-[rgba(240,160,32,0.03)] space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] text-[var(--text-3)] uppercase font-bold tracking-wider mb-1">Cliente</p>
                            <h2 className="font-[var(--font-display)] text-xl font-bold text-[var(--text-1)]">
                              {summary.summary.nome || "Nome não identificado"}
                            </h2>
                            <p className="font-mono text-sm text-[var(--text-2)] mt-0.5">{formatPhone(summary.phone)}</p>
                          </div>
                          {summary.summary.status && STATUS_LABELS[summary.summary.status] && (
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${STATUS_LABELS[summary.summary.status].color}`}>
                              {STATUS_LABELS[summary.summary.status].label}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--border)]">
                          <div className="text-center">
                            <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wide">Mensagens</p>
                            <p className="text-lg font-bold text-[var(--text-1)] font-mono">{summary.totalMessages}</p>
                          </div>
                          <div className="text-center border-x border-[var(--border)]">
                            <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wide">Do Cliente</p>
                            <p className="text-lg font-bold text-[var(--text-1)] font-mono">{summary.userMessages}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wide">Tokens</p>
                            <p className="text-lg font-bold text-[var(--ai)] font-mono">{summary.totalTokens}</p>
                          </div>
                        </div>
                      </div>

                      {/* Resumo geral */}
                      {summary.summary.resumo && (
                        <div className="card space-y-2">
                          <p className="text-[10px] text-purple-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                            <i className="fa-solid fa-sparkles text-[9px]"></i>
                            Resumo Executivo
                          </p>
                          <p className="text-sm text-[var(--text-2)] leading-relaxed">{summary.summary.resumo}</p>
                        </div>
                      )}

                      {/* Produto / quantidade */}
                      {(summary.summary.interesse || summary.summary.quantidade) && (
                        <div className="grid grid-cols-2 gap-3">
                          {summary.summary.interesse && (
                            <div className="card space-y-1.5">
                              <p className="text-[10px] text-[var(--text-3)] uppercase font-bold tracking-wider">Interesse</p>
                              <p className="text-sm font-semibold text-[var(--text-1)]">{summary.summary.interesse}</p>
                            </div>
                          )}
                          {summary.summary.quantidade && (
                            <div className="card space-y-1.5">
                              <p className="text-[10px] text-[var(--text-3)] uppercase font-bold tracking-wider">Quantidade</p>
                              <p className="text-sm font-semibold text-[var(--text-1)]">{summary.summary.quantidade}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pontos principais */}
                      {summary.summary.pontosPrincipais && summary.summary.pontosPrincipais.length > 0 && (
                        <div className="card space-y-3">
                          <p className="text-[10px] text-[var(--text-3)] uppercase font-bold tracking-wider flex items-center gap-1.5">
                            <i className="fa-solid fa-list-check text-[9px] text-[var(--accent)]"></i>
                            Pontos-chave da Conversa
                          </p>
                          <ul className="space-y-2">
                            {summary.summary.pontosPrincipais.map((point, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-2)]">
                                <span className="text-[var(--accent)] font-bold text-xs mt-0.5 shrink-0">{i + 1}.</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Próximos passos */}
                      {summary.summary.proximosPassos && (
                        <div className="card border-[rgba(45,212,191,0.15)] space-y-2">
                          <p className="text-[10px] text-[var(--ai)] uppercase font-bold tracking-wider flex items-center gap-1.5">
                            <i className="fa-solid fa-arrow-right text-[9px]"></i>
                            Próximos Passos
                          </p>
                          <p className="text-sm text-[var(--text-2)]">{summary.summary.proximosPassos}</p>
                        </div>
                      )}

                      {/* Regenerar */}
                      <button
                        onClick={handleLoadSummary}
                        disabled={summaryLoading}
                        className="btn-ghost w-full text-xs cursor-pointer flex items-center justify-center gap-2 py-2.5"
                      >
                        <i className="fa-solid fa-rotate-right text-[10px]"></i>
                        Regenerar Resumo
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Bottom bar */}
            <div className="p-3 border-t border-[var(--border)] bg-[#070712] text-center text-[10px] text-[var(--text-3)] shrink-0">
              <i className="fa-solid fa-shield-halved text-[9px] mr-1 text-[var(--success)]"></i>
              <span>Esta conversa está sendo sincronizada em tempo real via webhook Evolution API</span>
            </div>
          </>
        ) : (
          <div className="max-w-xl mx-auto flex flex-col items-center justify-center h-full text-center px-4 animate-fade-up">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)] text-2xl mb-6 shadow-[0_0_20px_rgba(240,160,32,0.1)]">
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <h1 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-[var(--text-1)] mb-2">
              Histórico Real do WhatsApp
            </h1>
            <p className="text-sm text-[var(--text-2)] max-w-sm mb-6 leading-relaxed">
              Selecione uma conversa na lista à esquerda para ver o histórico ou o resumo gerado por IA.
            </p>
            <div className="card text-left text-xs bg-[#090914] border-[var(--border)] p-4 space-y-3">
              <span className="font-bold text-[var(--text-1)] uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <i className="fa-solid fa-circle-info text-[var(--accent)]"></i> Como receber mensagens reais aqui?
              </span>
              <ol className="list-decimal list-inside space-y-2 text-[var(--text-2)] leading-relaxed">
                <li>Configure o pool de conexão do WhatsApp na sua <strong>Evolution API</strong>.</li>
                <li>Adicione seu número à lista de permitidos ou deixe vazia nas Configurações.</li>
                <li>Copie a URL do Webhook e cole no painel do Evolution para eventos de mensagens.</li>
                <li>Mande uma mensagem! O webhook processará e salvará o histórico automaticamente.</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
