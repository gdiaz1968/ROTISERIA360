const pool = require("../db");

/**
 * Registra una actividad sin interrumpir la operación principal.
 * Los datos opcionales se normalizan para respetar el esquema de Neon.
 */
async function registrarActividad(actividad) {
    const {
        usuarioId = null,
        usuario = null,
        sesionId = null,
        modulo,
        pantalla = null,
        accion,
        entidad = null,
        entidadId = null,
        metodoHttp = null,
        ruta = null,
        resultado = "OK",
        duracionMs = null,
        ip = null,
        userAgent = null,
        detalle = {}
    } = actividad;

    try {
        await pool.query(
            `INSERT INTO public.auditoria_actividad
            (
                usuario_id, usuario, sesion_id, modulo, pantalla, accion,
                entidad, entidad_id, metodo_http, ruta, resultado,
                duracion_ms, ip, user_agent, detalle
            )
            VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)`,
            [
                usuarioId,
                usuario,
                sesionId,
                modulo,
                pantalla,
                accion,
                entidad,
                entidadId,
                metodoHttp,
                ruta,
                resultado,
                duracionMs,
                ip,
                userAgent,
                JSON.stringify(detalle || {})
            ]
        );
    } catch (error) {
        // La auditoría nunca debe invalidar una operación comercial ya respondida.
        console.error("[AUDITORIA] No se pudo registrar la actividad:", error.message);
    }
}

module.exports = { registrarActividad };
