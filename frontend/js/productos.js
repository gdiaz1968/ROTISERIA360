// ============================================================
// PRODUCTOS
// ============================================================


// ============================================================
// VARIABLES
// ============================================================

let productoSeleccionado = null;
let presentacionSeleccionada = null;


// ============================================================
// CARGAR UNIDADES
// ============================================================

async function cargarUnidades() {

    try {

        const respuesta =
            await fetch("/api/unidades");

        if (!respuesta.ok) {

            throw new Error(
                "No se pudieron cargar las unidades."
            );

        }

        const unidades =
            await respuesta.json();


        // ----------------------------------------------------
        // Unidad del producto
        // ----------------------------------------------------

        const comboUnidad =
            document.getElementById("unidad");


        if (comboUnidad) {

            comboUnidad.innerHTML =
                `
                <option value="">
                    Seleccionar...
                </option>
                `;


            unidades.forEach(
                function (unidad) {

                    const option =
                        document.createElement("option");

                    option.value =
                        unidad.id;

                    option.textContent =
                        unidad.codigo +
                        " - " +
                        unidad.nombre;

                    comboUnidad.appendChild(
                        option
                    );

                }
            );

        }


        // ----------------------------------------------------
        // Unidad de la presentación
        // ----------------------------------------------------

        const comboPresentacionUnidad =
            document.getElementById(
                "presentacionUnidad"
            );


        if (comboPresentacionUnidad) {

            comboPresentacionUnidad.innerHTML =
                `
                <option value="">
                    Seleccionar...
                </option>
                `;


            unidades.forEach(
                function (unidad) {

                    const option =
                        document.createElement("option");

                    option.value =
                        unidad.id;

                    option.textContent =
                        unidad.codigo +
                        " - " +
                        unidad.nombre;

                    comboPresentacionUnidad.appendChild(
                        option
                    );

                }
            );

        }

    }
    catch (error) {

        console.error(
            "Error al cargar unidades:",
            error
        );

    }

}



// ============================================================
// CARGAR PRODUCTOS
// ============================================================

async function cargarProductos() {

    try {

        const respuesta =
            await fetch("/api/productos");


        if (!respuesta.ok) {

            throw new Error(
                "No se pudieron cargar los productos."
            );

        }


        const productos =
            await respuesta.json();


        const tabla =
            document.getElementById(
                "tablaProductos"
            );


        tabla.innerHTML = "";


        productos.forEach(
            function (producto) {

                const fila =
                    document.createElement("tr");


                fila.dataset.id =
                    producto.id;


                fila.innerHTML =
                    `
                    <td>
                        ${producto.codigo}
                    </td>

                    <td>
                        ${producto.nombre}
                    </td>

                    <td>
                        ${producto.tipo}
                    </td>

                    <td>
                        ${producto.unidad || ""}
                    </td>

                    <td>
                        <span class="${
                            producto.activo
                                ? "estado-activo"
                                : "estado-inactivo"
                        }">
                            ${
                                producto.activo
                                    ? "Activo"
                                    : "Inactivo"
                            }
                        </span>
                    </td>
                    `;


                fila.addEventListener(
                    "click",
                    function () {

                        seleccionarProducto(
                            producto
                        );

                    }
                );


                tabla.appendChild(
                    fila
                );

            }
        );


        const cantidad =
            productos.length;


        const textoCantidad =
            document.getElementById(
                "cantidadProductos"
            );


        if (textoCantidad) {

            textoCantidad.textContent =
                cantidad +
                (
                    cantidad === 1
                        ? " producto"
                        : " productos"
                );

        }


        const dashboard =
            document.getElementById(
                "dashboardCantidadProductos"
            );


        if (dashboard) {

            dashboard.textContent =
                cantidad;

        }

    }
    catch (error) {

        console.error(
            "Error al cargar productos:",
            error
        );

        alert(
            "No se pudieron cargar los productos."
        );

    }

}



// ============================================================
// OBTENER DATOS DEL FORMULARIO
// ============================================================

function obtenerDatosFormulario() {

    return {

        codigo:
            document
                .getElementById("codigo")
                .value
                .trim(),

        nombre:
            document
                .getElementById("nombre")
                .value
                .trim(),

        tipo:
            document
                .getElementById("tipo")
                .value,

        id_unidad:
            document
                .getElementById("unidad")
                .value,

        activo:
            document
                .getElementById("activo")
                .checked

    };

}



// ============================================================
// VALIDAR PRODUCTO
// ============================================================

function validarProducto(datos) {

    if (!datos.codigo) {

        alert(
            "Ingrese el código del producto."
        );

        return false;

    }


    if (!datos.nombre) {

        alert(
            "Ingrese el nombre del producto."
        );

        return false;

    }


    if (!datos.tipo) {

        alert(
            "Seleccione el tipo de producto."
        );

        return false;

    }


    if (!datos.id_unidad) {

        alert(
            "Seleccione la unidad."
        );

        return false;

    }


    return true;

}



// ============================================================
// NUEVO PRODUCTO
// ============================================================

function nuevoProducto() {

    document.getElementById(
        "idProducto"
    ).value = "";


    document.getElementById(
        "codigo"
    ).value = "";


    document.getElementById(
        "nombre"
    ).value = "";


    document.getElementById(
        "tipo"
    ).value = "";


    document.getElementById(
        "unidad"
    ).value = "";


    document.getElementById(
        "activo"
    ).checked = true;


    limpiarSeleccionProducto();

}



// ============================================================
// SELECCIONAR PRODUCTO
// ============================================================

function seleccionarProducto(producto) {

    productoSeleccionado =
        producto;


    document.getElementById(
        "idProducto"
    ).value =
        producto.id;


    document.getElementById(
        "codigo"
    ).value =
        producto.codigo;


    document.getElementById(
        "nombre"
    ).value =
        producto.nombre;


    document.getElementById(
        "tipo"
    ).value =
        producto.tipo;


    document.getElementById(
        "unidad"
    ).value =
        producto.id_unidad;


    document.getElementById(
        "activo"
    ).checked =
        producto.activo;


    // --------------------------------------------------------
    // Marcar fila seleccionada
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "#tablaProductos tr"
        )
        .forEach(
            function (fila) {

                fila.classList.remove(
                    "fila-seleccionada"
                );

            }
        );


    const filaSeleccionada =
        document.querySelector(
            '#tablaProductos tr[data-id="' +
            producto.id +
            '"]'
        );


    if (filaSeleccionada) {

        filaSeleccionada.classList.add(
            "fila-seleccionada"
        );

    }


    // --------------------------------------------------------
    // Presentaciones
    // --------------------------------------------------------

    if (
        producto.tipo === "INSUMO"
    ) {

        mostrarPanelPresentaciones(
            producto
        );

        cargarPresentacionesProducto();

    }
    else {

        ocultarPanelPresentaciones();

    }

}



// ============================================================
// LIMPIAR SELECCION PRODUCTO
// ============================================================

function limpiarSeleccionProducto() {

    productoSeleccionado =
        null;


    document
        .querySelectorAll(
            "#tablaProductos tr"
        )
        .forEach(
            function (fila) {

                fila.classList.remove(
                    "fila-seleccionada"
                );

            }
        );


    ocultarPanelPresentaciones();

}



// ============================================================
// GUARDAR PRODUCTO
// ============================================================

async function guardarProducto() {

    const datos =
        obtenerDatosFormulario();


    if (!validarProducto(datos)) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/productos",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(datos)
                }
            );


        const resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            alert(
                resultado.mensaje ||
                "No se pudo guardar el producto."
            );

            return;

        }


        alert(
            "Producto guardado correctamente."
        );


        await cargarProductos();


        nuevoProducto();

    }
    catch (error) {

        console.error(
            "Error al guardar producto:",
            error
        );

        alert(
            "Error al guardar el producto."
        );

    }

}



// ============================================================
// MODIFICAR PRODUCTO
// ============================================================

async function modificarProducto() {

    const id =
        document.getElementById(
            "idProducto"
        ).value;


    if (!id) {

        alert(
            "Seleccione un producto."
        );

        return;

    }


    const datos =
        obtenerDatosFormulario();


    if (!validarProducto(datos)) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/productos/" + id,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(datos)
                }
            );


        const resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            alert(
                resultado.mensaje ||
                "No se pudo modificar el producto."
            );

            return;

        }


        alert(
            "Producto modificado correctamente."
        );


        await cargarProductos();


        nuevoProducto();

    }
    catch (error) {

        console.error(
            "Error al modificar producto:",
            error
        );

        alert(
            "Error al modificar el producto."
        );

    }

}



// ============================================================
// ELIMINAR PRODUCTO
// ============================================================

async function eliminarProducto() {

    const id =
        document.getElementById(
            "idProducto"
        ).value;


    if (!id) {

        alert(
            "Seleccione un producto."
        );

        return;

    }


    const confirmar =
        confirm(
            "¿Está seguro de eliminar el producto?"
        );


    if (!confirmar) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/productos/" + id,
                {
                    method: "DELETE"
                }
            );


        const resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            alert(
                resultado.mensaje ||
                "No se pudo eliminar el producto."
            );

            return;

        }


        alert(
            "Producto eliminado correctamente."
        );


        await cargarProductos();


        nuevoProducto();

    }
    catch (error) {

        console.error(
            "Error al eliminar producto:",
            error
        );

        alert(
            "Error al eliminar el producto."
        );

    }

}



// ============================================================
// MOSTRAR PANEL PRESENTACIONES
// ============================================================

function mostrarPanelPresentaciones(
    producto
) {

    const panel =
        document.getElementById(
            "panelPresentaciones"
        );


    if (!panel) {

        return;

    }


    panel.style.display =
        "block";


    const titulo =
        document.getElementById(
            "presentacionProductoTitulo"
        );


    if (titulo) {

        titulo.textContent =
            producto.codigo +
            " - " +
            producto.nombre;

    }

}



// ============================================================
// OCULTAR PANEL PRESENTACIONES
// ============================================================

function ocultarPanelPresentaciones() {

    const panel =
        document.getElementById(
            "panelPresentaciones"
        );


    if (!panel) {

        return;

    }


    panel.style.display =
        "none";


    limpiarFormularioPresentacion();

}



// ============================================================
// CARGAR PRESENTACIONES DEL PRODUCTO
// ============================================================

async function cargarPresentacionesProducto() {

    if (!productoSeleccionado) {

        return;

    }


    if (
        productoSeleccionado.tipo !== "INSUMO"
    ) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/presentaciones/producto/" +
                productoSeleccionado.id
            );


        if (!respuesta.ok) {

            throw new Error(
                "No se pudieron cargar las presentaciones."
            );

        }


        const presentaciones =
            await respuesta.json();


        const tabla =
            document.getElementById(
                "tablaPresentaciones"
            );


        tabla.innerHTML = "";


        presentaciones.forEach(
            function (presentacion) {

                const fila =
                    document.createElement("tr");


                fila.dataset.id =
                    presentacion.id;


                fila.innerHTML =
                    `
                    <td>
                        ${presentacion.nombre}
                    </td>

                    <td>
                        ${presentacion.cantidad_contenida}
                    </td>

                    <td>
                        ${presentacion.unidad || ""}
                    </td>

                    <td>
                        <span class="${
                            presentacion.activo
                                ? "estado-activo"
                                : "estado-inactivo"
                        }">
                            ${
                                presentacion.activo
                                    ? "Activo"
                                    : "Inactivo"
                            }
                        </span>
                    </td>
                    `;


                fila.addEventListener(
                    "click",
                    function () {

                        seleccionarPresentacion(
                            presentacion
                        );

                    }
                );


                tabla.appendChild(
                    fila
                );

            }
        );


        const cantidad =
            presentaciones.length;


        const contador =
            document.getElementById(
                "cantidadPresentaciones"
            );


        if (contador) {

            contador.textContent =
                cantidad +
                (
                    cantidad === 1
                        ? " presentación"
                        : " presentaciones"
                );

        }

    }
    catch (error) {

        console.error(
            "Error al cargar presentaciones:",
            error
        );

    }

}



// ============================================================
// NUEVA PRESENTACIÓN
// ============================================================

function nuevaPresentacion() {

    presentacionSeleccionada =
        null;


    document.getElementById(
        "idPresentacion"
    ).value = "";


    document.getElementById(
        "presentacionNombre"
    ).value = "";


    document.getElementById(
        "presentacionCantidad"
    ).value = "";


    document.getElementById(
        "presentacionUnidad"
    ).value = "";


    document.getElementById(
        "presentacionActivo"
    ).checked = true;


    document
        .querySelectorAll(
            "#tablaPresentaciones tr"
        )
        .forEach(
            function (fila) {

                fila.classList.remove(
                    "fila-seleccionada"
                );

            }
        );


    limpiarMensajePresentacion();

}



// ============================================================
// SELECCIONAR PRESENTACIÓN
// ============================================================

function seleccionarPresentacion(
    presentacion
) {

    presentacionSeleccionada =
        presentacion;


    document.getElementById(
        "idPresentacion"
    ).value =
        presentacion.id;


    document.getElementById(
        "presentacionNombre"
    ).value =
        presentacion.nombre;


    document.getElementById(
        "presentacionCantidad"
    ).value =
        presentacion.cantidad_contenida;


    document.getElementById(
        "presentacionUnidad"
    ).value =
        presentacion.id_unidad_contenido;


    document.getElementById(
        "presentacionActivo"
    ).checked =
        presentacion.activo;


    document
        .querySelectorAll(
            "#tablaPresentaciones tr"
        )
        .forEach(
            function (fila) {

                fila.classList.remove(
                    "fila-seleccionada"
                );

            }
        );


    const fila =
        document.querySelector(
            '#tablaPresentaciones tr[data-id="' +
            presentacion.id +
            '"]'
        );


    if (fila) {

        fila.classList.add(
            "fila-seleccionada"
        );

    }

}



// ============================================================
// OBTENER DATOS PRESENTACIÓN
// ============================================================

function obtenerDatosPresentacion() {

    return {

        id_producto:
            productoSeleccionado
                ? productoSeleccionado.id
                : null,

        nombre:
            document
                .getElementById(
                    "presentacionNombre"
                )
                .value
                .trim(),

        cantidad_contenida:
            document
                .getElementById(
                    "presentacionCantidad"
                )
                .value,

        id_unidad_contenido:
            document
                .getElementById(
                    "presentacionUnidad"
                )
                .value,

        activo:
            document
                .getElementById(
                    "presentacionActivo"
                )
                .checked

    };

}



// ============================================================
// VALIDAR PRESENTACIÓN
// ============================================================

function validarPresentacion(
    datos
) {

    if (!productoSeleccionado) {

        mostrarMensajePresentacion(
            "Seleccione primero un producto."
        );

        return false;

    }


    if (
        productoSeleccionado.tipo !== "INSUMO"
    ) {

        mostrarMensajePresentacion(
            "Las presentaciones corresponden a INSUMOS."
        );

        return false;

    }


    if (!datos.nombre) {

        mostrarMensajePresentacion(
            "Ingrese el nombre de la presentación."
        );

        return false;

    }


    if (
        !datos.cantidad_contenida ||
        Number(datos.cantidad_contenida) <= 0
    ) {

        mostrarMensajePresentacion(
            "La cantidad contenida debe ser mayor que cero."
        );

        return false;

    }


    if (!datos.id_unidad_contenido) {

        mostrarMensajePresentacion(
            "Seleccione la unidad de contenido."
        );

        return false;

    }


    return true;

}



// ============================================================
// GUARDAR PRESENTACIÓN
// ============================================================

async function guardarPresentacion() {

    const datos =
        obtenerDatosPresentacion();


    if (
        !validarPresentacion(datos)
    ) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/presentaciones",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(datos)
                }
            );


        const resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            mostrarMensajePresentacion(
                resultado.mensaje ||
                "No se pudo guardar la presentación."
            );

            return;

        }


        mostrarMensajePresentacion(
            "Presentación guardada correctamente."
        );


        await cargarPresentacionesProducto();


        nuevaPresentacion();

    }
    catch (error) {

        console.error(
            "Error al guardar presentación:",
            error
        );

        mostrarMensajePresentacion(
            "Error al guardar la presentación."
        );

    }

}



// ============================================================
// MODIFICAR PRESENTACIÓN
// ============================================================

async function modificarPresentacion() {

    const id =
        document.getElementById(
            "idPresentacion"
        ).value;


    if (!id) {

        mostrarMensajePresentacion(
            "Seleccione una presentación."
        );

        return;

    }


    const datos =
        obtenerDatosPresentacion();


    if (
        !validarPresentacion(datos)
    ) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/presentaciones/" + id,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(datos)
                }
            );


        const resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            mostrarMensajePresentacion(
                resultado.mensaje ||
                "No se pudo modificar la presentación."
            );

            return;

        }


        mostrarMensajePresentacion(
            "Presentación modificada correctamente."
        );


        await cargarPresentacionesProducto();


        nuevaPresentacion();

    }
    catch (error) {

        console.error(
            "Error al modificar presentación:",
            error
        );

        mostrarMensajePresentacion(
            "Error al modificar la presentación."
        );

    }

}



// ============================================================
// ELIMINAR PRESENTACIÓN
// ============================================================

async function eliminarPresentacion() {

    const id =
        document.getElementById(
            "idPresentacion"
        ).value;


    if (!id) {

        mostrarMensajePresentacion(
            "Seleccione una presentación."
        );

        return;

    }


    const confirmar =
        confirm(
            "¿Está seguro de eliminar la presentación?"
        );


    if (!confirmar) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/presentaciones/" + id,
                {
                    method: "DELETE"
                }
            );


        const resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            mostrarMensajePresentacion(
                resultado.mensaje ||
                "No se pudo eliminar la presentación."
            );

            return;

        }


        mostrarMensajePresentacion(
            "Presentación eliminada correctamente."
        );


        await cargarPresentacionesProducto();


        nuevaPresentacion();

    }
    catch (error) {

        console.error(
            "Error al eliminar presentación:",
            error
        );

        mostrarMensajePresentacion(
            "Error al eliminar la presentación."
        );

    }

}



// ============================================================
// LIMPIAR FORMULARIO PRESENTACIÓN
// ============================================================

function limpiarFormularioPresentacion() {

    const id =
        document.getElementById(
            "idPresentacion"
        );


    if (id) {

        id.value = "";

    }


    const nombre =
        document.getElementById(
            "presentacionNombre"
        );


    if (nombre) {

        nombre.value = "";

    }


    const cantidad =
        document.getElementById(
            "presentacionCantidad"
        );


    if (cantidad) {

        cantidad.value = "";

    }


    const unidad =
        document.getElementById(
            "presentacionUnidad"
        );


    if (unidad) {

        unidad.value = "";

    }


    const activo =
        document.getElementById(
            "presentacionActivo"
        );


    if (activo) {

        activo.checked = true;

    }


    presentacionSeleccionada =
        null;

}



// ============================================================
// MENSAJE PRESENTACIÓN
// ============================================================

function mostrarMensajePresentacion(
    mensaje
) {

    const elemento =
        document.getElementById(
            "presentacionMensaje"
        );


    if (elemento) {

        elemento.textContent =
            mensaje;

    }

}



// ============================================================
// LIMPIAR MENSAJE
// ============================================================

function limpiarMensajePresentacion() {

    const elemento =
        document.getElementById(
            "presentacionMensaje"
        );


    if (elemento) {

        elemento.textContent =
            "";

    }

}



// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        cargarUnidades();

        cargarProductos();

    }
);