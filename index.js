/**
 * LIZ AI AGENT - CRIAÇÕES FREITAS
 * Standalone Node.js Express Microservice
 * Integrado com Evolution API, PostgreSQL, Redis e SDK do Gemini.
 * Oferece interface de monitoramento e sincronização em tempo real (SSE).
 */

const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Servir arquivos estáticos (index.html, styles.css, app.js) na mesma porta do Express
app.use(express.static(__dirname));

// Declarar conexões mutáveis para suportar reconfigurações dinâmicas pela interface
let pool;
let redis;
let ai;

function initServices() {
  try {
    if (process.env.DATABASE_URL) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
        query_timeout: 7000
      });
      pool.on('error', (err) => console.error('Erro no pool do PostgreSQL:', err.message));
    }
    
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000
      });
      redis.on('error', (err) => console.error('Erro na conexão com Redis:', err.message));
    }
    
    if (process.env.GEMINI_API_KEY) {
      ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    console.log('Serviços (Postgres, Redis, Gemini SDK) inicializados com sucesso.');
  } catch (err) {
    console.error('Falha na inicialização dos serviços do backend:', err.message);
  }
}

// Inicializa conexões na partida do servidor
initServices();

// Controle de clientes Server-Sent Events (SSE) para atualização em tempo real
let clients = [];

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.write(`data: ${JSON.stringify({ type: 'sys-status', message: 'Conectado em tempo real ao microsserviço da Liz!' })}\n\n`);
  
  clients.push(res);
  
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

// Envia dados JSON em tempo real para todos os navegadores visualizando o simulador
function broadcast(type, payload) {
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  });
}

// Endpoint para obter as configurações atuais em tempo real do process.env (sincronização VPS -> GUI)
app.get('/api/settings', (req, res) => {
  try {
    const envMapping = {
      'set-evolution-url': 'EVOLUTION_API_URL',
      'set-evolution-key': 'EVOLUTION_API_KEY',
      'set-instance-name': 'EVOLUTION_INSTANCE_NAME',
      'set-webhook-crm': 'CRM_WEBHOOK_URL',
      'set-gemini-key': 'GEMINI_API_KEY',
      'set-redis-ttl': 'REDIS_LOCK_TTL',
      'set-wait-time': 'DEBOUNCE_WAIT_SECONDS',
      'set-postgres-url': 'DATABASE_URL',
      'set-redis-url': 'REDIS_URL',
      'agent-prompt-setting': 'GEMINI_LIZ_SYSTEM_PROMPT'
    };

    const config = {};
    Object.keys(envMapping).forEach(guiId => {
      const envKey = envMapping[guiId];
      let val = process.env[envKey] || '';
      // Desfaz tratamento de quebras de linha
      if (val && typeof val === 'string') {
        val = val.replace(/\\n/g, '\n');
      }
      config[guiId] = val;
    });

    res.status(200).json(config);
  } catch (err) {
    console.error('[Backend] Falha ao recuperar configurações:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para reconfigurar as chaves reais de acesso direto da interface do simulador
app.post('/api/settings', async (req, res) => {
  try {
    const config = req.body;
    
    // Mapeia chaves recebidas da interface para o formato do arquivo .env
    const envMapping = {
      'set-evolution-url': 'EVOLUTION_API_URL',
      'set-evolution-key': 'EVOLUTION_API_KEY',
      'set-instance-name': 'EVOLUTION_INSTANCE_NAME',
      'set-webhook-crm': 'CRM_WEBHOOK_URL',
      'set-gemini-key': 'GEMINI_API_KEY',
      'set-redis-ttl': 'REDIS_LOCK_TTL',
      'set-wait-time': 'DEBOUNCE_WAIT_SECONDS',
      'set-postgres-url': 'DATABASE_URL',
      'set-redis-url': 'REDIS_URL',
      'agent-prompt-setting': 'GEMINI_LIZ_SYSTEM_PROMPT'
    };

    const envLines = [];
    Object.keys(config).forEach(guiId => {
      const envKey = envMapping[guiId];
      if (envKey) {
        // Salva com quebras e aspas tratadas
        const cleanedValue = config[guiId].toString().replace(/\r?\n/g, '\\n');
        envLines.push(`${envKey}="${cleanedValue}"`);
      }
    });

    // Escreve fisicamente o novo arquivo .env no disco do servidor
    const envPath = path.join(__dirname, '.env');
    fs.writeFileSync(envPath, envLines.join('\n') + '\n');
    console.log('[Backend] Configurações reconfiguradas via GUI salvas no .env.');

    // Recarrega variáveis do .env na memória do processo
    require('dotenv').config({ path: envPath, override: true });

    // Reinicializa todos os pools e conexões de rede
    if (pool) await pool.end().catch(() => {});
    if (redis) await redis.quit().catch(() => {});
    
    initServices();

    res.status(200).json({ success: true, message: 'Parâmetros atualizados e serviços reiniciados!' });
  } catch (err) {
    console.error('[Backend] Falha ao atualizar credenciais do microsserviço:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint principal do Webhook da Evolution API (Recebe mensagens do WhatsApp real)
app.post('/webhook', async (req, res) => {
  const requestStartTime = Date.now();
  let userPhone = 'desconhecido';
  try {
    const { event, data } = req.body;

    console.log(`[Webhook] Nova requisição recebida no Express. Evento: ${event}`);

    // Filtra apenas mensagens recebidas por padrão
    if (event !== 'MESSAGES_UPSERT' || !data || data.key.fromMe) {
      console.log(`[Webhook] Evento ignorado ou mensagem enviada por nós (event: ${event}, fromMe: ${data?.key?.fromMe})`);
      return res.status(200).send('Ignored event');
    }

    const chatId = data.key.remoteJid;
    const instanceName = req.body.instance || process.env.EVOLUTION_INSTANCE_NAME || 'freitas-prod';
    const sessionKey = `${instanceName}_${chatId}`;
    userPhone = chatId.replace('@s.whatsapp.net', '');

    console.log(`[Webhook] Processando mensagem recebida de +${userPhone} (Instância: ${instanceName})`);

    // Inicializa variáveis do ambiente de execução
    const REDIS_LOCK_TTL = parseInt(process.env.REDIS_LOCK_TTL || '300');
    let DEBOUNCE_WAIT = parseFloat(process.env.DEBOUNCE_WAIT_SECONDS || '1.5');
    if (isNaN(DEBOUNCE_WAIT) || DEBOUNCE_WAIT < 0) {
      DEBOUNCE_WAIT = 1.5;
    }
    const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
    const CRM_WEBHOOK = process.env.CRM_WEBHOOK_URL;
    const systemInstruction = process.env.GEMINI_LIZ_SYSTEM_PROMPT 
      ? process.env.GEMINI_LIZ_SYSTEM_PROMPT.replace(/\\n/g, '\n')
      : 'Você é a Liz assistente virtual da Criações Freitas...';

    // A. SISTEMA DE MONITORAMENTO EM TEMPO REAL - DISPARA INÍCIO DO FLUXO NA GUI
    broadcast('node-highlight', { nodeId: 'node-webhook', duration: 600 });
    broadcast('log', { message: `[Express] Webhook ativado. Mensagem recebida do WhatsApp (+${userPhone})`, logType: 'system' });

    // B. LOGIC ROUTER (Texto ou Mídia)
    await new Promise(resolve => setTimeout(resolve, 300));
    broadcast('connection-animate', { fromNodeId: 'node-webhook', toNodeId: 'node-switch', duration: 300 });
    broadcast('node-highlight', { nodeId: 'node-switch', duration: 600 });

    const messageContent = data.message;
    let userMessageText = '';
    let printDescription = 'Nenhuma estampa enviada nesta rodada.';
    const isImage = !!messageContent.imageMessage;

    if (isImage) {
      userMessageText = messageContent.imageMessage.caption || 'Enviou uma estampa';
      console.log(`[Router] Mensagem com mídia de estampa (+${userPhone})`);
      broadcast('log', { message: `[Router] Filtro: Mensagem com estampa gráfica detectada (imageMessage).`, logType: 'info' });
      
      // Conexão para download e visão computacional
      await new Promise(resolve => setTimeout(resolve, 300));
      broadcast('connection-animate', { fromNodeId: 'node-switch', toNodeId: 'node-media', duration: 300 });
      broadcast('node-highlight', { nodeId: 'node-media', duration: 1000 });
      broadcast('log', { message: `[Axios] Baixando buffer da estampa gráfica pelo Evolution API...`, logType: 'info' });

      try {
        const mediaKey = messageContent.imageMessage.mediaKey;
        console.log(`[Axios] Baixando estampa do Evolution: ${EVOLUTION_URL}/media/download/${mediaKey}`);
        // Download de mídia do Evolution API (com timeout curto para evitar travas)
        const mediaResponse = await axios.get(`${EVOLUTION_URL}/media/download/${mediaKey}`, {
          headers: { 'apikey': EVOLUTION_KEY },
          responseType: 'arraybuffer',
          timeout: 7000
        });
        
        const base64Image = Buffer.from(mediaResponse.data).toString('base64');
        console.log(`[Axios] Download concluído. Tamanho: ${mediaResponse.data.length} bytes`);
        broadcast('log', { message: `[Axios] Imagem baixada com sucesso (${(mediaResponse.data.length / 1024).toFixed(1)} KB). Invocando Gemini Vision...`, logType: 'success' });

        if (ai) {
          console.log(`[Gemini Vision] Invocando gemini-2.5-flash para descrever a estampa...`);
          const visionResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              'Analise esta estampa enviada pelo cliente para a Criações Freitas. Descreva cores hexadecimais predominantes, estilos gráficos (ex: streetwear, logo corporativo, arte abstrata) e recomende a impressão ideal (Sublimação se houver degradês em poliéster, Silk-Screen ou Bordado se forem cores sólidas ou logos corporativos em algodão/uniforme). Retorne uma descrição curta e focada.',
              { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
            ]
          });
          printDescription = visionResponse.text;
          console.log(`[Gemini Vision] Análise técnica: ${printDescription.substring(0, 80)}...`);
          broadcast('log', { message: `[Gemini Vision] Análise técnica realizada com sucesso: "${printDescription}"`, logType: 'success' });
        } else {
          printDescription = 'Simulação: Estampa com cores vibrantes e degradê identificada. Recomendado sublimação.';
          broadcast('log', { message: `[Gemini Vision] (MOCK - Chave ausente) Descrição gerada em sandbox.`, logType: 'warning' });
        }
      } catch (err) {
        console.error(`[Error Image Processing] Falha ao processar estampa:`, err.message);
        printDescription = 'Não foi possível descrever a estampa devido a um erro de conexão.';
        broadcast('log', { message: `[Axios/Gemini] Erro no processamento de mídia: ${err.message}`, logType: 'danger' });
      }
    } else {
      if (messageContent.conversation) {
        userMessageText = messageContent.conversation;
      } else if (messageContent.extendedTextMessage) {
        userMessageText = messageContent.extendedTextMessage.text;
      }
      console.log(`[Router] Mensagem de texto puro (+${userPhone}): "${userMessageText.substring(0, 60)}"`);
      broadcast('log', { message: `[Router] Filtro: Mensagem de conversação padrão (texto).`, logType: 'info' });
    }

    // Sinaliza nova mensagem na interface gráfica do chat em tempo real
    broadcast('chat-message', { role: 'user', content: userMessageText, mediaUrl: isImage ? 'https://images.unsplash.com/photo-1576016770956-debb63d90029?w=200&q=80' : null });

    // C. REDIS ANTI-LOOP LOCKS
    await new Promise(resolve => setTimeout(resolve, 300));
    const fromNode = isImage ? 'node-media' : 'node-switch';
    broadcast('connection-animate', { fromNodeId: fromNode, toNodeId: 'node-redis', duration: 300 });
    broadcast('node-highlight', { nodeId: 'node-redis', duration: 600 });
    
    const redisLockKey = `lock:freitas:${sessionKey}`;
    let lockExists = false;

    if (redis && redis.status === 'ready') {
      try {
        console.log(`[Redis] Lendo trava anti-loop para ${sessionKey}`);
        lockExists = await redis.get(redisLockKey);
      } catch (err) {
        console.error('[Redis Error] Falha ao ler lock do Redis:', err.message);
        broadcast('log', { message: `[Redis] Falha ao ler trava anti-loop: ${err.message}. Continuando em sandbox sem travas.`, logType: 'warning' });
      }
    }

    if (lockExists) {
      console.log(`[Redis] Bloqueado! O número +${userPhone} já tem um processamento em andamento.`);
      broadcast('log', { message: `[Redis] Concorrência bloqueada! Travado pelo sistema anti-loop para ${sessionKey}`, logType: 'danger' });
      return res.status(200).send('Anti-loop blocked');
    }

    if (redis && redis.status === 'ready') {
      try {
        console.log(`[Redis] Salvando trava anti-loop com TTL de ${REDIS_LOCK_TTL}s`);
        await redis.set(redisLockKey, 'locked', 'EX', REDIS_LOCK_TTL);
        broadcast('log', { message: `[Redis] GET trava: livre. SET trava anti-loop registrada com TTL de ${REDIS_LOCK_TTL}s`, logType: 'success' });
      } catch (err) {
        console.error('[Redis Error] Falha ao gravar lock no Redis:', err.message);
        broadcast('log', { message: `[Redis] Falha ao registrar trava anti-loop: ${err.message}. Continuando sem travas.`, logType: 'warning' });
      }
    } else {
      broadcast('log', { message: `[Redis] Cache offline. SET trava anti-loop ignorada (Executando em sandbox).`, logType: 'warning' });
    }

    // D. FILA DE WAIT DEBOUNCE
    await new Promise(resolve => setTimeout(resolve, 300));
    broadcast('connection-animate', { fromNodeId: 'node-redis', toNodeId: 'node-wait', duration: 300 });
    broadcast('node-highlight', { nodeId: 'node-wait', duration: 1000 });
    broadcast('log', { message: `[Queue/Debounce] Agrupando requisições por ${DEBOUNCE_WAIT}s para buffering de mensagens consecutivas...`, logType: 'warning' });

    console.log(`[Queue/Debounce] Aplicando delay de debounce de ${DEBOUNCE_WAIT}s...`);
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_WAIT * 1000));
    broadcast('log', { message: `[Queue/Debounce] Fila liberada. Iniciando processamento do pipeline do chat.`, logType: 'info' });

    // E. POSTGRES GET HISTORY MEMORY
    await new Promise(resolve => setTimeout(resolve, 300));
    broadcast('connection-animate', { fromNodeId: 'node-wait', toNodeId: 'node-postgres-get', duration: 300 });
    broadcast('node-highlight', { nodeId: 'node-postgres-get', duration: 600 });
    broadcast('log', { message: `[pg-pool] Consultando histórico profundo de chat (limite últimas 15 mensagens)...`, logType: 'info' });

    let chatHistory = [];
    if (pool) {
      try {
        console.log(`[pg-pool] Buscando histórico no Postgres para ${sessionKey}`);
        const historyQuery = await pool.query(
          'SELECT role, content FROM chat_history WHERE session_id = $1 ORDER BY created_at ASC LIMIT 15',
          [sessionKey]
        );
        chatHistory = historyQuery.rows;
        console.log(`[pg-pool] Histórico recuperado: ${chatHistory.length} mensagens`);
        broadcast('log', { message: `[pg-pool] Memória recuperada com sucesso (${chatHistory.length} logs contextuais recuperados).`, logType: 'success' });
      } catch (err) {
        console.error('[Postgres Error] Falha ao recuperar histórico do Postgres:', err.message);
        broadcast('log', { message: `[pg-pool] Erro na consulta de histórico. Continuando em modo sem memória.`, logType: 'danger' });
      }
    } else {
      broadcast('log', { message: `[pg-pool] Banco ausente. Executando em memória volátil de sandbox.`, logType: 'warning' });
    }

    // F. GEMINI SDK CORE CALL
    await new Promise(resolve => setTimeout(resolve, 300));
    broadcast('connection-animate', { fromNodeId: 'node-postgres-get', toNodeId: 'node-gemini', duration: 300 });
    broadcast('node-highlight', { nodeId: 'node-gemini', duration: 1500 });
    broadcast('log', { message: `[Gemini SDK] Processando prompt de personalidade e histórico no modelo gemini-2.5-flash...`, logType: 'info' });

    let agentReply = '';
    if (ai) {
      try {
        console.log(`[Gemini SDK] Solicitando resposta ao Gemini (gemini-2.5-flash)...`);
        const geminiPayloadHistory = chatHistory.map(row => ({
          role: row.role === 'model' ? 'model' : 'user',
          parts: [{ text: row.content }]
        }));

        geminiPayloadHistory.push({
          role: 'user',
          parts: [{ text: `Mensagem do Usuário: ${userMessageText}\nContexto da Estampa: ${printDescription}` }]
        });

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          systemInstruction: systemInstruction,
          contents: geminiPayloadHistory
        });
        
        agentReply = response.text;
        console.log(`[Gemini SDK] Resposta obtida. Tamanho: ${agentReply.length} caracteres`);
        broadcast('log', { message: `[Gemini SDK] Resposta estruturada gerada: "${agentReply.substring(0, 50)}..."`, logType: 'success' });
      } catch (err) {
        console.error('[Gemini Error] Erro na chamada do Gemini:', err.message);
        agentReply = 'Olá! Estou tendo dificuldades técnicas para me conectar ao meu cérebro de IA agora. Poderia repetir a sua ideia em instantes? 🌸';
        broadcast('log', { message: `[Gemini SDK] Falha ao processar conteúdo: ${err.message}`, logType: 'danger' });
      }
    } else {
      console.log(`[Gemini SDK] (MOCK) Sem chave configurada. Usando resposta fallback mockada.`);
      // Simulação fallback estática da inteligência da Liz caso o usuário não tenha configurado a API Key
      agentReply = `Olá! Sou a Liz, assistente da Criações Freitas. 🌸\n\nRecebi sua mensagem no WhatsApp real! Para te passar o orçamento perfeito de vestuário personalizado, me conta: Qual seria o seu nome, o produto de interesse (camisetas, uniformes ou moletons) e a quantidade estimada?`;
      broadcast('log', { message: `[Gemini SDK] (MOCK) Executando script local estático em sandbox (Chave ausente).`, logType: 'warning' });
    }

    // G. POSTGRES SAVE HISTORY MEMORY
    await new Promise(resolve => setTimeout(resolve, 300));
    broadcast('connection-animate', { fromNodeId: 'node-gemini', toNodeId: 'node-postgres-save', duration: 300 });
    broadcast('node-highlight', { nodeId: 'node-postgres-save', duration: 600 });
    broadcast('log', { message: `[pg-pool] Persistindo novas interações (mensagens de pergunta e resposta) na memória SQL...`, logType: 'info' });

    if (pool) {
      try {
        console.log(`[pg-pool] Gravando mensagem do usuário e resposta no histórico PostgreSQL`);
        await pool.query(
          'INSERT INTO chat_history (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionKey, 'user', userMessageText || '[Estampa]']
        );
        await pool.query(
          'INSERT INTO chat_history (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionKey, 'model', agentReply]
        );
        broadcast('log', { message: `[pg-pool] Interação gravada com sucesso no PostgreSQL.`, logType: 'success' });
      } catch (err) {
        console.error('[Postgres Error] Erro ao salvar histórico no PostgreSQL:', err.message);
        broadcast('log', { message: `[pg-pool] Erro ao gravar dados de conversão no histórico.`, logType: 'danger' });
      }
    } else {
      broadcast('log', { message: `[pg-pool] Gravação ignorada (modo sandbox).`, logType: 'warning' });
    }

    // H. EVOLUTION SEND TEXT API
    await new Promise(resolve => setTimeout(resolve, 300));
    broadcast('connection-animate', { fromNodeId: 'node-postgres-save', toNodeId: 'node-sender', duration: 300 });
    broadcast('node-highlight', { nodeId: 'node-sender', duration: 1000 });
    
    const typingDelayMs = Math.min(Math.max(agentReply.length * 45, 1000), 4500);
    broadcast('log', { message: `[Evolution API] Enviando resposta ao cliente (+${userPhone}) com delay de simulação de digitação de ${(typingDelayMs/1000).toFixed(1)}s...`, logType: 'info' });

    // Atualiza o simulador visual mostrando o balão recebido em tempo real
    broadcast('chat-message', { role: 'model', content: agentReply });

    if (EVOLUTION_URL && EVOLUTION_KEY) {
      try {
        console.log(`[Evolution API] Enviando mensagem de resposta para WhatsApp (+${userPhone}) via POST ${EVOLUTION_URL}/message/sendText/${instanceName}`);
        // Post para a Evolution API (Com timeout de 8000ms para evitar travamentos infinitos por Loopback)
        await axios.post(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
          number: chatId,
          text: agentReply,
          delay: typingDelayMs
        }, {
          headers: { 'apikey': EVOLUTION_KEY },
          timeout: 8000
        });
        console.log(`[Evolution API] Resposta entregue com sucesso!`);
        broadcast('log', { message: `[Evolution API] POST /message/sendText - Status 200 OK. Resposta enviada com sucesso!`, logType: 'success' });
      } catch (err) {
        console.error(`[Evolution API Error] Erro ao enviar mensagem pelo Evolution:`, err.message);
        broadcast('log', { message: `[Evolution API] Erro ao disparar mensagem para WhatsApp real: ${err.message}`, logType: 'danger' });
      }
    } else {
      console.log(`[Evolution API] URL ou Chave ausente. Envio de WhatsApp omitido.`);
      broadcast('log', { message: `[Evolution API] Envio omitido (Evolution URL/Key não configurados na interface).`, logType: 'warning' });
    }

    // I. DETECÇÃO DE ENCERRAMENTO (WEBHOOK LEAD CRM DISPATCH)
    if (agentReply.includes('📋 **Resumo da Solicitação:**') || agentReply.toLowerCase().includes('finalizando seu atendimento')) {
      await new Promise(resolve => setTimeout(resolve, 300));
      broadcast('connection-animate', { fromNodeId: 'node-gemini', toNodeId: 'node-webhook-end', duration: 500 });
      broadcast('node-highlight', { nodeId: 'node-webhook-end', duration: 1200 });
      broadcast('log', { message: `[Logic Router] CONVERSÃO COMERCIAL DETECTADA. Iniciando parser estruturado de Leads...`, logType: 'warning' });

      let leadObject = {
        nome: 'Cliente Criações Freitas',
        telefone: userPhone,
        email: 'contato@cliente.com',
        produto: 'Camisetas',
        tecido: 'Algodão Premium',
        quantidade: 30,
        descricao_estampa: printDescription
      };

      if (ai) {
        try {
          console.log(`[Lead Extractor] Extraindo JSON de lead estruturado com Gemini...`);
          const extractionResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              `Com base no seguinte histórico da Liz, extraia os dados estruturados do cliente em formato JSON com chaves: nome, email, produto, tecido, quantidade. Retorne APENAS o objeto JSON limpo e sem formatação markdown:\n\nHistórico:\n${JSON.stringify(chatHistory)}`
            ]
          });
          const leadJsonString = extractionResponse.text.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(leadJsonString);
          leadObject = { ...leadObject, ...parsed };
        } catch (err) {
          console.error('[Lead Extractor Error] Erro ao processar JSON estruturado de lead:', err.message);
        }
      }

      console.log(`[Lead Extractor] Lead extraído:`, JSON.stringify(leadObject));
      broadcast('log', { message: `[Lead Extractor] Lead estruturado gerado:\n${JSON.stringify(leadObject, null, 2)}`, logType: 'success' });

      if (CRM_WEBHOOK && !CRM_WEBHOOK.includes('teste.divary.shop/webhook')) {
        try {
          console.log(`[CRM Webhook] Disparando lead para ${CRM_WEBHOOK}...`);
          await axios.post(CRM_WEBHOOK, leadObject, { timeout: 5000 });
          console.log(`[CRM Webhook] Lead disparado com sucesso!`);
          broadcast('log', { message: `[Axios] POST para CRM comercial disparado com sucesso! Lead cadastrado no ERP.`, logType: 'success' });
        } catch (err) {
          console.error('[CRM Webhook Error] Erro ao enviar webhook do CRM:', err.message);
          broadcast('log', { message: `[Axios] Falha no disparo do webhook CRM: ${err.message}`, logType: 'danger' });
        }
      } else {
        console.log(`[CRM Webhook] Disparo omitido (URL vazia, padrão ou autorreferenciada para si mesma)`);
      }
    }

    // Libera a trava do Redis ao finalizar com sucesso
    if (redis && redis.status === 'ready') {
      console.log(`[Redis] Removendo trava anti-loop para ${sessionKey}`);
      await redis.del(redisLockKey).catch(() => {});
    }

    const duration = Date.now() - requestStartTime;
    console.log(`[Webhook] Requisição finalizada com sucesso em ${duration}ms!`);
    res.status(200).send('Success');
  } catch (error) {
    console.error(`[Webhook Fatal Error] Erro fatal no processamento de +${userPhone}:`, error.message);
    broadcast('log', { message: `[Webhook Endpoint] Erro catastrófico: ${error.message}`, logType: 'danger' });
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor unificado da Liz (Backend + GUI) ativo na porta ${PORT}`);
});
