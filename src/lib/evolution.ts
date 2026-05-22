export async function sendWhatsAppMessage(
  evolutionUrl: string,
  evolutionApiKey: string,
  instanceId: string,
  phone: string,
  text: string
): Promise<void> {
  if (!evolutionUrl || !evolutionApiKey || !instanceId) {
    console.warn("[Evolution API] Configuração incompleta. Pulando envio de WhatsApp.");
    return;
  }

  // Sanitiza a URL removendo barras finais
  const cleanUrl = (evolutionUrl || "").trim().replace(/\/$/, "");
  const url = `${cleanUrl}/message/sendText/${instanceId.trim()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey.trim(),
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
      throw new Error(`Instabilidade na API (${response.status}): ${errorText}`);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      console.error(`[Evolution API Error] Timeout de 8s excedido no envio de mensagem para +${phone}`);
      throw new Error("Timeout excedido na conexão com a Evolution API.");
    }
    console.error(`[Evolution API Error] Erro ao disparar mensagem para +${phone}:`, err.message);
    throw err;
  }
}

/**
 * Envia uma nota de voz (áudio WAV em base64) via Evolution API.
 * O endpoint /message/sendWhatsAppAudio trata a mensagem como PTT (nota de voz).
 */
export async function sendWhatsAppAudio(
  evolutionUrl: string,
  evolutionApiKey: string,
  instanceId: string,
  phone: string,
  audioBase64: string
): Promise<void> {
  if (!evolutionUrl || !evolutionApiKey || !instanceId) {
    console.warn("[Evolution API] Configuração incompleta. Pulando envio de áudio.");
    return;
  }

  const cleanUrl = (evolutionUrl || "").trim().replace(/\/$/, "");
  const url = `${cleanUrl}/message/sendWhatsAppAudio/${instanceId.trim()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey.trim(),
      },
      body: JSON.stringify({
        number: phone,
        audio: `data:audio/wav;base64,${audioBase64}`,
        delay: 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Evolution API] Falha ao enviar áudio (${response.status}): ${errorText}`);
      // Não lança exceção — fallback para texto acontecerá no caller
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
 * Altera a presença da Liz no chat (ex: 'composing' ou 'recording')
 */
export async function sendWhatsAppPresence(
  evolutionUrl: string,
  evolutionApiKey: string,
  instanceId: string,
  phone: string,
  presence: "composing" | "recording" | "paused"
): Promise<void> {
  if (!evolutionUrl || !evolutionApiKey || !instanceId) {
    return;
  }

  const cleanUrl = (evolutionUrl || "").trim().replace(/\/$/, "");
  const url = `${cleanUrl}/chat/sendPresence/${instanceId.trim()}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey.trim(),
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
 * Marca as mensagens recebidas de um determinado cliente como lidas
 */
export async function markWhatsAppMessageAsRead(
  evolutionUrl: string,
  evolutionApiKey: string,
  instanceId: string,
  remoteJid: string,
  messageId: string
): Promise<void> {
  if (!evolutionUrl || !evolutionApiKey || !instanceId) {
    return;
  }

  const cleanUrl = (evolutionUrl || "").trim().replace(/\/$/, "");
  const url = `${cleanUrl}/chat/markMessageAsRead/${instanceId.trim()}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey.trim(),
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
    console.error(`[Evolution API Error] Erro ao marcar mensagem ${messageId} como lida para +${remoteJid}:`, err.message);
  }
}



