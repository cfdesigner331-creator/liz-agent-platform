export async function sendWhatsAppMessage(
  provider: string,
  baseUrl: string,
  apiKeyOrToken: string,
  instanceOrApiId: string,
  phone: string,
  text: string
): Promise<void> {
  const isWiseTalk = provider === "wisetalk";

  if (isWiseTalk) {
    if (!baseUrl || !apiKeyOrToken || !instanceOrApiId) {
      console.warn("[WiseTalk API] Configuração incompleta. Pulando envio.");
      return;
    }
    const cleanUrl = (baseUrl || "").trim().replace(/\/$/, "");
    const url = `${cleanUrl}/v1/api/external/${instanceOrApiId.trim()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKeyOrToken.trim()}`,
        },
        body: JSON.stringify({
          number: phone.trim(),
          body: text,
          externalKey: ""
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Instabilidade na API WiseTalk (${response.status}): ${errorText}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        console.error(`[WiseTalk API Error] Timeout de 8s excedido no envio para +${phone}`);
        throw new Error("Timeout excedido na conexão com a API WiseTalk.");
      }
      console.error(`[WiseTalk API Error] Erro ao disparar mensagem para +${phone}:`, err.message);
      throw err;
    }
  } else {
    // Evolution API
    if (!baseUrl || !apiKeyOrToken || !instanceOrApiId) {
      console.warn("[Evolution API] Configuração incompleta. Pulando envio de WhatsApp.");
      return;
    }
    const cleanUrl = (baseUrl || "").trim().replace(/\/$/, "");
    const url = `${cleanUrl}/message/sendText/${instanceOrApiId.trim()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": apiKeyOrToken.trim(),
        },
        body: JSON.stringify({
          number: phone,
          text: text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Instabilidade na API Evolution (${response.status}): ${errorText}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        console.error(`[Evolution API Error] Timeout de 8s excedido no envio para +${phone}`);
        throw new Error("Timeout excedido na conexão com a Evolution API.");
      }
      console.error(`[Evolution API Error] Erro ao disparar mensagem para +${phone}:`, err.message);
      throw err;
    }
  }
}

/**
 * Envia nota de áudio (Suportado apenas no Evolution)
 */
export async function sendWhatsAppAudio(
  provider: string,
  baseUrl: string,
  apiKeyOrToken: string,
  instanceOrApiId: string,
  phone: string,
  audioBase64: string
): Promise<void> {
  if (provider === "wisetalk") {
    console.log(`[WiseTalk API PTT] Áudio não suportado pela API Externa. Fallback automático para texto habilitado.`);
    return;
  }

  if (!baseUrl || !apiKeyOrToken || !instanceOrApiId) {
    console.warn("[Evolution API] Configuração incompleta. Pulando envio de áudio.");
    return;
  }

  const cleanUrl = (baseUrl || "").trim().replace(/\/$/, "");
  const url = `${cleanUrl}/message/sendWhatsAppAudio/${instanceOrApiId.trim()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKeyOrToken.trim(),
      },
      body: JSON.stringify({
        number: phone,
        audio: audioBase64,
        delay: 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Evolution API] Falha ao enviar áudio (${response.status}): ${errorText}`);
      throw new Error(`Falha ao enviar áudio (${response.status})`);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      console.error(`[Evolution API Error] Timeout de 15s ao enviar áudio para +${phone}`);
      throw new Error("Timeout ao enviar áudio pela Evolution API.");
    }
    console.error(`[Evolution API Error] Erro ao enviar áudio para +${phone}:`, err.message);
    throw err;
  }
}

/**
 * Altera presença do agente (Suportado apenas no Evolution)
 */
export async function sendWhatsAppPresence(
  provider: string,
  baseUrl: string,
  apiKeyOrToken: string,
  instanceOrApiId: string,
  phone: string,
  presence: "composing" | "recording" | "paused"
): Promise<void> {
  if (provider === "wisetalk") {
    return;
  }

  if (!baseUrl || !apiKeyOrToken || !instanceOrApiId) {
    return;
  }

  const cleanUrl = (baseUrl || "").trim().replace(/\/$/, "");
  const url = `${cleanUrl}/chat/sendPresence/${instanceOrApiId.trim()}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKeyOrToken.trim(),
      },
      body: JSON.stringify({
        number: phone,
        presence: presence,
      }),
    });
  } catch (err: any) {
    console.error(`[Evolution API Error] Erro ao enviar presença (${presence}) para +${phone}:`, err.message);
  }
}

/**
 * Marca as mensagens como lidas (Suportado apenas no Evolution)
 */
export async function markWhatsAppMessageAsRead(
  provider: string,
  baseUrl: string,
  apiKeyOrToken: string,
  instanceOrApiId: string,
  remoteJid: string,
  messageId: string
): Promise<void> {
  if (provider === "wisetalk") {
    return;
  }

  if (!baseUrl || !apiKeyOrToken || !instanceOrApiId) {
    return;
  }

  const cleanUrl = (baseUrl || "").trim().replace(/\/$/, "");
  const url = `${cleanUrl}/chat/markMessageAsRead/${instanceOrApiId.trim()}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKeyOrToken.trim(),
      },
      body: JSON.stringify({
        readMessages: [
          {
            remoteJid: remoteJid,
            fromMe: false,
            id: messageId,
          },
        ],
      }),
    });
  } catch (err: any) {
    console.error(`[Evolution API Error] Erro ao marcar mensagem como lida:`, err.message);
  }
}
