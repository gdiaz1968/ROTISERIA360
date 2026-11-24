const { registrarActividad } = require("../services/auditoriaService");

function obtenerRuta(req) {
    const rutaRegistrada = req.route && req.route.path
        ? String(req.route.path)
        : req.path;

    return `${req.baseUrl || ""}${rutaRegistrada || ""}`.split("?")[0];
}

function obtenerModulo(req) {
    const base = (req.baseUrl || req.path || "").toLowerCase();

    if (base.startsWith("/api/")) {
        const segmento = base.split("/")[2] || "api";
        return segmento === "estructura" ? "recetas" : segmento;
    }

    return "sistema";
}

function obtenerUsuario(req) {
    const candidato = req.user || req.usuario || (req.session && req.session.user);

    if (!candidato) return null;
    if (typeof candidato === "string" || typeof candidato === "number") {
        return String(candidato).slice(0, 150);
    }

    const identificador =
        candidato.usuario ||
        candidato.username ||
        candidato.nombre_usuario ||
        candidato.nombre ||
        candidato.id ||
        candidato.userId;

    return identificador === undefined || identificador === null
        ? null
        : String(identificador).slice(0, 150);
}

function obtenerAccion(metodo) {
    switch (metodo) {
        case "POST": return "ALTA";
        case "PUT":
        case "PATCH": return "MODIFICACION";
        case "DELETE": return "BAJA";
        default: return "CONSULTA";
    }
}

function auditoriaMiddleware(req, res, next) {
    const inicio = Date.now();
    const metodo = String(req.method || "GET").toUpperCase();

    // OPTIONS y HEAD no representan operaciones funcionales auditables.
    if (metodo === "OPTIONS" || metodo === "HEAD") {
        return next();
    }

    res.on("finish", function () {
        const statusHttp = res.statusCode || 0;
        const esModificacion = ["POST", "PUT", "PATCH", "DELETE"].includes(metodo);

        // Registrar todas las escrituras y solamente las consultas que
        // terminaron en advertencia/error. No se guardan cuerpos ni query strings.
        if (!esModificacion && statusHttp < 300) {
            return;
        }

        const resultado = statusHttp >= 400
            ? "ERROR"
            : statusHttp >= 300
                ? "ADVERTENCIA"
                : "OK";

        const ruta = obtenerRuta(req);
        const detalle = {
            content_length: req.get("content-length") || null
        };

        registrarActividad({
            usuario: obtenerUsuario(req),
            modulo: obtenerModulo(req),
            accion: obtenerAccion(metodo),
            metodo,
            ruta,
            resultado,
            statusHttp,
            ip: req.ip || null,
            duracionMs: Math.max(0, Date.now() - inicio),
            detalle
        }).catch(function (error) {
            // La auditoría no debe interrumpir ni cambiar la respuesta del negocio.
            console.error("ERROR REGISTRANDO AUDITORIA:", error.message);
        });
    });

    next();
}

module.exports = auditoriaMiddleware;
