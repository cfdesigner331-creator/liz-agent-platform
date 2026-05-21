-- 1. Criar Tabela de Histórico de Conversas para Memória de Longo Prazo
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL, -- Chave: instanceName + remoteJid
    role VARCHAR(50) NOT NULL,        -- 'user' ou 'model'
    content TEXT NOT NULL,            -- Conteúdo da mensagem
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices para otimização de buscas de alta velocidade
CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_at);
