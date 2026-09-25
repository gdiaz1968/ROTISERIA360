// ======================================================
// ROTISERIA360
// COSTOS
// ======================================================

let productosCostos = [];

let costoActual = null;


// ======================================================
// INICIO
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        cargarProductosCostos();

        document
            .getElementById("costos-producto")
            .addEventListener(
                "change",
                seleccionarProductoCosto
            );

        document
            .getElementById("btn-calcular-costo")
            .addEventListener(
                "click",
                calcularCostoSeleccionado
            );

        document
            .getElementById("btn-limpiar-costo")
            .addEventListener(
                "click",
                limpiarCosto
            );

    }
);


// ======================================================
// CARGAR PRODUCTOS
// ======================================================

async function cargarProductosCostos() {

    try {

        const respuesta =
            await fetch(
                "/api/productos"
            );


        if (!respuesta.ok) {

            throw new Error(
                "No se pudieron consultar los productos."
            );

        }


        const datos =
            await respuesta.json();


        productosCostos =
            Array.isArray(datos)
                ? datos
                : (
                    Array.isArray(datos.productos)
                        ? datos.productos
                        : []
                );


        const combo =
            document.getElementById(
                "costos-producto"
            );


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


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    producto.id;


                option.textContent =
                    producto.codigo +
                    " - " +
                    producto.nombre;


                combo.appendChild(
                    option
                );

            }
        );


    } catch (error) {

        console.error(
            "ERROR CARGANDO PRODUCTOS COSTOS:",
            error
        );


        mostrarMensajeCosto(
            "No se pudieron cargar los productos.",
            "error"
        );

    }

}


// ======================================================
// SELECCIONAR PRODUCTO
// ======================================================

function seleccionarProductoCosto() {

    const id =
        parseInt(
            document.getElementById(
                "costos-producto"
            ).value
        );


    const producto =
        productosCostos.find(
            function (item) {

                return item.id === id;

            }
        );


    if (!producto) {

        limpiarDatosProducto();

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
        obtenerUnidadProducto(
            producto
        );


    limpiarResultadoCosto();

}


// ======================================================
// OBTENER UNIDAD
// ======================================================

function obtenerUnidadProducto(
    producto
) {

    if (
        producto.unidad !== undefined &&
        producto.unidad !== null
    ) {

        return producto.unidad;

    }


    if (
        producto.codigo_unidad !== undefined &&
        producto.codigo_unidad !== null
    ) {

        return producto.codigo_unidad;

    }


    return "";

}


// ======================================================
// CALCULAR
// ======================================================

async function calcularCostoSeleccionado() {

    const id =
        parseInt(
            document.getElementById(
                "costos-producto"
            ).value
        );


    if (!id) {

        mostrarMensajeCosto(
            "Seleccione un producto.",
            "error"
        );

        return;

    }


    mostrarMensajeCosto(
        "Calculando costo...",
        "info"
    );


    try {

        const respuesta =
            await fetch(
                "/api/costos/calcular/" +
                id
            );


        const resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                resultado.mensaje ||
                resultado.error ||
                "No se pudo calcular el costo."
            );

        }


        costoActual =
            resultado.resultado ||
            resultado;


        mostrarResultadoCosto(
            costoActual
        );


        mostrarMensajeCosto(
            "Costo calculado correctamente.",
            "ok"
        );


    } catch (error) {

        console.error(
            "ERROR CALCULANDO COSTO:",
            error
        );


        limpiarResultadoCosto();


        mostrarMensajeCosto(
            error.message,
            "error"
        );

    }

}


// ======================================================
// MOSTRAR RESULTADO
// ======================================================

function mostrarResultadoCosto(
    resultado
) {

    const producto =
        obtenerObjeto(
            resultado,
            [
                "producto",
                "product"
            ]
        );


    if (producto) {

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
            obtenerUnidadProducto(
                producto
            );

    }


    const costoUnitario =
        obtenerNumero(
            resultado,
            [
                "costo_unitario",
                "costoUnitario",
                "costo"
            ]
        );


    const costoTotal =
        obtenerNumero(
            resultado,
            [
                "costo_total",
                "costoTotal",
                "total"
            ]
        );


    const estructura =
        obtenerObjeto(
            resultado,
            [
                "estructura"
            ]
        );


    let rendimiento =
        obtenerNumero(
            resultado,
            [
                "rendimiento"
            ]
        );


    let unidadRendimiento = "";


    if (estructura) {

        if (!tieneNumero(rendimiento)) {

            rendimiento =
                obtenerNumero(
                    estructura,
                    [
                        "rendimiento"
                    ]
                );

        }


        unidadRendimiento =
            estructura.unidad_rendimiento ||
            estructura.unidadRendimiento ||
            "";

    }


    document.getElementById(
        "costos-costo-unitario"
    ).textContent =
        formatearMoneda(
            costoUnitario
        );


    document.getElementById(
        "costos-costo-total"
    ).textContent =
        formatearMoneda(
            costoTotal
        );


    document.getElementById(
        "costos-rendimiento"
    ).textContent =
        tieneNumero(rendimiento)
            ? formatearNumero(rendimiento) +
              (
                  unidadRendimiento
                      ? " " + unidadRendimiento
                      : ""
              )
            : "-";


    actualizarDashboardCosto(
        costoUnitario
    );


    const detalle =
        obtenerDetalle(
            resultado,
            estructura
        );


    mostrarDetalleCosto(
        detalle
    );

}


// ======================================================
// OBTENER DETALLE
// ======================================================

function obtenerDetalle(
    resultado,
    estructura
) {

    if (
        Array.isArray(
            resultado.detalle
        )
    ) {

        return resultado.detalle;

    }


    if (
        Array.isArray(
            resultado.detalles
        )
    ) {

        return resultado.detalles;

    }


    if (
        estructura &&
        Array.isArray(
            estructura.detalle
        )
    ) {

        return estructura.detalle;

    }


    if (
        estructura &&
        Array.isArray(
            estructura.detalles
        )
    ) {

        return estructura.detalles;

    }


    return [];

}


// ======================================================
// MOSTRAR DETALLE
// ======================================================

function mostrarDetalleCosto(
    detalle
) {

    const tbody =
        document.getElementById(
            "tablaCostos"
        );


    tbody.innerHTML = "";


    if (
        !detalle ||
        detalle.length === 0
    ) {

        const fila =
            document.createElement(
                "tr"
            );


        fila.innerHTML = `
            <td colspan="9">
                No hay detalle de componentes para mostrar.
            </td>
        `;


        tbody.appendChild(
            fila
        );


        return;

    }


    detalle.forEach(
        function (item) {

            agregarFilaDetalle(
                tbody,
                item
            );

        }
    );

}


// ======================================================
// FILA DETALLE
// ======================================================

function agregarFilaDetalle(
    tbody,
    item
) {

    const fila =
        document.createElement(
            "tr"
        );


    const codigo =
        item.codigo ||
        item.componente_codigo ||
        item.componenteCodigo ||
        "";


    const nombre =
        item.nombre ||
        item.componente_nombre ||
        item.componenteNombre ||
        "";


    const tipo =
        item.tipo ||
        item.componente_tipo ||
        item.componenteTipo ||
        "";


    const unidad =
        item.unidad ||
        item.componente_unidad ||
        item.componenteUnidad ||
        "";


    const cantidad =
        obtenerNumero(
            item,
            [
                "cantidad"
            ]
        );


    const merma =
        obtenerNumero(
            item,
            [
                "merma"
            ]
        );


    let cantidadEfectiva =
        obtenerNumero(
            item,
            [
                "cantidad_efectiva",
                "cantidadEfectiva"
            ]
        );


    if (
        !tieneNumero(
            cantidadEfectiva
        ) &&
        tieneNumero(cantidad)
    ) {

        cantidadEfectiva =
            cantidad *
            (
                1 +
                (
                    (merma || 0) /
                    100
                )
            );

    }


    const costoUnitario =
        obtenerNumero(
            item,
            [
                "costo_unitario",
                "costoUnitario",
                "costo"
            ]
        );


    const subtotal =
        obtenerNumero(
            item,
            [
                "subtotal",
                "costo_total",
                "costoTotal",
                "total"
            ]
        );


    fila.innerHTML = `

        <td>
            ${escapeHtml(codigo)}
        </td>

        <td>
            ${escapeHtml(nombre)}
        </td>

        <td>
            ${escapeHtml(tipo)}
        </td>

        <td>
            ${escapeHtml(unidad)}
        </td>

        <td>
            ${formatearNumero(cantidad)}
        </td>

        <td>
            ${formatearNumero(merma)}
        </td>

        <td>
            ${formatearNumero(cantidadEfectiva)}
        </td>

        <td>
            ${formatearMoneda(costoUnitario)}
        </td>

        <td>
            ${formatearMoneda(subtotal)}
        </td>

    `;


    tbody.appendChild(
        fila
    );


    /*
     * Si el motor devuelve un detalle
     * anidado para un producto ELABORADO,
     * lo mostramos debajo.
     */

    const subdetalle =
        item.detalle ||
        item.detalles ||
        item.componentes;


    if (
        Array.isArray(
            subdetalle
        ) &&
        subdetalle.length > 0
    ) {

        subdetalle.forEach(
            function (subitem) {

                agregarFilaDetalle(
                    tbody,
                    subitem
                );

            }
        );

    }

}


// ======================================================
// LIMPIAR
// ======================================================

function limpiarCosto() {

    document.getElementById(
        "costos-producto"
    ).value = "";


    limpiarDatosProducto();

    limpiarResultadoCosto();

    mostrarMensajeCosto(
        "",
        ""
    );

}


// ======================================================
// LIMPIAR DATOS PRODUCTO
// ======================================================

function limpiarDatosProducto() {

    document.getElementById(
        "costos-codigo"
    ).value = "";


    document.getElementById(
        "costos-nombre"
    ).value = "";


    document.getElementById(
        "costos-tipo"
    ).value = "";


    document.getElementById(
        "costos-unidad"
    ).value = "";

}


// ======================================================
// LIMPIAR RESULTADO
// ======================================================

function limpiarResultadoCosto() {

    document.getElementById(
        "costos-costo-unitario"
    ).textContent = "-";


    document.getElementById(
        "costos-costo-total"
    ).textContent = "-";


    document.getElementById(
        "costos-rendimiento"
    ).textContent = "-";


    document.getElementById(
        "tablaCostos"
    ).innerHTML = "";


    actualizarDashboardCosto(
        null
    );


    costoActual = null;

}


// ======================================================
// DASHBOARD
// ======================================================

function actualizarDashboardCosto(
    costo
) {

    const elemento =
        document.getElementById(
            "dashboardCosto"
        );


    if (!elemento) {

        return;

    }


    if (
        costo === null ||
        costo === undefined ||
        isNaN(Number(costo))
    ) {

        elemento.textContent =
            "-";

        return;

    }


    elemento.textContent =
        formatearMoneda(
            costo
        );

}


// ======================================================
// MENSAJE
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
// UTILIDADES
// ======================================================

function obtenerObjeto(
    objeto,
    propiedades
) {

    if (!objeto) {

        return null;

    }


    for (
        let i = 0;
        i < propiedades.length;
        i++
    ) {

        const propiedad =
            propiedades[i];


        if (
            objeto[propiedad] &&
            typeof objeto[propiedad] === "object"
        ) {

            return objeto[propiedad];

        }

    }


    return null;

}


function obtenerNumero(
    objeto,
    propiedades
) {

    if (!objeto) {

        return null;

    }


    for (
        let i = 0;
        i < propiedades.length;
        i++
    ) {

        const valor =
            objeto[
                propiedades[i]
            ];


        if (
            valor !== null &&
            valor !== undefined &&
            valor !== ""
        ) {

            const numero =
                Number(valor);


            if (
                !isNaN(numero)
            ) {

                return numero;

            }

        }

    }


    return null;

}


function tieneNumero(
    valor
) {

    return (
        valor !== null &&
        valor !== undefined &&
        !isNaN(Number(valor))
    );

}


function formatearNumero(
    valor
) {

    if (
        valor === null ||
        valor === undefined ||
        isNaN(Number(valor))
    ) {

        return "-";

    }


    return Number(
        valor
    ).toLocaleString(
        "es-AR",
        {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        }
    );

}


function formatearMoneda(
    valor
) {

    if (
        valor === null ||
        valor === undefined ||
        isNaN(Number(valor))
    ) {

        return "-";

    }


    return Number(
        valor
    ).toLocaleString(
        "es-AR",
        {
            style: "currency",
            currency: "ARS",
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
        }
    );

}


function escapeHtml(
    valor
) {

    if (
        valor === null ||
        valor === undefined
    ) {

        return "";

    }


    return String(valor)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}