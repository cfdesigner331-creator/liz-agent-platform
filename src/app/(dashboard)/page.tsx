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

interface AgentConfig {
  aiProvider: string;
  openaiModel: string;
  groqModel: string;
  geminiModel: string;
}

export default function PlaygroundPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Suggested prompt chips for the simulated customer
  const suggestionChips = [
    "Olá! Quero encomendar camisetas.",
    "Vocês fazem bordado personalizado?",
    "Qual o valor mínimo para Silk-Screen?",
    "Quero orçamento de 30 moletons.",
  ];

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Fetch Config
      const configRes = await fetch("/api/config");
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }

      // 2. Fetch Conversations
      const chatRes = await fetch("/api/chat");
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setConversations(chatData);
        if (chatData.length > 0) {
          setActiveChat(chatData[0]);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Falha ao se conectar com a API local.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-scroll to bottom of active chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, sending]);

  const startNewSimulation = async () => {
    setActiveChat(null);
    setInputMessage("");
  };

  const selectConversation = (conv: Conversation) => {
    setActiveChat(conv);
  };

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || sending) return;
    setError("");
    setSending(true);

    const activeId = activeChat?.id || null;
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageText,
      tokens: null,
      createdAt: new Date().toISOString(),
    };

    // Optimistically update the active chat if it exists
    if (activeChat) {
      setActiveChat((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, tempUserMsg],
        };
      });
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeId,
          message: messageText,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao gerar resposta da IA");
      }

      const data = await response.json();
      
      // Update conversations list and active conversation
      const updatedRes = await fetch("/api/chat");
      if (updatedRes.ok) {
        const updatedList: Conversation[] = await updatedRes.json();
        setConversations(updatedList);
        const match = updatedList.find((c) => c.id === data.conversationId);
        if (match) {
          setActiveChat(match);
        }
      }
      setInputMessage("");
    } catch (err: any) {
      setError(err.message || "Erro de conexão ao enviar mensagem.");
      // Rollback optimistic update by fetching list again
      fetchData();
    } finally {
      setSending(false);
    }
  };

  const getActiveModelName = () => {
    if (!config) return "Carregando...";
    if (config.aiProvider === "groq") {
      return `Groq / ${config.groqModel}`;
    }
    if (config.aiProvider === "gemini") {
      return `Google Gemini / ${config.geminiModel}`;
    }
    return `OpenAI / ${config.openaiModel}`;
  };

  const getActiveChatTokens = () => {
    if (!activeChat) return 0;
    return activeChat.messages.reduce((acc, msg) => acc + (msg.tokens || 0), 0);
  };

  return (
    <div className="flex-1 flex h-full min-h-0">
      {/* Simulation History Sidebar */}
      <div className="w-80 border-r border-[var(--border)] bg-[rgba(13,13,28,0.35)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center gap-2">
          <h3 className="font-[var(--font-display)] font-bold text-sm tracking-wide text-[var(--text-1)] uppercase">
            Simulações
          </h3>
          <button
            onClick={startNewSimulation}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent)] hover:opacity-90 active:scale-95 transition-all text-xs font-semibold cursor-pointer"
          >
            <i className="fa-solid fa-plus"></i>
            <span>Nova</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[var(--text-3)] text-xs gap-2">
              <span className="dot-pulse">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span>Carregando simulações...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <i className="fa-solid fa-ghost text-2xl text-[var(--text-3)] mb-2"></i>
              <p className="text-xs text-[var(--text-2)]">Nenhuma simulação ativa</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const lastMsg = conv.messages[conv.messages.length - 1];
              const isSelected = activeChat?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-[rgba(240,160,32,0.06)] border-[rgba(240,160,32,0.2)] text-[var(--text-1)]"
                      : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] text-[var(--text-2)]"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-bold text-xs truncate text-[var(--text-1)]">
                      Sessão #{conv.id.substring(conv.id.length - 6)}
                    </span>
                    <span className="text-[9px] text-[var(--text-3)] whitespace-nowrap">
                      {new Date(conv.updatedAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-2)] truncate line-clamp-1">
                    {lastMsg ? lastMsg.content : "Sem mensagens ainda..."}
                  </p>
                  <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-[rgba(255,255,255,0.03)] text-[10px]">
                    <span className="text-[var(--text-3)]">
                      {conv.messages.length} mensagens
                    </span>
                    {isSelected && (
                      <span className="text-[var(--accent)] font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping"></span>
                        Ativo
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Interactive Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#06060c]">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] bg-[#080814] flex justify-between items-center gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--ai-dim)] border border-[var(--ai-border)] flex items-center justify-center text-[var(--ai)]">
              <i className="fa-solid fa-robot text-lg"></i>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] truncate">
                  {activeChat
                    ? `Simulador - Sessão #${activeChat.id.substring(activeChat.id.length - 6)}`
                    : "Nova Simulação"}
                </h2>
                <span className="status-pulse"></span>
              </div>
              <p className="text-[11px] text-[var(--text-3)] truncate mt-0.5 flex items-center gap-1">
                <i className="fa-solid fa-microchip text-[10px]"></i>
                <span>{getActiveModelName()}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeChat && (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[rgba(45,212,191,0.06)] border border-[rgba(45,212,191,0.15)] text-[var(--ai)] font-[var(--font-mono)]">
                <i className="fa-solid fa-bolt-lightning"></i>
                <span>{getActiveChatTokens()} tokens consumidos</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="mx-auto max-w-xl text-center text-xs text-[var(--error)] bg-[var(--error-dim)] border border-[rgba(248,113,113,0.15)] rounded-lg p-3 flex items-center justify-center gap-2 mb-4 animate-fade-up">
              <i className="fa-solid fa-triangle-exclamation text-sm"></i>
              <span>{error}</span>
            </div>
          )}

          {!activeChat ? (
            /* Welcome / New Simulation Screen */
            <div className="max-w-2xl mx-auto flex flex-col items-center justify-center h-full text-center px-4 animate-fade-up">
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)] text-2xl mb-6 shadow-[0_0_20px_rgba(240,160,32,0.1)]">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
              </div>
              <h1 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-[var(--text-1)] mb-2">
                Simulador de Atendimento Comercial
              </h1>
              <p className="text-sm text-[var(--text-2)] max-w-md mb-8 leading-relaxed">
                Interaja diretamente com a Liz neste ambiente de teste. Simule um
                cliente enviando mensagens para analisar as respostas da IA, regras de
                minutos/pedidos e a extração estruturada de leads de forma isolada do WhatsApp.
              </p>

              {/* Suggestions Grid */}
              <div className="w-full">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-3)] block mb-3">
                  Escolha um prompt rápido para simular:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {suggestionChips.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(chip)}
                      className="p-3 text-left rounded-xl border border-[var(--border)] bg-[#0a0a14] text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--accent)] hover:bg-[rgba(240,160,32,0.02)] transition-all cursor-pointer group flex justify-between items-center"
                    >
                      <span className="truncate">{chip}</span>
                      <i className="fa-solid fa-arrow-right text-[10px] text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors ml-2"></i>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Active Simulation Messages */
            <div className="max-w-3xl mx-auto space-y-4">
              {activeChat.messages.length === 0 ? (
                <div className="text-center py-16 text-[var(--text-2)] text-xs flex flex-col items-center gap-2">
                  <i className="fa-solid fa-circle-nodes text-2xl text-[var(--text-3)] mb-2"></i>
                  <span>A simulação foi criada. Envie uma mensagem abaixo para iniciar!</span>
                </div>
              ) : (
                activeChat.messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 max-w-[80%] ${
                        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                      } animate-fade-up`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold ${
                          isUser
                            ? "bg-[#1C1C38] text-[var(--text-2)] border border-[var(--border)]"
                            : "bg-[var(--ai-dim)] text-[var(--ai)] border border-[var(--ai-border)]"
                        }`}
                      >
                        {isUser ? <i className="fa-solid fa-user"></i> : "L"}
                      </div>

                      {/* Bubble */}
                      <div className="flex flex-col">
                        <div
                          className={`rounded-2xl px-4 py-3 border text-sm leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? "bg-[#090918] border-[var(--border-2)] text-[var(--text-1)]"
                              : "bg-[rgba(13,13,28,0.7)] border-[var(--border)] text-[var(--text-1)] shadow-md"
                          }`}
                        >
                          {msg.content}
                        </div>
                        {/* Token Tag for AI */}
                        {!isUser && msg.tokens && (
                          <span className="text-[9px] font-[var(--font-mono)] text-[var(--text-3)] mt-1.5 flex items-center gap-1 ml-2">
                            <i className="fa-solid fa-bolt text-[8px] text-[var(--ai)]"></i>
                            <span>IA processou em {msg.tokens} tokens</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* AI Typing Pulse */}
              {sending && (
                <div className="flex gap-3 max-w-[80%] mr-auto animate-fade-up">
                  <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold bg-[var(--ai-dim)] text-[var(--ai)] border border-[var(--ai-border)]">
                    L
                  </div>
                  <div className="flex flex-col">
                    <div className="rounded-2xl px-4 py-3 border border-[var(--border)] bg-[rgba(13,13,28,0.7)] flex items-center justify-center">
                      <span className="dot-pulse">
                        <span></span>
                        <span></span>
                        <span></span>
                      </span>
                    </div>
                    <span className="text-[9px] font-[var(--font-mono)] text-[var(--text-3)] mt-1 ml-2">
                      Liz está digitando...
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Message Input Area */}
        <div className="p-4 border-t border-[var(--border)] bg-[#070712] shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* suggestions inline bar if chat is active but has very few messages */}
            {activeChat && activeChat.messages.length < 3 && !sending && (
              <div className="flex flex-wrap gap-2 mb-3 items-center">
                <span className="text-[9px] text-[var(--text-3)] font-bold uppercase tracking-wide mr-1">
                  Sugestões:
                </span>
                {suggestionChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(chip)}
                    className="px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[#0b0b18] hover:border-[var(--accent)] hover:text-[var(--accent)] text-[10px] font-semibold text-[var(--text-2)] cursor-pointer transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputMessage);
              }}
              className="flex gap-2.5 items-center bg-[#0d0d1c] border border-[var(--border)] rounded-xl p-1.5 focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-dim)] transition-all"
            >
              <input
                type="text"
                placeholder={
                  activeChat
                    ? "Digite uma mensagem para simular o cliente..."
                    : "Escolha uma sugestão ou escreva algo acima para iniciar a simulação"
                }
                disabled={sending}
                className="flex-1 bg-transparent border-none text-sm text-[var(--text-1)] placeholder-[var(--text-3)] py-2 px-3 focus:outline-none"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || sending}
                className="btn-primary w-10 h-10 p-0 rounded-lg shrink-0 flex items-center justify-center"
              >
                <i className="fa-solid fa-paper-plane text-xs"></i>
              </button>
            </form>
            <div className="flex justify-between items-center text-[10px] text-[var(--text-3)] px-1 mt-2">
              <span>* Pressione Enter para enviar</span>
              <span>Liz Inteligência Comercial v2.4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
