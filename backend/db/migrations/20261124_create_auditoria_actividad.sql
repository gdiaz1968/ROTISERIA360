CREATE TABLE IF NOT EXISTS public.auditoria_actividad (
    id BIGSERIAL PRIMARY KEY,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario VARCHAR(150),
    modulo VARCHAR(100) NOT NULL,
    accion VARCHAR(50) NOT NULL,
    metodo VARCHAR(10) NOT NULL,
    ruta TEXT NOT NULL,
    resultado VARCHAR(20) NOT NULL,
    status_http INTEGER,
    ip VARCHAR(100),
    duracion_ms INTEGER,
    detalle JSONB,
    CONSTRAINT chk_auditoria_actividad_resultado
        CHECK (resultado IN ('OK', 'ERROR', 'ADVERTENCIA'))
);

CREATE INDEX IF NOT EXISTS idx_auditoria_actividad_fecha
    ON public.auditoria_actividad (fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_actividad_usuario_fecha
    ON public.auditoria_actividad (usuario, fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_actividad_modulo_fecha
    ON public.auditoria_actividad (modulo, fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_actividad_accion_fecha
    ON public.auditoria_actividad (accion, fecha_hora DESC);
