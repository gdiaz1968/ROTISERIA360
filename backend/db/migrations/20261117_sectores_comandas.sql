-- Asocia cada producto habilitado para la venta con un sector responsable.
-- La columna queda nullable para permitir configurar productos antes de habilitarlos.
ALTER TABLE public.productos_venta
  ADD COLUMN id_sector bigint NULL;

ALTER TABLE public.productos_venta
  ADD CONSTRAINT fk_productos_venta_sector
  FOREIGN KEY (id_sector) REFERENCES public.sectores_cocina(id);

CREATE INDEX ix_productos_venta_sector
  ON public.productos_venta (id_sector);
