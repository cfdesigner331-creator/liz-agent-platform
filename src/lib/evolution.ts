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
