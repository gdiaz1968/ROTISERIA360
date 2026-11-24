-- Auditoría de actividad para ROTISERIA360.
-- Idempotente: permite ejecutar la migración más de una vez sin duplicar objetos.

CREATE TABLE IF NOT EXISTS public.auditoria_actividad (
    id BIGSERIAL PRIMARY KEY,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario_id BIGINT NULL,
    usuario TEXT NULL,
    sesion_id TEXT NULL,
    modulo TEXT NOT NULL,
    pantalla TEXT NULL,
    accion TEXT NOT NULL,
    entidad TEXT NULL,
    entidad_id TEXT NULL,
    metodo_http TEXT NULL,
    ruta TEXT NULL,
    resultado TEXT NOT NULL DEFAULT 'OK',
    duracion_ms INTEGER NULL,
    ip INET NULL,
    user_agent TEXT NULL,
    detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT ck_auditoria_resultado
        CHECK (resultado IN ('OK', 'ERROR', 'ADVERTENCIA'))
);

CREATE INDEX IF NOT EXISTS ix_auditoria_fecha_hora
    ON public.auditoria_actividad (fecha_hora DESC);

CREATE INDEX IF NOT EXISTS ix_auditoria_usuario_fecha
    ON public.auditoria_actividad (usuario, fecha_hora DESC);

CREATE INDEX IF NOT EXISTS ix_auditoria_modulo_fecha
    ON public.auditoria_actividad (modulo, fecha_hora DESC);

CREATE INDEX IF NOT EXISTS ix_auditoria_accion_fecha
    ON public.auditoria_actividad (accion, fecha_hora DESC);
