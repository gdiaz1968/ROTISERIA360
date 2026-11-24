const pool = require("../db");

async function registrarActividad(datos) {
    const {
        usuario = null,
        modulo,
        accion,
        metodo,
        ruta,
        resultado,
        statusHttp,
        ip = null,
        duracionMs = null,
        detalle = null
    } = datos;

    const sql = `
        INSERT INTO public.auditoria_actividad (
            usuario,
            modulo,
            accion,
            metodo,
            ruta,
            resultado,
            status_http,
            ip,
            duracion_ms,
            detalle
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    `;

    const valores = [
        usuario,
        modulo,
        accion,
        metodo,
        ruta,
        resultado,
        statusHttp,
        ip,
        duracionMs,
        detalle ? JSON.stringify(detalle) : null
    ];

    await pool.query(sql, valores);
}

module.exports = {
    registrarActividad
};
