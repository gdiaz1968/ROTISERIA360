// ======================================================
// ROTISERIA360
// COSTOS
// ======================================================

let productosCostos = [];
let insumosCostos = [];

document.addEventListener("DOMContentLoaded", function () {
    cargarProductosCostos();
    cargarInsumosCostos();

    const comboProducto = document.getElementById("costos-producto");
    if (comboProducto) {
        comboProducto.addEventListener("change", seleccionarProductoCosto);
    }

    const btnCalcular = document.getElementById("btn-calcular-costo");
    if (btnCalcular) {
        btnCalcular.addEventListener("click", consultarCosto);
    }

    const btnLimpiar = document.getElementById("btn-limpiar-costo");
    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", limpiarCosto);
    }

    const comboInsumo = document.getElementById("costo-insumo");
    if (comboInsumo) {
        comboInsumo.addEventListener("change", seleccionarInsumoCosto);
    }

    const btnGuardarInsumo = document.getElementById("btn-guardar-costo-insumo");
    if (btnGuardarInsumo) {
        btnGuardarInsumo.addEventListener("click", guardarCostoInsumo);
    }

    const btnLimpiarInsumo = document.getElementById("btn-limpiar-costo-insumo");
    if (btnLimpiarInsumo) {
        btnLimpiarInsumo.addEventListener("click", limpiarCostoInsumo);
    }
});

// ======================================================
// UTILIDADES
// ======================================================

async function costosLeerRespuesta(respuesta) {
    const texto = await respuesta.text();

    let datos = {};

    if (texto) {
        try {
            datos = JSON.parse(texto);
        } catch {
            throw new Error("El servidor devolvió una respuesta no válida.");
        }
    }

    if (!respuesta.ok) {
        throw new Error(
            datos.error ||
            datos.mensaje ||
            `Error del servidor (${respuesta.status}).`
        );
    }

    return datos;
}

function costosObtenerLista(datos, propiedad) {
    if (Array.isArray(datos)) {
        return datos;
    }

    if (datos && Array.isArray(datos[propiedad])) {
        return datos[propiedad];
    }

    return [];
}

function costosElemento(id) {
    return document.getElementById(id);
}

function costosAsignarValor(id, valor) {
    const elemento = costosElemento(id);

    if (elemento) {
        elemento.value = valor ?? "";
    }
}

function costosAsignarTexto(id, valor) {
    const elemento = costosElemento(id);

    if (elemento) {
        elemento.textContent = valor ?? "";
    }
}

function costosTipoProducto(producto) {
    return String(producto?.tipo ?? "").trim().toUpperCase();
}

// ======================================================
// CARGAR PRODUCTOS ELABORADOS
// ======================================================

async function cargarProductosCostos() {
    try {
        const respuesta = await fetch("/api/productos");
        const datos = await costosLeerRespuesta(respuesta);

        const todos = costosObtenerLista(datos, "productos");

        // El cálculo de recetas corresponde a productos ELABORADOS.
        productosCostos = todos.filter(function (producto) {
            return producto.activo !== false &&
                costosTipoProducto(producto) === "ELABORADO";
        });

        const combo = costosElemento("costos-producto");

        if (!combo) {
            return;
        }

        combo.replaceChildren();

        const opcionInicial = document.createElement("option");
        opcionInicial.value = "";
        opcionInicial.textContent = "Seleccionar producto elaborado...";
        combo.appendChild(opcionInicial);

        productosCostos.forEach(function (producto) {
            const opcion = document.createElement("option");
            opcion.value = producto.id;
            opcion.textContent =
                `${producto.codigo || ""} - ${producto.nombre || ""}`;

            combo.appendChild(opcion);
        });

        if (productosCostos.length === 0) {
            mostrarMensajeCosto(
                "No hay productos elaborados activos para calcular.",
                "info"
            );
        }
    } catch (error) {
        console.error("ERROR CARGANDO PRODUCTOS ELABORADOS:", error);
        mostrarMensajeCosto(error.message, "error");
    }
}

// ======================================================
// CARGAR INSUMOS
// ======================================================

async function cargarInsumosCostos() {
    try {
        const respuesta = await fetch("/api/costos/insumos");
        const datos = await costosLeerRespuesta(respuesta);

        insumosCostos = costosObtenerLista(datos, "insumos");

        const combo = costosElemento("costo-insumo");

        if (!combo) {
            return;
        }

        combo.replaceChildren();

        const opcionInicial = document.createElement("option");
        opcionInicial.value = "";
        opcionInicial.textContent = "Seleccionar insumo...";
        combo.appendChild(opcionInicial);

        insumosCostos.forEach(function (insumo) {
            const opcion = document.createElement("option");
            opcion.value = insumo.id;
            opcion.textContent =
                `${insumo.codigo || ""} - ${insumo.nombre || ""}`;

            combo.appendChild(opcion);
        });
    } catch (error) {
        console.error("ERROR CARGANDO INSUMOS:", error);
        mostrarMensajeCostoInsumo(error.message, "error");
    }
}

// ======================================================
// SELECCIONAR INSUMO
// ======================================================

async function seleccionarInsumoCosto() {
    const combo = costosElemento("costo-insumo");

    if (!combo || !combo.value) {
        limpiarDatosInsumo();
        return;
    }

    const id = Number(combo.value);

    const insumo = insumosCostos.find(function (item) {
        return Number(item.id) === id;
    });

    if (insumo) {
        costosAsignarValor("costo-insumo-unidad", insumo.unidad || "");
    }

    costosAsignarValor("costo-insumo-actual", "Consultando...");
    mostrarMensajeCostoInsumo("", "");

    try {
        const respuesta = await fetch(`/api/costos/insumo/${id}`);
        const datos = await costosLeerRespuesta(respuesta);

        // Admite respuesta directa o respuesta envuelta.
        const costo = datos?.resultado ?? datos?.insumo ?? datos;

        if (
            !costo ||
            costo.costo === null ||
            costo.costo === undefined
        ) {
            costosAsignarValor("costo-insumo-actual", "-");
        } else {
            costosAsignarValor(
                "costo-insumo-actual",
                costosFormatearMoneda(costo.costo)
            );
        }

        costosAsignarValor("costo-insumo-nuevo", "");

        await cargarHistorialCostoInsumo(id);
    } catch (error) {
        console.error("ERROR CONSULTANDO COSTO INSUMO:", error);
        costosAsignarValor("costo-insumo-actual", "-");
        mostrarMensajeCostoInsumo(error.message, "error");
    }
}

// ======================================================
// HISTORIAL DE COSTOS DEL INSUMO
// ======================================================

async function cargarHistorialCostoInsumo(idProducto) {
    try {
        const respuesta = await fetch(
            `/api/costos/insumo/${idProducto}/historial`
        );

        const datos = await costosLeerRespuesta(respuesta);
        const historial = costosObtenerLista(datos, "historial");

        mostrarHistorialCostoInsumo(historial);
    } catch (error) {
        console.error("ERROR CONSULTANDO HISTORIAL DE COSTOS:", error);
        mostrarHistorialCostoInsumo([]);
        mostrarMensajeCostoInsumo(
            "El costo actual se consultó, pero no se pudo cargar el historial.",
            "error"
        );
    }
}

function mostrarHistorialCostoInsumo(historial) {
    let contenedor = costosElemento("costo-insumo-historial");

    // El HTML actual no contiene un contenedor para el historial.
    // Se crea debajo del formulario de costos de insumos.
    if (!contenedor) {
        const combo = costosElemento("costo-insumo");

        const panel = combo
            ? combo.closest(".costos-panel")
            : null;

        if (!panel) {
            return;
        }

        contenedor = document.createElement("div");
        contenedor.id = "costo-insumo-historial";
        contenedor.className = "tabla-contenedor";
        contenedor.style.marginTop = "16px";
        panel.appendChild(contenedor);
    }

    contenedor.replaceChildren();

    const titulo = document.createElement("h3");
    titulo.textContent = "Historial de costos";
    contenedor.appendChild(titulo);

    if (!historial.length) {
        const mensaje = document.createElement("p");
        mensaje.textContent = "No hay registros de historial para mostrar.";
        contenedor.appendChild(mensaje);
        return;
    }

    const tabla = document.createElement("table");
    tabla.className = "tabla-costos";

    const encabezado = document.createElement("thead");
    const filaEncabezado = document.createElement("tr");

    ["Costo", "Desde", "Hasta", "Estado"].forEach(function (texto) {
        const th = document.createElement("th");
        th.textContent = texto;
        filaEncabezado.appendChild(th);
    });

    encabezado.appendChild(filaEncabezado);
    tabla.appendChild(encabezado);

    const cuerpo = document.createElement("tbody");

    historial.forEach(function (registro) {
        const fila = document.createElement("tr");

        const costo = registro.costo;
        const desde = registro.fecha_desde;
        const hasta = registro.fecha_hasta;
        const activo = registro.activo;

        [
            costosFormatearMoneda(costo),
            costosFormatearFecha(desde),
            costosFormatearFecha(hasta),
            activo === true ? "Vigente" : "Histórico"
        ].forEach(function (valor) {
            const celda = document.createElement("td");
            celda.textContent = valor;
            fila.appendChild(celda);
        });

        cuerpo.appendChild(fila);
    });

    tabla.appendChild(cuerpo);
    contenedor.appendChild(tabla);
}

function costosFormatearFecha(valor) {
    if (!valor) {
        return "-";
    }

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return String(valor);
    }

    return fecha.toLocaleString("es-AR");
}

// ======================================================
// GUARDAR COSTO DE INSUMO
// ======================================================

async function guardarCostoInsumo() {
    const combo = costosElemento("costo-insumo");
    const campoCosto = costosElemento("costo-insumo-nuevo");

    if (!combo || !campoCosto) {
        return;
    }

    const idProducto = Number(combo.value);
    const textoCosto = campoCosto.value.trim();
    const costo = Number(textoCosto);

    if (!idProducto) {
        mostrarMensajeCostoInsumo("Seleccione un insumo.", "error");
        return;
    }

    if (textoCosto === "" || !Number.isFinite(costo) || costo < 0) {
        mostrarMensajeCostoInsumo("Ingrese un costo válido.", "error");
        return;
    }

    try {
        const respuesta = await fetch("/api/costos/insumo", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id_producto: idProducto,
                costo: costo
            })
        });

        await costosLeerRespuesta(respuesta);

        costosAsignarValor(
            "costo-insumo-actual",
            costosFormatearMoneda(costo)
        );

        campoCosto.value = "";

        mostrarMensajeCostoInsumo(
            "Costo registrado correctamente.",
            "ok"
        );

        await cargarInsumosCostos();
        await cargarHistorialCostoInsumo(idProducto);
    } catch (error) {
        console.error("ERROR GUARDANDO COSTO INSUMO:", error);
        mostrarMensajeCostoInsumo(error.message, "error");
    }
}

// ======================================================
// LIMPIAR INSUMO
// ======================================================

function limpiarCostoInsumo() {
    costosAsignarValor("costo-insumo", "");
    limpiarDatosInsumo();
    mostrarMensajeCostoInsumo("", "");

    const historial = costosElemento("costo-insumo-historial");

    if (historial) {
        historial.replaceChildren();
    }
}

function limpiarDatosInsumo() {
    costosAsignarValor("costo-insumo-unidad", "");
    costosAsignarValor("costo-insumo-actual", "-");
    costosAsignarValor("costo-insumo-nuevo", "");
}

// ======================================================
// SELECCIONAR PRODUCTO ELABORADO
// ======================================================

function seleccionarProductoCosto() {
    const combo = costosElemento("costos-producto");

    if (!combo || !combo.value) {
        limpiarDatosProducto();
        limpiarResultado();
        return;
    }

    const id = Number(combo.value);

    const producto = productosCostos.find(function (item) {
        return Number(item.id) === id;
    });

    if (!producto) {
        limpiarDatosProducto();
        limpiarResultado();
        return;
    }

    costosAsignarValor("costos-codigo", producto.codigo || "");
    costosAsignarValor("costos-nombre", producto.nombre || "");
    costosAsignarValor("costos-tipo", producto.tipo || "");
    costosAsignarValor("costos-unidad", producto.unidad || "");

    limpiarResultado();
    mostrarMensajeCosto("", "");
}

// ======================================================
// CONSULTAR COSTO DEL PRODUCTO
// ======================================================

async function consultarCosto() {
    const combo = costosElemento("costos-producto");

    if (!combo || !combo.value) {
        mostrarMensajeCosto("Seleccione un producto elaborado.", "error");
        return;
    }

    const id = Number(combo.value);

    mostrarMensajeCosto("Consultando estructura y calculando costo...", "info");

    const boton = costosElemento("btn-calcular-costo");

    if (boton) {
        boton.disabled = true;
    }

    try {
        const respuesta = await fetch(
            `/api/costos/estructura/${id}/costos`
        );

        const datos = await costosLeerRespuesta(respuesta);

        // El router puede devolver { resultado: ... } o el resultado directo.
        const resultado = datos?.resultado ?? datos;

        if (!resultado || typeof resultado !== "object") {
            throw new Error("El servidor no devolvió un resultado de cálculo válido.");
        }

        mostrarResultado(resultado);

        mostrarMensajeCosto(
            "Cálculo consultado correctamente.",
            "ok"
        );
    } catch (error) {
        console.error("ERROR CALCULANDO COSTO:", error);
        mostrarMensajeCosto(error.message, "error");
    } finally {
        if (boton) {
            boton.disabled = false;
        }
    }
}

// ======================================================
// MOSTRAR RESULTADO DEL CÁLCULO
// ======================================================

function mostrarResultado(resultado) {
    if (!resultado) {
        mostrarMensajeCosto("No hay datos para mostrar.", "error");
        return;
    }

    const producto = resultado.producto || {};

    if (producto.codigo !== undefined) {
        costosAsignarValor("costos-codigo", producto.codigo);
    }

    if (producto.nombre !== undefined) {
        costosAsignarValor("costos-nombre", producto.nombre);
    }

    if (producto.tipo !== undefined) {
        costosAsignarValor("costos-tipo", producto.tipo);
    }

    if (producto.unidad !== undefined) {
        costosAsignarValor("costos-unidad", producto.unidad);
    }

    const rendimiento = resultado.rendimiento ?? null;
    const unidadRendimiento = resultado.unidad_rendimiento || "";
    const costoTotal = costosNumeroOpcional(resultado.costo_total);
    const costoUnitario = costosNumeroOpcional(resultado.costo_unitario);

    costosAsignarTexto(
        "costos-rendimiento",
        rendimiento === null
            ? "-"
            : `${costosFormatearNumero(rendimiento)}${unidadRendimiento ? " " + unidadRendimiento : ""}`
    );

    costosAsignarTexto(
        "costos-costo-total",
        costoTotal === null ? "-" : costosFormatearMoneda(costoTotal)
    );

    costosAsignarTexto(
        "costos-costo-unitario",
        costoUnitario === null ? "-" : costosFormatearMoneda(costoUnitario)
    );

    mostrarExplicacionCosto(
        costoTotal,
        rendimiento,
        unidadRendimiento,
        costoUnitario
    );

    mostrarDetalleCosto(resultado.detalle || []);
}

function costosNumeroOpcional(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return null;
    }

    const numero = Number(valor);

    return Number.isFinite(numero) ? numero : null;
}

// ======================================================
// EXPLICACIÓN DEL COSTO
// ======================================================

function mostrarExplicacionCosto(
    costoTotal,
    rendimiento,
    unidadRendimiento,
    costoUnitario
) {
    const textoTotal = costoTotal === null
        ? "-"
        : costosFormatearMoneda(costoTotal);

    const textoRendimiento =
        rendimiento === null || rendimiento === undefined
            ? "-"
            : `${costosFormatearNumero(rendimiento)}${unidadRendimiento ? " " + unidadRendimiento : ""}`;

    const textoUnitario = costoUnitario === null
        ? "-"
        : costosFormatearMoneda(costoUnitario);

    costosAsignarTexto("costos-explicacion-total", textoTotal);
    costosAsignarTexto("costos-explicacion-total-2", textoTotal);
    costosAsignarTexto("costos-explicacion-rendimiento", textoRendimiento);
    costosAsignarTexto("costos-explicacion-unitario", textoUnitario);

    let formula = "-";

    if (
        costoTotal !== null &&
        rendimiento !== null &&
        rendimiento !== undefined &&
        Number(rendimiento) > 0 &&
        costoUnitario !== null
    ) {
        formula =
            `${costosFormatearMoneda(costoTotal)} ÷ ` +
            `${costosFormatearNumero(rendimiento)}` +
            `${unidadRendimiento ? " " + unidadRendimiento : ""} = ` +
            `${costosFormatearMoneda(costoUnitario)}`;
    }

    costosAsignarTexto("costos-formula-final-resultado", formula);
}

// ======================================================
// DETALLE DE COMPONENTES
// ======================================================

function mostrarDetalleCosto(detalle) {
    const tabla = costosElemento("tablaCostos");

    if (!tabla) {
        return;
    }

    tabla.replaceChildren();

    if (!Array.isArray(detalle) || detalle.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 9;
        celda.textContent = "No hay componentes en la estructura.";

        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
    }

    detalle.forEach(function (item) {
        const fila = document.createElement("tr");

        const cantidad = Number(item.cantidad) || 0;
        const merma = Number(item.merma) || 0;

        const cantidadEfectiva =
            item.cantidad_efectiva !== null &&
            item.cantidad_efectiva !== undefined
                ? Number(item.cantidad_efectiva)
                : cantidad * (1 + merma / 100);

        const costo = costosNumeroOpcional(item.costo_unitario);

        let subtotal = costosNumeroOpcional(item.subtotal);

        if (subtotal === null && costo !== null) {
            subtotal = cantidadEfectiva * costo;
        }

        const valores = [
            item.codigo || "",
            item.nombre || "",
            item.tipo || "",
            item.unidad || "",
            costosFormatearNumero(cantidad),
            `${costosFormatearNumero(merma)} %`,
            costosFormatearNumero(cantidadEfectiva),
            costo === null ? "Sin costo" : costosFormatearMoneda(costo),
            subtotal === null ? "-" : costosFormatearMoneda(subtotal)
        ];

        valores.forEach(function (valor) {
            const celda = document.createElement("td");
            celda.textContent = String(valor);
            fila.appendChild(celda);
        });

        tabla.appendChild(fila);
    });
}

// ======================================================
// LIMPIAR CÁLCULO
// ======================================================

function limpiarCosto() {
    costosAsignarValor("costos-producto", "");
    limpiarDatosProducto();
    limpiarResultado();
    mostrarMensajeCosto("", "");
}

function limpiarDatosProducto() {
    costosAsignarValor("costos-codigo", "");
    costosAsignarValor("costos-nombre", "");
    costosAsignarValor("costos-tipo", "");
    costosAsignarValor("costos-unidad", "");
}

function limpiarResultado() {
    const tabla = costosElemento("tablaCostos");

    if (tabla) {
        tabla.replaceChildren();
    }

    [
        "costos-rendimiento",
        "costos-costo-unitario",
        "costos-costo-total",
        "costos-explicacion-total",
        "costos-explicacion-total-2",
        "costos-explicacion-rendimiento",
        "costos-explicacion-unitario",
        "costos-formula-final-resultado"
    ].forEach(function (id) {
        costosAsignarTexto(id, "-");
    });
}

// ======================================================
// MENSAJES
// ======================================================

function mostrarMensajeCosto(mensaje, tipo) {
    const elemento = costosElemento("costos-mensaje");

    if (!elemento) {
        return;
    }

    elemento.textContent = mensaje || "";
    elemento.className = "costos-mensaje";

    if (tipo) {
        elemento.classList.add(`costos-mensaje-${tipo}`);
    }
}

function mostrarMensajeCostoInsumo(mensaje, tipo) {
    const elemento = costosElemento("costo-insumo-mensaje");

    if (!elemento) {
        return;
    }

    elemento.textContent = mensaje || "";
    elemento.className = "costos-mensaje";

    if (tipo) {
        elemento.classList.add(`costos-mensaje-${tipo}`);
    }
}

// ======================================================
// FORMATEAR NÚMEROS
// ======================================================

function costosFormatearNumero(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return "-";
    }

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return "-";
    }

    return numero.toLocaleString("es-AR", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    });
}

function costosFormatearMoneda(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return "-";
    }

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return "-";
    }

    return numero.toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    });
}

