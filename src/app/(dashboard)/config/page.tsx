"use client";

import { useState, useEffect } from "react";

interface AgentConfig {
  id?: string;
  name: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  evolutionUrl: string;
  evolutionApiKey: string;
  instanceId: string;
  historyLimit: number;
  enabled: boolean;
  allowedPhones: string;
  aiProvider: string;
  openaiApiKey: string;
  openaiModel: string;
  groqApiKey: string;
  groqModel: string;
  geminiApiKey: string;
  geminiModel: string;
  audioResponseMode: string;
  ttsVoice: string;
  ttsProvider: string;
  cartesiaApiKey: string;
  cartesiaVoiceId: string;
  scheduleEnabled: boolean;
  scheduleTimezone: string;
  scheduleDays: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  scheduleOffMessage: string;
  scheduleMode?: string;
  schedulePlantaoStart1?: string;
  schedulePlantaoEnd1?: string;
  schedulePlantaoStart2?: string;
  schedulePlantaoEnd2?: string;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<AgentConfig>({
    name: "Liz Agent",
    systemPrompt: "",
    temperature: 0.4,
    maxTokens: 1024,
    evolutionUrl: "",
    evolutionApiKey: "",
    instanceId: "",
    historyLimit: 12,
    enabled: true,
    allowedPhones: "",
    aiProvider: "openai",
    openaiApiKey: "",
    openaiModel: "gpt-4.1-mini",
    groqApiKey: "",
    groqModel: "llama-3.3-70b-versatile",
    geminiApiKey: "",
    geminiModel: "gemini-2.5-flash-lite",
    audioResponseMode: "on_audio",
    ttsVoice: "Kore",
    ttsProvider: "gemini",
    cartesiaApiKey: "sk_car_3yj7jJ1y5HpBhDNRGfBvHG",
    cartesiaVoiceId: "c9611be8-aae9-4a93-bb1c-98dd6b7d52a4",
    scheduleEnabled: false,
    scheduleTimezone: "America/Sao_Paulo",
    scheduleDays: "[1,2,3,4,5]",
    scheduleStartTime: "08:00",
    scheduleEndTime: "18:00",
    scheduleOffMessage: "Olá! No momento estou fora do horário de atendimento. Em breve retornarei! 😊",
    scheduleMode: "normal",
    schedulePlantaoStart1: "07:30",
    schedulePlantaoEnd1: "12:00",
    schedulePlantaoStart2: "13:00",
    schedulePlantaoEnd2: "17:30",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showCartesiaKey, setShowCartesiaKey] = useState(false);
  const [showEvoKey, setShowEvoKey] = useState(false);
  const [copied, setCopied] = useState(false);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<"ai" | "instructions" | "evolution" | "voice" | "schedule">("ai");

  useEffect(() => {
    // Generate full webhook URL dynamically based on location
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/webhook`);
    }

    const loadConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/config");
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
        } else {
          setError("Falha ao recuperar configurações salvas.");
        }
      } catch (err) {
        setError("Erro ao se conectar com o servidor.");
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        setSuccess("Configurações atualizadas com sucesso!");
        setTimeout(() => setSuccess(""), 4000);
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Erro de rede");
      }
    } catch (err: any) {
      setError(err.message || "Erro desconhecido ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof AgentConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-3)] text-sm gap-2">
        <span className="dot-pulse">
          <span></span>
          <span></span>
          <span></span>
        </span>
        <span>Carregando painel de controle...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-8 animate-fade-up">
      {/* Top Header */}
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-[var(--text-1)]">
            Painel de Configuração
          </h1>
          <p className="text-xs text-[var(--text-2)] mt-1">
            Orquestre as conexões de inteligência artificial e configure o canal de WhatsApp.
          </p>
        </div>

        {/* Global Agent Toggle Badge */}
        <button
          onClick={() => updateField("enabled", !config.enabled)}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
            config.enabled
              ? "bg-[rgba(74,222,128,0.06)] border-[rgba(74,222,128,0.2)] text-[var(--success)]"
              : "bg-[rgba(248,113,113,0.06)] border-[rgba(248,113,113,0.2)] text-[var(--error)]"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${config.enabled ? "bg-[var(--success)] animate-pulse" : "bg-[var(--error)]"}`} />
          <span>AUTOMAÇÃO: {config.enabled ? "ATIVADA" : "DESATIVADA"}</span>
        </button>
      </div>

      {/* Webhook Quickbox Widget */}
      <div className="card border-[rgba(45,212,191,0.15)] bg-[rgba(13,13,28,0.4)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 shadow-[0_0_20px_rgba(45,212,191,0.03)]">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--ai)] flex items-center gap-1.5">
            <i className="fa-solid fa-link"></i> Endpoint Público de Integração
          </span>
          <p className="text-xs text-[var(--text-2)] max-w-xl">
            Configure este webhook na sua Evolution API no evento <code className="bg-[#1C1C38] px-1 rounded text-[var(--text-1)] text-[10px] font-mono">MESSAGES_UPSERT</code> para capturar interações automaticamente.
          </p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-2">
          <input
            type="text"
            readOnly
            value={webhookUrl}
            className="field-input text-xs font-mono text-[var(--text-2)] bg-[#070712] max-w-sm md:w-[320px] select-all cursor-text py-2 px-3 border border-[rgba(45,212,191,0.1)] focus:border-[var(--ai)]"
          />
          <button
            onClick={handleCopyWebhook}
            className={`btn-ghost px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
              copied
                ? "bg-[var(--success-dim)] border-[var(--success)] text-[var(--success)]"
                : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)]"
            }`}
          >
            {copied ? (
              <>
                <i className="fa-solid fa-circle-check"></i>
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-copy"></i>
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Controls */}
      <div className="flex border-b border-[var(--border)] gap-2">
        <button
          onClick={() => setActiveTab("ai")}
          className={`pb-3 px-2 font-[var(--font-display)] text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === "ai"
              ? "border-[var(--accent)] text-[var(--accent-text)] font-bold"
              : "border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"
          }`}
        >
          <i className="fa-solid fa-brain mr-2 text-xs"></i>
          Provedores de IA
        </button>
        <button
          onClick={() => setActiveTab("instructions")}
          className={`pb-3 px-2 font-[var(--font-display)] text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === "instructions"
              ? "border-[var(--accent)] text-[var(--accent-text)] font-bold"
              : "border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"
          }`}
        >
          <i className="fa-solid fa-scroll mr-2 text-xs"></i>
          Prompts & Persona
        </button>
        <button
          onClick={() => setActiveTab("evolution")}
          className={`pb-3 px-2 font-[var(--font-display)] text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === "evolution"
              ? "border-[var(--accent)] text-[var(--accent-text)] font-bold"
              : "border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"
          }`}
        >
          <i className="fa-brands fa-whatsapp mr-2 text-xs"></i>
          Configuração WhatsApp
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("voice")}
          className={`pb-3 px-2 font-[var(--font-display)] text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === "voice"
              ? "border-purple-500 text-purple-400 font-bold"
              : "border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"
          }`}
        >
          <i className="fa-solid fa-microphone-lines mr-2 text-xs"></i>
          Voz &amp; Mídia
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          className={`pb-3 px-2 font-[var(--font-display)] text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === "schedule"
              ? "border-amber-500 text-amber-400 font-bold"
              : "border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"
          }`}
        >
          <i className="fa-solid fa-clock mr-2 text-xs"></i>
          Horário de Atendimento
        </button>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* TAB 1: AI CONFIGURATIONS */}
        {activeTab === "ai" && (
          <div className="space-y-6 animate-fade-up">
            <div className="card space-y-6">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3">
                Seleção de Inteligência
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => updateField("aiProvider", "openai")}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5 ${
                    config.aiProvider === "openai"
                      ? "bg-[rgba(240,160,32,0.06)] border-[rgba(240,160,32,0.35)] text-[var(--text-1)]"
                      : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.01)] text-[var(--text-2)]"
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-sm flex items-center gap-2 text-[var(--text-1)]">
                      <i className="fa-solid fa-microchip text-xs"></i> OpenAI
                    </span>
                    {config.aiProvider === "openai" && (
                      <i className="fa-solid fa-circle-check text-[var(--accent)]"></i>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--text-3)] leading-relaxed">
                    Uso recomendado em produção. Inteligência refinada do GPT-4.1-mini para extração exata de dados.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => updateField("aiProvider", "groq")}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5 ${
                    config.aiProvider === "groq"
                      ? "bg-[rgba(240,160,32,0.06)] border-[rgba(240,160,32,0.35)] text-[var(--text-1)]"
                      : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.01)] text-[var(--text-2)]"
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-sm flex items-center gap-2 text-[var(--text-1)]">
                      <i className="fa-solid fa-bolt text-xs"></i> Groq (Llama)
                    </span>
                    {config.aiProvider === "groq" && (
                      <i className="fa-solid fa-circle-check text-[var(--accent)]"></i>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--text-3)] leading-relaxed">
                    Velocidades extremas de token por segundo e menores custos usando o modelo comercial Llama-3.3-70b.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => updateField("aiProvider", "gemini")}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5 ${
                    config.aiProvider === "gemini"
                      ? "bg-[rgba(168,85,247,0.06)] border-[rgba(168,85,247,0.35)] text-[var(--text-1)]"
                      : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.01)] text-[var(--text-2)]"
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-sm flex items-center gap-2 text-[var(--text-1)]">
                      <i className="fa-solid fa-wand-magic-sparkles text-xs text-purple-400"></i> Google Gemini
                    </span>
                    {config.aiProvider === "gemini" && (
                      <i className="fa-solid fa-circle-check text-purple-400"></i>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--text-3)] leading-relaxed">
                    Modelo de última geração gemini-2.5-flash-lite. Inteligência extremamente veloz, responsiva e otimizada.
                  </span>
                </button>
              </div>

              {/* Dynamic Keys Form Fields */}
              {config.aiProvider === "openai" && (
                <div className="space-y-4 animate-fade-up">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-2)]">
                        OpenAI Model Name
                      </label>
                      <input
                        type="text"
                        value={config.openaiModel}
                        onChange={(e) => updateField("openaiModel", e.target.value)}
                        className="field-input text-xs font-mono"
                        placeholder="Ex: gpt-4.1-mini"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-2)] flex justify-between items-center">
                        <span>OpenAI API Key</span>
                        <button
                          type="button"
                          onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                          className="text-[10px] text-[var(--accent-text)] hover:underline"
                        >
                          {showOpenaiKey ? "Ocultar" : "Mostrar"}
                        </button>
                      </label>
                      <input
                        type={showOpenaiKey ? "text" : "password"}
                        value={config.openaiApiKey}
                        onChange={(e) => updateField("openaiApiKey", e.target.value)}
                        className="field-input text-xs font-mono"
                        placeholder="sk-..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {config.aiProvider === "groq" && (
                <div className="space-y-4 animate-fade-up">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-2)]">
                        Groq Model Name
                      </label>
                      <input
                        type="text"
                        value={config.groqModel}
                        onChange={(e) => updateField("groqModel", e.target.value)}
                        className="field-input text-xs font-mono"
                        placeholder="Ex: llama-3.3-70b-versatile"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-2)] flex justify-between items-center">
                        <span>Groq API Key</span>
                        <button
                          type="button"
                          onClick={() => setShowGroqKey(!showGroqKey)}
                          className="text-[10px] text-[var(--accent-text)] hover:underline"
                        >
                          {showGroqKey ? "Ocultar" : "Mostrar"}
                        </button>
                      </label>
                      <input
                        type={showGroqKey ? "text" : "password"}
                        value={config.groqApiKey}
                        onChange={(e) => updateField("groqApiKey", e.target.value)}
                        className="field-input text-xs font-mono"
                        placeholder="gsk_..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {config.aiProvider === "gemini" && (
                <div className="space-y-4 animate-fade-up">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-2)]">
                        Gemini Model Name
                      </label>
                      <input
                        type="text"
                        value={config.geminiModel}
                        onChange={(e) => updateField("geminiModel", e.target.value)}
                        className="field-input text-xs font-mono"
                        placeholder="Ex: gemini-2.5-flash-lite"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-2)] flex justify-between items-center">
                        <span>Gemini API Key</span>
                        <button
                          type="button"
                          onClick={() => setShowGeminiKey(!showGeminiKey)}
                          className="text-[10px] text-[var(--accent-text)] hover:underline"
                        >
                          {showGeminiKey ? "Ocultar" : "Mostrar"}
                        </button>
                      </label>
                      <input
                        type={showGeminiKey ? "text" : "password"}
                        value={config.geminiApiKey}
                        onChange={(e) => updateField("geminiApiKey", e.target.value)}
                        className="field-input text-xs font-mono"
                        placeholder="AIzaSy..."
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tuning parameters card */}
            <div className="card space-y-6">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3">
                Parâmetros e Consumo
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sliders and limits */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-[var(--text-2)]">
                    <span>Criatividade (Temperature)</span>
                    <span className="text-[var(--accent-text)] font-mono">{config.temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.temperature}
                    onChange={(e) => updateField("temperature", parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#1A1A3A] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                  />
                  <span className="text-[10px] text-[var(--text-3)] block">
                    Valores baixos tornam as respostas exatas, valores altos aumentam a criatividade.
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-2)]">
                    Limite de Retorno (Max Tokens)
                  </label>
                  <input
                    type="number"
                    value={config.maxTokens}
                    onChange={(e) => updateField("maxTokens", parseInt(e.target.value))}
                    className="field-input text-xs font-mono"
                    min="100"
                    max="8000"
                    required
                  />
                  <span className="text-[10px] text-[var(--text-3)]">
                    Evita respostas excessivamente longas que desperdiçam orçamento de tokens.
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-2)]">
                    Histórico de Memória (Limite)
                  </label>
                  <input
                    type="number"
                    value={config.historyLimit}
                    onChange={(e) => updateField("historyLimit", parseInt(e.target.value))}
                    className="field-input text-xs font-mono"
                    min="2"
                    max="50"
                    required
                  />
                  <span className="text-[10px] text-[var(--text-3)]">
                    Número de mensagens anteriores fornecidas à IA como contexto para entender a conversa.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INSTRUCTIONS & PERSONA */}
        {activeTab === "instructions" && (
          <div className="card space-y-6 animate-fade-up">
            <div className="border-b border-[var(--border)] pb-3 flex justify-between items-center">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)]">
                Instruções de Sistema (Prompt Base)
              </h3>
              <span className="text-[10px] text-[var(--text-3)] uppercase font-[var(--font-mono)]">
                {config.systemPrompt.length} caracteres
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-[var(--text-2)] leading-relaxed">
                Este é o "cérebro" do agente. Defina a personalidade da Liz, os produtos que ela vende, as regras de quantidades e formas de pagamento, e o modelo estruturado para fechar vendas.
              </p>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => updateField("systemPrompt", e.target.value)}
                className="field-input min-h-[420px] font-mono text-xs leading-relaxed"
                placeholder="Insira as diretrizes do robô..."
                required
              />
            </div>
          </div>
        )}

        {/* TAB 3: EVOLUTION CONFIGURATIONS */}
        {activeTab === "evolution" && (
          <div className="card space-y-6 animate-fade-up">
            <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3">
              Credenciais e Modos da Evolution API
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-2)]">
                  Evolution Base URL
                </label>
                <input
                  type="url"
                  value={config.evolutionUrl}
                  onChange={(e) => updateField("evolutionUrl", e.target.value)}
                  className="field-input text-xs font-mono"
                  placeholder="Ex: https://evo.meudominio.com"
                />
                <span className="text-[10px] text-[var(--text-3)]">
                  Endereço base do seu servidor VPS onde o container Evolution API está escutando.
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-2)]">
                  Nome da Instância (Instance Name)
                </label>
                <input
                  type="text"
                  value={config.instanceId}
                  onChange={(e) => updateField("instanceId", e.target.value)}
                  className="field-input text-xs font-mono"
                  placeholder="Ex: liz-whatsapp"
                />
                <span className="text-[10px] text-[var(--text-3)]">
                  O nome exato do pool de conexões criado no painel da sua Evolution API.
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-2)] flex justify-between items-center">
                  <span>Chave de API (Global ApiKey)</span>
                  <button
                    type="button"
                    onClick={() => setShowEvoKey(!showEvoKey)}
                    className="text-[10px] text-[var(--accent-text)] hover:underline"
                  >
                    {showEvoKey ? "Ocultar" : "Mostrar"}
                  </button>
                </label>
                <input
                  type={showEvoKey ? "text" : "password"}
                  value={config.evolutionApiKey}
                  onChange={(e) => updateField("evolutionApiKey", e.target.value)}
                  className="field-input text-xs font-mono"
                  placeholder="SuaApiKeyEvolution..."
                />
                <span className="text-[10px] text-[var(--text-3)]">
                  Utilizado para autenticar os disparos automáticos HTTP de retorno de mensagens.
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-2)]">
                  Lista de Números Permitidos (Piloto)
                </label>
                <input
                  type="text"
                  value={config.allowedPhones}
                  onChange={(e) => updateField("allowedPhones", e.target.value)}
                  className="field-input text-xs font-mono"
                  placeholder="Ex: 5511999999999, 5521988888888"
                />
                <span className="text-[10px] text-[var(--text-3)] font-semibold">
                  * Deixe vazio para responder a QUALQUER número de WhatsApp recebido.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VOICE & MEDIA */}
        {activeTab === "voice" && (
          <div className="space-y-6 animate-fade-up">
            {/* Provedor de Síntese de Voz */}
            <div className="card space-y-6">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                <i className="fa-solid fa-server text-purple-400 text-xs"></i>
                Provedor de Síntese de Voz
              </h3>
              <p className="text-xs text-[var(--text-2)] leading-relaxed">
                Escolha o motor de conversão de texto para fala (TTS). A Cartesia AI oferece vozes de altíssimo realismo e naturalidade (emocionais), enquanto o Google Gemini TTS fornece uma síntese eficiente integrada.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    value: "gemini",
                    label: "Google Gemini TTS",
                    icon: "fa-solid fa-wand-magic-sparkles text-purple-400",
                    desc: "Vozes sintéticas padrão integradas diretamente no Gemini.",
                  },
                  {
                    value: "cartesia",
                    label: "Cartesia AI (Vozes Ultra-Realistas)",
                    icon: "fa-solid fa-sparkles text-purple-400",
                    desc: "Vozes hiper-realistas com emoção e entonação natural humana.",
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField("ttsProvider", opt.value)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-2 ${
                      config.ttsProvider === opt.value
                        ? "bg-[rgba(168,85,247,0.08)] border-[rgba(168,85,247,0.4)] text-[var(--text-1)]"
                        : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.01)] text-[var(--text-2)]"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-bold text-sm flex items-center gap-2 text-[var(--text-1)]">
                        <i className={`${opt.icon} text-xs`}></i>
                        {opt.label}
                      </span>
                      {config.ttsProvider === opt.value && (
                        <i className="fa-solid fa-circle-check text-purple-400 text-sm"></i>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--text-3)] leading-relaxed">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Response Mode */}
            <div className="card space-y-6">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                <i className="fa-solid fa-microphone-lines text-purple-400 text-xs"></i>
                Modo de Resposta por Voz
              </h3>
              <p className="text-xs text-[var(--text-2)] leading-relaxed">
                Define quando a Liz responde com uma <strong>nota de voz</strong> sintetizada pelo Gemini TTS em vez de texto.
                O áudio é gerado em alta qualidade e enviado diretamente como mensagem de voz no WhatsApp.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { value: "never", label: "Nunca", icon: "fa-solid fa-ban", desc: "Sempre responde com texto, mesmo ao receber áudios." },
                  { value: "on_audio", label: "Somente ao Receber Áudio", icon: "fa-solid fa-microphone", desc: "Responde com voz apenas quando o cliente mandar uma nota de voz." },
                  { value: "always", label: "Sempre por Voz", icon: "fa-solid fa-volume-high", desc: "Todas as respostas serão notas de voz (com fallback para texto se o TTS falhar)." },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField("audioResponseMode", opt.value)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-2 ${
                      config.audioResponseMode === opt.value
                        ? "bg-[rgba(168,85,247,0.08)] border-[rgba(168,85,247,0.4)] text-[var(--text-1)]"
                        : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.01)] text-[var(--text-2)]"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-bold text-sm flex items-center gap-2 text-[var(--text-1)]">
                        <i className={`${opt.icon} text-xs text-purple-400`}></i>
                        {opt.label}
                      </span>
                      {config.audioResponseMode === opt.value && (
                        <i className="fa-solid fa-circle-check text-purple-400 text-sm"></i>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--text-3)] leading-relaxed">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* TTS Voice Selection */}
            {config.ttsProvider === "gemini" && (
              <div className="card space-y-6">
                <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                  <i className="fa-solid fa-waveform-lines text-purple-400 text-xs"></i>
                  Voz da Liz (Gemini TTS)
                </h3>
                <p className="text-xs text-[var(--text-2)] leading-relaxed">
                  Escolha a voz sintética usada pelo Gemini TTS. Cada voz possui timbre, entonação e ritmo únicos.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { name: "Kore", desc: "Feminina, calorosa", recommended: true },
                    { name: "Aoede", desc: "Feminina, expressiva" },
                    { name: "Zephyr", desc: "Feminina, suave" },
                    { name: "Leda", desc: "Feminina, clara" },
                    { name: "Puck", desc: "Masculina, jovial" },
                    { name: "Charon", desc: "Masculina, profunda" },
                    { name: "Fenrir", desc: "Masculina, firme" },
                    { name: "Orbit", desc: "Masculina, neutra" },
                  ].map((voice) => (
                    <button
                      key={voice.name}
                      type="button"
                      onClick={() => updateField("ttsVoice", voice.name)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 relative ${
                        config.ttsVoice === voice.name
                          ? "bg-[rgba(168,85,247,0.1)] border-[rgba(168,85,247,0.4)] shadow-[0_0_12px_rgba(168,85,247,0.1)]"
                          : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.01)]"
                      }`}
                    >
                      {voice.recommended && (
                        <span className="absolute top-1.5 right-1.5 text-[8px] px-1.5 py-0.5 rounded bg-[rgba(168,85,247,0.2)] border border-[rgba(168,85,247,0.3)] text-purple-400 font-bold">PADRÃO</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <i className={`fa-solid fa-circle text-[6px] ${config.ttsVoice === voice.name ? "text-purple-400" : "text-[var(--text-3)]"}`}></i>
                        <span className={`font-bold text-sm ${config.ttsVoice === voice.name ? "text-purple-300" : "text-[var(--text-1)]"}`}>{voice.name}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-3)]">{voice.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cartesia TTS Configuration */}
            {config.ttsProvider === "cartesia" && (
              <div className="card space-y-6 animate-fade-up">
                <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                  <i className="fa-solid fa-gears text-purple-400 text-xs"></i>
                  Configurações da Cartesia AI
                </h3>
                <p className="text-xs text-[var(--text-2)] leading-relaxed">
                  Insira as credenciais de autenticação da Cartesia AI e selecione o ID de voz desejado.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)] flex justify-between items-center">
                      <span>Cartesia API Key</span>
                      <button
                        type="button"
                        onClick={() => setShowCartesiaKey(!showCartesiaKey)}
                        className="text-[10px] text-[var(--accent-text)] hover:underline"
                      >
                        {showCartesiaKey ? "Ocultar" : "Mostrar"}
                      </button>
                    </label>
                    <input
                      type={showCartesiaKey ? "text" : "password"}
                      value={config.cartesiaApiKey}
                      onChange={(e) => updateField("cartesiaApiKey", e.target.value)}
                      className="field-input text-xs font-mono"
                      placeholder="sk_car_..."
                      required
                    />
                    <span className="text-[10px] text-[var(--text-3)]">
                      Chave secreta obtida no console da Cartesia para cobrança e autorização.
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">
                      ID de Voz Cartesia (UUID)
                    </label>
                    <input
                      type="text"
                      value={config.cartesiaVoiceId}
                      onChange={(e) => updateField("cartesiaVoiceId", e.target.value)}
                      className="field-input text-xs font-mono"
                      placeholder="Ex: a0e9987c-1f5c-43f1-a675-5841029f9dbe"
                      required
                    />
                    <span className="text-[10px] text-[var(--text-3)]">
                      O identificador UUID único da voz que a Liz usará para falar.
                    </span>
                  </div>
                </div>

                {/* Recomendação de Vozes Cartesia */}
                <div className="space-y-3 pt-2">
                  <label className="text-[11px] uppercase font-bold tracking-wider text-[var(--text-3)] block">
                    Vozes em Português Recomendadas
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      {
                        name: "Isabella (Feminina Premium - Expressiva)",
                        id: "c9611be8-aae9-4a93-bb1c-98dd6b7d52a4",
                        desc: "Voz rica, calorosa e altamente expressiva. Ideal para atendimento humanizado e narrações cativantes.",
                      },
                      {
                        name: "Beatriz (Feminina Suave - Atendimento)",
                        id: "d4b44b9a-82bc-4b65-b456-763fce4c52f9",
                        desc: "Voz amigável, clara e profissional. Perfeita para suporte, guias e conversas formais de vendas.",
                      },
                      {
                        name: "Mirella (Feminina Jovem - Conversacional)",
                        id: "2f4d204f-a5dc-4196-81bc-155986b76ab6",
                        desc: "Voz brilhante, jovem e descontraída. Ideal para diálogos casuais cotidianos e mensagens informais.",
                      },
                      {
                        name: "Bruno (Masculina Premium - Corporativa)",
                        id: "b603811e-54c2-4a0a-8854-09eab9ffa63f",
                        desc: "Voz masculina clara, firme e confiável. Ideal para comunicação corporativa de alta credibilidade.",
                      },
                      {
                        name: "Rafael (Masculina Dinâmica - Carismática)",
                        id: "07b6f895-78b9-4921-8e10-8a21c99c2e8a",
                        desc: "Voz altamente dinâmica, carismática e engajadora. Excelente para marketing e promoções.",
                      },
                      {
                        name: "Gustavo (Masculina Firme - Vendas)",
                        id: "28a942b5-74f3-47bb-9b56-4c3f2562d3ba",
                        desc: "Voz calma, ponderada e estruturada. Suporta conselhos e explanações técnicas de vendas.",
                      },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => updateField("cartesiaVoiceId", v.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 relative ${
                          config.cartesiaVoiceId === v.id
                            ? "bg-[rgba(168,85,247,0.1)] border-[rgba(168,85,247,0.4)] shadow-[0_0_12px_rgba(168,85,247,0.1)]"
                            : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.01)]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 justify-between">
                          <span className={`font-bold text-xs ${config.cartesiaVoiceId === v.id ? "text-purple-300" : "text-[var(--text-1)]"}`}>
                            {v.name}
                          </span>
                          {config.cartesiaVoiceId === v.id && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(168,85,247,0.2)] border border-[rgba(168,85,247,0.3)] text-purple-400 font-bold">ATRIBUÍDO</span>
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--text-3)] leading-relaxed mt-0.5">{v.desc}</span>
                        <code className="text-[9px] font-mono mt-1 text-purple-400/80 bg-[#14142b] py-0.5 px-1.5 rounded self-start truncate max-w-full">
                          {v.id}
                        </code>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Media Processing Info */}
            <div className="card border-[rgba(168,85,247,0.1)] bg-[rgba(13,13,28,0.4)] space-y-4">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                <i className="fa-solid fa-sparkles text-purple-400 text-xs"></i>
                Processamento de Mídia — Gemini Multimodal
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: "fa-solid fa-microphone", color: "text-green-400", bg: "bg-[rgba(74,222,128,0.08)] border-[rgba(74,222,128,0.2)]", title: "Áudio & Notas de Voz", desc: "Transcrição automática de qualquer áudio recebido. A Liz entende e responde ao conteúdo falado." },
                  { icon: "fa-solid fa-image", color: "text-blue-400", bg: "bg-[rgba(96,165,250,0.08)] border-[rgba(96,165,250,0.2)]", title: "Imagens", desc: "Análise visual completa via Gemini Vision — artes, estampas, referências de produto e muito mais." },
                  { icon: "fa-solid fa-file-pdf", color: "text-red-400", bg: "bg-[rgba(248,113,113,0.08)] border-[rgba(248,113,113,0.2)]", title: "Documentos (PDF)", desc: "Leitura e extração de informações de PDFs, planilhas e outros arquivos enviados." },
                ].map((item) => (
                  <div key={item.title} className={`rounded-xl border p-4 ${item.bg} flex flex-col gap-2`}>
                    <div className="flex items-center gap-2">
                      <i className={`${item.icon} ${item.color} text-sm`}></i>
                      <span className="font-bold text-xs text-[var(--text-1)]">{item.title}</span>
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.2)] text-purple-400 font-bold">ATIVO</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-3)] leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[var(--text-3)] border-t border-[var(--border)] pt-3">
                <i className="fa-solid fa-circle-info mr-1 text-purple-400"></i>
                O processamento de mídia requer a <strong className="text-[var(--text-2)]">Gemini API Key</strong> configurada na aba Provedores de IA.
              </p>
            </div>
          </div>
        )}

        {/* TAB 5: HORÁRIO DE ATENDIMENTO */}
        {activeTab === "schedule" && (
          <div className="space-y-6 animate-fade-up">
            {/* Ativação do Horário */}
            <div className="card space-y-6">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] flex items-center gap-2">
                  <i className="fa-solid fa-clock text-amber-400 text-xs"></i>
                  Horário de Funcionamento do Agente
                </h3>
                <button
                  type="button"
                  onClick={() => updateField("scheduleEnabled", !config.scheduleEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                    config.scheduleEnabled ? "bg-amber-500" : "bg-[#1C1C38]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.scheduleEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <p className="text-xs text-[var(--text-2)] leading-relaxed">
                Quando ativado, você pode definir se o agente funcionará em modo comercial comum (atendendo apenas nas horas de expediente) ou em Modo Plantão pós-horário (cobrindo almoços, noites e finais de semana).
              </p>

              {config.scheduleEnabled && (
                <div className="space-y-6 pt-2 animate-fade-up">
                  {/* Seletor de Modo */}
                  <div className="space-y-3">
                    <label className="text-[11px] uppercase font-bold tracking-wider text-[var(--text-3)] block">
                      Modo de Operação do Cronograma
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => updateField("scheduleMode", "normal")}
                        className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-2 ${
                          (config.scheduleMode || "normal") === "normal"
                            ? "bg-[rgba(245,158,11,0.06)] border-[rgba(245,158,11,0.3)] text-[var(--text-1)]"
                            : "bg-[#090914] border-[var(--border)] text-[var(--text-2)] hover:bg-[rgba(255,255,255,0.01)]"
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-bold text-sm flex items-center gap-2 text-[var(--text-1)]">
                            <i className="fa-solid fa-briefcase text-amber-500 text-xs"></i>
                            Expediente Comercial Comum
                          </span>
                          {(config.scheduleMode || "normal") === "normal" && (
                            <i className="fa-solid fa-circle-check text-amber-500 text-sm"></i>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--text-3)] leading-relaxed">
                          A Liz responde apenas no horário comercial configurado e envia mensagem de ausência nos demais horários.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateField("scheduleMode", "plantao")}
                        className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-2 ${
                          config.scheduleMode === "plantao"
                            ? "bg-[rgba(168,85,247,0.06)] border-[rgba(168,85,247,0.3)] text-[var(--text-1)]"
                            : "bg-[#090914] border-[var(--border)] text-[var(--text-2)] hover:bg-[rgba(255,255,255,0.01)]"
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-bold text-sm flex items-center gap-2 text-[var(--text-1)]">
                            <i className="fa-solid fa-shield-halved text-purple-400 text-xs"></i>
                            Modo Plantão / Pós-Horário
                          </span>
                          {config.scheduleMode === "plantao" && (
                            <i className="fa-solid fa-circle-check text-purple-400 text-sm"></i>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--text-3)] leading-relaxed">
                          A Liz atende noites, almoços e fins de semana. Ela silencia totalmente no expediente comercial para que humanos atendam.
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Configurações do Modo Comercial Comum */}
                  {(config.scheduleMode || "normal") === "normal" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--border)] animate-fade-up">
                      {/* Horários de Início e Fim */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-[var(--text-2)]">Horário de Início</label>
                            <input
                              type="time"
                              value={config.scheduleStartTime}
                              onChange={(e) => updateField("scheduleStartTime", e.target.value)}
                              className="field-input text-xs"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-[var(--text-2)]">Horário de Fim</label>
                            <input
                              type="time"
                              value={config.scheduleEndTime}
                              onChange={(e) => updateField("scheduleEndTime", e.target.value)}
                              className="field-input text-xs"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-[var(--text-2)]">Fuso Horário (Timezone)</label>
                          <select
                            value={config.scheduleTimezone}
                            onChange={(e) => updateField("scheduleTimezone", e.target.value)}
                            className="field-input text-xs bg-[#090914] cursor-pointer"
                          >
                            <option value="America/Sao_Paulo">America/Sao_Paulo (Horário de Brasília)</option>
                            <option value="America/Bahia">America/Bahia</option>
                            <option value="America/Manaus">America/Manaus</option>
                            <option value="America/New_York">America/New_York (EST)</option>
                            <option value="Europe/Lisbon">Europe/Lisbon (WET)</option>
                            <option value="Europe/London">Europe/London (GMT)</option>
                          </select>
                        </div>
                      </div>

                      {/* Dias da Semana */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-[var(--text-2)]">Dias de Atendimento</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { num: 1, name: "Segunda-feira" },
                            { num: 2, name: "Terça-feira" },
                            { num: 3, name: "Quarta-feira" },
                            { num: 4, name: "Quinta-feira" },
                            { num: 5, name: "Sexta-feira" },
                            { num: 6, name: "Sábado" },
                            { num: 0, name: "Domingo" },
                          ].map((day) => {
                            let daysList: number[] = [];
                            try {
                              daysList = JSON.parse(config.scheduleDays || "[1,2,3,4,5]");
                            } catch (e) {
                              daysList = [1, 2, 3, 4, 5];
                            }
                            const isChecked = daysList.includes(day.num);
                            return (
                              <button
                                key={day.num}
                                type="button"
                                onClick={() => {
                                  let newList = [...daysList];
                                  if (newList.includes(day.num)) {
                                    newList = newList.filter((d) => d !== day.num);
                                  } else {
                                    newList.push(day.num);
                                    newList.sort();
                                  }
                                  updateField("scheduleDays", JSON.stringify(newList));
                                }}
                                className={`p-2 rounded-lg border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                                  isChecked
                                    ? "bg-[rgba(245,158,11,0.06)] border-[rgba(245,158,11,0.3)] text-[var(--text-1)] font-semibold"
                                    : "bg-[#090914] border-[var(--border)] text-[var(--text-3)]"
                                }`}
                              >
                                <span>{day.name}</span>
                                {isChecked ? (
                                  <i className="fa-solid fa-circle-check text-amber-500 text-xs"></i>
                                ) : (
                                  <i className="fa-regular fa-circle text-[10px] text-[var(--text-3)]"></i>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Configurações do Modo Plantão */}
                  {config.scheduleMode === "plantao" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--border)] animate-fade-up">
                      {/* Inputs das Janelas de Silêncio */}
                      <div className="space-y-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)] block">
                          Janelas de Silêncio (Expediente dos Humanos)
                        </span>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-[var(--text-3)]">Silêncio Manhã - Início</label>
                            <input
                              type="time"
                              value={config.schedulePlantaoStart1 || "07:30"}
                              onChange={(e) => updateField("schedulePlantaoStart1", e.target.value)}
                              className="field-input text-xs"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-[var(--text-3)]">Silêncio Manhã - Fim</label>
                            <input
                              type="time"
                              value={config.schedulePlantaoEnd1 || "12:00"}
                              onChange={(e) => updateField("schedulePlantaoEnd1", e.target.value)}
                              className="field-input text-xs"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-[var(--text-3)]">Silêncio Tarde - Início</label>
                            <input
                              type="time"
                              value={config.schedulePlantaoStart2 || "13:00"}
                              onChange={(e) => updateField("schedulePlantaoStart2", e.target.value)}
                              className="field-input text-xs"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-[var(--text-3)]">Silêncio Tarde - Fim</label>
                            <input
                              type="time"
                              value={config.schedulePlantaoEnd2 || "17:30"}
                              onChange={(e) => updateField("schedulePlantaoEnd2", e.target.value)}
                              className="field-input text-xs"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-[var(--text-2)]">Fuso Horário (Timezone)</label>
                          <select
                            value={config.scheduleTimezone}
                            onChange={(e) => updateField("scheduleTimezone", e.target.value)}
                            className="field-input text-xs bg-[#090914] cursor-pointer"
                          >
                            <option value="America/Sao_Paulo">America/Sao_Paulo (Horário de Brasília)</option>
                            <option value="America/Bahia">America/Bahia</option>
                            <option value="America/Manaus">America/Manaus</option>
                            <option value="America/New_York">America/New_York (EST)</option>
                            <option value="Europe/Lisbon">Europe/Lisbon (WET)</option>
                            <option value="Europe/London">Europe/London (GMT)</option>
                          </select>
                        </div>
                      </div>

                      {/* Card de Resumo Explicativo Premium */}
                      <div className="rounded-xl border border-[rgba(168,85,247,0.15)] bg-[rgba(13,13,28,0.3)] p-5 flex flex-col gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
                        <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
                          <i className="fa-solid fa-circle-info text-purple-400 text-xs"></i>
                          <span className="font-bold text-xs text-[var(--text-1)]">Turnos de Atendimento (Liz)</span>
                          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.25)] text-purple-400 font-bold">PLANTÃO ATIVO</span>
                        </div>

                        <div className="space-y-3.5 text-xs text-[var(--text-2)]">
                          <div className="flex items-start gap-2.5">
                            <span className="text-base shrink-0">🌙</span>
                            <div>
                              <strong className="text-[var(--text-1)] block text-xs">Pós-Horário e Noites:</strong>
                              <span className="text-[var(--text-3)] text-[11px] leading-normal block mt-0.5">
                                Segunda a sexta: das <strong className="text-[var(--text-2)]">{config.schedulePlantaoEnd2 || "17:30"}</strong> do dia até às <strong className="text-[var(--text-2)]">{config.schedulePlantaoStart1 || "07:30"}</strong> da manhã seguinte.
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5">
                            <span className="text-base shrink-0">🍕</span>
                            <div>
                              <strong className="text-[var(--text-1)] block text-xs">Intervalo de Almoço:</strong>
                              <span className="text-[var(--text-3)] text-[11px] leading-normal block mt-0.5">
                                Segunda a sexta: das <strong className="text-[var(--text-2)]">{config.schedulePlantaoEnd1 || "12:00"}</strong> às <strong className="text-[var(--text-2)]">{config.schedulePlantaoStart2 || "13:00"}</strong>.
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5">
                            <span className="text-base shrink-0">🏖️</span>
                            <div>
                              <strong className="text-[var(--text-1)] block text-xs">Finais de Semana:</strong>
                              <span className="text-[var(--text-3)] text-[11px] leading-normal block mt-0.5">
                                Sábado e Domingo inteiros (atendimento ininterrupto 24 horas por dia).
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5 border-t border-[var(--border)] pt-3 mt-1">
                            <span className="text-base shrink-0">🤫</span>
                            <div>
                              <strong className="text-purple-400 block text-xs">Silenciador Ativo (Humanos Atendendo):</strong>
                              <span className="text-[var(--text-3)] text-[11px] leading-normal block mt-0.5">
                                A Liz ignorará silenciosamente mensagens recebidas de segunda a sexta entre <strong className="text-[var(--text-2)]">{config.schedulePlantaoStart1 || "07:30"}-{config.schedulePlantaoEnd1 || "12:00"}</strong> e <strong className="text(--text-2)">{config.schedulePlantaoStart2 || "13:00"}-{config.schedulePlantaoEnd2 || "17:30"}</strong> para que sua equipe atenda sem duplicidade.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mensagem de Ausência (Ocultada em Modo Plantão já que lá é ignore silencioso) */}
            {config.scheduleEnabled && (config.scheduleMode || "normal") === "normal" && (
              <div className="card space-y-4 animate-fade-up">
                <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                  <i className="fa-solid fa-message text-amber-400 text-xs"></i>
                  Mensagem de Ausência (Fora do Horário)
                </h3>
                <p className="text-xs text-[var(--text-2)]">
                  Esta mensagem é disparada na primeira interação do cliente que ocorrer fora das regras de expediente configuradas.
                </p>
                <textarea
                  value={config.scheduleOffMessage}
                  onChange={(e) => updateField("scheduleOffMessage", e.target.value)}
                  className="field-input min-h-[120px] font-mono text-xs leading-relaxed"
                  placeholder="Olá! No momento estamos fora do horário de expediente..."
                  required
                />
              </div>
            )}
          </div>
        )}

        {/* Global feedbacks and trigger button */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-t border-[var(--border)] pt-6">
          {error && (
            <span className="text-xs text-[var(--error)] flex items-center gap-1.5 font-semibold">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{error}</span>
            </span>
          )}

          {success && (
            <span className="text-xs text-[var(--success)] flex items-center gap-1.5 font-semibold animate-pulse">
              <i className="fa-solid fa-circle-check"></i>
              <span>{success}</span>
            </span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full md:w-auto md:ml-auto px-8 cursor-pointer shrink-0"
          >
            {saving ? (
              <span className="dot-pulse">
                <span></span>
                <span></span>
                <span></span>
              </span>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk text-xs"></i>
                <span>Gravar Parâmetros</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
