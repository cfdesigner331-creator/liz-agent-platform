# Liz AI Agent - Criações Freitas 🌸✂️
> Arquitetura de Produção: Evolution API + Node.js Backend Autônomo + Gemini 2.5 Flash Lite + Redis + PostgreSQL

Este repositório contém a infraestrutura e os arquivos necessários para implantar a **Liz**, a assistente virtual inteligente da **Criações Freitas** de forma **100% autônoma e independente (sem n8n)**. Ela é especializada em qualificação comercial de leads, análise técnica de estampas gráficas de vestuário e automação de orçamentos via WhatsApp.

---

## 🏛️ Arquitetura do Sistema Independente

O ecossistema é acionado por eventos em tempo real no WhatsApp e processado pelo nosso microsserviço Node.js/Express, seguindo o modelo:

1. **Evolution API**: Intermedia a comunicação bidirecional com o WhatsApp. Envia Webhooks JSON de novas mensagens para o nosso serviço e oferece endpoints HTTP para envio e downloads de mídias.
2. **Microsserviço Liz (Express)**: Backend escrito em Node.js (`index.js`). Centraliza as regras de negócio, coordenação de banco de dados, chamadas ao Gemini, roteamento e ações de leads.
3. **Redis**: Cache em memória de alta performance. Implementa duas funcionalidades cruciais:
   - **Sistema Anti-Loop (Lock)**: Garante uma trava com TTL de 300 segundos usando chaves específicas por chat. Impede loops de mensagens concorrentes caso múltiplos eventos ocorram simultaneamente ou a Liz receba mensagens automáticas de outros sistemas.
   - **Debounce de Mensagens (Fila)**: Um timer de 1.5s que agrupa mensagens rápidas enviadas sequencialmente pelo cliente em uma única requisição ao Gemini, oferecendo respostas coesas e consolidadas em vez de múltiplos balões fragmentados.
4. **PostgreSQL**: Memória de longo prazo persistente. O backend recupera automaticamente as últimas 15 interações históricas ordenadas por timestamp a cada nova mensagem para manter o contexto conversacional do Gemini.
5. **Google Gemini 2.5 Flash Lite**: O cérebro do agente de IA. É invocado diretamente via SDK oficial `@google/genai`. 
   - **Multimodal (Visão Computacional)**: Descreve cores hexadecimais, estilos gráficos e recomenda a estamparia perfeita (Sublimação para degradês/poliéster, Silk-Screen ou Bordado para algodão e logos sólidos) de imagens enviadas.
   - **Personalidade do Prompt**: Qualifica o lead coletando Nome, Produto, Tipo de Estampa, Material sugerido, Quantidade e E-mail comercial, enviando uma ficha técnica de fechamento.
6. **Lead CRM Webhook**: Ao concluir o script comercial (detecção automática por IA no encerramento), o backend extrai os parâmetros qualificados de forma estruturada em formato JSON e os dispara por POST para o CRM/ERP da empresa.

---

## 🚀 Guia de Implantação Rápida com Docker

Suba toda a infraestrutura e o microsserviço da Liz em um único comando usando a nossa stack integrada de Docker Compose:

### 1. Pré-requisitos
- Docker instalado na sua máquina.
- Docker Compose configurado.

### 2. Configurando o seu Arquivo de Variáveis (`.env`)
Abra o arquivo `.env` do diretório e insira a sua chave secreta da API do Gemini (obtenha gratuitamente em [Google AI Studio](https://aistudio.google.com/)):
```env
GEMINI_API_KEY=SUA_CHAVE_AQUI
```

### 3. Executando a Stack Completa
Com o Docker ativo na sua máquina, abra o terminal no diretório e execute:
```bash
docker-compose up -d --build
```
Este comando executará:
- O build local e inicialização do contêiner da **Liz (Express)** na porta `3000`.
- A **Evolution API** na porta `8080` (Integração WhatsApp).
- O **Redis** na porta `6379` (Fila, cache e locks).
- O **PostgreSQL** na porta `5432` (Banco de dados de memória persistente).

---

## 💾 Setup de Banco de Dados (PostgreSQL)

O banco de dados é criado automaticamente pelo Docker. No entanto, é necessário rodar a migração inicial para criar a tabela de histórico. 

Conecte-se ao seu PostgreSQL no banco `freitas_db` (usando ferramentas como DBeaver ou pgAdmin) na porta `5432` (senha: `FreitasAdmin99`) e rode o script [postgres_setup.sql](file:///C:/Users/User/.gemini/antigravity/scratch/liz-agent-platform/postgres_setup.sql):

```sql
-- Criar Tabela de Histórico de Conversas para Memória de Longo Prazo
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL, -- Chave: instanceName + remoteJid
    role VARCHAR(50) NOT NULL,        -- 'user' ou 'model'
    content TEXT NOT NULL,            -- Conteúdo da mensagem
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para buscas de performance instantânea
CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_at);
```

---

## 🔌 Configurando e Pareando com o WhatsApp

Após a Stack Docker estar online, você deve conectar o telefone da sua empresa na Evolution API:

1. **Crie a Instância do WhatsApp**:
   - Faça uma requisição HTTP **POST** para `http://localhost:8080/instance/create`
   - Headers: `apikey: EvolutionSecretApiKey_2026`
   - JSON Payload:
     ```json
     {
       "instanceName": "freitas-prod",
       "token": "EvolutionSecretApiKey_2026",
       "qrcode": true
     }
     ```
2. **Escaneie o QR Code**:
   - Abra o log do container da Evolution API no terminal (`docker logs -f evolution-api`) ou use a resposta visual no seu gerenciador para ver o QR Code e escanear pelo celular do atendimento em *Aparelhos Conectados*.
3. **Configure o Webhook da Evolution API**:
   - Aponte os eventos do WhatsApp para o nosso microsserviço Node.js na rota `/webhook` fazendo uma requisição **POST** para `http://localhost:8080/webhook/set/freitas-prod`
   - Headers: `apikey: EvolutionSecretApiKey_2026`
   - JSON Payload:
     ```json
     {
       "enabled": true,
       "url": "http://liz-agent-service:3000/webhook",
       "events": [
         "MESSAGES_UPSERT"
       ]
     }
     ```

Pronto! A partir desse momento, toda mensagem enviada ao número do WhatsApp passará automaticamente pela Liz, que processará o atendimento comercial sem a necessidade de nenhuma ferramenta como n8n!

---

### 🎨 Painel de Simulação Local
Para testar os comportamentos de concorrência, o debounce de fila de 1.5s, as descrições de estampas por visão computacional e as integrações de logs interativos antes de colocar o robô no ar, acesse o nosso simulador visual no seu navegador no endereço:
👉 **[http://localhost:8500](http://localhost:8500)**
