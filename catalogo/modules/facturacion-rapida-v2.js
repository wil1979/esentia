// modules/facturacion-rapida-v2.js
import { collection, addDoc, getDocs, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { Store, Utils } from './core.js';
import { UI } from '../components/ui.js';

export const FacturacionRapidaV2 = {
  productosCache: [],
  clienteTemporal: null,
  carritoFactura: [],

  async init() {
    console.log('🧾 Facturación Rápida v2.0 - Iniciando...');
    // No cargamos nada aquí, esperamos a que products.js llene el Store
  },

  // ✅ LECTURA DIRECTA DEL STORE GLOBAL (Unificado con products.js)
  prepararProductos() {
    const productosGlobales = Store.get('productos') || [];
    this.productosCache = productosGlobales;
    console.log(`🧾 Facturación lista con ${this.productosCache.length} productos globales.`);
    
    // Actualizar contador visual si existe
    const contadorEl = document.getElementById('contadorProductos');
    if (contadorEl) contadorEl.textContent = this.productosCache.length;
  },

  async mostrarPanel() {
    if (!Store.get('isAdmin')) { UI.toast('Acceso denegado', 'warning'); return; }
    
    // 1. Cargar productos del Store global (unificados)
    this.prepararProductos();

    // 2. Importar carrito personal si existe
    this.carritoFactura = [];
    const personalCart = Store.get('carrito') || [];
    if (personalCart.length > 0) {
      const quiere = confirm(`🛒 Tienes ${personalCart.length} productos en tu carrito personal.\n¿Deseas pasarlos a esta factura?`);
      if (quiere) {
        this.carritoFactura = personalCart.map(i => ({
          id: i.id || `temp_${Date.now()}`,
          nombre: i.nombre || 'Producto',
          variante: typeof i.variante === 'object' ? i.variante.nombre : (i.variante || 'Única'),
          precio: Number(i.precio) || 0,
          cantidad: Number(i.cantidad) || 1,
          subtotal: (Number(i.precio) || 0) * (Number(i.cantidad) || 1),
          tipo: i.tipo || 'General',
          categoria: i.categoria || 'General'
        }));
        UI.toast('📦 Productos importados', 'info');
      }
    }

    // 3. Renderizar Modal con NUEVOS elementos (Recargar + Método Pago)
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'modalFacturacionRapida';
    modal.innerHTML = `
      <div class="modal-content modal-xl facturacion-modal">
        <button class="modal-close" onclick="UI.modal('modalFacturacionRapida','close')">✕</button>
        <h2>🧾 Facturación Rápida v2.0</h2>
        
        <div class="facturacion-layout">
          <div class="facturacion-left">
            <div class="cliente-section">
              <h3>👤 Cliente</h3>
              <div class="cliente-search">
                <input type="text" id="frBuscarCliente" placeholder="🔍 Cédula o nombre...">
                <button id="frNuevoCliente" class="btn-secondary">➕ Nuevo</button>
              </div>
              <div id="frClienteInfo" class="cliente-info hidden"></div>
            </div>

            <div class="productos-section">
  <h3>📦 Productos (<span id="contadorProductos">0</span>)</h3>
  
  <button id="btnRecargarProductos" class="btn-secondary" style="margin: 5px 0; width: 100%; font-size: 0.85rem;">
    🔄 Recargar Catálogo
  </button>
  
  <!-- Buscador Principal -->
  <div class="fr-buscador-container">
    <input type="text" id="frBuscarProducto" placeholder="🔍 Buscar por nombre, categoría o ID..." autocomplete="off">
  </div>
  
  <!-- Filtros Compactos -->
  <div class="fr-filtros-compactos">
    <select id="frFiltroTipo">
      <option value="">Todos los tipos</option>
    </select>
    <select id="frFiltroCategoria">
      <option value="">Todas las categorías</option>
    </select>
  </div>
  
  <div id="frListaProductos" class="fr-productos-grid">
    <div class="loading-state">Cargando productos...</div>
  </div>
</div>

          <div class="facturacion-right">
            <h3>🛒 Factura Actual</h3>
            <div id="frCarrito" class="fr-carrito"><p class="empty-carrito">Sin productos agregados</p></div>
            
            <div class="fr-totales">
              <div class="fr-row"><span>Subtotal:</span><span id="frSubtotal">₡0</span></div>
              <div class="fr-row"><span>Descuento:</span><input type="number" id="frDescuento" value="0" min="0" class="fr-input"></div>
              
              <!-- ✅ SELECTOR MÉTODO DE PAGO -->
              <div class="fr-row" style="flex-direction:column; align-items:flex-start; margin-top:10px;">
                <label style="font-size:0.9rem;"><strong>Método de Pago:</strong></label>
                <select id="frMetodoPago" style="width:100%; padding:8px; border-radius:6px; border:1px solid #ddd;">
                  <option value="contado">💵 Contado</option>
                  <option value="credito">💳 Crédito (15 días)</option>
                </select>
              </div>

              <div class="fr-row total"><span>Total:</span><span id="frTotal">₡0</span></div>
            </div>

            <div class="fr-actions">
              <button id="frGuardarFactura" class="btn-primary btn-large" disabled>💾 Guardar Factura</button>
              <button id="frLimpiar" class="btn-secondary">🗑️ Limpiar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.llenarFiltros();
    this.attachEvents();
    this.renderProductos();
    this.renderCarrito(); // Renderizar si importamos carrito
  },

  attachEvents() {
    document.getElementById('frBuscarCliente')?.addEventListener('input', this.debounce(() => this.buscarCliente(), 300));
    document.getElementById('frNuevoCliente')?.addEventListener('click', () => this.nuevoCliente());
    
    document.getElementById('frBuscarProducto')?.addEventListener('input', () => this.renderProductos());
    document.getElementById('frFiltroTipo')?.addEventListener('change', () => this.renderProductos());
    document.getElementById('frFiltroCategoria')?.addEventListener('change', () => this.renderProductos());
    
    // ✅ EVENTO RECARGAR CATÁLOGO
    document.getElementById('btnRecargarProductos')?.addEventListener('click', () => {
      this.prepararProductos();
      this.llenarFiltros();
      this.renderProductos();
      UI.toast('🔄 Catálogo recargado desde Store', 'info');
    });

    document.getElementById('frDescuento')?.addEventListener('input', () => this.calcularTotales());
    document.getElementById('frLimpiar')?.addEventListener('click', () => this.limpiarFactura());
    document.getElementById('frGuardarFactura')?.addEventListener('click', () => this.guardarFactura());

    // Debug: Verificar si hay productos
   console.log('📦 Productos en caché:', this.productosCache.length);
   console.log('📋 Primer producto:', this.productosCache[0]);
  },

  llenarFiltros() {
    const tipos = [...new Set(this.productosCache.map(p => p.tipo).filter(Boolean))].sort();
    const cats = [...new Set(this.productosCache.map(p => p.categoria).filter(Boolean))].sort();
    
    const selTipo = document.getElementById('frFiltroTipo');
    const selCat = document.getElementById('frFiltroCategoria');
    
    if(selTipo) {
        selTipo.innerHTML = '<option value="">Todos</option>';
        tipos.forEach(t => selTipo.innerHTML += `<option value="${t}">${t}</option>`);
    }
    if(selCat) {
        selCat.innerHTML = '<option value="">Todas</option>';
        cats.forEach(c => selCat.innerHTML += `<option value="${c}">${c}</option>`);
    }

    // Búsqueda en tiempo real con debounce
 const buscarInput = document.getElementById('frBuscarProducto');
 if (buscarInput) {
  buscarInput.addEventListener('input', this.debounce(() => {
    this.renderProductos();
  }, 300));
  
  // Foco automático al abrir
  setTimeout(() => buscarInput.focus(), 100);
 }
  },

  async buscarCliente() {
    const query = document.getElementById('frBuscarCliente')?.value.trim();
    if (!query || query.length < 3) return;
    try {
      const snap = await getDocs(collection(DB.db, "clientesBD"));
      const clienteEncontrado = snap.docs.find(d => 
        d.id === query || (d.data().nombre && d.data().nombre.toLowerCase().includes(query.toLowerCase()))
      );
      if (clienteEncontrado) {
        this.clienteTemporal = { id: clienteEncontrado.id, ...clienteEncontrado.data() };
        this.mostrarClienteInfo();
      }
    } catch (e) { console.warn('Error buscando cliente:', e); }
  },

  nuevoCliente() {
    const cedula = prompt('Ingrese cédula del cliente:');
    if (!cedula) return;
    const nombre = prompt('Ingrese nombre del cliente:');
    if (!nombre) return;
    this.clienteTemporal = {
      id: cedula, cedula, nombre,
      telefono: prompt('Teléfono (opcional):') || '',
      email: prompt('Email (opcional):') || ''
    };
    this.mostrarClienteInfo();
  },

  mostrarClienteInfo() {
    const container = document.getElementById('frClienteInfo');
    container.classList.remove('hidden');
    container.innerHTML = `<strong>✅ ${this.clienteTemporal.nombre}</strong><br><small>${this.clienteTemporal.cedula} | 📱 ${this.clienteTemporal.telefono || 'N/A'}</small>`;
  },

renderProductos() {
  const busqueda = (document.getElementById('frBuscarProducto')?.value || '').toLowerCase().trim();
  const tipoFiltro = document.getElementById('frFiltroTipo')?.value || '';
  const catFiltro = document.getElementById('frFiltroCategoria')?.value || '';
  const container = document.getElementById('frListaProductos');

  if (this.productosCache.length === 0) {
    container.innerHTML = '<p class="fr-sin-resultados">⚠️ No hay productos cargados</p>';
    return;
  }

  // ✅ Solo mostrar productos si hay búsqueda O filtros activos
  const hayBusqueda = busqueda.length > 0;
  const hayFiltros = tipoFiltro !== '' || catFiltro !== '';

  if (!hayBusqueda && !hayFiltros) {
    // Mostrar mensaje inicial amigable
    container.innerHTML = `
      <div class="fr-buscar-inicial">
        <div class="buscar-icon">🔍</div>
        <h3>Busca productos</h3>
        <p>Escribe un nombre, categoría o usa los filtros para ver el catálogo</p>
        <div class="sugerencias">
          <small>Sugerencias:</small>
          <button onclick="document.getElementById('frBuscarProducto').value='detergente'; FacturacionRapidaV2.renderProductos()">Detergente</button>
          <button onclick="document.getElementById('frBuscarProducto').value='vela'; FacturacionRapidaV2.renderProductos()">Vela</button>
          <button onclick="document.getElementById('frBuscarProducto').value='difusor'; FacturacionRapidaV2.renderProductos()">Difusor</button>
        </div>
      </div>
    `;
    
    // Actualizar contador
    const contadorEl = document.getElementById('contadorProductos');
    if (contadorEl) {
      contadorEl.textContent = `${this.productosCache.length} disponibles`;
    }
    return;
  }

  // Filtrar productos
  let filtrados = this.productosCache.filter(p => {
    const nombre = String(p.nombre || '').toLowerCase();
    const categoria = String(p.categoria || '').toLowerCase();
    const tipo = String(p.tipo || '').toLowerCase();
    const id = String(p.id || '').toLowerCase();
    
    const coincideTexto = !busqueda || 
      nombre.includes(busqueda) || 
      categoria.includes(busqueda) ||
      id.includes(busqueda);
      
    const coincideTipo = !tipoFiltro || tipo === tipoFiltro.toLowerCase();
    const coincideCat = !catFiltro || categoria === catFiltro.toLowerCase();
    
    return coincideTexto && coincideTipo && coincideCat;
  });

  // Limitar resultados
  if (filtrados.length > 100) {
    filtrados = filtrados.slice(0, 100);
  }

  if (filtrados.length === 0) {
    container.innerHTML = `
      <div class="fr-sin-resultados">
        🔍 No se encontraron productos<br>
        <small>Intenta con otra búsqueda o filtro</small>
      </div>
    `;
    
    const contadorEl = document.getElementById('contadorProductos');
    if (contadorEl) contadorEl.textContent = '0 resultados';
    return;
  }

  // Renderizar productos compactos
  container.innerHTML = filtrados.map(p => `
    <div class="fr-producto-card" data-product-id="${p.id}">
      <div class="fr-prod-nombre" title="${p.nombre || ''}">${p.nombre || 'Producto'}</div>
      <div class="fr-prod-tipo">${p.tipo || 'General'} • ${p.categoria || 'General'}</div>
      <div class="fr-prod-precio">₡${(p.precio || 0).toLocaleString()}</div>
      ${p.stock !== undefined ? `<div class="fr-prod-stock">Stock: ${p.stock}</div>` : ''}
      ${p.variantes?.length > 1 ? `<span class="fr-prod-variantes">${p.variantes.length} opc.</span>` : ''}
    </div>
  `).join('');

  // Agregar event listeners
  container.querySelectorAll('.fr-producto-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const productId = card.dataset.productId;
      this.agregarAlCarrito(productId);
    });
  });

  // Actualizar contador
  const contadorEl = document.getElementById('contadorProductos');
  if (contadorEl) {
    contadorEl.textContent = `${filtrados.length} encontrados`;
  }
},

  agregarItem(producto, variante) {
  const cantidad = parseInt(prompt(`Cantidad para ${producto.nombre}:`, '1')) || 1;
  
  // ✅ ELIMINADA VALIDACIÓN ESTRICTA: Permitir agregar sin importar el stock
  // Solo mostramos advertencia si el stock es bajo o no existe
  const stockDisponible = producto.stock || 0;
  if (stockDisponible === 0) {
    console.warn(`⚠️ Producto ${producto.nombre} no tiene stock registrado`);
  } else if (cantidad > stockDisponible) {
    UI.toast(`⚠️ Stock bajo: ${stockDisponible} disponibles`, 'warning');
  }

  const existing = this.carritoFactura.find(i => i.id === producto.id && i.variante === variante.nombre);
  if (existing) {
    existing.cantidad += cantidad;
  } else {
    this.carritoFactura.push({
      id: producto.id, 
      nombre: producto.nombre, 
      variante: variante.nombre,
      precio: variante.precio, 
      cantidad, 
      subtotal: variante.precio * cantidad,
      categoria: producto.categoria, 
      tipo: producto.tipo
    });
  }
  
  this.renderCarrito();
},

  renderCarrito() {
    const container = document.getElementById('frCarrito');
    const btnGuardar = document.getElementById('frGuardarFactura');
    
    if (this.carritoFactura.length === 0) {
      container.innerHTML = '<p class="empty-carrito">Sin productos agregados</p>';
      if (btnGuardar) btnGuardar.disabled = true;
    } else {
      container.innerHTML = this.carritoFactura.map((item, idx) => `
        <div class="fr-carrito-item">
          <div class="fr-item-info">
            <strong>${item.nombre || 'Producto'}</strong>
            <small>${item.variante || 'Única'} × ${Number(item.cantidad)||1}</small>
          </div>
          <div class="fr-item-actions">
            <span>₡${(Number(item.subtotal) || 0).toLocaleString()}</span>
            <button onclick="FacturacionRapidaV2.eliminarDelCarrito(${idx})" class="btn-sm btn-danger">🗑️</button>
          </div>
        </div>
      `).join('');
      if (btnGuardar) btnGuardar.disabled = false;
    }
    this.calcularTotales();
  },

  eliminarDelCarrito(idx) { this.carritoFactura.splice(idx, 1); this.renderCarrito(); },

  calcularTotales() {
    const subtotal = this.carritoFactura.reduce((sum, i) => sum + i.subtotal, 0);
    const descuento = parseInt(document.getElementById('frDescuento')?.value) || 0;
    const total = Math.max(0, subtotal - descuento);
    document.getElementById('frSubtotal').textContent = `₡${subtotal.toLocaleString()}`;
    document.getElementById('frTotal').textContent = `₡${total.toLocaleString()}`;
    return { subtotal, descuento, total };
  },

  async guardarFactura() {
    if (!this.clienteTemporal) return UI.toast('⚠️ Debe seleccionar un cliente', 'warning');
    if (this.carritoFactura.length === 0) return UI.toast('❌ No hay productos', 'warning');

    const { subtotal, descuento, total } = this.calcularTotales();
    
    // ✅ OBTENER MÉTODO DE PAGO
    const metodoPago = document.getElementById('frMetodoPago')?.value || 'contado';
    const estadoFactura = metodoPago === 'credito' ? 'pendiente' : 'completado';
    
    // Accesos seguros
    const nombreCliente = this.clienteTemporal.nombre || 'Cliente';
    const idCliente = this.clienteTemporal.id || this.clienteTemporal.cedula || 'temp';
    const telefonoCliente = this.clienteTemporal.telefono || '';

    const facturaData = {
      fecha: new Date().toISOString(),
      clienteId: idCliente,
      clienteNombre: nombreCliente,
      clienteTelefono: telefonoCliente,
      productos: this.carritoFactura,
      subtotal, descuento, total,
      estado: estadoFactura,
      metodoPago, // ✅ GUARDAMOS EL MÉTODO
      tipoFactura: 'rapida', 
      creadaPor: Store.get('cliente')?.nombre || 'admin',
      // Si es crédito, fecha de vencimiento estimada (15 días)
      fechaVencimiento: metodoPago === 'credito' ? new Date(Date.now() + 15*24*60*60*1000).toISOString() : null
    };

    try {
      // ✅ GUARDAR EN COLECCIÓN SEPARADA
      await addDoc(collection(DB.db, "facturas_rapidas"), facturaData);
      
      // ✅ ACTUALIZAR STOCK LOCAL
      for (const item of this.carritoFactura) {
        const prod = this.productosCache.find(p => p.id === item.id);
        if (prod) prod.stock -= item.cantidad;
      }
      
      // ✅ SI ES CRÉDITO, ACTUALIZAR SALDO DEL CLIENTE
      if (metodoPago === 'credito') {
        await this.actualizarSaldoCliente(idCliente, total);
      }
      
      UI.toast(`✅ Factura guardada (${metodoPago.toUpperCase()})`, 'success');
      
      if (telefonoCliente && confirm('¿Enviar factura por WhatsApp?')) {
        this.enviarWhatsApp({ ...facturaData, telefono: telefonoCliente });
      }
      
      this.limpiarFactura();
    } catch (e) {
      console.error(e);
      UI.toast('❌ Error al guardar', 'error');
    }
  },

  // ✅ NUEVA FUNCIÓN: Actualizar saldo pendiente del cliente
  async actualizarSaldoCliente(clienteId, monto) {
    try {
      const clienteRef = doc(DB.db, "clientesBD", clienteId);
      const clienteSnap = await getDoc(clienteRef);
      
      let saldoActual = 0;
      if (clienteSnap.exists()) {
        saldoActual = clienteSnap.data().saldoPendiente || 0;
      }
      
      await updateDoc(clienteRef, {
        saldoPendiente: saldoActual + monto,
        ultimoCredito: new Date().toISOString()
      });
      console.log(`💳 Saldo de ${clienteId} actualizado: ₡${(saldoActual + monto).toLocaleString()}`);
    } catch (e) {
      console.warn('No se pudo actualizar saldo del cliente:', e);
    }
  },

  enviarWhatsApp(factura) {
    const telefono = factura.telefono?.replace(/\D/g, '') || '';
    if (!telefono || telefono.length < 8) {
        UI.toast('⚠️ No hay teléfono válido para enviar', 'warning');
        return;
    }
    const cleanPhone = telefono.length === 8 ? '506' + telefono : telefono;

    let mensaje = `🧾 *FACTURA ESENTIA*\n👤 ${factura.clienteNombre}\n📅 ${new Date(factura.fecha).toLocaleDateString()}\n\n*Productos:*\n`;
    factura.productos.forEach(p => { mensaje += `• ${p.nombre} (${p.variante}) x${p.cantidad} - ₡${p.subtotal.toLocaleString()}\n`; });
    mensaje += `\n💰 *Total: ₡${factura.total.toLocaleString()}*\n`;
    mensaje += `💳 Método: ${factura.metodoPago?.toUpperCase() || 'CONTADO'}\n\n¡Gracias! 🌸`;
    
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensaje)}`, '_blank');
  },

  limpiarFactura() {
    this.carritoFactura = [];
    this.clienteTemporal = null;
    document.getElementById('frBuscarCliente').value = '';
    document.getElementById('frClienteInfo').classList.add('hidden');
    document.getElementById('frDescuento').value = 0;
    document.getElementById('frMetodoPago').value = 'contado'; // Resetear a contado
    this.renderCarrito();
  },

  debounce(fn, ms) {
    let timeout;
    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), ms); };
  }
};

export default FacturacionRapidaV2;