let productosElaborados = [];
let componentes = [];
let detalleEstructura = [];

let estructuraActual = null;
let modoEstructura = "NUEVO";


document.addEventListener("DOMContentLoaded", function () {

    cargarProductosElaborados();
    cargarComponentes();

    document.getElementById("estructura-producto")
        .addEventListener("change", seleccionarProducto);

    document.getElementById("estructura-componente")
        .addEventListener("change", seleccionarComponente);

    document.getElementById("btn-agregar-componente")
        .addEventListener("click", agregarComponente);

    document.getElementById("btn-guardar-estructura")
        .addEventListener("click", guardarEstructura);

    configurarBotonesCRUD();

    establecerModoNuevo();
});


/* =========================================================
   CONFIGURACION DE BOTONES CRUD
   ========================================================= */

function configurarBotonesCRUD() {

    var contenedor = document.getElementById("modulo-estructura");

    if (!contenedor) {
        return;
    }


    var btnNuevo =
        document.getElementById("btn-nueva-estructura");

    if (btnNuevo) {

        btnNuevo.addEventListener("click", function () {

            establecerModoNuevo();

        });
    }


    var btnConsultar =
        document.getElementById("btn-consultar-estructura");

    if (btnConsultar) {

        btnConsultar.addEventListener("click", function () {

            consultarEstructura();

        });
    }


    var btnModificar =
        document.getElementById("btn-modificar-estructura");

    if (btnModificar) {

        btnModificar.addEventListener("click", function () {

            habilitarModificacion();

        });
    }


    var btnEliminar =
        document.getElementById("btn-eliminar-estructura");

    if (btnEliminar) {

        btnEliminar.addEventListener("click", function () {

            eliminarEstructura();

        });
    }
}


/* =========================================================
   PRODUCTOS ELABORADOS
   ========================================================= */

async function cargarProductosElaborados() {

    try {

        var respuesta =
            await fetch("/api/estructura/productos");


        if (!respuesta.ok) {

            throw new Error(
                "No se pudieron cargar los productos elaborados."
            );
        }


        productosElaborados =
            await respuesta.json();


        var combo =
            document.getElementById("estructura-producto");


        combo.innerHTML =
            '<option value="">Seleccione un producto</option>';


        productosElaborados.forEach(function (producto) {

            var opcion =
                document.createElement("option");


            opcion.value =
                producto.id;


            opcion.textContent =
                producto.codigo +
                " - " +
                producto.nombre;


            combo.appendChild(opcion);

        });


    } catch (error) {

        console.error(
            "ERROR CARGANDO PRODUCTOS:",
            error
        );


        alert(
            "Error al cargar los productos elaborados."
        );
    }
}


/* =========================================================
   COMPONENTES
   ========================================================= */

async function cargarComponentes() {

    try {

        var respuesta =
            await fetch("/api/estructura/componentes");


        if (!respuesta.ok) {

            throw new Error(
                "No se pudieron cargar los componentes."
            );
        }


        componentes =
            await respuesta.json();


        var combo =
            document.getElementById(
                "estructura-componente"
            );


        combo.innerHTML =
            '<option value="">Seleccione un componente</option>';


        componentes.forEach(function (componente) {

            var opcion =
                document.createElement("option");


            opcion.value =
                componente.id;


            opcion.textContent =
                componente.codigo +
                " - " +
                componente.nombre;


            combo.appendChild(opcion);

        });


    } catch (error) {

        console.error(
            "ERROR CARGANDO COMPONENTES:",
            error
        );


        alert(
            "Error al cargar los componentes."
        );
    }
}


/* =========================================================
   SELECCIONAR PRODUCTO
   ========================================================= */

function seleccionarProducto() {

    var combo =
        document.getElementById(
            "estructura-producto"
        );


    var productoId =
        parseInt(combo.value);


    if (!productoId) {

        estructuraActual = null;

        detalleEstructura = [];

        limpiarDatosProducto();

        mostrarDetalle();

        actualizarEstadoBotones();

        return;
    }


    var producto =
        productosElaborados.find(function (p) {

            return p.id === productoId;

        });


    if (!producto) {

        return;
    }


    document.getElementById(
        "estructura-codigo"
    ).value =
        producto.codigo || "";


    document.getElementById(
        "estructura-unidad"
    ).value =
        producto.unidad || "";


    document.getElementById(
        "estructura-unidad-rendimiento"
    ).value =
        producto.unidad || "";


    /*
        Al cambiar de producto dejamos
        la pantalla preparada para una
        nueva alta o una nueva consulta.
    */

    estructuraActual = null;

    detalleEstructura = [];


    document.getElementById(
        "estructura-rendimiento"
    ).value = "1";


    limpiarVersionEstado();

    mostrarDetalle();

    actualizarEstadoBotones();
}


/* =========================================================
   SELECCIONAR COMPONENTE
   ========================================================= */

function seleccionarComponente() {

    var combo =
        document.getElementById(
            "estructura-componente"
        );


    var componenteId =
        parseInt(combo.value);


    if (!componenteId) {

        limpiarComponente();

        return;
    }


    var componente =
        componentes.find(function (c) {

            return c.id === componenteId;

        });


    if (!componente) {

        return;
    }


    document.getElementById(
        "estructura-componente-codigo"
    ).value =
        componente.codigo || "";


    document.getElementById(
        "estructura-componente-tipo"
    ).value =
        componente.tipo || "";


    document.getElementById(
        "estructura-componente-unidad"
    ).value =
        componente.unidad || "";
}


/* =========================================================
   AGREGAR COMPONENTE
   ========================================================= */

function agregarComponente() {

    var combo =
        document.getElementById(
            "estructura-componente"
        );


    var componenteId =
        parseInt(combo.value);


    var cantidad =
        parseFloat(
            document.getElementById(
                "estructura-cantidad"
            ).value
        );


    var merma =
        parseFloat(
            document.getElementById(
                "estructura-merma"
            ).value
        );


    if (!componenteId) {

        alert(
            "Seleccione un componente."
        );

        return;
    }


    if (isNaN(cantidad) || cantidad <= 0) {

        alert(
            "Ingrese una cantidad válida."
        );

        return;
    }


    if (isNaN(merma) || merma < 0) {

        alert(
            "Ingrese una merma válida."
        );

        return;
    }


    var componente =
        componentes.find(function (c) {

            return c.id === componenteId;

        });


    if (!componente) {

        alert(
            "El componente seleccionado no existe."
        );

        return;
    }


    /*
        No permitimos agregar dos veces
        el mismo componente.
    */

    var existente =
        detalleEstructura.find(function (item) {

            return item.componente_id === componenteId;

        });


    if (existente) {

        alert(
            "El componente ya fue agregado a la estructura."
        );

        return;
    }


    detalleEstructura.push({

        componente_id: componente.id,

        codigo: componente.codigo,

        nombre: componente.nombre,

        tipo: componente.tipo,

        unidad: componente.unidad,

        cantidad: cantidad,

        merma: merma

    });


    mostrarDetalle();

    limpiarComponente();
}


/* =========================================================
   MOSTRAR DETALLE
   ========================================================= */

function mostrarDetalle() {

    var tbody =
        document.getElementById(
            "detalle-estructura"
        );


    if (!tbody) {

        return;
    }


    tbody.innerHTML = "";


    detalleEstructura.forEach(function (item, index) {

        var fila =
            document.createElement("tr");


        var columnaCodigo =
            document.createElement("td");


        columnaCodigo.textContent =
            item.codigo || "";


        fila.appendChild(
            columnaCodigo
        );


        var columnaNombre =
            document.createElement("td");


        columnaNombre.textContent =
            item.nombre || "";


        fila.appendChild(
            columnaNombre
        );


        var columnaTipo =
            document.createElement("td");


        columnaTipo.textContent =
            item.tipo || "";


        fila.appendChild(
            columnaTipo
        );


        var columnaUnidad =
            document.createElement("td");


        columnaUnidad.textContent =
            item.unidad || "";


        fila.appendChild(
            columnaUnidad
        );


        var columnaCantidad =
            document.createElement("td");


        columnaCantidad.textContent =
            Number(item.cantidad).toFixed(3);


        fila.appendChild(
            columnaCantidad
        );


        var columnaMerma =
            document.createElement("td");


        columnaMerma.textContent =
            Number(item.merma).toFixed(3);


        fila.appendChild(
            columnaMerma
        );


        var columnaAccion =
            document.createElement("td");


        var botonEliminar =
            document.createElement("button");


        botonEliminar.type =
            "button";


        botonEliminar.textContent =
            "Eliminar";


        /*
            En modo consulta el botón
            queda deshabilitado.
        */

        if (modoEstructura === "CONSULTA") {

            botonEliminar.disabled = true;

        } else {

            botonEliminar.addEventListener(
                "click",
                function () {

                    eliminarComponente(index);

                }
            );
        }


        columnaAccion.appendChild(
            botonEliminar
        );


        fila.appendChild(
            columnaAccion
        );


        tbody.appendChild(
            fila
        );

    });
}


/* =========================================================
   ELIMINAR COMPONENTE DEL DETALLE
   ========================================================= */

function eliminarComponente(index) {

    if (modoEstructura === "CONSULTA") {

        alert(
            "La estructura está en modo consulta."
        );

        return;
    }


    detalleEstructura.splice(
        index,
        1
    );


    mostrarDetalle();
}


/* =========================================================
   LIMPIAR COMPONENTE
   ========================================================= */

function limpiarComponente() {

    document.getElementById(
        "estructura-componente"
    ).value = "";


    document.getElementById(
        "estructura-componente-codigo"
    ).value = "";


    document.getElementById(
        "estructura-componente-tipo"
    ).value = "";


    document.getElementById(
        "estructura-componente-unidad"
    ).value = "";


    document.getElementById(
        "estructura-cantidad"
    ).value = "";


    document.getElementById(
        "estructura-merma"
    ).value = "0";
}


/* =========================================================
   LIMPIAR DATOS PRODUCTO
   ========================================================= */

function limpiarDatosProducto() {

    document.getElementById(
        "estructura-codigo"
    ).value = "";


    document.getElementById(
        "estructura-unidad"
    ).value = "";


    document.getElementById(
        "estructura-unidad-rendimiento"
    ).value = "";


    document.getElementById(
        "estructura-rendimiento"
    ).value = "1";


    limpiarVersionEstado();
}


/* =========================================================
   LIMPIAR VERSION Y ESTADO
   ========================================================= */

function limpiarVersionEstado() {

    var version =
        document.getElementById(
            "estructura-version"
        );


    var estado =
        document.getElementById(
            "estructura-estado"
        );


    if (version) {

        version.value = "";

    }


    if (estado) {

        estado.value = "";

    }
}


/* =========================================================
   ESTABLECER VERSION Y ESTADO
   ========================================================= */

function mostrarVersionEstado(
    version,
    activo
) {

    var campoVersion =
        document.getElementById(
            "estructura-version"
        );


    var campoEstado =
        document.getElementById(
            "estructura-estado"
        );


    if (campoVersion) {

        campoVersion.value =
            version != null
                ? version
                : "";

    }


    if (campoEstado) {

        campoEstado.value =
            activo
                ? "ACTIVA"
                : "INACTIVA";

    }
}


/* =========================================================
   NUEVA ESTRUCTURA
   ========================================================= */

function establecerModoNuevo() {

    modoEstructura =
        "NUEVO";


    estructuraActual =
        null;


    detalleEstructura =
        [];


    var producto =
        document.getElementById(
            "estructura-producto"
        );


    if (producto) {

        producto.value = "";

    }


    limpiarDatosProducto();

    limpiarComponente();

    mostrarDetalle();

    actualizarEstadoBotones();
}


/* =========================================================
   CONSULTAR ESTRUCTURA
   ========================================================= */

async function consultarEstructura() {

    var combo =
        document.getElementById(
            "estructura-producto"
        );


    var productoId =
        parseInt(combo.value);


    if (!productoId) {

        alert(
            "Seleccione un producto elaborado."
        );

        return;
    }


    try {

        var respuesta =
            await fetch(
                "/api/estructura/producto/" +
                productoId
            );


        /*
            No existe estructura activa.
        */

        if (respuesta.status === 404) {

            estructuraActual =
                null;


            detalleEstructura =
                [];


            mostrarDetalle();


            modoEstructura =
                "NUEVO";


            /*
                El producto sí existe,
                pero no tiene estructura.
            */

            document.getElementById(
                "estructura-rendimiento"
            ).value = "1";


            var producto =
                productosElaborados.find(
                    function (p) {

                        return p.id === productoId;

                    }
                );


            if (producto) {

                document.getElementById(
                    "estructura-codigo"
                ).value =
                    producto.codigo || "";


                document.getElementById(
                    "estructura-unidad"
                ).value =
                    producto.unidad || "";


                document.getElementById(
                    "estructura-unidad-rendimiento"
                ).value =
                    producto.unidad || "";

            }


            var campoVersion =
                document.getElementById(
                    "estructura-version"
                );


            var campoEstado =
                document.getElementById(
                    "estructura-estado"
                );


            if (campoVersion) {

                campoVersion.value = "";

            }


            if (campoEstado) {

                campoEstado.value =
                    "SIN ESTRUCTURA";

            }


            actualizarEstadoBotones();


            alert(
                "El producto no tiene una estructura activa."
            );


            return;
        }


        if (!respuesta.ok) {

            var error =
                await respuesta.json();


            throw new Error(
                error.error ||
                error.mensaje ||
                "Error al consultar la estructura."
            );
        }


        var datos =
            await respuesta.json();


        estructuraActual =
            datos.estructura;


        detalleEstructura =
            datos.detalle.map(
                function (item) {

                    return {

                        id: item.id,

                        componente_id:
                            item.componente_id,

                        codigo:
                            item.componente_codigo,

                        nombre:
                            item.componente_nombre,

                        tipo:
                            item.componente_tipo,

                        unidad:
                            item.componente_unidad,

                        cantidad:
                            Number(item.cantidad),

                        merma:
                            Number(item.merma)

                    };

                }
            );


        document.getElementById(
            "estructura-producto"
        ).value =
            estructuraActual.producto_id;


        document.getElementById(
            "estructura-codigo"
        ).value =
            estructuraActual.producto_codigo ||
            "";


        document.getElementById(
            "estructura-unidad"
        ).value =
            estructuraActual.producto_unidad ||
            "";


        document.getElementById(
            "estructura-rendimiento"
        ).value =
            estructuraActual.rendimiento;


        document.getElementById(
            "estructura-unidad-rendimiento"
        ).value =
            estructuraActual.unidad_rendimiento ||
            "";


        /*
            NUEVO:
            mostramos versión y estado
            provenientes directamente de DB.
        */

        mostrarVersionEstado(
            estructuraActual.version,
            estructuraActual.activo
        );


        mostrarDetalle();


        modoEstructura =
            "CONSULTA";


        actualizarEstadoBotones();


    } catch (error) {

        console.error(
            "ERROR CONSULTANDO ESTRUCTURA:",
            error
        );


        alert(
            "Error al consultar la estructura:\n" +
            error.message
        );
    }
}


/* =========================================================
   HABILITAR MODIFICACION
   ========================================================= */

function habilitarModificacion() {

    if (!estructuraActual) {

        alert(
            "Primero debe consultar una estructura."
        );

        return;
    }


    modoEstructura =
        "MODIFICACION";


    actualizarEstadoBotones();
}


/* =========================================================
   GUARDAR ESTRUCTURA
   ========================================================= */

async function guardarEstructura() {

    var productoId =
        parseInt(
            document.getElementById(
                "estructura-producto"
            ).value
        );


    var rendimiento =
        parseFloat(
            document.getElementById(
                "estructura-rendimiento"
            ).value
        );


    var unidadRendimiento =
        document.getElementById(
            "estructura-unidad-rendimiento"
        ).value;


    if (!productoId) {

        alert(
            "Seleccione un producto elaborado."
        );

        return;
    }


    if (
        isNaN(rendimiento) ||
        rendimiento <= 0
    ) {

        alert(
            "Ingrese un rendimiento válido."
        );

        return;
    }


    if (!unidadRendimiento) {

        alert(
            "La unidad de rendimiento es obligatoria."
        );

        return;
    }


    if (detalleEstructura.length === 0) {

        alert(
            "Debe agregar al menos un componente."
        );

        return;
    }


    var detalle =
        detalleEstructura.map(
            function (item) {

                return {

                    componente_id:
                        item.componente_id,

                    cantidad:
                        Number(item.cantidad),

                    merma:
                        Number(item.merma)

                };

            }
        );


    var datos = {

        producto_id:
            productoId,

        rendimiento:
            rendimiento,

        unidad_rendimiento:
            unidadRendimiento,

        detalle:
            detalle

    };


    try {

        var respuesta;


        /*
            ALTA
        */

        if (modoEstructura === "NUEVO") {

            respuesta =
                await fetch(
                    "/api/estructura",
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
        }


        /*
            MODIFICACION

            El backend genera una nueva versión.
        */

        else if (
            modoEstructura ===
            "MODIFICACION"
        ) {

            if (
                !estructuraActual ||
                !estructuraActual.id
            ) {

                alert(
                    "No existe una estructura para modificar."
                );

                return;
            }


            respuesta =
                await fetch(
                    "/api/estructura/" +
                    estructuraActual.id,
                    {

                        method: "PUT",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                rendimiento:
                                    rendimiento,

                                unidad_rendimiento:
                                    unidadRendimiento,

                                detalle:
                                    detalle

                            })

                    }
                );
        }


        else {

            alert(
                "La estructura está en modo consulta. " +
                "Seleccione Modificar para editarla."
            );

            return;
        }


        var resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                resultado.error ||
                resultado.mensaje ||
                "No se pudo guardar la estructura."
            );
        }


        /*
            RESPUESTA DEL ALTA
        */

        if (modoEstructura === "NUEVO") {

            alert(
                "Estructura creada correctamente.\n\n" +
                "Versión: " +
                resultado.version
            );

        }


        /*
            RESPUESTA DE MODIFICACION

            El backend devuelve:

            version_anterior
            version

            No devuelve nueva_version.
        */

        else {

            alert(
                "Estructura modificada correctamente.\n\n" +
                "Versión anterior: " +
                resultado.version_anterior +
                "\n" +
                "Nueva versión: " +
                resultado.version
            );
        }


        /*
            Volvemos a consultar la estructura activa
            para dejar la pantalla sincronizada con DB.
        */

        await consultarEstructura();


    } catch (error) {

        console.error(
            "ERROR GUARDANDO ESTRUCTURA:",
            error
        );


        alert(
            "Error al guardar la estructura:\n" +
            error.message
        );
    }
}


/* =========================================================
   ELIMINAR ESTRUCTURA
   ========================================================= */

async function eliminarEstructura() {

    if (
        !estructuraActual ||
        !estructuraActual.id
    ) {

        alert(
            "Primero debe consultar una estructura."
        );

        return;
    }


    var confirmar =
        confirm(

            "¿Está seguro de dar de baja la estructura?\n\n" +

            "Producto: " +
            (
                estructuraActual.producto_nombre ||
                ""
            ) +

            "\n" +

            "Versión: " +
            estructuraActual.version +

            "\n\n" +

            "La estructura no será eliminada físicamente. " +

            "Se realizará una baja lógica."

        );


    if (!confirmar) {

        return;
    }


    try {

        var respuesta =
            await fetch(
                "/api/estructura/" +
                estructuraActual.id,
                {
                    method: "DELETE"
                }
            );


        var resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                resultado.error ||
                resultado.mensaje ||
                "No se pudo eliminar la estructura."
            );
        }


        alert(

            "Estructura dada de baja correctamente.\n\n" +

            "Versión: " +
            resultado.version

        );


        establecerModoNuevo();


    } catch (error) {

        console.error(
            "ERROR ELIMINANDO ESTRUCTURA:",
            error
        );


        alert(
            "Error al dar de baja la estructura:\n" +
            error.message
        );
    }
}


/* =========================================================
   ESTADO DE LA PANTALLA
   ========================================================= */

function actualizarEstadoBotones() {

    var btnGuardar =
        document.getElementById(
            "btn-guardar-estructura"
        );


    var btnNuevo =
        document.getElementById(
            "btn-nueva-estructura"
        );


    var btnConsultar =
        document.getElementById(
            "btn-consultar-estructura"
        );


    var btnModificar =
        document.getElementById(
            "btn-modificar-estructura"
        );


    var btnEliminar =
        document.getElementById(
            "btn-eliminar-estructura"
        );


    /*
        NUEVO
    */

    if (modoEstructura === "NUEVO") {

        if (btnGuardar) {

            btnGuardar.disabled =
                false;

            btnGuardar.textContent =
                "Guardar estructura";
        }


        if (btnModificar) {

            btnModificar.disabled =
                true;
        }


        if (btnEliminar) {

            btnEliminar.disabled =
                true;
        }
    }


    /*
        CONSULTA
    */

    if (modoEstructura === "CONSULTA") {

        if (btnGuardar) {

            btnGuardar.disabled =
                true;
        }


        if (btnModificar) {

            btnModificar.disabled =
                false;
        }


        if (btnEliminar) {

            btnEliminar.disabled =
                false;
        }
    }


    /*
        MODIFICACION
    */

    if (modoEstructura === "MODIFICACION") {

        if (btnGuardar) {

            btnGuardar.disabled =
                false;

            btnGuardar.textContent =
                "Guardar nueva versión";
        }


        if (btnModificar) {

            btnModificar.disabled =
                true;
        }


        if (btnEliminar) {

            btnEliminar.disabled =
                true;
        }
    }


    actualizarCamposSegunModo();

    /*
        Volvemos a dibujar el detalle para que
        los botones de eliminar de cada fila
        respeten el modo actual.
    */

    mostrarDetalle();
}


/* =========================================================
   HABILITAR / DESHABILITAR CAMPOS
   ========================================================= */

function actualizarCamposSegunModo() {

    var producto =
        document.getElementById(
            "estructura-producto"
        );


    var rendimiento =
        document.getElementById(
            "estructura-rendimiento"
        );


    var componente =
        document.getElementById(
            "estructura-componente"
        );


    var cantidad =
        document.getElementById(
            "estructura-cantidad"
        );


    var merma =
        document.getElementById(
            "estructura-merma"
        );


    var btnAgregar =
        document.getElementById(
            "btn-agregar-componente"
        );


    /*
        CONSULTA
    */

    if (modoEstructura === "CONSULTA") {

        /*
            Permitimos cambiar de producto
            para realizar otra consulta.
        */

        if (producto) {

            producto.disabled =
                false;
        }


        if (rendimiento) {

            rendimiento.disabled =
                true;
        }


        if (componente) {

            componente.disabled =
                true;
        }


        if (cantidad) {

            cantidad.disabled =
                true;
        }


        if (merma) {

            merma.disabled =
                true;
        }


        if (btnAgregar) {

            btnAgregar.disabled =
                true;
        }


        return;
    }


    /*
        NUEVO / MODIFICACION
    */

    if (producto) {

        /*
            Durante modificación no permitimos
            cambiar el producto de la estructura.
        */

        producto.disabled =
            modoEstructura ===
            "MODIFICACION";
    }


    if (rendimiento) {

        rendimiento.disabled =
            false;
    }


    if (componente) {

        componente.disabled =
            false;
    }


    if (cantidad) {

        cantidad.disabled =
            false;
    }


    if (merma) {

        merma.disabled =
            false;
    }


    if (btnAgregar) {

        btnAgregar.disabled =
            false;
    }
}
