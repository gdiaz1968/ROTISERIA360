-- Anulación auditada de comandas y baja lógica de renglones de venta.
-- No elimina registros ni modifica pagos ya confirmados.

ALTER TABLE public.ventas_detalle
  ADD COLUMN IF NOT EXISTS estado varchar(20) NOT NULL DEFAULT 'ACTIVO';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ventas_detalle_estado_check'
      AND conrelid = 'public.ventas_detalle'::regclass
  ) THEN
    ALTER TABLE public.ventas_detalle
      ADD CONSTRAINT ventas_detalle_estado_check
      CHECK (estado IN ('ACTIVO', 'ANULADO'));
  END IF;
END $$;

ALTER TABLE public.ventas_comandas
  ADD COLUMN IF NOT EXISTS fecha_anulacion timestamptz NULL,
  ADD COLUMN IF NOT EXISTS motivo_anulacion text NULL,
  ADD COLUMN IF NOT EXISTS usuario_anulacion varchar(120) NULL;

CREATE INDEX IF NOT EXISTS ix_ventas_detalle_venta_estado
  ON public.ventas_detalle (id_venta, estado);

CREATE INDEX IF NOT EXISTS ix_ventas_comandas_venta_estado
  ON public.ventas_comandas (id_venta, estado);
