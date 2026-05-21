/* ==========================================================================
   LIZ AGENT PLATFORM - CRIAÇÕES FREITAS
   Interactive Logic & Standalone Node.js Service Generator
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Init Platform
  initNavigation();
  initSimulator();
  initCanvasInteractivity();
  initExporter();
  initSettings();
  initRealtimeBridge();
  syncSettingsWithBackend();
  
  // Render initial connection paths
  setTimeout(drawFlowLines, 100);
  window.addEventListener('resize', drawFlowLines);
});

/* ==========================================================================
   NAVIGATION
   ========================================================================== */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      if (!tabId) return;

      // Update Navigation active state
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Update Tab Pane active state
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === tabId) {
          pane.classList.add('active');
        }
      });

      // Redraw lines if dashboard selected
      if (tabId === 'tab-dashboard') {
        setTimeout(drawFlowLines, 50);
      }
    });
  });
}

/* ==========================================================================
   WORKFLOW CANVAS CONNECTIONS
   ========================================================================== */
function drawFlowLines() {
  const container = document.querySelector('.canvas-container');
  const svg = document.getElementById('flow-lines');
  if (!svg || !container) return;

  svg.innerHTML = '';
  
  const connections = [
    { from: 'node-webhook', to: 'node-switch' },
    { from: 'node-switch', to: 'node-redis', type: 'text' },
    { from: 'node-switch', to: 'node-media', type: 'image' },
    { from: 'node-media', to: 'node-redis' },
    { from: 'node-redis', to: 'node-wait' },
    { from: 'node-wait', to: 'node-postgres-get' },
    { from: 'node-postgres-get', to: 'node-gemini' },
    { from: 'node-gemini', to: 'node-postgres-save' },
    { from: 'node-postgres-save', to: 'node-sender' },
    { from: 'node-gemini', to: 'node-webhook-end' }
  ];

  const svgRect = svg.getBoundingClientRect();

  connections.forEach(conn => {
    const elFrom = document.getElementById(conn.from);
    const elTo = document.getElementById(conn.to);
    
    if (elFrom && elTo) {
      const rectFrom = elFrom.getBoundingClientRect();
      const rectTo = elTo.getBoundingClientRect();

      const x1 = rectFrom.left + rectFrom.width / 2 - svgRect.left + container.scrollLeft;
      const y1 = rectFrom.bottom - svgRect.top + container.scrollTop;
      
      const x2 = rectTo.left + rectTo.width / 2 - svgRect.left + container.scrollLeft;
      const y2 = rectTo.top - svgRect.top + container.scrollTop;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const offset = Math.abs(y2 - y1) * 0.4;
      const d = `M ${x1} ${y1} C ${x1} ${y1 + offset}, ${x2} ${y2 - offset}, ${x2} ${y2}`;
      
      path.setAttribute('d', d);
      path.setAttribute('id', `path-${conn.from}-${conn.to}`);
      svg.appendChild(path);
    }
  });
}

function initCanvasInteractivity() {
  const nodes = document.querySelectorAll('.node-card');
  nodes.forEach(node => {
    node.addEventListener('click', () => {
      showToast(`Visualizando parâmetros de microsserviço: ${node.querySelector('.node-header').textContent.trim()}`);
    });
  });
}

function animateConnection(fromNodeId, toNodeId, duration = 500) {
  const path = document.getElementById(`path-${fromNodeId}-${toNodeId}`);
  if (path) {
    path.classList.add('active');
    setTimeout(() => {
      path.classList.remove('active');
    }, duration);
  }
}

function highlightNode(nodeId, duration = 800) {
  const node = document.getElementById(nodeId);
  if (node) {
    node.classList.add('active-execution');
    setTimeout(() => {
      node.classList.remove('active-execution');
    }, duration);
  }
}

/* ==========================================================================
   SIMULATOR CORE
   ========================================================================== */
let conversationStage = 0;
let userProfile = {
  name: '',
  phone: '+55 11 99999-8888',
  product: '',
  fabric: '',
  quantity: 0,
  printDescription: '',
  imageAttached: false,
  imageUrl: ''
};

const printTemplates = [
  {
    name: "Estampa Floral Tropical",
    url: "https://images.unsplash.com/photo-1576016770956-debb63d90029?w=300&q=80",
    desc: "Estampa floral vibrante estilo tropical, cores predominantes verde-esmeralda, rosa pastel e amarelo sobre fundo preto. Altamente recomendada para sublimação total em poliéster toque de algodão."
  },
  {
    name: "Logotipo Academia Crossfit",
    url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300&q=80",
    desc: "Logotipo gráfico minimalista com escudo, barras de peso e fontes robustas em cor branca chapada sobre tecido escuro. Indicado para Silk-Screen plastisol ou Bordado de alta definição."
  },
  {
    name: "Arte Abstrata Streetwear",
    url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=300&q=80",
    desc: "Ilustração abstrata moderna com formas geométricas distorcidas e respingos de tinta nas tonalidades roxo neon, laranja e turquesa. Ideal para camisetas premium 100% algodão com estamparia DTG ou Silk."
  }
];

function initSimulator() {
  const inputField = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const uploadBtn = document.getElementById('upload-btn');
  const previewArea = document.getElementById('image-preview-area');
  const quickTemplates = document.getElementById('quick-templates');

  let selectedImage = null;

  // Envia mensagem inicial se o chat estiver vazio e não houver histórico
  setTimeout(() => {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages && chatMessages.children.length === 0) {
      appendMessage("Olá! Sou a Liz, assistente virtual independente da Criações Freitas. 🌸✂️\n\nEstou aqui para criar o seu orçamento de vestuário personalizado sem complicações! O que você gostaria de produzir hoje? (Ex: camisetas personalizadas, moletons ou uniformes corporativos?)", 'incoming');
    }
  }, 1000);

  printTemplates.forEach((tpl) => {
    const chip = document.createElement('div');
    chip.className = 'quick-template-chip';
    chip.innerHTML = `<i class="fa-solid fa-image"></i> ${tpl.name}`;
    chip.addEventListener('click', () => {
      selectedImage = tpl;
      previewArea.innerHTML = `
        <div class="image-preview-thumbnail">
          <img src="${tpl.url}" alt="${tpl.name}">
          <button class="remove-btn" onclick="removeSelectedImage()"><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;
      inputField.value = `Quero confeccionar camisetas usando esta arte como referência.`;
      showToast("Estampa carregada como anexo de imagem!");
    });
    quickTemplates.appendChild(chip);
  });

  window.removeSelectedImage = () => {
    selectedImage = null;
    previewArea.innerHTML = '';
  };

  const handleSend = () => {
    const text = inputField.value.trim();
    if (!text && !selectedImage) return;

    // Limpa os campos. O SSE do backend Express vai receber o webhook e
    // disparar os eventos para adicionar no chat em tempo real de forma consistente!
    inputField.value = '';
    const currentImg = selectedImage;
    selectedImage = null;
    previewArea.innerHTML = '';

    sendToWebhook(text, currentImg);
  };

  sendBtn.addEventListener('click', handleSend);
  inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  uploadBtn.addEventListener('click', () => {
    const randomTpl = printTemplates[Math.floor(Math.random() * printTemplates.length)];
    selectedImage = randomTpl;
    previewArea.innerHTML = `
      <div class="image-preview-thumbnail">
        <img src="${randomTpl.url}" alt="${randomTpl.name}">
        <button class="remove-btn" onclick="removeSelectedImage()"><i class="fa-solid fa-xmark"></i></button>
      </div>
    `;
    showToast("Simulação: Imagem anexada com sucesso!");
  });
}

function appendMessage(text, direction, imageUrl = null) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${direction}`;
  
  let content = '';
  if (imageUrl) {
    content += `<div class="media-preview"><img src="${imageUrl}"></div>`;
  }
  content += `<span>${text.replace(/\n/g, '<br>')}</span>`;
  content += `<span class="time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
  
  bubble.innerHTML = content;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addConsoleLog(message, type = 'info') {
  const consoleBody = document.getElementById('console-body');
  if (!consoleBody) return;

  const log = document.createElement('div');
  log.className = `console-log ${type}`;
  log.innerHTML = `
    <span class="time">[${new Date().toLocaleTimeString()}]</span>
    <span class="message">${message}</span>
  `;
  consoleBody.appendChild(log);
  consoleBody.scrollTop = consoleBody.scrollHeight;
}

async function sendToWebhook(text, imageTemplate) {
  const instanceName = localStorage.getItem('liz_set-instance-name') || 'freitas-prod';
  const chatId = '5511999998888@s.whatsapp.net';
  
  let messageContent = {};
  if (imageTemplate) {
    messageContent = {
      imageMessage: {
        caption: text || 'Enviou uma estampa',
        mediaKey: 'fake-media-key-from-sim'
      }
    };
  } else {
    messageContent = {
      conversation: text
    };
  }

  const webhookPayload = {
    event: 'MESSAGES_UPSERT',
    instance: instanceName,
    data: {
      key: {
        remoteJid: chatId,
        fromMe: false
      },
      message: messageContent
    }
  };

  try {
    addConsoleLog(`[Simulador] Enviando payload de teste para POST /webhook...`, 'info');
    const response = await fetch('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });
    if (!response.ok) {
      addConsoleLog(`[Simulador] Falha ao enviar para o webhook: ${response.statusText}`, 'danger');
    }
  } catch (err) {
    console.error('Erro no simulador HTTP:', err);
    addConsoleLog(`[Simulador] Erro de conexão com /webhook: ${err.message}`, 'danger');
  }
}

/* ==========================================================================
   CODE EXPORTER GENERATOR (STANDALONE NODE.JS)
   ========================================================================== */
function initExporter() {
  const menuItems = document.querySelectorAll('.code-menu-item');
  const codeBox = document.getElementById('code-content');
  const codeTitle = document.getElementById('code-title');
  const copyBtn = document.getElementById('copy-code-btn');

  let currentKey = 'index-js';

  const getDynamicCode = (key) => {
    const evoUrl = localStorage.getItem('liz_set-evolution-url') || 'http://localhost:8080';
    const evoKey = localStorage.getItem('liz_set-evolution-key') || 'EvolutionSecretApiKey_2026';
    const instName = localStorage.getItem('liz_set-instance-name') || 'freitas-prod';
    const crmWebhook = localStorage.getItem('liz_set-webhook-crm') || 'http://seu-crm.com/api/webhook/leads';
    const geminiKey = localStorage.getItem('liz_set-gemini-key') || 'SuaGoogleGeminiApiKeyAqui';
    const redisTtl = localStorage.getItem('liz_set-redis-ttl') || '300';
    const waitTime = localStorage.getItem('liz_set-wait-time') || '1.5';
    const pgUrl = localStorage.getItem('liz_set-postgres-url') || 'postgresql://postgres:FreitasAdmin99@postgres-db:5432/freitas_db';
    const redisUrl = localStorage.getItem('liz_set-redis-url') || 'redis://redis-cache:6379/1';
    const systemPrompt = localStorage.getItem('liz_agent-prompt-setting') || 'Você é a Liz, assistente virtual da Criações Freitas...';

    switch (key) {
      case 'index-js':
        return {
          title: 'Serviço Autônomo - index.js (Node.js)',
          lang: 'js',
          code: `/**
 * LIZ AI AGENT - CRIAÇÕES FREITAS
 * Standalone Node.js Express Microservice
 * Integrado com Evolution API, PostgreSQL, Redis e SDK do Gemini.
 */

const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: '${pgUrl}' });
const redis = new Redis('${redisUrl}');
const ai = new GoogleGenAI({ apiKey: '${geminiKey}' });

const EVOLUTION_URL = '${evoUrl}';
const EVOLUTION_KEY = '${evoKey}';
const CRM_WEBHOOK = '${crmWebhook}';
const WAIT_TIME_MS = parseFloat('${waitTime}') * 1000;

app.post('/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;
    if (event !== 'MESSAGES_UPSERT' || !data || data.key.fromMe) return res.status(200).send('Ignored');

    const chatId = data.key.remoteJid;
    const sessionKey = \`${instName}_\${chatId}\`;
    const redisLockKey = \`lock:freitas:\${sessionKey}\`;
    
    if (await redis.get(redisLockKey)) return res.status(200).send('Locked');
    await redis.set(redisLockKey, 'locked', 'EX', ${redisTtl});

    await new Promise(res => setTimeout(res, WAIT_TIME_MS));

    // ... (logic remains)
    res.status(200).send('Success');
  } catch (err) { res.status(500).send('Error'); }
});
app.listen(3000, () => console.log('Liz running on port 3000'));`
        };
      case 'package-json':
        return {
          title: 'Gerenciador de Dependências - package.json',
          lang: 'json',
          code: `{ "name": "liz-agent-service", "dependencies": { "@google/genai": "^2.5.0", "axios": "^1.6.2", "express": "^4.18.2", "ioredis": "^5.3.2", "pg": "^8.11.3" } }`
        };
      case 'docker-compose':
        return {
          title: 'Docker Stack Independente - docker-compose.yml',
          lang: 'yaml',
          code: `version: '3.8'
services:
  liz-agent-service:
    build: .
    environment:
      - DATABASE_URL=${pgUrl}
      - REDIS_URL=${redisUrl}
      - EVOLUTION_API_URL=${evoUrl}
      - EVOLUTION_API_KEY=${evoKey}
      - GEMINI_API_KEY=${geminiKey}
      - CRM_WEBHOOK_URL=${crmWebhook}`
        };
      case 'gemini-prompt':
        return {
          title: 'Diretrizes do Sistema (System Prompt)',
          lang: 'txt',
          code: systemPrompt
        };
      case 'postgres-sql':
        return {
          title: 'Migrações do Banco de Dados',
          lang: 'sql',
          code: `CREATE TABLE IF NOT EXISTS chat_history (id SERIAL PRIMARY KEY, session_id TEXT, role TEXT, content TEXT);`
        };
      default: return null;
    }
  };

  const updateCodeDisplay = (key) => {
    currentKey = key;
    const tpl = getDynamicCode(key);
    if (!tpl) return;
    codeTitle.textContent = tpl.title;
    codeBox.textContent = tpl.code;
    codeBox.className = `code-content-box ${tpl.lang}`;
  };

  window.refreshCodeDisplay = () => updateCodeDisplay(currentKey);

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      updateCodeDisplay(item.getAttribute('data-code'));
    });
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(codeBox.textContent).then(() => showToast("Código copiado!"));
  });

  updateCodeDisplay('index-js');
}

function loadStoredSettings() {
  const fields = ['set-evolution-url', 'set-evolution-key', 'set-instance-name', 'set-webhook-crm', 'set-gemini-key', 'set-redis-ttl', 'set-wait-time', 'set-postgres-url', 'set-redis-url', 'agent-prompt-setting'];
  fields.forEach(id => {
    const val = localStorage.getItem(`liz_${id}`);
    const el = document.getElementById(id);
    if (val && el) el.value = val;
  });

  // Atualiza o indicador visual do badge do Gemini na carga
  const geminiKey = localStorage.getItem('liz_set-gemini-key') || '';
  const geminiBadge = document.getElementById('status-gemini');
  if (geminiBadge) {
    if (geminiKey.trim()) {
      geminiBadge.classList.add('active');
      geminiBadge.classList.remove('offline');
      geminiBadge.setAttribute('title', 'Gemini 2.5 Flash Lite conectado com chave real');
    } else {
      geminiBadge.classList.remove('active');
      geminiBadge.classList.add('offline');
      geminiBadge.setAttribute('title', 'Aguardando chave do Gemini');
    }
  }

  // Atualiza indicador visual do Cache & DB
  const pgUrl = localStorage.getItem('liz_set-postgres-url') || '';
  const dbBadge = document.getElementById('status-database');
  if (dbBadge) {
    if (pgUrl.trim()) {
      dbBadge.classList.add('active');
      dbBadge.classList.remove('offline');
      dbBadge.setAttribute('title', 'Banco Postgres e Redis configurados');
    } else {
      dbBadge.classList.remove('active');
      dbBadge.classList.add('offline');
    }
  }
}

function initSettings() {
  const saveBtn = document.getElementById('save-settings-btn');
  const resetBtn = document.querySelector('#tab-settings button[type="reset"]');
  loadStoredSettings();

  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const fields = ['set-evolution-url', 'set-evolution-key', 'set-instance-name', 'set-webhook-crm', 'set-gemini-key', 'set-redis-ttl', 'set-wait-time', 'set-postgres-url', 'set-redis-url', 'agent-prompt-setting'];
    const config = {};
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        localStorage.setItem(`liz_${id}`, el.value);
        config[id] = el.value;
      }
    });

    const geminiKey = document.getElementById('set-gemini-key').value.trim();
    const geminiBadge = document.getElementById('status-gemini');
    if (geminiBadge) {
      if (geminiKey) {
        geminiBadge.classList.add('active');
        geminiBadge.classList.remove('offline');
        geminiBadge.setAttribute('title', 'Gemini 2.5 Flash Lite conectado com chave real do usuário');
      } else {
        geminiBadge.classList.remove('active');
        geminiBadge.classList.add('offline');
        geminiBadge.setAttribute('title', 'Aguardando configuração da chave no painel de ajustes');
      }
    }

    const pgUrl = document.getElementById('set-postgres-url').value.trim();
    const dbBadge = document.getElementById('status-database');
    if (dbBadge) {
      if (pgUrl) {
        dbBadge.classList.add('active');
        dbBadge.classList.remove('offline');
      } else {
        dbBadge.classList.remove('active');
        dbBadge.classList.add('offline');
      }
    }

    try {
      addConsoleLog('[Simulador] Enviando novas configurações para o backend Express...', 'info');
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      const resData = await response.json();
      if (resData.success) {
        showToast("Ajustes salvos localmente e aplicados no backend com sucesso!");
        addConsoleLog('[Express] Parâmetros salvos no .env físico e serviços reiniciados com sucesso!', 'success');
      } else {
        showToast(`Erro ao aplicar ajustes: ${resData.error}`, 'danger');
        addConsoleLog(`[Express] Erro ao reconfigurar chaves: ${resData.error}`, 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast("Erro de rede ao sincronizar ajustes com o Express.", 'danger');
      addConsoleLog(`[Express] Erro de conexão com /api/settings: ${err.message}`, 'danger');
    }

    if (window.refreshCodeDisplay) {
      window.refreshCodeDisplay();
    }

    setTimeout(() => {
      document.querySelector('.nav-item[data-tab="tab-dashboard"]').click();
    }, 600);
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (confirm("Deseja realmente restaurar os valores padrão do sistema?")) {
        const defaults = {
          'set-evolution-url': 'http://localhost:8080',
          'set-evolution-key': 'EvolutionSecretApiKey_2026',
          'set-instance-name': 'freitas-prod',
          'set-webhook-crm': 'http://seu-crm.com/api/webhook/leads',
          'set-gemini-key': '',
          'set-redis-ttl': '300',
          'set-wait-time': '1.5',
          'set-postgres-url': 'postgresql://postgres:FreitasAdmin99@postgres-db:5432/freitas_db',
          'set-redis-url': 'redis://redis-cache:6379/1',
          'agent-prompt-setting': `Você é a Liz, assistente de inteligência artificial da "Criações Freitas", uma confecção especializada em vestuário personalizado, estamparia premium e bordados industriais.

### 🌟 PERSONALIDADE E TOM
- Amigável, empolgada com arte, profissional, focada em design de estampas e moda.
- Use emojis moderadamente (🎨, 🌸, 👕, ✂️).
- Fale em português de forma fluida e calorosa. Nunca pareça um robô engessado.

### 💼 DIRETRIZES DO NEGÓCIO
1. PRODUTOS QUE OFERECEMOS:
   - Camisetas Premium (Algodão Fio 30.1 Penteado ou Poliéster Toque de Algodão).
   - Moletons Flanelados Confort.
   - Uniformes Profissionais Customizados.
   - Eco-bags Ecológicas de Lona/Algodão.

2. MÉTODOS DE IMPRESSÃO / REGRAS:
   - **Sublimação**: Perfeito para fotos, imagens complexas com degradês ou artes coloridas. Realizado em poliéster toque de algodão. **Mínimo: Não há mínimo (1 peça).**
   - **Silk-Screen (Serigrafia)**: Perfeito para logos corporativos, estampas grandes com cores sólidas. **Mínimo: 20 peças.**
   - **Bordado Industrial**: Alta sofisticação, ideal para logotipos pequenos no peito de uniformes ou moletons. **Mínimo: 20 peças.**

3. CONDIÇÕES FINANCEIRAS:
   - Faturamento: 50% de sinal para dar entrada na produção física + 50% restantes antes da expedição e envio das peças.

### 📋 SCRIPT DE ATENDIMENTO E QUALIFICAÇÃO
Seu objetivo é coletar estes dados de forma natural ao longo do chat (não pergunte tudo de uma vez):
1. **Nome do Cliente**: Trate-o pelo nome assim que souber.
2. **Produto Desejado**: Camiseta, moletom, uniforme, etc.
3. **Tipo de Material**: Pergunte ou sugira conforme a estampa.
4. **Arte/Estampa**: Peça imagens de referência. Se ele enviar uma imagem, comente sobre ela com base na análise técnica.
5. **Quantidade**: Pergunte as unidades desejadas (aplique a regra de pedido mínimo).
6. **E-mail de Contato**: Para formalização da ficha técnica e financeiro.

### ⚠️ DETECÇÃO DE FECHAMENTO (webhook trigger)
Assim que tiver todas as informações básicas coletadas (Nome, Produto, Quantidade, Tipo de Arte/Material e E-mail), encerre a conversa de forma amigável gerando um resumo detalhado como este:
📋 **Resumo da Solicitação:**
- **Nome:** [Nome]
- **Produto:** [Produto]
- **Estampa:** [Descrição da estampa]
- **Material:** [Material sugerido]
- **Quantidade:** [Quantidade]
- **Contato:** [E-mail]`
        };

        Object.keys(defaults).forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.value = defaults[id];
            localStorage.setItem(`liz_${id}`, defaults[id]);
          }
        });

        const geminiBadge = document.getElementById('status-gemini');
        if (geminiBadge) {
          geminiBadge.classList.remove('active');
          geminiBadge.classList.add('offline');
          geminiBadge.setAttribute('title', 'Aguardando configuração da chave no painel de ajustes');
        }

        showToast("Configurações padrão restauradas!", "success");
        if (window.refreshCodeDisplay) window.refreshCodeDisplay();

        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(defaults)
          });
          addConsoleLog('[Express] Configurações resetadas com sucesso no backend.', 'info');
        } catch (err) {
          console.error(err);
        }
      }
    });
  }
}

function initRealtimeBridge() {
  addConsoleLog('[SSE] Conectando ao canal de eventos em tempo real do Express...', 'info');
  const evtSource = new EventSource('/api/events');
  
  evtSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        addConsoleLog(data.message, data.logType || 'info');
      } else if (data.type === 'node-highlight') {
        highlightNode(data.nodeId, data.duration || 600);
      } else if (data.type === 'connection-animate') {
        animateConnection(data.fromNodeId, data.toNodeId, data.duration || 300);
      } else if (data.type === 'chat-message') {
        const direction = data.role === 'model' ? 'incoming' : 'outgoing';
        appendMessage(data.content, direction, data.mediaUrl);
      } else if (data.type === 'sys-status') {
        addConsoleLog(data.message, 'system');
      }
    } catch (err) {
      console.error('Erro ao decodificar evento SSE:', err);
    }
  };

  evtSource.onerror = (err) => {
    console.error('Falha na conexão do EventSource:', err);
  };
}

async function syncSettingsWithBackend() {
  const fields = ['set-evolution-url', 'set-evolution-key', 'set-instance-name', 'set-webhook-crm', 'set-gemini-key', 'set-redis-ttl', 'set-wait-time', 'set-postgres-url', 'set-redis-url', 'agent-prompt-setting'];
  const config = {};
  let hasData = false;
  fields.forEach(id => {
    const val = localStorage.getItem(`liz_${id}`);
    if (val !== null) {
      config[id] = val;
      hasData = true;
    }
  });

  if (hasData) {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      const data = await response.json();
      if (data.success) {
        addConsoleLog('[Express] Configurações persistidas sincronizadas com o backend com sucesso.', 'success');
      }
    } catch (err) {
      console.error('Erro na sincronização de boot:', err);
    }
  }
}

/* ==========================================================================
   TOAST NOTIFICATION SYSTEM
   ========================================================================== */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-notif');
  if (!toast) return;

  const icon = type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation';
  const color = type === 'success' ? '#10b981' : '#ef4444';

  toast.style.background = color;
  toast.innerHTML = `<i class="fa-solid \${icon}"></i> <span>\${message}</span>`;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
