-- 1. Create the migraña_registros table
CREATE TABLE IF NOT EXISTS migraña_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  tipo_tratamiento text NOT NULL
);

-- 2. Enable Row Level Security (RLS) on the table (Optional but recommended)
ALTER TABLE migraña_registros ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated users to read and insert (since you might not have auth set up fully yet)
CREATE POLICY "Permitir insertar a todos" ON migraña_registros
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir leer a todos" ON migraña_registros
  FOR SELECT
  USING (true);

-- 3. Create the view for trends (vista_tendencia_migraña)
CREATE OR REPLACE VIEW vista_tendencia_migraña AS
SELECT 
  tipo_tratamiento,
  DATE_TRUNC('month', fecha) as mes,
  COUNT(*) as cantidad
FROM migraña_registros
GROUP BY tipo_tratamiento, DATE_TRUNC('month', fecha);

-- 4. Grant access to the view
GRANT SELECT ON vista_tendencia_migraña TO anon, authenticated;

-- 5. Create the ciclo_menstrual table
CREATE TABLE IF NOT EXISTS ciclo_menstrual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE ciclo_menstrual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir insertar a todos en ciclo" ON ciclo_menstrual
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir leer a todos en ciclo" ON ciclo_menstrual
  FOR SELECT
  USING (true);
