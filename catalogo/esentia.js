// Variables globales
let carrito = [];
let productos = [];
let productoSeleccionado = null;
let codigoAplicado = null;
let descuentoAplicado = 0;
let clienteAutenticado = null;
let datosLealtadCliente = null;
let tarjetaLealtadAbierta = true;
let adminProductoActualId = null;
let clienteSeleccionado = null;
window.catalogoListo = false;
// Variable para controlar el estado de carga
window.estadoCarga = {
    productos: false,
    inventario: false,
    sesion: false
};

// ================================
// FUNCIONES DE UI
// ================================

function mostrarToast(mensaje, color = "#6c4ba3") {
  const toast = document.getElementById("toast");
  toast.textContent = mensaje;
  toast.style.background = color;
  toast.classList.add("mostrar");
  setTimeout(() => {
    toast.classList.remove("mostrar");
  }, 3000);
}

function cambiarTab(tab) {
  document.querySelectorAll(".btn-tab").forEach(btn => btn.classList.remove("activo"));
  event.target.classList.add("activo");

  document.getElementById("formLogin").style.display = tab === "login" ? "block" : "none";
  document.getElementById("formRegistro").style.display = tab === "registro" ? "block" : "none";
  document.getElementById("loginMensaje").textContent = "";
}

function cerrarModalLogin() {
  document.getElementById("modalLoginRegistro").style.display = "none";
}

// ================================
// AUTENTICACION
// ================================

function abrirLoginRegistro() {
  document.getElementById("modalLoginRegistro").style.display = "flex";
}

function verificarSesion() {
    const inicio = performance.now();
    const sesion = localStorage.getItem("sesionEsentia");
    
    if (!sesion) {
        document.getElementById("loader").style.display = "none";
        document.getElementById("modalLoginRegistro").style.display = "flex";
        window.estadoCarga.sesion = true;
        verificarYRenderizar();
        return;
    }
    
    clienteAutenticado = JSON.parse(sesion);
    document.getElementById("nombreUsuario").textContent = clienteAutenticado.nombre;
    document.getElementById("panelUsuario").style.display = "flex";
    document.getElementById("btnLogin").style.display = "none";
    document.getElementById("modalLoginRegistro").style.display = "none";
    
    const esAdmin = clienteAutenticado.cedula === "110350666" || clienteAutenticado.id === "110350666";
    localStorage.setItem("adminEsentia", esAdmin ? "1" : "");
    
    const btnAdmin = document.getElementById("adminDropdownContainer");
    if (btnAdmin) btnAdmin.style.display = esAdmin ? "inline-block" : "none";
    
    window.estadoCarga.sesion = true;
    window.catalogoListo = true;
    verificarYRenderizar();
    
    actualizarLealtadAlAutenticar();
    cargarNotificacionesCliente();
    
    console.log('⏱️ Tiempo verificación sesión:', (performance.now() - inicio).toFixed(0), 'ms');
}

function cerrarSesion() {
  localStorage.removeItem("sesionEsentia");
  localStorage.removeItem("adminEsentia");
  clienteAutenticado = null;
  carrito = [];
  localStorage.removeItem("carrito");

  document.getElementById("panelUsuario").style.display = "none";
  document.getElementById("btnLogin").style.display = "inline-block";
  document.getElementById("loader").style.display = "none";
  document.getElementById("productos-hogar").innerHTML = "";
  document.getElementById("modalLoginRegistro").style.display = "flex";

  ocultarTarjetaLealtad();
}

function normalizarNombre(nombre) {
    return nombre
        ?.toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // quita acentos
}

async function cargarInventario() {
    try {
        const snapshot = await getDocs(collection(db, "stock"));
        
        window.inventario = {};

        snapshot.forEach(doc => {
            const data = doc.data();

            // 🔥 SOLO guardar stock
            const key = normalizarNombre(data.nombre);
            window.inventario[key] = data.cantidad ?? data.stock ?? 0;
        });

        window.estadoCarga.inventario = true;

        console.log("📦 Inventario cargado:", window.inventario);

        verificarYRenderizar();

    } catch (error) {
        console.error("Error cargando inventario:", error);
    }
}
// ================================
// TARJETA DE LEALTAD
// ================================

function abrirTarjetaLealtad() {
  document.getElementById("tarjetaLealtad").style.display = "block";
  document.getElementById("cajaRegaloFlotante").style.display = "none";
  tarjetaLealtadAbierta = true;
  localStorage.setItem("tarjetaLealtadAbierta", "true");
}

function cerrarTarjetaLealtad() {
  document.getElementById("tarjetaLealtad").style.display = "none";
  document.getElementById("cajaRegaloFlotante").style.display = "flex";
  tarjetaLealtadAbierta = false;
  localStorage.setItem("tarjetaLealtadAbierta", "false");
}

function ocultarTarjetaLealtad() {
  document.getElementById("lealtadContainer").style.display = "none";
}

async function actualizarLealtadAlAutenticar() {
  if (!clienteAutenticado) return;

  document.getElementById("lealtadContainer").style.display = "block";
  await cargarDatosLealtadCliente();
  registrarVisita();

  const abierta = localStorage.getItem("tarjetaLealtadAbierta") !== "false";
  if (abierta) {
    abrirTarjetaLealtad();
  } else {
    cerrarTarjetaLealtad();
  }
}

async function cargarDatosLealtadCliente() {
  if (!clienteAutenticado) return;

  try {
    const { doc, getDoc } = window.firebaseUtils;
    const ref = doc(window.db, "facturas", clienteAutenticado.id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      datosLealtadCliente = {
        nombre: clienteAutenticado.nombre,
        sellos: 0,
        objetivo: 6,
        premiosPendientes: 0
      };
    } else {
      const data = snap.data();
      datosLealtadCliente = {
        nombre: clienteAutenticado.nombre,
        sellos: data.lealtad?.sellos || 0,
        objetivo: data.lealtad?.objetivo || 6,
        premiosPendientes: data.lealtad?.premiosPendientes || 0
      };
    }

    renderizarTarjetaLealtad();
  } catch (error) {
    console.error("Error cargando lealtad:", error);
  }
}

function renderizarTarjetaLealtad() {
  if (!datosLealtadCliente) return;

  document.getElementById("nombreClienteLealtad").textContent = datosLealtadCliente.nombre;
  document.getElementById("sellsActualesLealtad").textContent = datosLealtadCliente.sellos;
  document.getElementById("sellsObjetivoLealtad").textContent = datosLealtadCliente.objetivo;

  const grid = document.getElementById("sellsGrid");
  grid.innerHTML = "";

  for (let i = 1; i <= datosLealtadCliente.objetivo; i++) {
    const div = document.createElement("div");
    div.className = "sello " + (i <= datosLealtadCliente.sellos ? "activo" : "inactivo");
    div.textContent = "★";
    grid.appendChild(div);
  }

  const progreso = document.getElementById("progresoLealtad");
  if (datosLealtadCliente.sellos >= datosLealtadCliente.objetivo) {
    progreso.innerHTML = "<div class='estado-premio'>🎉 ¡Completaste tu tarjeta! Reclama tu regalo</div>";
  } else {
    const faltan = datosLealtadCliente.objetivo - datosLealtadCliente.sellos;
    progreso.textContent = `Faltan ${faltan} sello${faltan !== 1 ? 's' : ''} para tu regalo`;
  }

  const estadoPremio = document.getElementById("estadoPremioLealtad");
  if (datosLealtadCliente.premiosPendientes > 0) {
    estadoPremio.innerHTML = `<div class="estado-premio">🎁 Tienes ${datosLealtadCliente.premiosPendientes} premio${datosLealtadCliente.premiosPendientes !== 1 ? 's' : ''} por reclamar</div>`;
  } else {
    estadoPremio.innerHTML = "";
  }
}

async function registrarVisita() {
  if (!clienteAutenticado) return;
  try {
    const { doc, setDoc, serverTimestamp } = window.firebaseUtils;
    const ref = doc(window.db, "registroVisitas", clienteAutenticado.id);
    await setDoc(ref, {
      nombre: clienteAutenticado.nombre,
      cedula: clienteAutenticado.cedula || "",
      pagina: "catalogo.html",
      ultimaVisita: serverTimestamp(),
      navegador: navigator.userAgent
    }, { merge: true });
  } catch (error) {
    console.error("Error registrando visita:", error);
  }
}

// ================================
// HISTORIAL DE COMPRAS
// ================================

function abrirHistorial() {
  if (!clienteAutenticado) {
    mostrarToast("Inicia sesión para ver tu historial", "#e74c3c");
    abrirLoginRegistro();
    return;
  }

  document.getElementById("modalHistorial").style.display = "flex";
  cargarHistorialCompras();
}

function cerrarModalHistorial() {
  document.getElementById("modalHistorial").style.display = "none";
}

async function cargarHistorialCompras() {
  const container = document.getElementById("listaHistorial");
  container.innerHTML = '<div class="loading-historial">📦 Cargando tu historial...</div>';

  try {
    const { doc, getDoc } = window.firebaseUtils;

    // Obtener el documento del cliente usando su ID
    const ref = doc(window.db, "facturas", clienteAutenticado.id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      mostrarSinCompras();
      actualizarResumen(0, 0, null);
      return;
    }

    const datosCliente = snap.data();
    const compras = datosCliente.compras || [];

    if (compras.length === 0) {
      mostrarSinCompras();
      actualizarResumen(0, 0, null);
      return;
    }

    let html = '';
    let totalGastado = 0;
    let totalCompras = compras.length;
    let ultimaFecha = null;

    // Ordenar compras por fecha descendente
    const comprasOrdenadas = [...compras].sort((a, b) => {
      const fechaA = a.fecha ? new Date(a.fecha) : new Date(0);
      const fechaB = b.fecha ? new Date(b.fecha) : new Date(0);
      return fechaB - fechaA;
    });

    comprasOrdenadas.forEach((compra, index) => {
      const fecha = compra.fecha ? new Date(compra.fecha) : new Date();

      if (index === 0) ultimaFecha = fecha;

      const total = compra.total || 0;
      totalGastado += total;

      // Usar estado de la compra o 'entregado' por defecto
      const estado = compra.estado || 'entregado';
      const estadoClass = getEstadoClass(estado);
      const estadoTexto = getEstadoTexto(estado);

      html += crearCardCompra(index, compra, fecha, estadoClass, estadoTexto);
    });

    container.innerHTML = html;
    actualizarResumen(totalCompras, totalGastado, ultimaFecha, datosCliente);

  } catch (error) {
    console.error("Error cargando historial:", error);
    container.innerHTML = `
      <div class="sin-compras">
        <div class="sin-compras-icono">⚠️</div>
        <div class="sin-compras-texto">Error al cargar el historial</div>
        <div class="sin-compras-subtexto">Intenta de nuevo más tarde</div>
      </div>
    `;
  }
}

function crearCardCompra(id, factura, fecha, estadoClass, estadoTexto) {
  const fechaStr = fecha.toLocaleDateString('es-CR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const horaStr = fecha.toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  let productosHTML = '';
  const productos = factura.productos || factura.items || [];

  productos.forEach(prod => {
    const imagen = prod.imagen || 'https://wil1979.github.io/esentia-factura/images/logo.png';
    productosHTML += `
      <div class="producto-historial">
        <div class="producto-historial-info">
          <img src="${imagen}" alt="${prod.nombre}" class="producto-historial-img" onerror="this.src='https://wil1979.github.io/esentia-factura/images/logo.png'">
          <div>
            <div class="producto-historial-nombre">${prod.nombre}</div>
            <div class="producto-historial-variante">${prod.variante || 'Estándar'} × ${prod.cantidad}</div>
          </div>
        </div>
        <div class="producto-historial-precio">₡${(prod.precio * prod.cantidad).toLocaleString()}</div>
      </div>
    `;
  });

  const descuento = factura.descuento || 0;
  const total = factura.total || 0;
  const saldo = factura.saldo || 0;
  const metodoPago = factura.metodoPago || 'No especificado';
  const tipoPago = factura.tipoPago || 'contado';

  const iconoMetodo = metodoPago === 'SINPE' ? '📱' : metodoPago === 'Efectivo' ? '💵' : '💳';

  return `
    <div class="compra-card">
      <div class="compra-header">
        <div class="compra-fecha">
          <span class="compra-fecha-icono">📅</span>
          <span>${fechaStr} · ${horaStr}</span>
        </div>
        <span class="compra-estado ${estadoClass}">${estadoTexto}</span>
      </div>

      <div class="compra-productos">
        ${productosHTML}
      </div>

      ${descuento > 0 ? `
        <div class="compra-descuento">
          🎉 Descuento aplicado: -₡${descuento.toLocaleString()}
        </div>
      ` : ''}

      <div class="compra-detalles">
        <div class="detalle-fila">
          <span class="detalle-label">${iconoMetodo} Método:</span>
          <span class="detalle-valor">${metodoPago}</span>
        </div>
        <div class="detalle-fila">
          <span class="detalle-label">💰 Tipo:</span>
          <span class="detalle-valor">${tipoPago === 'credito' ? 'Crédito' : 'Contado'}</span>
        </div>
        ${saldo > 0 ? `
          <div class="detalle-fila" style="color: #e74c3c;">
            <span class="detalle-label">⚠️ Pendiente:</span>
            <span class="detalle-valor">₡${saldo.toLocaleString()}</span>
          </div>
        ` : ''}
      </div>

      <div class="compra-footer">
        <span class="compra-id">#${id.toString().slice(-6).toUpperCase()}</span>
        <div style="text-align: right;">
          <div class="compra-total-label">Total</div>
          <div class="compra-total-valor">₡${total.toLocaleString()}</div>
        </div>
      </div>
    </div>
  `;
}


function getEstadoClass(estado) {
  const estados = {
    'pendiente': 'estado-pendiente',
    'proceso': 'estado-proceso',
    'en proceso': 'estado-proceso',
    'entregado': 'estado-entregado',
    'cancelado': 'estado-cancelado'
  };
  return estados[estado.toLowerCase()] || 'estado-pendiente';
}

function getEstadoTexto(estado) {
  const estados = {
    'pendiente': '⏳ Pendiente',
    'proceso': '📦 En proceso',
    'en proceso': '📦 En proceso',
    'entregado': '✅ Entregado',
    'cancelado': '❌ Cancelado'
  };
  return estados[estado.toLowerCase()] || estado;
}

function actualizarResumen(totalCompras, totalGastado, ultimaFecha) {
  document.getElementById("totalCompras").textContent = totalCompras;
  document.getElementById("totalGastado").textContent = `₡${totalGastado.toLocaleString()}`;

  if (ultimaFecha) {
    const dias = Math.floor((new Date() - ultimaFecha) / (1000 * 60 * 60 * 24));
    let texto;
    if (dias === 0) texto = "Hoy";
    else if (dias === 1) texto = "Ayer";
    else if (dias < 7) texto = `Hace ${dias} días`;
    else if (dias < 30) texto = `Hace ${Math.floor(dias/7)} semanas`;
    else texto = `Hace ${Math.floor(dias/30)} meses`;
    document.getElementById("ultimaCompra").textContent = texto;
  } else {
    document.getElementById("ultimaCompra").textContent = "-";
  }
}

function mostrarSinCompras() {
  document.getElementById("listaHistorial").innerHTML = `
    <div class="sin-compras">
      <div class="sin-compras-icono">🛍️</div>
      <div class="sin-compras-texto">Aún no tienes compras</div>
      <div class="sin-compras-subtexto">¡Explora nuestro catálogo y haz tu primer pedido!</div>
      <button onclick="cerrarModalHistorial();" class="btn-submit" style="margin-top: 1.5rem; max-width: 250px;">
        Ver catálogo
      </button>
    </div>
  `;
}

// ================================
// RENDERIZADO CONDICIONAL (NUEVO)
// ================================
function verificarYRenderizar() {
    // Solo renderizar si productos E inventario están listos
    if (window.estadoCarga.productos && window.estadoCarga.inventario) {
        renderizarProductos();
        
        // Inicializar buscador si existe
        if (window.BuscadorInteligente && productos.length > 0) {
            window.buscador = new BuscadorInteligente(productos);
        }
        
        console.log('✅ Catálogo listo - Productos con stock:', 
            productos.filter(p => (window.inventario[p.nombre] ?? 0) > 0).length);
    }
}
// ================================
// PRODUCTOS (Sin renderizar inmediatamente)
// ================================
async function cargarProductos() {
    const inicio = performance.now();
    
    try {
        const resp = await fetch("https://wil1979.github.io/esentia-factura/productos_esentia.json");
        const datosPorTipo = await resp.json();
        
        productos = [];
        for (const tipo in datosPorTipo) {
            if (Array.isArray(datosPorTipo[tipo])) {
                datosPorTipo[tipo].forEach(producto => {
                    productos.push({ ...producto, tipo });
                });
            }
        }
        
        window.estadoCarga.productos = true;
        verificarYRenderizar(); // ← Espera inventario también
        
        console.log('⏱️ Tiempo carga productos:', (performance.now() - inicio).toFixed(0), 'ms');
        
    } catch (error) {
        console.error("Error cargando productos:", error);
        document.getElementById("loader").innerHTML = `
            <div style="text-align:center;padding:40px;">
                <p style="color:#e74c3c;">⚠️ Error cargando catálogo</p>
                <button onclick="location.reload()" class="btn-submit" style="max-width:200px;margin-top:10px;">
                    🔄 Reintentar
                </button>
            </div>
        `;
    }
}

function intentarRenderizar() {
    // ✅ Verificar que inventario exista antes de renderizar
    if (window.catalogoListo && window.inventario && productos.length > 0) {
        renderizarProductos();
    }
}

// ================================
// RENDERIZAR PRODUCTOS (FILTRADO POR STOCK)
// ================================
function renderizarProductos() {
     const container = document.getElementById("productos-hogar");
    const loader = document.getElementById("loader");
    loader.style.display = "none";
    container.innerHTML = "";
    
    // FILTRO CRÍTICO: Solo productos con stock > 0
    const productosConStock = productos.filter(p => {
       const key = normalizarNombre(p.nombre);
       const stock = window.inventario[key] ?? 0;
        const disponible = p.disponible !== false;
        return disponible && stock > 0; // ← stock > 0 (no >= 0)
    });
    
    // Mensaje si no hay productos con stock
    if (productosConStock.length === 0) {
        const esAdmin = localStorage.getItem("adminEsentia") === "1";
        container.innerHTML = `
            <div style="text-align:center;padding:60px 20px;">
                <div style="font-size:4rem;margin-bottom:20px;">📦</div>
                <h3 style="color:var(--primary);margin-bottom:10px;">
                    ${esAdmin ? "⚠️ No hay productos con stock" : "🔄 Próximamente"}
                </h3>
                <p style="color:var(--text-muted);margin-bottom:20px;">
                    ${esAdmin 
                        ? "Admin: Ve a 📦 Gestionar Inventario para agregar stock" 
                        : "Estamos preparando nuevas esencias para ti"}
                </p>
                ${esAdmin 
                    ? `<button onclick="gestionarInventario()" class="btn-submit" style="max-width:250px;">
                        📦 Gestionar Inventario
                    </button>` 
                    : ''}
            </div>
        `;
        return;
    }
    
    // Agrupar por tipo
    const porTipo = {};
    productosConStock.forEach(p => {
        const tipo = p.tipo || 'Otros';
        if (!porTipo[tipo]) porTipo[tipo] = [];
        porTipo[tipo].push(p);
    });
    
    // Renderizar secciones
    Object.keys(porTipo).sort().forEach(tipo => {
        const seccion = document.createElement("div");
        seccion.className = "seccion-tipo";
        const titulo = document.createElement("h2");
        titulo.className = "titulo-tipo";
        titulo.innerHTML = `${getIconoTipo(tipo)} ${capitalizar(tipo)}  
            <span class="contador-productos">${porTipo[tipo].length}</span>`;
        seccion.appendChild(titulo);
        
        const grid = document.createElement("div");
        grid.className = "productos-grid";
        
        porTipo[tipo].forEach(p => {
            grid.appendChild(crearCardProducto(p));
        });
        
        seccion.appendChild(grid);
        container.appendChild(seccion);
    });
    
    // Activar admin si corresponde
    if (localStorage.getItem("adminEsentia") === "1") {
        activarAccionesAdmin();
    }
}
// ================================
// FUNCIONES DE BÚSQUEDA (Agregar en esentia.js)
// ================================
function mostrarSugerencias(termino) {
    if (!termino || termino.length < 2) {
        // Ocultar sugerencias si el término es muy corto
        const sugerenciasBox = document.getElementById('sugerenciasBusqueda');
        if (sugerenciasBox) sugerenciasBox.style.display = 'none';
        return;
    }
    
    if (!window.buscador) return;
    
    const sugerencias = window.buscador.sugerencias(termino);
    const sugerenciasBox = document.getElementById('sugerenciasBusqueda');
    
    if (!sugerenciasBox) {
        // Crear el contenedor si no existe
        const searchInput = document.getElementById('searchInput');
        const box = document.createElement('div');
        box.id = 'sugerenciasBusqueda';
        box.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            max-height: 200px;
            overflow-y: auto;
        `;
        searchInput.parentElement.style.position = 'relative';
        searchInput.parentElement.appendChild(box);
        return;
    }
    
    if (sugerencias.length === 0) {
        sugerenciasBox.style.display = 'none';
        return;
    }
    
    sugerenciasBox.innerHTML = sugerencias.map(s => `
        <div style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee;"
             onmouseover="this.style.background='#f8f5ff'" 
             onmouseout="this.style.background='white'"
             onclick="document.getElementById('searchInput').value='${s}'; 
                      document.getElementById('searchInput').dispatchEvent(new Event('input'));
                      document.getElementById('sugerenciasBusqueda').style.display='none'">
            🔍 ${s}
        </div>
    `).join('');
    
    sugerenciasBox.style.display = 'block';
}

// Cerrar sugerencias al hacer click fuera
document.addEventListener('click', (e) => {
    const sugerenciasBox = document.getElementById('sugerenciasBusqueda');
    const searchInput = document.getElementById('searchInput');
    if (sugerenciasBox && !searchInput.contains(e.target) && !sugerenciasBox.contains(e.target)) {
        sugerenciasBox.style.display = 'none';
    }
});
function crearCardProducto(p) {
    const precioFinal = p.precioOferta || p.precio || 3000;
    const precioOriginal = p.precioOriginal;
    const stock = window.inventario[normalizarNombre(p.nombre)] ?? 0;
    
    const card = document.createElement("div");
    card.className = p.precioOferta ? "producto-card oferta" : "producto-card";
    card.dataset.nombre = p.nombre;
    
    let badges = "";
    if (p.esNuevo) badges += `<span class="badge badge-nuevo">Nuevo</span>`;
    badges += `<span class="badge badge-tipo">${p.tipo}</span>`;
    if (p.precioOferta) badges += `<span class="badge badge-oferta">Oferta</span>`;
    
    // Badge de stock bajo (visible para admin)
    if (stock > 0 && stock <= 5 && localStorage.getItem("adminEsentia") === "1") {
        badges += `<span class="badge" style="background:#e74c3c;color:white;">⚠️ ${stock}</span>`;
    }
    
    let precioHTML = "";
    if (p.precioOferta && precioOriginal) {
        precioHTML = `<span class="precio-original">₡${precioOriginal.toLocaleString()}</span>
                      <span class="precio-oferta">₡${precioFinal.toLocaleString()}</span>`;
    } else {
        precioHTML = `<span class="precio-normal">₡${precioFinal.toLocaleString()}</span>`;
    }
    
    // Indicador de stock (solo visual, no bloquea porque ya filtramos)
    let stockIndicator = "";
    if (stock <= 5) {
        stockIndicator = `<div class="stock-label stock-bajo">⚠️ Últimas ${stock} unidades</div>`;
    } else if (stock <= 10) {
        stockIndicator = `<div class="stock-label" style="background:rgba(240,173,78,0.1);color:#f0ad4e;">
            📦 Stock: ${stock}
        </div>`;
    }
    
    const nombreEsc = p.nombre.replace(/'/g, "\\'");
    const infoEsc = (p.info || " ").replace(/`/g, "\\`");
    const benefEsc = (p.beneficios || " ").replace(/`/g, "\\`");
    const usoEsc = (p.usoRecomendado || " ").replace(/`/g, "\\`");
    
    card.innerHTML = `
        <div class="producto-imagen-container">
            <div class="badges-container">${badges}</div>
            <img src="${p.imagen}" alt="${p.nombre}" loading="lazy" 
                 onclick="mostrarInfoProducto('${nombreEsc}', ${precioFinal}, '${p.imagen}', \`${infoEsc}\`, \`${benefEsc}\`, \`${usoEsc}\`)">
        </div>
        <div class="producto-info">
            <h3 class="producto-nombre">${p.nombre}</h3>
            ${p.calificacion ? 
                `<div class="producto-calificacion">${"★".repeat(Math.floor(p.calificacion))}</div>` 
                : ""}
            <div class="producto-precio-container">${precioHTML}</div>
            ${stockIndicator}
            <button class="btn-agregar" 
                    onclick="mostrarInfoProducto('${nombreEsc}', ${precioFinal}, '${p.imagen}', \`${infoEsc}\`, \`${benefEsc}\`, \`${usoEsc}\`)">
                Ver detalles →
            </button>
        </div>
    `;
    
    return card;
}


function getIconoTipo(tipo) {
  const iconos = {
    'Aromaterapia': '🌿',
    'Difusores': '💨',
    'Velas': '🕯️',
    'Aceites': '💧',
    'Perfumes': '🌸',
    'Ambientadores': '🏠',
    'Regalos': '🎁',
    'Limpieza': '🧼'
  };
  return iconos[tipo] || '✨';
}

function capitalizar(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ================================
// MODAL PRODUCTO
// ================================

function mostrarInfoProducto(nombre, precio, imagen, info, beneficios, uso) {
  document.getElementById("modalProductoNombre").textContent = nombre;
  document.getElementById("modalProductoImagen").src = imagen;
  document.getElementById("modalProductoInfo").textContent = info || "";
  document.getElementById("modalProductoUso").innerHTML = 
    `<strong>✨ Beneficios:</strong> ${beneficios || "No especificado"}<br><br><strong>🏠 Uso recomendado:</strong> ${uso || "No especificado"}`;
  document.getElementById("modalProductoPrecio").textContent = `₡${precio.toLocaleString()}`;

  const p = productos.find(x => x.nombre === nombre);
  productoSeleccionado = { ...p };

  const selector = document.getElementById("selectorVariante");
  selector.innerHTML = "";

  if (p.variantes && p.variantes.length > 0) {
    const select = document.createElement("select");
    select.className = "selector-variante";
    select.id = "varianteSeleccionada";

    const nombres = ["Auto", "Hogar / Oficina 30 ml", "Hogar / Oficina 120 ml"];

    p.variantes.forEach((v, i) => {
      const opt = document.createElement("option");
      opt.value = JSON.stringify({ nombre: nombres[i] || "Presentación", precio: v.precio });
      opt.textContent = `${nombres[i] || "Presentación"} – ₡${v.precio.toLocaleString()}`;
      if (v.precio === 3000) opt.selected = true;
      select.appendChild(opt);
    });

    select.onchange = () => {
      const v = JSON.parse(select.value);
      document.getElementById("modalProductoPrecio").textContent = `₡${v.precio.toLocaleString()}`;
    };

    selector.appendChild(select);
    setTimeout(() => select.dispatchEvent(new Event("change")), 0);
  }

  document.getElementById("modalProducto").style.display = "flex";
}

function cerrarModalProducto() {
  document.getElementById("modalProducto").style.display = "none";
}

// ================================
// CARRITO
// ================================

function agregarAlCarritoDesdeModal() {
  if (!productoSeleccionado) return;

  const selectVar = document.getElementById("varianteSeleccionada");
  let variante = { nombre: "Hogar / Oficina 30 ml", precio: 3000 };

  if (selectVar && selectVar.value) {
    try {
      variante = JSON.parse(selectVar.value);
    } catch (e) {}
  }

  if (productoSeleccionado.variantes?.length > 0 && (!selectVar || !selectVar.value)) {
    mostrarToast("Selecciona una presentación", "#e74c3c");
    return;
  }

  carrito.push({
    id: Date.now(),
    nombre: productoSeleccionado.nombre,
    imagen: productoSeleccionado.imagen,
    variante: variante.nombre,
    precio: variante.precio,
    cantidad: 1
  });

  guardarCarrito();
  cerrarModalProducto();
  mostrarToast("✓ Producto agregado");
}

function guardarCarrito() {
  localStorage.setItem("carrito", JSON.stringify(carrito));
  document.getElementById("contadorCarrito").textContent = carrito.length;
}

function cargarCarrito() {
  const data = localStorage.getItem("carrito");
  if (data) {
    carrito = JSON.parse(data);
    document.getElementById("contadorCarrito").textContent = carrito.length;
  }
}

function abrirModalCarrito() {
  renderCarrito();
  document.getElementById("modalCarrito").style.display = "flex";
}

function cerrarModalCarrito() {
  document.getElementById("modalCarrito").style.display = "none";
}

function renderCarrito() {
  const lista = document.getElementById("listaCarrito");
  lista.innerHTML = "";
  let total = 0;

  carrito.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "item-carrito";
    li.innerHTML = `
      <div class="item-carrito-info">
        <div class="item-carrito-nombre">${item.nombre}</div>
        <div class="item-carrito-variante">${item.variante} × ${item.cantidad}</div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="item-carrito-precio">₡${(item.precio * item.cantidad).toLocaleString()}</span>
        <button class="btn-eliminar" onclick="eliminarDelCarrito(${index})">🗑</button>
      </div>
    `;
    lista.appendChild(li);
    total += item.precio * item.cantidad;
  });

  if (descuentoAplicado > 0) {
    total -= descuentoAplicado;
    document.getElementById("totalModal").textContent = `Total: ₡${total.toLocaleString()} (-₡${descuentoAplicado.toLocaleString()})`;
  } else {
    document.getElementById("totalModal").textContent = `Total: ₡${total.toLocaleString()}`;
  }
}

function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  guardarCarrito();
  renderCarrito();
}

async function aplicarCodigoPremio() {

  const input = document.getElementById("codigoPremio");
  if (!input) {
    console.error("❌ Input codigoPremio no existe");
    return;
  }

  const codigo = input.value.trim().toUpperCase();

  if (!codigo) {
    mostrarToast("Ingresa un código", "#e74c3c");
    return;
  }

  console.log("🎁 Código ingresado:", codigo);

  let promo = null;

  // 🔥 1. Intentar Firebase
  try {
    if (typeof validarPromo === "function") {
      const resultado = await validarPromo(codigo, "cliente123");

      if (!resultado.valido) {
  mostrarToast(resultado.mensaje || "Código inválido", "#e74c3c");
  return;
}
    } else {
      console.warn("⚠️ validarPromo no existe");
    }
  } catch (e) {
    console.warn("❌ Error Firebase:", e);
  }

  // 🔥 2. Códigos locales (fallback)
  if (!promo) {
    const codigos = {
      "ESENTIA10": { tipo: "porcentaje", valor: 10 },
      "NAVIDAD": { tipo: "monto", valor: 1500 },
      "PREMIO1": { tipo: "monto", valor: 1000 }
    };

    promo = codigos[codigo];

    if (promo) {
      console.log("✅ Promo local:", promo);
    }
  }

  // ❌ Si no hay promo
  if (!promo) {
    mostrarToast("Código inválido", "#e74c3c");
    return;
  }

  // 🔥 3. Calcular total
  let total = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

  if (promo.tipo === "porcentaje") {
    descuentoAplicado = Math.round(total * (promo.valor / 100));
  } else {
    descuentoAplicado = promo.valor;
  }

  codigoAplicado = codigo;

  console.log("💰 Descuento aplicado:", descuentoAplicado);

  renderCarrito();

  mostrarToast(`🎁 Descuento aplicado -₡${descuentoAplicado.toLocaleString()}`, "#2ecc71");
}

async function validarUsoCliente(clienteId, promoId, limite) {

  const { getDocs, collection, query, where } = window.firebaseUtils;

  const q = query(
    collection(window.db, "promos_usadas"),
    where("clienteId", "==", clienteId),
    where("promoId", "==", promoId)
  );

  const snap = await getDocs(q);

  if (snap.empty) return true;

  const data = snap.docs[0].data();

  return data.vecesUsado < limite;
}

async function usarPromo(id, clienteId) {

  const { doc, updateDoc } = window.firebaseUtils;

  const ref = doc(window.db, "promociones", id);

  try {
    await updateDoc(ref, {
      usosActuales: (window.increment ? window.increment(1) : 1)
    });
  } catch (error) {
    console.error("Error registrando uso:", error);
  }
}

async function validarPromo(codigo, clienteId) {

  const { getDocs, collection, query, where, doc, getDoc } = window.firebaseUtils;

  try {
    const q = query(
      collection(window.db, "promociones"),
      where("codigo", "==", codigo)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      return { valido: false, mensaje: "Código no existe" };
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data();

    // 🔥 1. Activa
    if (data.activa === false) {
      return { valido: false, mensaje: "Código desactivado" };
    }

    // 🔥 2. Expiración
    if (data.fechaExpiracion) {
      if (new Date() > new Date(data.fechaExpiracion)) {
        return { valido: false, mensaje: "Código expirado" };
      }
    }

    // 🔥 3. Usos globales
    if (data.usosMax && data.usosActuales >= data.usosMax) {
      return { valido: false, mensaje: "Código agotado" };
    }

    // 🔥 4. Monto mínimo
    const total = carrito.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
    if (data.minimoCompra && total < data.minimoCompra) {
      return { 
        valido: false, 
        mensaje: `Compra mínima ₡${data.minimoCompra}` 
      };
    }

    // 🔥 5. Primera compra
    if (data.soloPrimeraCompra && clienteId) {
      const refCliente = doc(window.db, "facturas", clienteId);
      const snapCliente = await getDoc(refCliente);

      const compras = snapCliente.exists() ? snapCliente.data().compras || [] : [];

      if (compras.length > 0) {
        return { valido: false, mensaje: "Solo para nuevos clientes" };
      }
    }

    // 🔥 6. Clientes específicos
    if (data.clientesPermitidos?.length > 0) {
      if (!data.clientesPermitidos.includes(clienteId)) {
        return { valido: false, mensaje: "No autorizado" };
      }
    }

    return {
      valido: true,
      promo: {
        id: docSnap.id,
        ...data
      }
    };

  } catch (error) {
    console.error("Error validando promo:", error);
    return { valido: false, mensaje: "Error validando" };
  }
}

window.mostrarPanelPromos = async function () {
  if (localStorage.getItem("adminEsentia") !== "1") return;

  const panel = document.getElementById("panelPromos");
  panel.classList.remove("hidden");

  cargarPromosAdmin();
};
async function cargarNotificacionesCliente() {

  const { getDocs, collection } = window.firebaseUtils;

  const snap = await getDocs(collection(window.db, "notificaciones"));

  snap.forEach(doc => {
    const n = doc.data();

    mostrarToast(`🔔 ${n.titulo}: ${n.mensaje}`, "#6c4ba3");
  });
}

async function cargarPromosAdmin() {

  console.log("Buscando listaPromos:", document.getElementById("listaPromos"));
  const { getDocs, collection } = window.firebaseUtils;
  const contenedor = document.getElementById("listaPromos");

if (!contenedor) {
  console.error("❌ listaPromos no existe en el DOM");
  return;
}

  contenedor.innerHTML = "Cargando...";

  const snap = await getDocs(collection(window.db, "promociones"));

  contenedor.innerHTML = "";

  if (snap.empty) {
    contenedor.innerHTML = "⚠️ No hay códigos creados";
    return;
  }

  snap.forEach(docSnap => {
    const p = docSnap.data();
    const id = docSnap.id;

    const expira = p.fechaExpiracion ? new Date(p.fechaExpiracion) : null;
    const expirada = expira && new Date() > expira;

    contenedor.innerHTML += `
      <div style="padding:10px;border:1px solid #444;margin-bottom:10px;border-radius:8px;">
        
        <strong style="font-size:16px;">${p.codigo}</strong><br>
        
        💸 ${p.tipo === "porcentaje" ? p.valor + "%" : "₡" + p.valor}<br>
        📊 Usos: ${p.usosActuales || 0}/${p.usosMax || "∞"}<br>
        ⏳ ${expirada ? "❌ Expirada" : "✅ Activa"}

        <br><br>

        <button onclick="editarPromo('${id}', '${p.codigo}', ${p.valor})">
          ✏️ Editar
        </button>

        <button onclick="eliminarPromo('${id}')">
          🗑️ Eliminar
        </button>

      </div>
    `;
  });
}

window.editarPromo = async function (id, codigo, valorActual) {
  const nuevoValor = prompt(`Editar valor para ${codigo}`, valorActual);

  if (!nuevoValor) return;

  const { updateDoc, doc } = window.firebaseUtils;

  await updateDoc(doc(window.db, "promociones", id), {
    valor: Number(nuevoValor)
  });

  alert("✅ Promo actualizada");

  cargarPromosAdmin();
};


window.eliminarPromo = async function (id) {

  if (!id) return;

  if (!confirm("¿Eliminar esta promoción?")) return;

  try {
    await window.firebaseUtils.deleteDoc(
      window.firebaseUtils.doc(window.db, "promociones", id)
    );

    mostrarToast("🗑️ Promoción eliminada", "#e74c3c");
    cargarPromosAdmin();

  } catch (error) {
    console.error("Error eliminando promo:", error);
    mostrarToast("⚠️ No se pudo eliminar", "#e74c3c");
  }
};

async function cargarNotificacionesAdmin() {
  const { getDocs, collection } = window.firebaseUtils;

  const contenedor = document.getElementById("listaNotificaciones");
  contenedor.innerHTML = "Cargando...";

  const snap = await getDocs(collection(window.db, "notificaciones"));

  contenedor.innerHTML = "";

  snap.forEach(doc => {
    const n = doc.data();

    contenedor.innerHTML += `
      <div class="promo-card">
        <strong>${n.titulo}</strong><br>
        ${n.mensaje}<br>

        <button onclick="eliminarNotificacion('${doc.id}')">🗑️</button>
      </div>
    `;
  });
}

window.eliminarNotificacion = async function (id) {
  await window.firebaseUtils.deleteDoc(
  window.firebaseUtils.doc(window.db, "promociones", id)
  );
  cargarNotificacionesAdmin();
};

function finalizarPedido() {
  if (!clienteAutenticado) {
    mostrarToast("Inicia sesión para continuar", "#e74c3c");
    abrirLoginRegistro();
    return;
  }

  if (carrito.length === 0) {
    mostrarToast("Tu carrito está vacío", "#e74c3c");
    return;
  }

  let mensaje = `Hola Wilber 👋\n\nQuiero hacer un pedido:\n\n`;
  carrito.forEach(item => {
    mensaje += `• ${item.nombre} (${item.variante}) × ${item.cantidad} – ₡${(item.precio * item.cantidad).toLocaleString()}\n`;
  });

  let total = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  if (descuentoAplicado > 0) {
    mensaje += `\nDescuento: -₡${descuentoAplicado.toLocaleString()}`;
    total -= descuentoAplicado;
  }

  mensaje += `\n\n*Total: ₡${total.toLocaleString()}*\n\n`;
  mensaje += `Cliente: ${clienteAutenticado.nombre}\nTel: ${clienteAutenticado.telefono || "No registrado"}`;

  window.open(`https://wa.me/50672952454?text=${encodeURIComponent(mensaje)}`, "_blank");
}



window.abrirModalFacturacion = async function () {

  document.getElementById("modalFacturacion").style.display = "flex";

  renderProductosFact();
  cargarClientesFact();
  actualizarTotalesFact();
};

function cerrarModalFacturacion() {
  document.getElementById("modalFacturacion").style.display = "none";
}

async function cargarClientesFact() {

  const { getDocs, collection } = window.firebaseUtils;

  const snap = await getDocs(collection(window.db, "clientesBD"));

  const cont = document.getElementById("listaClientesFact");
  cont.innerHTML = "";

  snap.forEach(doc => {
    const c = doc.data();

    const div = document.createElement("div");
    div.className = "cliente-item";
    div.innerHTML = `${c.nombre} - ${c.telefono}`;

    div.onclick = () => {
      clienteSeleccionado = { id: doc.id, ...c };

      document.querySelectorAll("#listaClientesFact div")
        .forEach(el => el.classList.remove("activo"));

      div.classList.add("activo");
    };

    cont.appendChild(div);
  });
}

function renderProductosFact() {

  const cont = document.getElementById("listaProductosFact");
  cont.innerHTML = "";

  carrito.forEach((p, i) => {

    const div = document.createElement("div");

    div.innerHTML = `
      ${p.nombre} x${p.cantidad}
      <span>₡${p.precio * p.cantidad}</span>
    `;

    cont.appendChild(div);
  });
}


function actualizarTotalesFact() {

  const subtotal = carrito.reduce((s, p) => s + p.precio * p.cantidad, 0);
  const descuento = Number(document.getElementById("descuentoFact").value) || 0;

  const total = subtotal - descuento;

  document.getElementById("subtotalFact").innerText = subtotal;
  document.getElementById("descuentoMostrado").innerText = descuento;
  document.getElementById("totalFact").innerText = total;
}

window.confirmarFacturacion = async function () {

  if (!clienteSeleccionado) {
    mostrarToast("Selecciona cliente", "#e74c3c");
    return;
  }

  const metodo = document.getElementById("metodoPagoFact").value;
  const descuento = Number(document.getElementById("descuentoFact").value) || 0;

  const productos = carrito.map(p => ({
    cantidad: p.cantidad,
    idProducto: p.id,
    nombre: p.nombre,
    precio: p.precio,
    variante: p.variante || "Única"
  }));

  const subtotal = productos.reduce((s, p) => s + p.precio * p.cantidad, 0);
  const total = subtotal - descuento;

  const compra = {
    fecha: new Date().toISOString(),
    productos,
    total,
    monto: total,
    descuento,
    metodoPago: metodo,
    tipoPago: metodo === "Credito" ? "credito" : "contado",
    pagado: metodo === "Credito" ? 0 : total,
    saldo: metodo === "Credito" ? total : 0
  };

  const { doc, updateDoc, arrayUnion } = window.firebaseUtils;

  await updateDoc(
    doc(window.db, "facturas", clienteSeleccionado.id),
    { compras: arrayUnion(compra) }
  );

  await descontarInventario(productos);
  await actualizarLealtad(clienteSeleccionado.id);
  enviarFacturaCliente(clienteSeleccionado, compra);

  mostrarToast("🧾 Factura completa", "#2ecc71");

  cerrarModalFacturacion();

  carrito = [];
  renderCarrito();
};

// ================================
// UTILIDADES
// ================================

function solicitarAroma() {
  const msg = encodeURIComponent("Hola, me gustaría un aroma personalizado para mi hogar 🌸");
  window.open(`https://wa.me/50672952454?text=${msg}`, "_blank");
}

function copiarEnlaceRecomendacion() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    mostrarToast("¡Enlace copiado! 💌");
  });
}

// ================================
// ADMIN - GESTIÓN DE INVENTARIO
// ================================

function activarAccionesAdmin() {
    if (localStorage.getItem("adminEsentia") !== "1") return;
    
    const adminContainer = document.getElementById("adminDropdownContainer");
    if (adminContainer) {
        adminContainer.style.display = "inline-block";
    }
    
    // Ocultar botón admin antiguo si existe
    const btnAdminOld = document.getElementById("btnAdminVelas");
    if (btnAdminOld && !btnAdminOld.classList.contains("btn-admin-main")) {
        btnAdminOld.style.display = "none";
    }
    
   
}

function toggleAdminMenu() {
    const menu = document.getElementById("adminMenu");
    const arrow = document.querySelector(".dropdown-arrow");
    
    if (menu) {
        if (menu.style.display === "none" || menu.style.display === "") {
            menu.style.display = "block";
            if (arrow) arrow.style.transform = "rotate(180deg)";
        } else {
            menu.style.display = "none";
            if (arrow) arrow.style.transform = "rotate(0deg)";
        }
    }
}

// Cerrar menú al hacer click fuera
document.addEventListener("click", (e) => {
    const adminDropdown = document.getElementById("adminDropdownContainer");
    const adminMenu = document.getElementById("adminMenu");
    
    if (adminDropdown && adminMenu && !adminDropdown.contains(e.target)) {
        adminMenu.style.display = "none";
        const arrow = document.querySelector(".dropdown-arrow");
        if (arrow) arrow.style.transform = "rotate(0deg)";
    }
});

// Función para mostrar estadísticas (si no existe)
async function mostrarEstadisticas() {
    const adminMenu = document.getElementById("adminMenu");
    if (adminMenu) adminMenu.style.display = "none";
    
    const panel = document.getElementById("panelEstadisticas");
    const contenido = document.getElementById("contenidoEstadisticas");
    
    if (!panel || !contenido) {
        mostrarToast("Panel de estadísticas no disponible", "#6c4ba3");
        return;
    }
    
    panel.classList.remove("hidden");
    contenido.innerHTML = '<div style="text-align:center;padding:40px;">📊 Cargando...</div>';
    
    try {
        const { collection, getDocs } = window.firebaseUtils;
        
        const visitasSnap = await getDocs(collection(window.db, "registroVisitas"));
        const clientesSnap = await getDocs(collection(window.db, "clientesBD"));
        
        const totalVisitas = visitasSnap.size;
        const totalClientes = clientesSnap.size;
        const productosAgotados = productos.filter(p => (window.inventario[p.nombre] ?? 0) === 0).length;
        
        contenido.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="number">${totalVisitas}</span>
                    <span class="label">Visitas Totales</span>
                </div>
                <div class="stat-card accent">
                    <span class="number">${totalClientes}</span>
                    <span class="label">Clientes</span>
                </div>
                <div class="stat-card">
                    <span class="number">${productos.length}</span>
                    <span class="label">Productos</span>
                </div>
                <div class="stat-card warning">
                    <span class="number">${productosAgotados}</span>
                    <span class="label">Agotados</span>
                </div>
            </div>
        `;
    } catch (error) {
        contenido.innerHTML = '<div style="color:#e74c3c;text-align:center;">⚠️ Error cargando estadísticas</div>';
    }
}

function cerrarPanelEstadisticas() {
    const panel = document.getElementById("panelEstadisticas");
    if (panel) panel.classList.add("hidden");
}

// NUEVO: Panel completo de gestión de inventario
function gestionarInventario() {
    const adminMenu = document.getElementById("adminMenu");
    adminMenu.style.display = "none";
    
    // Crear/abrir modal de inventario
    abrirModalInventario();
}

function abrirModalInventario() {
    // Verificar si ya existe el modal
    let modal = document.getElementById("modalInventario");
    
    if (!modal) {
        // Crear modal dinámicamente
        modal = document.createElement("div");
        modal.id = "modalInventario";
        modal.className = "modal-carrito";
        modal.style.display = "none";
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>📦 Gestión de Inventario</h3>
                    <button class="btn-close" onclick="cerrarModalInventario()">×</button>
                </div>
                <div class="modal-body">
                    <div class="inventario-stats" id="inventarioStats"></div>
                    <div class="inventario-filtros">
                        <input type="text" id="filtroInventario" placeholder="🔍 Buscar producto..." oninput="filtrarInventario()">
                        <select id="filtroStock" onchange="filtrarInventario()">
                            <option value="">Todos los estados</option>
                            <option value="agotado">Agotados</option>
                            <option value="bajo">Stock Bajo (≤5)</option>
                            <option value="normal">Stock Normal</option>
                        </select>
                    </div>
                    <div class="inventario-grid" id="inventarioGrid"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn-submit" onclick="guardarInventarioCompleto()">💾 Guardar Cambios</button>
                    <button class="btn-secondary" onclick="exportarInventario()">📥 Exportar CSV</button>
                    <button class="btn-secondary" onclick="cerrarModalInventario()">❌ Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    modal.style.display = "flex";
    cargarVistaInventario();
}

function cerrarModalInventario() {
    const modal = document.getElementById("modalInventario");
    if (modal) modal.style.display = "none";
}

// Cargar productos en la vista de inventario
async function cargarVistaInventario() {
    try {
        const snapshot = await getDocs(collection(db, "stock"));

        const grid = document.getElementById("inventarioGrid");
        grid.innerHTML = "";

        let totalProductos = 0;
        let totalStock = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            const cantidad = data.cantidad ?? data.stock ?? 0;

            totalProductos++;
            totalStock += cantidad;

            const item = document.createElement("div");
            item.className = "inventario-item";

            item.innerHTML = `
                <div class="inventario-card">
                    <h4>${data.nombre}</h4>
                    <p>Stock:</p>
                    <input type="number" value="${cantidad}" min="0"
                        onchange="actualizarStockLocal('${doc.id}', this.value)">
                </div>
            `;

            grid.appendChild(item);
        });

        document.getElementById("inventarioStats").innerHTML = `
            <strong>Productos:</strong> ${totalProductos} |
            <strong>Total Stock:</strong> ${totalStock}
        `;

    } catch (error) {
        console.error("Error cargando vista inventario:", error);
    }
}

window.cambiosInventario = {};

function actualizarStockLocal(id, valor) {
    window.cambiosInventario[id] = parseInt(valor) || 0;
}

window.mostrarPanelVisitasAdmin = async function () {
  if (localStorage.getItem("adminEsentia") !== "1") return;

  const panel = document.getElementById("panelVisitas");
  panel.classList.remove("hidden");

  try {
    const { collection, getDocs } = window.firebaseUtils;
    const snap = await getDocs(collection(window.db, "registroVisitas"));

    let total = 0;
    let unicos = 0;
    let hoy = 0;

    const mapaClientes = {};
    const visitasPorDia = {};

    const hoyFecha = new Date().toLocaleDateString("es-CR");

    snap.forEach(doc => {
      const v = doc.data();
      total += v.visitas || 1;
      unicos++;

      const nombre = v.nombre || "Anónimo";

      // 🔥 Top visitantes
      mapaClientes[nombre] = (mapaClientes[nombre] || 0) + (v.visitas || 1);

      // 🔥 Fecha
      if (v.ultimaVisita?.seconds) {
        const fecha = new Date(v.ultimaVisita.seconds * 1000);
        const fechaStr = fecha.toLocaleDateString("es-CR");

        visitasPorDia[fechaStr] = (visitasPorDia[fechaStr] || 0) + 1;

        if (fechaStr === hoyFecha) hoy++;
      }
    });

    // 📊 Render tarjetas
    document.getElementById("totalVisitas").textContent = total;
    document.getElementById("visitantesUnicos").textContent = unicos;
    document.getElementById("visitasHoy").textContent = hoy;

    // 🏆 Top visitantes
    const top = Object.entries(mapaClientes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topHTML = top.map(t => `
      <div>👤 ${t[0]} - <strong>${t[1]}</strong></div>
    `).join("");

    document.getElementById("topVisitantes").innerHTML = topHTML;

    // 📅 Visitas por día
    const dias = Object.entries(visitasPorDia)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .slice(0, 7);

    const diasHTML = dias.map(d => `
      <div>${d[0]} → <strong>${d[1]}</strong></div>
    `).join("");

    document.getElementById("visitasPorDia").innerHTML = diasHTML;

  } catch (e) {
    console.error(e);
  }
};


window.cerrarPanelVisitas = function() {
  const panel = document.getElementById("panelVisitas");
  if (panel) {
    panel.classList.add("hidden");
  }
};
//PROMOS GENERADOR DE COIGOS INICIO**************************************
window.generarCodigoPromo = async function () {
  const codigo = prompt("Código (ej: ESENTIA10)");
  const tipo = prompt("Tipo: porcentaje o fijo");
  const valor = parseInt(prompt("Valor descuento"));

  if (!codigo || !tipo || !valor) return;

  const { addDoc, collection } = window.firebaseUtils;

  await addDoc(collection(window.db, "promociones"), {
    codigo: codigo.toUpperCase(),
    tipo,
    valor,
    activo: true,
    usosMax: 100,
    usosActuales: 0,
    fechaExpiracion: null,
    clientesUsados: []
  });

  alert("✅ Código creado");
};

function aplicarDescuento(total, promo) {
  if (promo.tipo === "porcentaje") {
    return total - (total * promo.valor / 100);
  } else {
    return total - promo.valor;
  }
}

function aplicarDescuento(total, promo) {
if (promo.fechaExpiracion) {
  const ahora = new Date();
  const expira = new Date(promo.fechaExpiracion);

  if (ahora > expira) {
    return { valido: false, mensaje: "Código expirado" };
  }
}



  if (promo.tipo === "porcentaje") {
    return total - (total * promo.valor / 100);
  } else {
    return total - promo.valor;
  }
}

async function usarPromo(promoId, clienteId) {
  const { doc, updateDoc, arrayUnion, increment } = window.firebaseUtils;

  await updateDoc(doc(window.db, "promociones", promoId), {
    usosActuales: increment(1),
    clientesUsados: arrayUnion(clienteId)
  });

  if (ahora > expira) {
  await updateDoc(doc(window.db, "promociones", promo.id), {
    activo: false
  });

  return { valido: false, mensaje: "Código expirado" };
}
}
//PROMOS GENERADOR DE COIGOS FINAL
window.crearNotificacion = async function () {
  const titulo = prompt("Título");
  const mensaje = prompt("Mensaje");

  if (!titulo || !mensaje) return;

  const { addDoc, collection } = window.firebaseUtils;

  await addDoc(collection(window.db, "notificaciones"), {
    titulo,
    mensaje,
    fecha: new Date().toISOString(),
    activa: true
  });

  alert("📢 Notificación enviada");
};

async function guardarInventarioCompleto() {
    try {
        const updates = Object.entries(window.cambiosInventario);

        for (const [id, cantidad] of updates) {
            await updateDoc(doc(db, "stock", id), {
                cantidad: cantidad,
                ultimaActualizacion: new Date().toISOString()
            });
        }

        alert("✅ Inventario actualizado");
        window.cambiosInventario = {};

        cargarVistaInventario();

    } catch (error) {
        console.error("Error guardando inventario:", error);
    }
}
function renderizarListaInventario(listaProductos) {
    const grid = document.getElementById("inventarioGrid");
    if (!grid) return;
    
    grid.innerHTML = "";
    
    listaProductos.forEach(p => {
        const stockActual = window.inventario[p.nombre] ?? 0;
        const stockClass = stockActual === 0 ? "stock-agotado" : stockActual <= 5 ? "stock-bajo" : "stock-normal";
        const stockIcon = stockActual === 0 ? "❌" : stockActual <= 5 ? "⚠️" : "✓";
        
        const row = document.createElement("div");
        row.className = "inventario-item";
        row.dataset.nombre = p.nombre;
        row.innerHTML = `
            <div class="inventario-info">
                <img src="${p.imagen}" alt="${p.nombre}" class="inventario-img">
                <div class="inventario-detalles">
                    <div class="inventario-nombre">${p.nombre}</div>
                    <div class="inventario-tipo">${p.tipo}</div>
                    <div class="inventario-precio">₡${(p.precioOferta || p.precio || 3000).toLocaleString()}</div>
                </div>
            </div>
            <div class="inventario-controles">
                <div class="stock-control">
                    <button class="btn-stock" onclick="ajustarStock('${p.nombre.replace(/'/g, "\\'")}', -1)">−</button>
                    <input type="number" 
                           class="stock-input ${stockClass}" 
                           value="${stockActual}" 
                           min="0" 
                           max="999"
                           onchange="actualizarStockInput('${p.nombre.replace(/'/g, "\\'")}', this.value)"
                           onfocus="this.select()">
                    <button class="btn-stock" onclick="ajustarStock('${p.nombre.replace(/'/g, "\\'")}', 1)">+</button>
                </div>
                <div class="stock-estado ${stockClass}">
                    ${stockIcon} ${stockActual === 0 ? "Agotado" : stockActual <= 5 ? "Stock Bajo" : "En Stock"}
                </div>
            </div>
        `;
        grid.appendChild(row);
    });
}

// Ajustar stock con botones + / -
function ajustarStock(nombre, cambio) {
    const current = window.inventario[nombre] ?? 0;
    const nuevo = Math.max(0, Math.min(999, current + cambio));
    window.inventario[nombre] = nuevo;
    
    // Actualizar vista
    const row = document.querySelector(`.inventario-item[data-nombre="${nombre.replace(/"/g, '\\"')}"]`);
    if (row) {
        const input = row.querySelector(".stock-input");
        const estado = row.querySelector(".stock-estado");
        
        input.value = nuevo;
        
        // Actualizar clase y texto
        input.className = `stock-input ${nuevo === 0 ? "stock-agotado" : nuevo <= 5 ? "stock-bajo" : "stock-normal"}`;
        estado.className = `stock-estado ${nuevo === 0 ? "stock-agotado" : nuevo <= 5 ? "stock-bajo" : "stock-normal"}`;
        estado.innerHTML = `${nuevo === 0 ? "❌" : nuevo <= 5 ? "⚠️" : "✓"} ${nuevo === 0 ? "Agotado" : nuevo <= 5 ? "Stock Bajo" : "En Stock"}`;
    }
    
    // Marcar como modificado
    row?.classList.add("modificado");
}

// Actualizar stock desde input directo
function actualizarStockInput(nombre, valor) {
    const nuevo = Math.max(0, Math.min(999, parseInt(valor) || 0));
    window.inventario[nombre] = nuevo;
    
    const row = document.querySelector(`.inventario-item[data-nombre="${nombre.replace(/"/g, '\\"')}"]`);
    row?.classList.add("modificado");
}

// Filtrar productos en la vista de inventario
function filtrarInventario() {
    const texto = document.getElementById("filtroInventario")?.value.toLowerCase() || "";
    const estado = document.getElementById("filtroStock")?.value || "";
    
    const filtrados = productos.filter(p => {
        const coincideNombre = p.nombre.toLowerCase().includes(texto) || p.tipo.toLowerCase().includes(texto);
        const stock = window.inventario[normalizarNombre(p.nombre)] ?? 0;
        
        let coincideEstado = true;
        if (estado === "agotado") coincideEstado = stock === 0;
        else if (estado === "bajo") coincideEstado = stock > 0 && stock <= 5;
        else if (estado === "normal") coincideEstado = stock > 5;
        
        return coincideNombre && coincideEstado;
    });
    
    renderizarListaInventario(filtrados);
}

// Guardar inventario completo en Firebase
async function guardarInventarioCompleto() {
    const modificados = productos.filter(p => {
        const row = document.querySelector(`.inventario-item[data-nombre="${p.nombre.replace(/"/g, '\\"')}"]`);
        return row?.classList.contains("modificado");
    });
    
    if (modificados.length === 0) {
        ToastSystem?.mostrar ? 
            ToastSystem.mostrar("No hay cambios para guardar", "info") :
            mostrarToast("No hay cambios para guardar", "#6c4ba3");
        return;
    }
    
    if (!confirm(`¿Guardar cambios en ${modificados.length} producto(s)?`)) return;
    
    try {
        const { doc, setDoc, serverTimestamp } = window.firebaseUtils;
        
        for (const p of modificados) {
           const stock = window.inventario[normalizarNombre(p.nombre)] ?? 0;
            // ✅ CAMBIO: "stock" en lugar de "inventario"
            const ref = doc(window.db, "stock", p.nombre);
            await setDoc(ref, {
                nombre: p.nombre,
                stock: stock, // ✅ Campo correcto según tu DB
                ultimaActualizacion: serverTimestamp(),
                actualizadoPor: clienteAutenticado?.nombre || "admin"
            }, { merge: true });
        }
        
        localStorage.setItem("inventarioEsentia", JSON.stringify(window.inventario));
        renderizarProductos();
        
        ToastSystem?.mostrar ? 
            ToastSystem.mostrar(`✓ Stock actualizado (${modificados.length} productos)`, "success") :
            mostrarToast(`✓ Stock actualizado`, "#25d366");
        
        cerrarModalInventario();
        
    } catch (error) {
        console.error("Error guardando stock:", error);
        ToastSystem?.mostrar ? 
            ToastSystem.mostrar("Error guardando stock", "error") :
            mostrarToast("Error guardando stock", "#e74c3c");
    }
}

// Exportar inventario a CSV
function exportarInventario() {
    let csv = "Nombre,Tipo,Precio,Stock,Estado\n";
    
    productos.forEach(p => {
        const stock = window.inventario[normalizarNombre(p.nombre)] ?? 0;
        const estado = stock === 0 ? "Agotado" : stock <= 5 ? "Bajo" : "Normal";
        const precio = p.precioOferta || p.precio || 3000;
        
        csv += `"${p.nombre}","${p.tipo}",${precio},${stock},"${estado}"\n`;
    });
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario_esentia_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    
    ToastSystem?.mostrar ? 
        ToastSystem.mostrar("✓ Inventario exportado", "success") :
        mostrarToast("✓ Inventario exportado", "#25d366");
}

// Importar inventario desde CSV (opcional)
function importarInventario() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const text = await file.text();
        const lines = text.split("\n").slice(1); // Skip header
        
        let actualizados = 0;
        lines.forEach(line => {
            const [nombre, , , stock] = line.split(",");
            if (nombre && stock) {
                const nombreLimpio = nombre.replace(/"/g, "").trim();
                window.inventario[nombreLimpio] = parseInt(stock) || 0;
                actualizados++;
            }
        });
        
        ToastSystem?.mostrar ? 
            ToastSystem.mostrar(`✓ ${actualizados} productos importados`, "success") :
            mostrarToast(`✓ ${actualizados} productos importados`, "#25d366");
        
        cargarVistaInventario();
    };
    
    input.click();
}

async function verEstructuraFirestore() {

  const { getDocs, collection } = window.firebaseUtils;

  const colecciones = ["clientes", "facturas", "facturacion", "promociones"];

  for (const col of colecciones) {
    try {
      const snap = await getDocs(collection(window.db, col));

      console.log(`📦 Colección: ${col}`);

      snap.forEach(doc => {
        console.log("ID:", doc.id);
        console.log("DATA:", doc.data());
        return false; // solo uno
      });

    } catch (e) {
      console.warn(`No existe colección: ${col}`);
    }
  }
}

window.facturarDesdeCatalogoPRO = async function () {

  const metodoPago = prompt("Método de pago:", "Efectivo") || "Efectivo";
  const descuento = Number(prompt("Descuento:", 0)) || 0;

  const carritoLocal = carrito.map(item => ({
    cantidad: item.cantidad,
    id: item.id,
    idProducto: item.id,
    nombre: item.nombre,
    precio: item.precio,
    variante: item.variante || "Única"
  }));

  const subtotal = carritoLocal.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const total = subtotal - descuento;

  const compra = {
    fecha: new Date().toISOString(),
    productos: carritoLocal,
    total,
    monto: total,
    descuento,
    metodoPago,
    tipoPago: metodoPago === "Credito" ? "credito" : "contado",
    pagado: metodoPago === "Credito" ? 0 : total,
    saldo: metodoPago === "Credito" ? total : 0
  };

  const { doc, updateDoc, arrayUnion, getDoc } = window.firebaseUtils;

  const ref = doc(window.db, "facturas", clienteSeleccionado.id);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, {
      compras: [],
      abonos: [],
      lealtad: { sellos: 0, premiosPendientes: 0, objetivo: 6 }
  });
}

  await descontarInventario(carritoLocal);
  await actualizarLealtad(clienteSeleccionado.id);
  enviarFacturaCliente(clienteSeleccionado, compra);

  carrito = [];
  renderCarrito();

  mostrarToast("🧾 Factura completa", "#2ecc71");
};

async function descontarInventario(productos) {

  const { doc, updateDoc, getDoc } = window.firebaseUtils;

  for (const p of productos) {

    const id = p.idProducto || p.id || p.nombre;

    if (!id || typeof id !== "string") {
      console.warn("❌ ID inválido en producto:", p);
      continue;
    }

    const ref = doc(window.db, "inventario", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.warn("⚠️ Producto no existe en inventario:", id);
      continue;
    }

    const data = snap.data();
    const nuevoStock = (data.stock || 0) - p.cantidad;

    await updateDoc(ref, {
      stock: nuevoStock
    });
  }

  console.log("📦 Inventario actualizado");
}

async function actualizarLealtad(clienteId) {

  const { doc, getDoc, updateDoc } = window.firebaseUtils;

  const ref = doc(window.db, "facturas", clienteId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const data = snap.data();
  let sellos = data.lealtad?.sellos || 0;

  sellos++;

  let premios = data.lealtad?.premiosPendientes || 0;

  if (sellos >= 6) {
    premios++;
    sellos = 0;
    mostrarToast("🎁 Cliente ganó un premio", "#f39c12");
  }

  await updateDoc(ref, {
    "lealtad.sellos": sellos,
    "lealtad.premiosPendientes": premios
  });
}

function generarFacturaPDF(cliente, compra) {

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Factura Esentia", 20, 20);

  doc.setFontSize(10);
  doc.text(`Cliente: ${cliente.nombre}`, 20, 30);

  let y = 40;

  compra.productos.forEach(p => {
    doc.text(`${p.nombre} x${p.cantidad}`, 20, y);
    doc.text(`₡${p.precio * p.cantidad}`, 150, y);
    y += 10;
  });

  doc.text(`Total: ₡${compra.total}`, 20, y + 10);

  doc.save("factura_esentia.pdf");
}

function enviarFacturaCliente(cliente, compra) {

  const detalle = compra.productos
    .map(p => `• ${p.nombre} x${p.cantidad}`)
    .join("\n");

  const mensaje = `
🧾 Factura Esentia

${cliente.nombre}

${detalle}

Total: ₡${compra.total}
`;

  const url = `https://wa.me/506${cliente.telefono}?text=${encodeURIComponent(mensaje)}`;

  window.open(url, "_blank");

  generarFacturaPDF(cliente, compra);
}

window.abrirSelectorCliente = async function () {
  document.getElementById("modalCliente").style.display = "flex";

  const { getDocs, collection } = window.firebaseUtils;
  const snap = await getDocs(collection(window.db, "clientesBD"));

  const contenedor = document.getElementById("listaClientes");
  contenedor.innerHTML = "";

  snap.forEach(doc => {
    const c = doc.data();

    const div = document.createElement("div");
    div.className = "cliente-item";
    div.innerHTML = `
      <strong>${c.nombre}</strong><br>
      📱 ${c.telefono}
    `;

    div.onclick = () => {
      clienteSeleccionado = { id: doc.id, ...c };
      document.querySelectorAll(".cliente-item").forEach(el => el.classList.remove("activo"));
      div.classList.add("activo");
       // 🔥 NUEVO: mostrar cliente seleccionado
  document.getElementById("clienteSeleccionadoLabel").innerText =
    `Cliente: ${c.nombre} (${c.telefono})`;

    };

    contenedor.appendChild(div);
  });
};

function cerrarModalCliente() {
  document.getElementById("modalCliente").style.display = "none";
}

function confirmarCliente() {
  if (!clienteSeleccionado) {
    mostrarToast("Selecciona un cliente", "#e74c3c");
    return;
  }

  cerrarModalCliente();
  facturarDesdeCatalogoPRO();
}

async function enviarFacturaCliente(clienteId, compra) {

  const { doc, getDoc } = window.firebaseUtils;

  const ref = doc(window.db, "clientesBD", clienteId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const cliente = snap.data();

  const detalle = compra.productos
    .map(p => `• ${p.nombre} x${p.cantidad} = ₡${p.precio * p.cantidad}`)
    .join("\n");

  const mensaje = `
🧾 *Factura Esentia*

👤 ${cliente.nombre}

${detalle}

💰 Total: ₡${compra.total}
`;

  const url = `https://wa.me/506${cliente.telefono}?text=${encodeURIComponent(mensaje)}`;

  window.open(url, "_blank");
}



// Ver productos agotados rápidamente
function verProductosAgotados() {
    const adminMenu = document.getElementById("adminMenu");
    adminMenu.style.display = "none";
    
    const agotados = productos.filter(p => window.inventario[p.nombre] === 0);
    
    if (agotados.length === 0) {
        ToastSystem?.mostrar ? 
            ToastSystem.mostrar("✓ Todos los productos en stock", "success") :
            mostrarToast("✓ Todos los productos en stock", "#25d366");
        return;
    }
    
    // Abrir inventario filtrado
    abrirModalInventario();
    document.getElementById("filtroStock").value = "agotado";
    filtrarInventario();
    
    ToastSystem?.mostrar ? 
        ToastSystem.mostrar(`${agotados.length} productos agotados`, "warning") :
        mostrarToast(`${agotados.length} productos agotados`, "#e74c3c");
}

// NUEVO: Exportar Catálogo
function exportarCatalogo() {
    const adminMenu = document.getElementById("adminMenu");
    adminMenu.style.display = "none";
    
    const dataStr = JSON.stringify(productos, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `catalogo_esentia_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    mostrarToast("✓ Catálogo exportado", "#25d366");
}

// NUEVO: Ver Pedidos Pendientes
function verPedidosPendientes() {
    const adminMenu = document.getElementById("adminMenu");
    adminMenu.style.display = "none";
    
    mostrarToast("🔄 Cargando pedidos...", "#6c4ba3");
    
    // Aquí iría la lógica para consultar Firebase
    // Por ahora, redirigir al historial
    abrirHistorial();
}

// NUEVO: Ver Historial Completo
function verHistorialCompleto() {
    const adminMenu = document.getElementById("adminMenu");
    adminMenu.style.display = "none";
    
    abrirHistorial();
    mostrarToast("📋 Historial completo abierto", "#6c4ba3");
}

window.generarCodigoPromoAuto = async function () {
  try {
    const { addDoc, collection } = window.firebaseUtils;

    // 🔥 Generar código automático
    //const codigo = "ESENTIA-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const codigo = "ESENTIA" + Math.floor(Math.random() * 10000);
    // ⏱️ Fecha actual
    const ahora = new Date();

    // ⏳ Expira en 24 horas
    const expiracion = new Date(ahora.getTime() + (24 * 60 * 60 * 1000));
    
    await addDoc(collection(window.db, "promociones"), {
      codigo,
      tipo: "porcentaje", // puedes cambiar a "fijo"
      valor: 10,
      activo: true,
      usosMax: 2,
      usosActuales: 0,
      fechaCreacion: ahora.toISOString(),
      fechaExpiracion: expiracion.toISOString(),
      clientesUsados: []
    });

    alert(`🎁 Código generado automáticamente:
    
${codigo}

⏳ Válido por 24 horas`);

  } catch (error) {
    console.error("Error creando código:", error);
    alert("Error al generar código");
  }
  cargarPromosAdmin()
};

window.enviarNotificacionMasiva = async function () {

  const adminMenu = document.getElementById("adminMenu");
  if (adminMenu) adminMenu.style.display = "none";

  const mensaje = prompt("📣 Mensaje para todos los clientes:");
  if (!mensaje) return;

  const titulo = prompt("📝 Título de la notificación:", "Esentia") || "Esentia";

  const { addDoc, collection, serverTimestamp } = window.firebaseUtils;

  try {
    await addDoc(collection(window.db, "notificaciones"), {
      titulo,
      mensaje,
      fecha: serverTimestamp(),
      leidaPor: []
    });

    mostrarToast("🔔 Notificación enviada a todos", "#2ecc71");

  } catch (error) {
    console.error("Error enviando notificación:", error);
    mostrarToast("❌ Error al enviar", "#e74c3c");
  }
};



// NUEVO: Limpiar Caché
function limpiarCache() {
    const adminMenu = document.getElementById("adminMenu");
    adminMenu.style.display = "none";
    
    localStorage.clear();
    sessionStorage.clear();
    
    mostrarToast("🧹 Caché limpiada. Recarga la página.", "#e74c3c");
    
    setTimeout(() => {
        location.reload();
    }, 2000);
}

// NUEVO: Ver Logs de Errores
function verLogsErrores() {
    const adminMenu = document.getElementById("adminMenu");
    adminMenu.style.display = "none";
    
    mostrarToast("🐛 Revisa la consola del navegador (F12)", "#6c4ba3");
    console.table({
        "Productos cargados": productos.length,
        "Carrito items": carrito.length,
        "Cliente autenticado": clienteAutenticado?.nombre || "No",
        "Admin activo": localStorage.getItem("adminEsentia") === "1" ? "Sí" : "No",
        "Versión": EsentiaApp?.version || "1.0"
    });
}



// ================================
// CARGAR INVENTARIO (CORREGIDO)
// ================================
async function cargarInventarioGuardado() {
    console.log('📦 Iniciando carga de inventario...');
    
    // 1. Inicializar window.inventario PRIMERO (evita undefined)
    window.inventario = {};
    
    // 2. Cargar desde localStorage si existe
    const inventarioLocal = localStorage.getItem("inventarioEsentia");
    if (inventarioLocal) {
        window.inventario = JSON.parse(inventarioLocal);
        console.log('✅ Inventario cargado desde localStorage');
    }
    
    // 3. Si es admin, cargar desde Firebase (colección "stock")
    if (localStorage.getItem("adminEsentia") === "1") {
        try {
            const { collection, getDocs } = window.firebaseUtils;
            // ✅ CAMBIO CRÍTICO: "stock" en lugar de "inventario"
            const snap = await getDocs(collection(window.db, "stock"));
            
            let actualizados = 0;
            snap.docs.forEach(doc => {
                const data = doc.data();
                window.inventario[data.nombre] = data.stock ?? 0;
                actualizados++;
            });
            
            localStorage.setItem("inventarioEsentia", JSON.stringify(window.inventario));
            console.log(`✅ Inventario sincronizado con Firebase (${actualizados} productos)`);
        } catch (error) {
            console.warn("⚠️ No se pudo cargar inventario de Firebase:", error.message);
        }
    }
    
    // 4. Asegurar que todos los productos tengan stock (aunque sea 0)
    productos.forEach(p => {
        if (!(p.nombre in window.inventario)) {
            window.inventario[p.nombre] = 0;
        }
    });
    
    console.log('📦 Inventario listo:', Object.keys(window.inventario).length, 'productos');
    intentarRenderizar();
}

function abrirAdminSheet(id) {
  adminProductoActualId = id;
  document.getElementById("adminSheetOverlay").style.display = "flex";
}

function cerrarAdminSheet(e) {
  if (!e || e.target === document.getElementById("adminSheetOverlay")) {
    document.getElementById("adminSheetOverlay").style.display = "none";
  }
}

function publicarFacebookOG() {
  if (!adminProductoActualId) return;
  const url = `https://wil1979.github.io/esentia-factura/og/${adminProductoActualId}.html`;
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
}

function publicarFacebookDirecto() {
  if (!adminProductoActualId) return;
  const url = `https://wil1979.github.io/esentia-factura/producto.html?id=${encodeURIComponent(adminProductoActualId)}`;
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
}

window.addEventListener("click", function (e) {
  const modal = document.getElementById("modalInventario");
  if (e.target === modal) {
    modal.style.display = "none";
  }
});

// Sync con Firebase (no bloqueante)
async function sincronizarInventarioFirebase() {
    try {
        const { collection, getDocs } = window.firebaseUtils;
        const snap = await getDocs(collection(window.db, "stock"));//inventRIO
        
        snap.docs.forEach(doc => {
            const data = doc.data();
            window.inventario[data.nombre] = data.stock ?? 10;
        });
        
        // Guardar actualizado
        localStorage.setItem("inventarioEsentia", JSON.stringify(window.inventario));
        localStorage.setItem("inventarioTime", Date.now().toString());
        
        // Re-renderizar solo si hubo cambios
        verificarYRenderizar();
        
        console.log('✅ Inventario sincronizado con Firebase');
    } catch (error) {
        console.warn("⚠️ No se pudo sincronizar inventario con Firebase:", error.message);
    }
}

// ================================
// LOGIN / REGISTRO
// ================================

async function buscarCedulaHacienda(cedula) {
  try {
    const resp = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${cedula}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.nombre || null;
  } catch {
    return null;
  }
}

// Login
document.getElementById("formLogin")?.addEventListener("submit", async e => {
  e.preventDefault();
  const valor = document.getElementById("loginCedulaTel").value.trim();
  const msg = document.getElementById("loginMensaje");

  if (!valor) {
    msg.textContent = "Ingresa cédula o teléfono";
    return;
  }

  msg.textContent = "Buscando...";

  try {
    const { query, where, collection, getDocs } = window.firebaseUtils;
    const col = collection(window.db, "clientesBD");
    const q1 = query(col, where("cedula", "==", valor));
    const q2 = query(col, where("telefono", "==", valor));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    let docSnap = null;

    if (!snap1.empty) docSnap = snap1.docs[0];
    else if (!snap2.empty) docSnap = snap2.docs[0];

    if (!docSnap) {
      msg.textContent = "Cliente no registrado. Usa 'Registrarse'.";
      return;
    }

    const data = docSnap.data();
    clienteAutenticado = {
      id: docSnap.id,
      nombre: data.nombre,
      cedula: data.cedula,
      telefono: data.telefono
    };

    localStorage.setItem("sesionEsentia", JSON.stringify(clienteAutenticado));

    const esAdmin = data.cedula === "110350666" || data.telefono === "110350666";
    localStorage.setItem("adminEsentia", esAdmin ? "1" : "");

    verificarSesion();
    msg.textContent = "";
  } catch (err) {
    msg.textContent = "Error de conexión";
  }
});

// Registro
let cedulaValidaCache = null;

document.getElementById("regCedula")?.addEventListener("input", async (e) => {
  let val = e.target.value.replace(/\D/g, "");
  e.target.value = val;

  const status = document.getElementById("cedulaStatus");
  const btn = document.getElementById("btnRegistrar");
  const nombreInput = document.getElementById("regNombre");

  if (val.length === 9) {
    status.textContent = "🔍";
    btn.disabled = true;
    btn.textContent = "Verificando...";

    const nombre = await buscarCedulaHacienda(val);
    if (nombre) {
      status.textContent = "✓";
      nombreInput.value = nombre;
      cedulaValidaCache = { cedula: val, nombre };
      btn.disabled = false;
      btn.textContent = "Registrarme";
    } else {
      status.textContent = "✗";
      nombreInput.value = "";
      cedulaValidaCache = null;
      btn.disabled = true;
      btn.textContent = "Cédula inválida";
    }
  } else {
    status.textContent = "";
    btn.disabled = true;
    btn.textContent = "Verificando cédula...";
  }
});

document.getElementById("formRegistro")?.addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("loginMensaje");

  const cedula = document.getElementById("regCedula").value;
  const telefono = document.getElementById("regTelefono").value;
  const nombre = document.getElementById("regNombre").value;

  if (!nombre) {
    msg.textContent = "Cédula no verificada";
    return;
  }

  if (telefono.length < 8) {
    msg.textContent = "Teléfono inválido";
    return;
  }

  try {
    const { collection, addDoc } = window.firebaseUtils;
    const ref = await addDoc(collection(window.db, "clientesBD"), {
      nombre,
      cedula,
      telefono: telefono.replace(/\D/g, ""),
      creado: new Date()
    });

    clienteAutenticado = {
      id: ref.id,
      nombre,
      cedula,
      telefono
    };

    localStorage.setItem("sesionEsentia", JSON.stringify(clienteAutenticado));

    const esAdmin = cedula === "110350666";
    localStorage.setItem("adminEsentia", esAdmin ? "1" : "");

    mostrarToast(`¡Bienvenido, ${nombre}!`);
    verificarSesion();
  } catch (err) {
    msg.textContent = "Error al registrar";
  }
});

// ================================
// INICIALIZACION (ORDEN CORREGIDO)
// ================================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("descuentoFact").addEventListener("input", actualizarTotalesFact);
    cargarCarrito();
    cargarProductos();
    cargarInventario(); // 👈 CLAVE
    verificarSesion();


    
    // 1. Cargar productos primero (para tener la lista)
    cargarProductos().then(() => {
        // 2. Luego cargar inventario (para saber el stock real)
        cargarInventarioGuardado();
    });

  
    // Cerrar modales al hacer click fuera
    document.querySelectorAll(".modal-carrito").forEach(modal => {
        modal.addEventListener("click", e => {
            if (e.target === modal) modal.style.display = "none";
        });
    });
});

document.addEventListener("click", function(e) {
  const panel = document.getElementById("panelVisitas");

  if (!panel || panel.classList.contains("hidden")) return;

  if (!panel.contains(e.target) && !e.target.closest("button[onclick*='mostrarPanelVisitas']")) {
    panel.classList.add("hidden");
  }
});


