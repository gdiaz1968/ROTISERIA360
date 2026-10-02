// ======================================================
// ROTISERIA360
// COSTOS
// ======================================================


// ======================================================
// VARIABLES
// ======================================================

let productosCostos = [];
let insumosCostos = [];


// ======================================================
// INICIO
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        cargarProductosCostos();

        cargarInsumosCostos();


        var comboProducto =
            document.getElementById(
                "costos-producto"
            );

        if (comboProducto) {

            comboProducto.addEventListener(
                "change",
                seleccionarProductoCosto
            );

        }


        var btnCalcular =
            document.getElementById(
                "btn-calcular-costo"
            );

        if (btnCalcular) {

            btnCalcular.addEventListener(
                "click",
                consultarCosto
            );

        }


        var btnLimpiar =
            document.getElementById(
                "btn-limpiar-costo"
            );

        if (btnLimpiar) {

            btnLimpiar.addEventListener(
                "click",
                limpiarCosto
            );

        }


        // --------------------------------------------------
        // COSTOS DE INSUMOS
        // --------------------------------------------------

        var comboInsumo =
            document.getElementById(
                "costo-insumo"
            );

        if (comboInsumo) {

            comboInsumo.addEventListener(
                "change",
                seleccionarInsumoCosto
            );

        }


        var btnGuardarInsumo =
            document.getElementById(
                "btn-guardar-costo-insumo"
            );

        if (btnGuardarInsumo) {

            btnGuardarInsumo.addEventListener(
                "click",
                guardarCostoInsumo
            );

        }


        var btnLimpiarInsumo =
            document.getElementById(
                "btn-limpiar-costo-insumo"
            );

        if (btnLimpiarInsumo) {

            btnLimpiarInsumo.addEventListener(
                "click",
                limpiarCostoInsumo
            );

        }

    }
);


// ======================================================
// CARGAR PRODUCTOS
// ======================================================

async function cargarProductosCostos() {

    try {

        const respuesta =
            await fetch("/api/productos");


        if (!respuesta.ok) {

            throw new Error(
                "No se pudieron cargar los productos."
            );

        }


        const datos =
            await respuesta.json();


        if (Array.isArray(datos)) {

            productosCostos = datos;

        }
        else {

            productosCostos =
                datos.productos || [];

        }


        const combo =
            document.getElementById(
                "costos-producto"
            );


        if (!combo) {

            return;

        }


        combo.innerHTML = `
            <option value="">
                Seleccionar producto...
            </option>
        `;


        productosCostos.forEach(
            function (producto) {

                if (
                    producto.activo === false
                ) {

                    return;

                }


                const opcion =
                    document.createElement(
                        "option"
                    );


                opcion.value =
                    producto.id;


                opcion.textContent =
                    producto.codigo +
                    " - " +
                    producto.nombre;


                combo.appendChild(
                    opcion
                );

            }
        );

    }
    catch (error) {

        console.error(
            "ERROR CARGANDO PRODUCTOS COSTOS:",
            error
        );


        mostrarMensajeCosto(
            error.message,
            "error"
        );

    }

}


// ======================================================
// CARGAR INSUMOS
// ======================================================

async function cargarInsumosCostos() {

    try {

        const respuesta =
            await fetch(
                "/api/costos/insumos"
            );


        if (!respuesta.ok) {

            throw new Error(
                "No se pudieron cargar los insumos."
            );

        }


        const datos =
            await respuesta.json();


        if (Array.isArray(datos)) {

            insumosCostos =
                datos;

        }
        else {

            insumosCostos =
                datos.insumos || [];

        }


        const combo =
            document.getElementById(
                "costo-insumo"
            );


        if (!combo) {

            return;

        }


        combo.innerHTML = `
            <option value="">
                Seleccionar insumo...
            </option>
        `;


        insumosCostos.forEach(
            function (insumo) {

                const opcion =
                    document.createElement(
                        "option"
                    );


                opcion.value =
                    insumo.id;


                opcion.textContent =
                    insumo.codigo +
                    " - " +
                    insumo.nombre;


                combo.appendChild(
                    opcion
                );

            }
        );

    }
    catch (error) {

        console.error(
            "ERROR CARGANDO INSUMOS COSTOS:",
            error
        );


        mostrarMensajeCostoInsumo(
            error.message,
            "error"
        );

    }

}


// ======================================================
// SELECCIONAR INSUMO
// ======================================================

async function seleccionarInsumoCosto() {

    const combo =
        document.getElementById(
            "costo-insumo"
        );


    if (!combo) {

        return;

    }


    const id =
        Number(
            combo.value
        );


    if (!id) {

        limpiarDatosInsumo();

        return;

    }


    const insumo =
        insumosCostos.find(
            function (item) {

                return Number(item.id) === id;

            }
        );


    if (insumo) {

        document.getElementById(
            "costo-insumo-unidad"
        ).value =
            insumo.unidad || "";

    }


    try {

        const respuesta =
            await fetch(
                "/api/costos/insumo/" + id
            );


        if (!respuesta.ok) {

            throw new Error(
                "No se pudo consultar el costo del insumo."
            );

        }


        const datos =
            await respuesta.json();


        const campoCosto =
            document.getElementById(
                "costo-insumo-actual"
            );


        if (!campoCosto) {

            return;

        }


        if (
            datos === null ||
            datos === undefined
        ) {

            campoCosto.value = "-";

        }
        else {

            campoCosto.value =
                costosFormatearMoneda(
                    datos.costo
                );

        }


        document.getElementById(
            "costo-insumo-nuevo"
        ).value = "";


        mostrarMensajeCostoInsumo(
            "",
            ""
        );

    }
    catch (error) {

        console.error(
            "ERROR CONSULTANDO COSTO INSUMO:",
            error
        );


        mostrarMensajeCostoInsumo(
            error.message,
            "error"
        );

    }

}


// ======================================================
// GUARDAR COSTO INSUMO
// ======================================================

async function guardarCostoInsumo() {

    const combo =
        document.getElementById(
            "costo-insumo"
        );


    const campoCosto =
        document.getElementById(
            "costo-insumo-nuevo"
        );


    if (!combo || !campoCosto) {

        return;

    }


    const idProducto =
        Number(
            combo.value
        );


    const costo =
        Number(
            campoCosto.value
        );


    if (!idProducto) {

        mostrarMensajeCostoInsumo(
            "Seleccione un insumo.",
            "error"
        );

        return;

    }


    if (
        isNaN(costo) ||
        costo < 0
    ) {

        mostrarMensajeCostoInsumo(
            "Ingrese un costo válido.",
            "error"
        );

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/costos/insumo",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        id_producto:
                            idProducto,

                        costo:
                            costo
                    })
                }
            );


        const datos =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                datos.error ||
                datos.mensaje ||
                "No se pudo registrar el costo."
            );

        }


        document.getElementById(
            "costo-insumo-actual"
        ).value =
            costosFormatearMoneda(
                costo
            );


        campoCosto.value = "";


        mostrarMensajeCostoInsumo(
            "Costo registrado correctamente.",
            "ok"
        );

    }
    catch (error) {

        console.error(
            "ERROR GUARDANDO COSTO INSUMO:",
            error
        );


        mostrarMensajeCostoInsumo(
            error.message,
            "error"
        );

    }

}


// ======================================================
// LIMPIAR INSUMO
// ======================================================

function limpiarCostoInsumo() {

    const combo =
        document.getElementById(
            "costo-insumo"
        );


    if (combo) {

        combo.value = "";

    }


    limpiarDatosInsumo();


    mostrarMensajeCostoInsumo(
        "",
        ""
    );

}


// ======================================================
// LIMPIAR DATOS INSUMO
// ======================================================

function limpiarDatosInsumo() {

    const unidad =
        document.getElementById(
            "costo-insumo-unidad"
        );


    const actual =
        document.getElementById(
            "costo-insumo-actual"
        );


    const nuevo =
        document.getElementById(
            "costo-insumo-nuevo"
        );


    if (unidad) {

        unidad.value = "";

    }


    if (actual) {

        actual.value = "-";

    }


    if (nuevo) {

        nuevo.value = "";

    }

}


// ======================================================
// SELECCIONAR PRODUCTO
// ======================================================

function seleccionarProductoCosto() {

    const combo =
        document.getElementById(
            "costos-producto"
        );


    if (!combo) {

        return;

    }


    const id =
        Number(
            combo.value
        );


    if (!id) {

        limpiarDatosProducto();

        limpiarResultado();

        return;

    }


    const producto =
        productosCostos.find(
            function (item) {

                return Number(item.id) === id;

            }
        );


    if (!producto) {

        limpiarDatosProducto();

        limpiarResultado();

        return;

    }


    document.getElementById(
        "costos-codigo"
    ).value =
        producto.codigo || "";


    document.getElementById(
        "costos-nombre"
    ).value =
        producto.nombre || "";


    document.getElementById(
        "costos-tipo"
    ).value =
        producto.tipo || "";


    document.getElementById(
        "costos-unidad"
    ).value =
        producto.unidad || "";


    limpiarResultado();

}


// ======================================================
// CONSULTAR COSTO
// ======================================================

async function consultarCosto() {

    const combo =
        document.getElementById(
            "costos-producto"
        );


    if (!combo) {

        return;

    }


    const id =
        Number(
            combo.value
        );


    if (!id) {

        mostrarMensajeCosto(
            "Seleccione un producto.",
            "error"
        );

        return;

    }


    mostrarMensajeCosto(
        "Consultando estructura...",
        "info"
    );


    try {

        const respuesta =
            await fetch(
                "/api/costos/estructura/" +
                id +
                "/costos"
            );


        const datos =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                datos.error ||
                datos.mensaje ||
                "No se pudo consultar la estructura."
            );

        }


        mostrarResultado(
            datos.resultado
        );


        mostrarMensajeCosto(
            "Estructura consultada correctamente.",
            "ok"
        );

    }
    catch (error) {

        console.error(
            "ERROR CONSULTANDO COSTO:",
            error
        );


        mostrarMensajeCosto(
            error.message,
            "error"
        );

    }

}


// ======================================================
// MOSTRAR RESULTADO
// ======================================================

function mostrarResultado(
    resultado
) {

    if (!resultado) {

        return;

    }


    // --------------------------------------------------
    // PRODUCTO
    // --------------------------------------------------

    if (resultado.producto) {

        document.getElementById(
            "costos-codigo"
        ).value =
            resultado.producto.codigo || "";


        document.getElementById(
            "costos-nombre"
        ).value =
            resultado.producto.nombre || "";


        document.getElementById(
            "costos-tipo"
        ).value =
            resultado.producto.tipo || "";


        document.getElementById(
            "costos-unidad"
        ).value =
            resultado.producto.unidad || "";

    }


    // --------------------------------------------------
    // VARIABLES DEL RESULTADO
    // --------------------------------------------------

    let rendimiento = null;
    let unidadRendimiento = "";

    let costoTotal = null;
    let costoUnitario = null;


    // --------------------------------------------------
    // RENDIMIENTO
    // --------------------------------------------------

    if (resultado.estructura) {

        rendimiento =
            resultado.rendimiento;


        unidadRendimiento =
            resultado.unidad_rendimiento ||
            "";


        if (
            rendimiento !== null &&
            rendimiento !== undefined
        ) {

            document.getElementById(
                "costos-rendimiento"
            ).textContent =
                costosFormatearNumero(
                    rendimiento
                ) +
                (
                    unidadRendimiento
                        ? " " + unidadRendimiento
                        : ""
                );

        }

    }


    // --------------------------------------------------
    // COSTO TOTAL
    // --------------------------------------------------

    if (
        resultado.costo_total !== null &&
        resultado.costo_total !== undefined
    ) {

        costoTotal =
            Number(
                resultado.costo_total
            );


        document.getElementById(
            "costos-costo-total"
        ).textContent =
            costosFormatearMoneda(
                costoTotal
            );

    }


    // --------------------------------------------------
    // COSTO UNITARIO
    // --------------------------------------------------

    if (
        resultado.costo_unitario !== null &&
        resultado.costo_unitario !== undefined
    ) {

        costoUnitario =
            Number(
                resultado.costo_unitario
            );


        document.getElementById(
            "costos-costo-unitario"
        ).textContent =
            costosFormatearMoneda(
                costoUnitario
            );

    }


    // --------------------------------------------------
    // MOSTRAR EXPLICACION DEL CALCULO
    // --------------------------------------------------

    mostrarExplicacionCosto(
        costoTotal,
        rendimiento,
        unidadRendimiento,
        costoUnitario
    );


    // --------------------------------------------------
    // DETALLE
    // --------------------------------------------------

    mostrarDetalleCosto(
        resultado.detalle || []
    );

}


// ======================================================
// MOSTRAR EXPLICACION DEL COSTO
// ======================================================

function mostrarExplicacionCosto(
    costoTotal,
    rendimiento,
    unidadRendimiento,
    costoUnitario
) {

    const campoTotal =
        document.getElementById(
            "costos-explicacion-total"
        );


    const campoTotal2 =
        document.getElementById(
            "costos-explicacion-total-2"
        );


    const campoRendimiento =
        document.getElementById(
            "costos-explicacion-rendimiento"
        );


    const campoUnitario =
        document.getElementById(
            "costos-explicacion-unitario"
        );


    const campoFormulaFinal =
        document.getElementById(
            "costos-formula-final-resultado"
        );


    // --------------------------------------------------
    // COSTO TOTAL
    // --------------------------------------------------

    if (campoTotal) {

        if (
            costoTotal !== null &&
            !isNaN(costoTotal)
        ) {

            campoTotal.textContent =
                costosFormatearMoneda(
                    costoTotal
                );

        }
        else {

            campoTotal.textContent = "-";

        }

    }


    // --------------------------------------------------
    // COSTO TOTAL - SEGUNDA REFERENCIA
    // --------------------------------------------------

    if (campoTotal2) {

        if (
            costoTotal !== null &&
            !isNaN(costoTotal)
        ) {

            campoTotal2.textContent =
                costosFormatearMoneda(
                    costoTotal
                );

        }
        else {

            campoTotal2.textContent = "-";

        }

    }


    // --------------------------------------------------
    // RENDIMIENTO
    // --------------------------------------------------

    if (campoRendimiento) {

        if (
            rendimiento !== null &&
            rendimiento !== undefined &&
            !isNaN(Number(rendimiento))
        ) {

            campoRendimiento.textContent =
                costosFormatearNumero(
                    rendimiento
                ) +
                (
                    unidadRendimiento
                        ? " " + unidadRendimiento
                        : ""
                );

        }
        else {

            campoRendimiento.textContent = "-";

        }

    }


    // --------------------------------------------------
    // COSTO UNITARIO
    // --------------------------------------------------

    if (campoUnitario) {

        if (
            costoUnitario !== null &&
            !isNaN(costoUnitario)
        ) {

            campoUnitario.textContent =
                costosFormatearMoneda(
                    costoUnitario
                );

        }
        else {

            campoUnitario.textContent = "-";

        }

    }


    // --------------------------------------------------
    // FORMULA FINAL
    // --------------------------------------------------

    if (campoFormulaFinal) {

        if (
            costoTotal !== null &&
            !isNaN(costoTotal) &&
            rendimiento !== null &&
            rendimiento !== undefined &&
            !isNaN(Number(rendimiento)) &&
            Number(rendimiento) !== 0 &&
            costoUnitario !== null &&
            !isNaN(costoUnitario)
        ) {

            campoFormulaFinal.textContent =
                costosFormatearMoneda(
                    costoTotal
                ) +
                " ÷ " +
                costosFormatearNumero(
                    rendimiento
                ) +
                (
                    unidadRendimiento
                        ? " " + unidadRendimiento
                        : ""
                ) +
                " = " +
                costosFormatearMoneda(
                    costoUnitario
                );

        }
        else {

            campoFormulaFinal.textContent = "-";

        }

    }

}


// ======================================================
// MOSTRAR DETALLE DE COSTOS
// ======================================================

function mostrarDetalleCosto(
    detalle
) {

    const tabla =
        document.getElementById(
            "tablaCostos"
        );


    if (!tabla) {

        return;

    }


    tabla.innerHTML = "";


    if (
        !detalle ||
        detalle.length === 0
    ) {

        tabla.innerHTML = `
            <tr>
                <td colspan="9">
                    No hay componentes en la estructura.
                </td>
            </tr>
        `;

        return;

    }


    detalle.forEach(
        function (item) {

            const fila =
                document.createElement(
                    "tr"
                );


            const cantidad =
                Number(
                    item.cantidad
                ) || 0;


            const merma =
                Number(
                    item.merma
                ) || 0;


            let cantidadEfectiva;


            if (
                item.cantidad_efectiva !== null &&
                item.cantidad_efectiva !== undefined
            ) {

                cantidadEfectiva =
                    Number(
                        item.cantidad_efectiva
                    );

            }
            else {

                cantidadEfectiva =
                    cantidad *
                    (
                        1 +
                        (
                            merma / 100
                        )
                    );

            }


            const costo =
                item.costo_unitario;


            let subtotal;


            if (
                item.subtotal !== null &&
                item.subtotal !== undefined
            ) {

                subtotal =
                    Number(
                        item.subtotal
                    );

            }
            else if (
                costo !== null &&
                costo !== undefined &&
                costo !== ""
            ) {

                subtotal =
                    cantidadEfectiva *
                    Number(costo);

            }
            else {

                subtotal = null;

            }


            let textoCosto =
                "Sin costo";


            if (
                costo !== null &&
                costo !== undefined &&
                costo !== ""
            ) {

                textoCosto =
                    costosFormatearMoneda(
                        costo
                    );

            }


            let textoSubtotal =
                "-";


            if (
                subtotal !== null &&
                !isNaN(subtotal)
            ) {

                textoSubtotal =
                    costosFormatearMoneda(
                        subtotal
                    );

            }


            fila.innerHTML = `

                <td>
                    ${item.codigo || ""}
                </td>

                <td>
                    ${item.nombre || ""}
                </td>

                <td>
                    ${item.tipo || ""}
                </td>

                <td>
                    ${item.unidad || ""}
                </td>

                <td>
                    ${costosFormatearNumero(
                        cantidad
                    )}
                </td>

                <td>
                    ${costosFormatearNumero(
                        merma
                    )}
                    %
                </td>

                <td>
                    ${costosFormatearNumero(
                        cantidadEfectiva
                    )}
                </td>

                <td>
                    ${textoCosto}
                </td>

                <td>
                    ${textoSubtotal}
                </td>

            `;


            tabla.appendChild(
                fila
            );

        }
    );

}


// ======================================================
// LIMPIAR COSTOS PRODUCTO
// ======================================================

function limpiarCosto() {

    const combo =
        document.getElementById(
            "costos-producto"
        );


    if (combo) {

        combo.value = "";

    }


    limpiarDatosProducto();

    limpiarResultado();


    mostrarMensajeCosto(
        "",
        ""
    );

}


// ======================================================
// LIMPIAR DATOS PRODUCTO
// ======================================================

function limpiarDatosProducto() {

    const codigo =
        document.getElementById(
            "costos-codigo"
        );


    const nombre =
        document.getElementById(
            "costos-nombre"
        );


    const tipo =
        document.getElementById(
            "costos-tipo"
        );


    const unidad =
        document.getElementById(
            "costos-unidad"
        );


    if (codigo) {

        codigo.value = "";

    }


    if (nombre) {

        nombre.value = "";

    }


    if (tipo) {

        tipo.value = "";

    }


    if (unidad) {

        unidad.value = "";

    }

}


// ======================================================
// LIMPIAR RESULTADO
// ======================================================

function limpiarResultado() {

    const tabla =
        document.getElementById(
            "tablaCostos"
        );


    const rendimiento =
        document.getElementById(
            "costos-rendimiento"
        );


    const costoUnitario =
        document.getElementById(
            "costos-costo-unitario"
        );


    const costoTotal =
        document.getElementById(
            "costos-costo-total"
        );


    if (tabla) {

        tabla.innerHTML = "";

    }


    if (rendimiento) {

        rendimiento.textContent = "-";

    }


    if (costoUnitario) {

        costoUnitario.textContent = "-";

    }


    if (costoTotal) {

        costoTotal.textContent = "-";

    }


    // --------------------------------------------------
    // LIMPIAR EXPLICACION
    // --------------------------------------------------

    const explicacionTotal =
        document.getElementById(
            "costos-explicacion-total"
        );


    const explicacionTotal2 =
        document.getElementById(
            "costos-explicacion-total-2"
        );


    const explicacionRendimiento =
        document.getElementById(
            "costos-explicacion-rendimiento"
        );


    const explicacionUnitario =
        document.getElementById(
            "costos-explicacion-unitario"
        );


    const formulaFinal =
        document.getElementById(
            "costos-formula-final-resultado"
        );


    if (explicacionTotal) {

        explicacionTotal.textContent = "-";

    }


    if (explicacionTotal2) {

        explicacionTotal2.textContent = "-";

    }


    if (explicacionRendimiento) {

        explicacionRendimiento.textContent = "-";

    }


    if (explicacionUnitario) {

        explicacionUnitario.textContent = "-";

    }


    if (formulaFinal) {

        formulaFinal.textContent = "-";

    }

}


// ======================================================
// MENSAJE GENERAL
// ======================================================

function mostrarMensajeCosto(
    mensaje,
    tipo
) {

    const elemento =
        document.getElementById(
            "costos-mensaje"
        );


    if (!elemento) {

        return;

    }


    elemento.textContent =
        mensaje || "";


    elemento.className =
        "costos-mensaje";


    if (tipo) {

        elemento.classList.add(
            "costos-mensaje-" + tipo
        );

    }

}


// ======================================================
// MENSAJE INSUMO
// ======================================================

function mostrarMensajeCostoInsumo(
    mensaje,
    tipo
) {

    const elemento =
        document.getElementById(
            "costo-insumo-mensaje"
        );


    if (!elemento) {

        return;

    }


    elemento.textContent =
        mensaje || "";


    elemento.className =
        "costos-mensaje";


    if (tipo) {

        elemento.classList.add(
            "costos-mensaje-" + tipo
        );

    }

}


// ======================================================
// FORMATEAR NUMERO - COSTOS
// ======================================================

function costosFormatearNumero(
    valor
) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {

        return "-";

    }


    const numero =
        Number(valor);


    if (isNaN(numero)) {

        return "-";

    }


    return numero.toLocaleString(
        "es-AR",
        {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        }
    );

}


// ======================================================
// FORMATEAR MONEDA - COSTOS
// ======================================================

function costosFormatearMoneda(
    valor
) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {

        return "-";

    }


    const numero =
        Number(valor);


    if (isNaN(numero)) {

        return "-";

    }


    return numero.toLocaleString(
        "es-AR",
        {
            style: "currency",
            currency: "ARS",
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
        }
    );

}