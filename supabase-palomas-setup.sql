-- Tabla para el sistema de Palomas Mensajeras (Cartas de amor / mensajes entre Juan Sebastián y Gina)
CREATE TABLE IF NOT EXISTS gina_palomas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender text NOT NULL, -- 'Juan Sebastián' o 'Gina'
  recipient text NOT NULL, -- 'Gina' o 'Juan Sebastián'
  message text NOT NULL,
  status text DEFAULT 'entregada', -- 'enviada', 'entregada', 'leida'
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE gina_palomas ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso abierto para lectura y escritura
CREATE POLICY "Permitir todo gina_palomas" ON gina_palomas
  FOR ALL USING (true) WITH CHECK (true);
