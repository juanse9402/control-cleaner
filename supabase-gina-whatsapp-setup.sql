-- Tabla para chats de WhatsApp guardados por Gina
CREATE TABLE IF NOT EXISTS gina_whatsapp_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  filename text,
  total_messages integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Tabla para los mensajes individuales del chat
CREATE TABLE IF NOT EXISTS gina_whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES gina_whatsapp_chats(id) ON DELETE CASCADE,
  timestamp text,
  date_iso date,
  sender text NOT NULL,
  message text NOT NULL,
  is_system boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE gina_whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE gina_whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso abierto
CREATE POLICY "Permitir todo gina_whatsapp_chats" ON gina_whatsapp_chats
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo gina_whatsapp_messages" ON gina_whatsapp_messages
  FOR ALL USING (true) WITH CHECK (true);
