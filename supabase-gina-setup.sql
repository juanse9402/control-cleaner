-- Tabla para el registro de horas de Gina
CREATE TABLE IF NOT EXISTS gina_horas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  horas numeric(4,2) NOT NULL DEFAULT 0,
  tipo_dia text NOT NULL DEFAULT 'normal', -- 'normal', 'horas_mas', 'festivo', 'vacaciones'
  notas text,
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE gina_horas ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para anon y authenticated
CREATE POLICY "Permitir leer gina_horas" ON gina_horas
  FOR SELECT USING (true);

CREATE POLICY "Permitir insertar gina_horas" ON gina_horas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualizar gina_horas" ON gina_horas
  FOR UPDATE USING (true);

CREATE POLICY "Permitir borrar gina_horas" ON gina_horas
  FOR DELETE USING (true);
