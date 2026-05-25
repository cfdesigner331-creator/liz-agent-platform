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
  textTitleEnabled?: boolean;
  textTitle?: string;
  transcriptionProvider?: string;
  visionProvider?: string;
  groqTranscriptionModel?: string;
  groqVisionModel?: string;
  observationMode?: boolean;
  securityShieldActive?: boolean;
  isDefaultPasswordActive?: boolean;
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
    textTitleEnabled: false,
    textTitle: "Liz | Assistente Virtual",
    transcriptionProvider: "groq",
    visionProvider: "groq",
    groqTranscriptionModel: "whisper-large-v3-turbo",
    groqVisionModel: "llama-3.2-11b-vision-preview",
    observationMode: false,
    securityShieldActive: true,
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

  // Appearance & Security controls
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState<string>("amber");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<"ai" | "instructions" | "evolution" | "voice" | "schedule" | "appearance" | "security">("ai");

  useEffect(() => {
    // Generate full webhook URL dynamically based on location
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/webhook`);

      const savedTheme = localStorage.getItem("assistente_theme") as "dark" | "light" || "dark";
      const savedAccent = localStorage.getItem("assistente_accent") || "amber";
      setTheme(savedTheme);
      setAccent(savedAccent);
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

  const handleToggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("assistente_theme", nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
    }
  };

  const handleUpdateAccent = (newAccent: string) => {
    setAccent(newAccent);
    if (typeof window !== "undefined") {
      localStorage.setItem("assistente_accent", newAccent);
      document.documentElement.setAttribute("data-accent", newAccent);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!newPassword) {
      setPasswordError("A nova senha não pode ser vazia.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setPasswordSuccess("Senha alterada com sucesso!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        
        // Refresh config to update isDefaultPasswordActive
        const configRes = await fetch("/api/config");
        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
        }
      } else {
        setPasswordError(data.error || "Falha ao alterar senha.");
      }
    } catch (err) {
      setPasswordError("Erro ao conectar ao servidor.");
    } finally {
      setPasswordSaving(false);
    }
  };

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

        <div className="flex items-center gap-2 shrink-0">
          {/* TEMA CLARO/ESCURO Toggle */}
          <button
            key="theme-toggle"
            type="button"
            onClick={handleToggleTheme}
            className="p-2 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-all cursor-pointer flex items-center justify-center w-9 h-9"
            title="Alternar Tema"
          >
            {theme === "dark" ? (
              <svg className="w-4 h-4 fill-current text-amber-400 animate-pulse" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464-5.636a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-5.636 4.464a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM6.343 14.657a1 1 0 010-1.414l.707-.707a1 1 0 111.414 1.414l-.707.707a1 1 0 01-1.414 0zM4 9a1 1 0 100 2H3a1 1 0 100-2h1zm1.414-4.464a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 fill-current text-indigo-500 animate-pulse" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>

          {/* MODO TREINAMENTO Toggle */}
          <button
            type="button"
            onClick={() => updateField("observationMode", !config.observationMode)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
              config.observationMode
                ? "bg-[rgba(168,85,247,0.06)] border-[rgba(168,85,247,0.25)] text-purple-400"
                : "bg-[rgba(255,255,255,0.02)] border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)]"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${config.observationMode ? "bg-purple-400 animate-pulse" : "bg-transparent border border-[var(--text-3)]"}`} />
            <span>MODO TREINAMENTO: {config.observationMode ? "ATIVADO" : "DESATIVADO"}</span>
          </button>

          {/* Global Agent Toggle Badge */}
          <button
            type="button"
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
              : "border-transparent text-[var(--text-2)] hover:text(--text-1)"
          }`}
        >
          <i className="fa-solid fa-comments-dollar mr-2 text-xs"></i>
          Conexão CRM (WiseTalk)
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
        <button
          type="button"
          onClick={() => setActiveTab("appearance")}
          className={`pb-3 px-2 font-[var(--font-display)] text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === "appearance"
              ? "border-[var(--accent)] text-[var(--accent-text)] font-bold"
              : "border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"
          }`}
        >
          <i className="fa-solid fa-palette mr-2 text-xs"></i>
          Aparência
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`pb-3 px-2 font-[var(--font-display)] text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === "security"
              ? "border-red-500 text-red-400 font-bold"
              : "border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"
          }`}
        >
          <i className="fa-solid fa-shield-halved mr-2 text-xs"></i>
          Segurança
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
          <div className="space-y-6 animate-fade-up">
            <div className="card space-y-6">
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

            {/* Modo Treinamento / Aprendizado Operacional */}
            <div className="card space-y-6">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                <div>
                  <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] flex items-center gap-2">
                    <i className="fa-solid fa-graduation-cap text-purple-400 text-xs"></i>
                    Modo Treinamento / Aprendizado
                  </h3>
                  <p className="text-xs text-[var(--text-3)] mt-0.5">
                    Permite que o agente funcione apenas observando e registrando conversas sem responder ativamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateField("observationMode", !config.observationMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                    config.observationMode ? "bg-purple-500" : "bg-[#1C1C38]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.observationMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="text-xs text-[var(--text-2)] leading-relaxed space-y-4">
                <p>
                  Quando o <strong className="text-purple-400">Modo Treinamento (Observação)</strong> está ativado, a Liz entra em estado de aprendizado operacional permanente:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[#090914] flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                      <i className="fa-solid fa-comment-slash"></i>
                      <span>Respostas Desativadas</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-3)] leading-relaxed">
                      A Liz não enviará nenhuma mensagem automática no WhatsApp, mantendo o fluxo inteiramente livre para sua equipe.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[#090914] flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-green-400 font-bold text-xs">
                      <i className="fa-solid fa-database"></i>
                      <span>Captura de Dados 100%</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-3)] leading-relaxed">
                      Mensagens de clientes (incluindo transcrição de áudios e descrições de imagens) são processadas e guardadas silenciosamente.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[#090914] flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                      <i className="fa-solid fa-brain"></i>
                      <span>Aprendizado Contínuo</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-3)] leading-relaxed">
                      Todas as interações dos atendentes humanos e dos clientes alimentam o contexto de plantão para futuras interações de IA.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EVOLUTION CONFIGURATIONS */}
        {activeTab === "evolution" && (
          <div className="space-y-6 animate-fade-up">
            <div className="card space-y-6">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3">
                Parâmetros de Conexão do CRM WiseTalk
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-2)]">
                    WiseTalk URL Base
                  </label>
                  <input
                    type="url"
                    value={config.evolutionUrl}
                    onChange={(e) => updateField("evolutionUrl", e.target.value)}
                    className="field-input text-xs font-mono"
                    placeholder="Ex: https://chat3.crmwisetalk.com.br"
                  />
                  <span className="text-[10px] text-[var(--text-3)]">
                    O endereço base do seu painel do CRM WiseTalk usado para integrações.
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-2)]">
                    ID da API (apiId)
                  </label>
                  <input
                    type="text"
                    value={config.instanceId}
                    onChange={(e) => updateField("instanceId", e.target.value)}
                    className="field-input text-xs font-mono"
                    placeholder="Ex: 12"
                  />
                  <span className="text-[10px] text-[var(--text-3)]">
                    O ID exclusivo da API Externa criado no menu de APIs do WiseTalk.
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-2)] flex justify-between items-center">
                    <span>Token de Integração (Bearer Token)</span>
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
                    placeholder="Token JWT do WiseTalk..."
                  />
                  <span className="text-[10px] text-[var(--text-3)]">
                    Chave de autenticação gerada no WiseTalk para autorizar o envio de mensagens da IA.
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

            {/* Identidade nas Mensagens de Texto */}
            <div className="card space-y-6">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                <div>
                  <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] flex items-center gap-2">
                    <i className="fa-solid fa-signature text-[var(--accent)] text-xs"></i>
                    Título / Identidade da Assistente (Mensagens de Texto)
                  </h3>
                  <p className="text-xs text-[var(--text-3)] mt-0.5">
                    Insere o nome da assistente em negrito no topo da primeira mensagem de texto enviada no WhatsApp.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateField("textTitleEnabled", !config.textTitleEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                    config.textTitleEnabled ? "bg-[var(--accent)]" : "bg-[#1C1C38]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.textTitleEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {config.textTitleEnabled && (
                <div className="space-y-4 animate-fade-up">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">
                      Título do Assistente (Nome Exibido)
                    </label>
                    <input
                      type="text"
                      value={config.textTitle || ""}
                      onChange={(e) => updateField("textTitle", e.target.value)}
                      className="field-input text-xs font-semibold"
                      placeholder="Ex: Liz | Assistente Virtual"
                      required
                    />
                    <span className="text-[10px] text-[var(--text-3)]">
                      Nome que aparecerá em negrito no topo da mensagem. Exemplo: <strong className="text-[var(--text-2)]">*{config.textTitle || "Liz | Assistente Virtual"}*</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Fuso Horário do Agente */}
            <div className="card space-y-4">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                <i className="fa-solid fa-earth-americas text-[var(--accent)] text-xs"></i>
                Fuso Horário & Localização do Agente
              </h3>
              <p className="text-xs text-[var(--text-2)] leading-relaxed">
                Configure o fuso horário da Liz. Isso será utilizado tanto para o <strong>horário de funcionamento (comercial/plantão)</strong> quanto para a <strong>IA saber a data e hora corretas do seu fuso horário</strong> ao saudar o cliente (evitando dar 'boa tarde' no período da manhã).
              </p>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-2)]">Fuso Horário (Timezone)</label>
                <select
                  value={config.scheduleTimezone}
                  onChange={(e) => updateField("scheduleTimezone", e.target.value)}
                  className="field-input text-xs bg-[#090914] cursor-pointer"
                >
                  <option value="America/Sao_Paulo">America/Sao_Paulo (Horário de Brasília - DF, SP, RJ, Sul, Sudeste, Nordeste)</option>
                  <option value="America/Bahia">America/Bahia (Bahia)</option>
                  <option value="America/Fortaleza">America/Fortaleza (Ceará, Maranhão, Piauí, RN, PB, PE)</option>
                  <option value="America/Recife">America/Recife (Pernambuco, Alagoas, Sergipe)</option>
                  <option value="America/Manaus">America/Manaus (Amazonas - Fuso -1h)</option>
                  <option value="America/Cuiaba">America/Cuiaba (Mato Grosso - Fuso -1h)</option>
                  <option value="America/Porto_Velho">America/Porto_Velho (Rondônia - Fuso -1h)</option>
                  <option value="America/Boa_Vista">America/Boa_Vista (Roraima - Fuso -1h)</option>
                  <option value="America/Rio_Branco">America/Rio_Branco (Acre - Fuso -2h)</option>
                  <option value="America/Noronha">America/Noronha (Fernando de Noronha - Fuso +1h)</option>
                  <option value="America/New_York">America/New_York (EST - Fuso EUA Leste)</option>
                  <option value="Europe/Lisbon">Europe/Lisbon (WET - Portugal Continental)</option>
                  <option value="Europe/London">Europe/London (GMT - Reino Unido)</option>
                </select>
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
                    Vozes em Português Recomendadas &amp; Personalização
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

                    {/* Custom Voice Card Option */}
                    {(() => {
                      const recommendedIds = [
                        "c9611be8-aae9-4a93-bb1c-98dd6b7d52a4",
                        "d4b44b9a-82bc-4b65-b456-763fce4c52f9",
                        "2f4d204f-a5dc-4196-81bc-155986b76ab6",
                        "b603811e-54c2-4a0a-8854-09eab9ffa63f",
                        "07b6f895-78b9-4921-8e10-8a21c99c2e8a",
                        "28a942b5-74f3-47bb-9b56-4c3f2562d3ba"
                      ];
                      const isCustom = !recommendedIds.includes(config.cartesiaVoiceId || "");
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isCustom) {
                              updateField("cartesiaVoiceId", "");
                            }
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 relative ${
                            isCustom
                              ? "bg-[rgba(168,85,247,0.1)] border-[rgba(168,85,247,0.4)] shadow-[0_0_12px_rgba(168,85,247,0.1)]"
                              : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.01)]"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 justify-between">
                            <span className={`font-bold text-xs ${isCustom ? "text-purple-300" : "text-[var(--text-1)]"}`}>
                              🎙️ Minha Voz Personalizada / Clonada
                            </span>
                            {isCustom && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(168,85,247,0.2)] border border-[rgba(168,85,247,0.3)] text-purple-400 font-bold">ATIVADO</span>
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--text-3)] leading-relaxed mt-0.5">
                            Selecione para usar sua própria voz customizada ou clonada no console da Cartesia. Basta digitar ou colar o UUID no campo "ID de Voz Cartesia (UUID)" acima!
                          </span>
                          {isCustom && config.cartesiaVoiceId && (
                            <code className="text-[9px] font-mono mt-1 text-purple-400/80 bg-[#14142b] py-0.5 px-1.5 rounded self-start truncate max-w-full">
                              {config.cartesiaVoiceId}
                            </code>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Provedores de Transcrição e Visão */}
            <div className="card space-y-6 animate-fade-up">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                <i className="fa-solid fa-brain text-purple-400 text-xs"></i>
                Provedores de Transcrição &amp; Visão (Mídia)
              </h3>
              <p className="text-xs text-[var(--text-2)] leading-relaxed">
                Configure os motores de inteligência que a Liz usará para transcrever notas de voz de áudio e descrever imagens ou PDFs enviados pelos clientes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Provedor de Transcrição */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-[var(--text-2)] flex items-center gap-1.5">
                    <i className="fa-solid fa-microphone text-purple-400"></i> Provedor de Transcrição (Áudio)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      {
                        value: "groq",
                        label: "Groq Whisper",
                        desc: "Grátis, Ultra Veloz",
                      },
                      {
                        value: "gemini",
                        label: "Google Gemini",
                        desc: "Grátis, Flash",
                      },
                      {
                        value: "openai",
                        label: "OpenAI Whisper",
                        desc: "Alta fidelidade",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateField("transcriptionProvider", opt.value)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 relative ${
                          (config.transcriptionProvider || "gemini") === opt.value
                            ? "bg-[rgba(168,85,247,0.08)] border-[rgba(168,85,247,0.4)] text-[var(--text-1)] shadow-[0_0_12px_rgba(168,85,247,0.05)]"
                            : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.01)] text-[var(--text-2)]"
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-bold text-xs">{opt.label}</span>
                          {(config.transcriptionProvider || "gemini") === opt.value && (
                            <i className="fa-solid fa-circle-check text-purple-400 text-xs"></i>
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--text-3)]">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Provedor de Visão */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-[var(--text-2)] flex items-center gap-1.5">
                    <i className="fa-solid fa-image text-purple-400"></i> Provedor de Visão (Imagens/PDF)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      {
                        value: "groq",
                        label: "Groq Vision",
                        desc: "Llama 3.2 Vision",
                      },
                      {
                        value: "gemini",
                        label: "Google Gemini",
                        desc: "Multimodal veloz",
                      },
                      {
                        value: "openai",
                        label: "OpenAI Vision",
                        desc: "GPT-4o-mini preciso",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateField("visionProvider", opt.value)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 relative ${
                          (config.visionProvider || "gemini") === opt.value
                            ? "bg-[rgba(168,85,247,0.08)] border-[rgba(168,85,247,0.4)] text-[var(--text-1)] shadow-[0_0_12px_rgba(168,85,247,0.05)]"
                            : "bg-[#090914] border-[var(--border)] hover:bg-[rgba(255,255,255,0.01)] text-[var(--text-2)]"
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-bold text-xs">{opt.label}</span>
                          {(config.visionProvider || "gemini") === opt.value && (
                            <i className="fa-solid fa-circle-check text-purple-400 text-xs"></i>
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--text-3)]">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* DYNAMIC API KEYS FOR MEDIA */}
              {(((config.transcriptionProvider || "gemini") === "openai" || (config.visionProvider || "gemini") === "openai") ||
                ((config.transcriptionProvider || "gemini") === "gemini" || (config.visionProvider || "gemini") === "gemini") ||
                ((config.transcriptionProvider || "gemini") === "groq" || (config.visionProvider || "gemini") === "groq")) && (
                <div className="border-t border-[var(--border)] pt-5 mt-4 space-y-4">
                  <h4 className="text-xs font-bold text-[var(--text-1)] flex items-center gap-1.5">
                    <i className="fa-solid fa-key text-purple-400"></i>
                    Configuração de Chaves de API para Mídia
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Groq API Key */}
                    {((config.transcriptionProvider || "gemini") === "groq" || (config.visionProvider || "gemini") === "groq") && (
                      <>
                        <div className="space-y-2 animate-fade-up">
                          <label className="text-xs font-semibold text-[var(--text-2)] flex justify-between items-center">
                            <span>Groq API Key (Whisper / Vision)</span>
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
                            value={config.groqApiKey || ""}
                            onChange={(e) => updateField("groqApiKey", e.target.value)}
                            className="field-input text-xs font-mono"
                            placeholder="gsk_..."
                          />
                        </div>

                        {/* Groq Transcription Model */}
                        {(config.transcriptionProvider || "gemini") === "groq" && (
                          <div className="space-y-2 animate-fade-up">
                            <label className="text-xs font-semibold text-[var(--text-2)]">
                              Modelo de Transcrição Groq
                            </label>
                            <input
                              type="text"
                              value={config.groqTranscriptionModel || ""}
                              onChange={(e) => updateField("groqTranscriptionModel", e.target.value)}
                              className="field-input text-xs font-mono"
                              placeholder="whisper-large-v3-turbo"
                            />
                          </div>
                        )}

                        {/* Groq Vision Model */}
                        {(config.visionProvider || "gemini") === "groq" && (
                          <div className="space-y-2 animate-fade-up">
                            <label className="text-xs font-semibold text-[var(--text-2)]">
                              Modelo de Visão Groq
                            </label>
                            <input
                              type="text"
                              value={config.groqVisionModel || ""}
                              onChange={(e) => updateField("groqVisionModel", e.target.value)}
                              className="field-input text-xs font-mono"
                              placeholder="llama-3.2-11b-vision-preview"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* OpenAI API Key */}
                    {((config.transcriptionProvider || "gemini") === "openai" || (config.visionProvider || "gemini") === "openai") && (
                      <div className="space-y-2 animate-fade-up">
                        <label className="text-xs font-semibold text-[var(--text-2)] flex justify-between items-center">
                          <span>OpenAI API Key (Whisper / Vision)</span>
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
                          value={config.openaiApiKey || ""}
                          onChange={(e) => updateField("openaiApiKey", e.target.value)}
                          className="field-input text-xs font-mono"
                          placeholder="sk-..."
                        />
                      </div>
                    )}

                    {/* Gemini API Key */}
                    {((config.transcriptionProvider || "gemini") === "gemini" || (config.visionProvider || "gemini") === "gemini") && (
                      <div className="space-y-2 animate-fade-up">
                        <label className="text-xs font-semibold text-[var(--text-2)] flex justify-between items-center">
                          <span>Gemini API Key (Transcrição / Visão)</span>
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
                          value={config.geminiApiKey || ""}
                          onChange={(e) => updateField("geminiApiKey", e.target.value)}
                          className="field-input text-xs font-mono"
                          placeholder="AIzaSy..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Media Processing Info */}
            <div className="card border-[rgba(168,85,247,0.1)] bg-[rgba(13,13,28,0.4)] space-y-4">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                <i className="fa-solid fa-sparkles text-purple-400 text-xs"></i>
                Processamento de Mídia Híbrido
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
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.25)] text-purple-400 font-bold">ATIVO</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-3)] leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[var(--text-3)] border-t border-[var(--border)] pt-3">
                <i className="fa-solid fa-circle-info mr-1 text-purple-400"></i>
                O processamento de mídia requer a <strong className="text-[var(--text-2)]">Groq API Key</strong>, <strong className="text-[var(--text-2)]">Gemini API Key</strong> ou a <strong className="text-[var(--text-2)]">OpenAI API Key</strong> devidamente configuradas na aba Provedores de IA.
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
                          A Liz atende de segunda a sexta a partir das 12:00. Ela silencia no expediente da manhã e nos finais de semana para que humanos respondam.
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
                  {/* Configurações do Modo Plantão */}
                  {config.scheduleMode === "plantao" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--border)] animate-fade-up">
                      {/* Descritivo de Regras */}
                      <div className="space-y-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)] block">
                          Regras de Operação do Plantão
                        </span>
                        
                        <p className="text-xs text-[var(--text-3)] leading-relaxed">
                          No Modo Plantão Inteligente, a Liz atua em regime pós-expediente para adiantar novas solicitações de clientes e qualificar contatos, sem conflitar com o atendimento humano de sua equipe.
                        </p>

                        <div className="space-y-3 pt-2">
                          <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[#090914] flex gap-3">
                            <span className="text-base shrink-0">🕒</span>
                            <div>
                              <strong className="text-xs text-[var(--text-1)] block">Período de Atendimento Autorizado:</strong>
                              <span className="text-[11px] text-[var(--text-3)] leading-normal mt-0.5 block">
                                Segunda a sexta-feira: a partir das <strong>12:00</strong>.
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[#090914] flex gap-3">
                            <span className="text-base shrink-0">🌅</span>
                            <div>
                              <strong className="text-xs text-[var(--text-1)] block">Período Comercial Humano:</strong>
                              <span className="text-[11px] text-[var(--text-3)] leading-normal mt-0.5 block">
                                Segunda a sexta: das <strong>07:30 às 12:00</strong> (Lis silenciosa para que humanos respondam).
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2">
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
                            <span className="text-base shrink-0">🤫</span>
                            <div>
                              <strong className="text-[var(--text-1)] block text-xs">Silêncio Inteligente aos Fins de Semana:</strong>
                              <span className="text-[var(--text-3)] text-[11px] leading-normal block mt-0.5">
                                Sábado e Domingo inteiros: Liz fica totalmente <strong>silenciosa</strong> para que contatos fiquem intactos aguardando a equipe humana.
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5">
                            <span className="text-base shrink-0">💾</span>
                            <div>
                              <strong className="text-[var(--text-1)] block text-xs">Armazenamento em Tempo Real (Learning Mode):</strong>
                              <span className="text-[var(--text-3)] text-[11px] leading-normal block mt-0.5">
                                Mesmo quando está silenciosa (manhãs e fins de semana), todas as mensagens recebidas são <strong>salvas no histórico do cliente</strong> para dar contexto completo.
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5">
                            <span className="text-base shrink-0">📋</span>
                            <div>
                              <strong className="text-[var(--text-1)] block text-xs">Silêncio Pós-Triagem:</strong>
                              <span className="text-[var(--text-3)] text-[11px] leading-normal block mt-0.5">
                                Assim que a triagem é concluída (<strong>Resumo da Solicitação</strong> enviado), a Liz encerra o atendimento e não responde a novas mensagens para priorizar o fluxo humano.
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5 border-t border-[var(--border)] pt-3 mt-1">
                            <span className="text-base shrink-0">🧠</span>
                            <div>
                              <strong className="text-purple-400 block text-xs">Aprendizado Operacional:</strong>
                              <span className="text-[var(--text-3)] text-[11px] leading-normal block mt-0.5">
                                A Liz analisa as interações em tempo real para gerar relatórios diários de comportamento dos clientes e sugestões de prompts de sistema otimizados.
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

        {/* TAB 6: APARÊNCIA */}
        {activeTab === "appearance" && (
          <div className="space-y-6 animate-fade-up">
            <div className="card space-y-6">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                <i className="fa-solid fa-palette text-[var(--accent)] text-xs"></i>
                Tema da Plataforma
              </h3>
              <p className="text-xs text-[var(--text-2)]">
                Selecione o modo de exibição visual para a interface do AssistentePRO.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setTheme("light");
                    if (typeof window !== "undefined") {
                      localStorage.setItem("assistente_theme", "light");
                      document.documentElement.setAttribute("data-theme", "light");
                    }
                  }}
                  className={`p-5 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-4 ${
                    theme === "light"
                      ? "border-[var(--accent)] bg-[rgba(var(--accent-rgb),0.06)] shadow-[0_0_12px_rgba(var(--accent-rgb),0.1)]"
                      : "bg-[var(--surface-2)] border-[var(--border)] hover:bg-[var(--surface-3)]"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm text-amber-500 text-lg">
                    ☀️
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[var(--text-1)] block">Modo Claro</span>
                    <span className="text-[10px] text-[var(--text-3)] block mt-0.5">Interface limpa de alto contraste lavanda</span>
                  </div>
                  {theme === "light" && (
                    <i className="fa-solid fa-circle-check text-[var(--accent)]"></i>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTheme("dark");
                    if (typeof window !== "undefined") {
                      localStorage.setItem("assistente_theme", "dark");
                      document.documentElement.setAttribute("data-theme", "dark");
                    }
                  }}
                  className={`p-5 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-4 ${
                    theme === "dark"
                      ? "border-[var(--accent)] bg-[rgba(var(--accent-rgb),0.06)] shadow-[0_0_12px_rgba(var(--accent-rgb),0.1)]"
                      : "bg-[var(--surface-2)] border-[var(--border)] hover:bg-[var(--surface-3)]"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#06060E] border border-slate-900 flex items-center justify-center shrink-0 shadow-sm text-indigo-400 text-lg">
                    🌙
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[var(--text-1)] block">Modo Escuro (Padrão)</span>
                    <span className="text-[10px] text-[var(--text-3)] block mt-0.5">Fundo escuro imersivo com brilhos sutis</span>
                  </div>
                  {theme === "dark" && (
                    <i className="fa-solid fa-circle-check text-[var(--accent)]"></i>
                  )}
                </button>
              </div>
            </div>

            <div className="card space-y-6">
              <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                <i className="fa-solid fa-wand-magic-sparkles text-[var(--accent)] text-xs"></i>
                Paleta de Cores (Destaque Accent)
              </h3>
              <p className="text-xs text-[var(--text-2)]">
                Escolha a cor de destaque que será aplicada em botões, bordas ativas e efeitos de iluminação em toda a plataforma.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { id: "amber", name: "Amber Gold", color: "#F0A020", rgb: "240, 160, 32" },
                  { id: "blue", name: "Ocean Blue", color: "#0A84FF", rgb: "10, 132, 255" },
                  { id: "emerald", name: "Emerald Green", color: "#30D158", rgb: "48, 209, 88" },
                  { id: "violet", name: "Fierce Violet", color: "#BF5AF2", rgb: "191, 90, 242" },
                  { id: "crimson", name: "Crimson Red", color: "#FF453A", rgb: "255, 69, 58" },
                  { id: "pink", name: "Rose Pink", color: "#FF375F", rgb: "255, 55, 95" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleUpdateAccent(item.id)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-3 ${
                      accent === item.id
                        ? "bg-[rgba(var(--accent-rgb),0.06)]"
                        : "bg-[var(--surface-2)] border-[var(--border)] hover:bg-[var(--surface-3)]"
                    }`}
                    style={{
                      borderColor: accent === item.id ? `rgb(${item.rgb})` : "var(--border)",
                      boxShadow: accent === item.id ? `0 0 16px rgba(${item.rgb}, 0.12)` : undefined
                    }}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-bold text-[var(--text-1)] flex-1">{item.name}</span>
                    {accent === item.id && (
                      <i className="fa-solid fa-circle-check text-xs shrink-0" style={{ color: item.color }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SEGURANÇA */}
        {activeTab === "security" && (
          <div className="space-y-6 animate-fade-up">
            <div className="card grid grid-cols-1 md:grid-cols-3 gap-6 items-center p-6 border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.02)]">
              <div className="flex justify-center md:justify-start">
                {/* Pulsing SVG Shield */}
                <div className="relative w-28 h-28 flex items-center justify-center security-pulse">
                  <svg className="w-24 h-24 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
              </div>
              
              <div className="md:col-span-2 space-y-4">
                <div>
                  <h3 className="font-[var(--font-display)] font-bold text-base text-[var(--text-1)] flex items-center gap-2">
                    🛡️ Escudo de Autodefesa Ativo
                  </h3>
                  <p className="text-xs text-[var(--text-2)] leading-relaxed mt-1">
                    O sistema de segurança monitora tentativas de acesso consecutivas malsucedidas. Caso ocorram <strong className="text-red-400">10 falhas de login por senha incorreta</strong>, o sistema entra em modo de bloqueio e apaga imediatamente as credenciais sensíveis salvas (API Keys do OpenAI, Groq, Gemini, Cartesia e Evolution) do banco de dados para evitar vazamento ou sequestro de chaves.
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
                  <div>
                    <span className="text-xs font-bold text-[var(--text-1)]">Status da Autodefesa</span>
                    <p className="text-[10px] text-[var(--text-3)] mt-0.5">Se ativado, executa o apagamento automático em ataques de força bruta.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField("securityShieldActive", !config.securityShieldActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                      config.securityShieldActive ? "bg-red-500" : "bg-[#1C1C38]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.securityShieldActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="card space-y-6">
              <div>
                <h3 className="font-[var(--font-display)] font-bold text-sm text-[var(--text-1)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                  <i className="fa-solid fa-key text-[var(--accent)] text-xs"></i>
                  Senha do Painel Administrativo
                </h3>
                <p className="text-xs text-[var(--text-2)] mt-1.5 leading-relaxed">
                  Para proteger suas conexões de IA e as configurações do WhatsApp, certifique-se de definir uma senha personalizada de alta complexidade.
                </p>
              </div>

              {config.isDefaultPasswordActive && (
                <div className="p-4 rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.06)] flex gap-3 text-amber-500">
                  <i className="fa-solid fa-triangle-exclamation text-base shrink-0 mt-0.5 animate-pulse"></i>
                  <div>
                    <strong className="text-xs font-bold block">Senha Padrão Ativa</strong>
                    <span className="text-[11px] leading-normal block mt-0.5">Você está acessando a plataforma sem nenhuma senha personalizada de administrador (senha em branco padrão). É altamente recomendável cadastrar uma senha imediatamente abaixo.</span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">Senha Atual</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Deixe em branco se for a padrão"
                      className="field-input text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">Nova Senha</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nova senha de administrador"
                      className="field-input text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">Confirmar Nova Senha</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme a nova senha"
                      className="field-input text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
                  {passwordError && (
                    <span className="text-xs text-[var(--error)] flex items-center gap-1.5 font-semibold">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span>{passwordError}</span>
                    </span>
                  )}

                  {passwordSuccess && (
                    <span className="text-xs text-[var(--success)] flex items-center gap-1.5 font-semibold">
                      <i className="fa-solid fa-circle-check"></i>
                      <span>{passwordSuccess}</span>
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={passwordSaving}
                    onClick={handleChangePassword}
                    className="btn-primary w-full md:w-auto md:ml-auto px-6 cursor-pointer text-xs shrink-0"
                  >
                    {passwordSaving ? (
                      <span className="dot-pulse">
                        <span></span>
                        <span></span>
                        <span></span>
                      </span>
                    ) : (
                      <>
                        <i className="fa-solid fa-lock text-xs"></i>
                        <span>Alterar Senha do Painel</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
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
