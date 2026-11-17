-- Delivery y entregas integrados al seguimiento de comandas.
-- Se conservan ventas, pagos y repartidores existentes.

ALTER TABLE public.ventas
  DROP CONSTRAINT IF EXISTS ventas_estado_check;

ALTER TABLE public.ventas
  ADD CONSTRAINT ventas_estado_check
  CHECK (estado IN (
    'PENDIENTE',
    'EN_PREPARACION',
    'LISTO_PARA_ENTREGAR',
    'EN_REPARTO',
    'ENTREGADO',
    'ANULADO'
  ));

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS fecha_entrega timestamptz NULL;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS usuario_entrega varchar(120) NULL;

CREATE TABLE IF NOT EXISTS public.repartos (
  id bigserial PRIMARY KEY,
  id_repartidor bigint NOT NULL REFERENCES public.repartidores(id),
  estado varchar(20) NOT NULL DEFAULT 'EN_CURSO'
    CHECK (estado IN ('EN_CURSO', 'FINALIZADO')),
  fecha_salida timestamptz NOT NULL DEFAULT now(),
  fecha_cierre timestamptz NULL,
  observaciones text NULL,
  fecha_alta timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_repartos_repartidor_fecha
  ON public.repartos (id_repartidor, fecha_salida DESC);

CREATE TABLE IF NOT EXISTS public.repartos_pedidos (
  id bigserial PRIMARY KEY,
  id_reparto bigint NOT NULL REFERENCES public.repartos(id),
  id_venta bigint NOT NULL UNIQUE REFERENCES public.ventas(id),
  fecha_alta timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_repartos_pedidos_reparto
  ON public.repartos_pedidos (id_reparto);

CREATE TABLE IF NOT EXISTS public.ventas_rendiciones (
  id bigserial PRIMARY KEY,
  id_venta bigint NOT NULL UNIQUE REFERENCES public.ventas(id),
  id_reparto bigint NULL REFERENCES public.repartos(id),
  importe_esperado numeric(14,2) NOT NULL DEFAULT 0 CHECK (importe_esperado >= 0),
  importe_efectivo numeric(14,2) NOT NULL DEFAULT 0 CHECK (importe_efectivo >= 0),
  importe_transferencia numeric(14,2) NOT NULL DEFAULT 0 CHECK (importe_transferencia >= 0),
  diferencia numeric(14,2) NOT NULL DEFAULT 0,
  observaciones text NULL,
  usuario varchar(120) NULL,
  fecha_rendicion timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ventas_rendiciones_fecha
  ON public.ventas_rendiciones (fecha_rendicion DESC);
