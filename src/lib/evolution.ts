export async function sendWhatsAppMessage(
  wisetalkUrl: string,
  wisetalkToken: string,
  apiId: string,
  phone: string,
  text: string
): Promise<void> {
  if (!wisetalkUrl || !wisetalkToken || !apiId) {
    console.warn("[WiseTalk API] Configuração incompleta. Pulando envio de mensagem.");
    return;
  }

  // Sanitiza a URL removendo barras finais
  const cleanUrl = (wisetalkUrl || "").trim().replace(/\/$/, "");
  const url = `${cleanUrl}/v1/api/external/${apiId.trim()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${wisetalkToken.trim()}`,
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
}

/**
 * Nota de voz (no-op para WiseTalk)
 */
export async function sendWhatsAppAudio(
  wisetalkUrl: string,
  wisetalkToken: string,
  apiId: string,
  phone: string,
  audioBase64: string
): Promise<void> {
  console.log(`[WiseTalk API PTT] Áudio não suportado pela API Externa. Fallback automático para texto habilitado.`);
}

/**
 * Simulação de digitação (no-op para WiseTalk)
 */
export async function sendWhatsAppPresence(
  wisetalkUrl: string,
  wisetalkToken: string,
  apiId: string,
  phone: string,
  presence: "composing" | "recording" | "paused"
): Promise<void> {
  // Omitido no WiseTalk
}

/**
 * Marca as mensagens recebidas como lidas (no-op para WiseTalk)
 */
export async function markWhatsAppMessageAsRead(
  wisetalkUrl: string,
  wisetalkToken: string,
  apiId: string,
  remoteJid: string,
  messageId: string
): Promise<void> {
  // Omitido no WiseTalk
}
