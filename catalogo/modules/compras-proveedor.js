// modules/compras-proveedor.js
import { getDocs, collection, addDoc, doc, updateDoc, setDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { Store, Utils } from './core.js';
import { UI } from '../components/ui.js';

export const ComprasManager = {
  carritoCompra: [],
  proveedorSeleccionado: null,
  proveedoresCache: [],

  async init() {
    console.log('📦 Módulo Compras a Proveedores cargado');
    await this.cargarProveedores();
  },

    // ==========================================
  // 🏢 GESTIÓN DE PROVEEDORES (CORREGIDO)
  // ==========================================
  async mostrarGestionProveedores() {
    // 1. Crear modal con estado de carga inicial
    const modal = document.createElement('div');
    modal.className = 'modal show'; modal.id = 'modalProveedores';
    modal.innerHTML = `
      <div class="modal-content modal-grande">
        <button class="modal-close" onclick="UI.modal('modalProveedores','close')">✕</button>
        <h2>🏢 Gestión de Proveedores</h2>
        <div class="proveedores-toolbar">
          <button id="btnNuevoProveedor" class="btn-primary">➕ Nuevo Proveedor</button>
          <input type="text" id="buscarProveedor" placeholder="🔍 Buscar proveedor...">
        </div>
        <div id="listaProveedores" class="proveedores-grid">
           <p style="text-align:center; padding: 2rem;">🔄 Cargando proveedores...</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // 2. ✅ ESPERAR carga real antes de pintar
    await this.cargarProveedores();
    this.renderListaProveedores();

    // 3. Listeners
    document.getElementById('btnNuevoProveedor').onclick = () => this.formularioProveedor();
    document.getElementById('buscarProveedor').oninput = (e) => this.renderListaProveedores(e.target.value);
  },

  async cargarProveedores() {
    try {
      const snap = await getDocs(collection(DB.db, "proveedores"));
      this.proveedoresCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { 
      console.warn('⚠️ Error cargando proveedores:', e); 
      this.proveedoresCache = []; 
    }
  },

  renderListaProveedores(filtro = '') {
    const container = document.getElementById('listaProveedores');
    if (!container) return;
    
    // Filtrado seguro
    const filtrados = filtro 
      ? this.proveedoresCache.filter(p => p.nombre?.toLowerCase().includes(filtro.toLowerCase())) 
      : this.proveedoresCache;
    
    if (!filtrados?.length) {
      container.innerHTML = '<p class="no-data">No hay proveedores registrados</p>';
      return;
    }

    // ✅ Mostrar 'notas' en lugar de 'contacto' (según tu schema real)
    container.innerHTML = filtrados.map(p => `
      <div class="proveedor-card">
        <h3>${p.nombre || 'Sin nombre'}</h3>
        <p>📞 ${p.telefono || 'N/A'} | 📝 ${p.notas || p.direccion || 'Sin notas'}</p>
        <div class="proveedor-actions">
          <button onclick="ComprasManager.seleccionarProveedor('${p.id}', '${(p.nombre||'').replace(/'/g, "\\'")}')">🛒 Registrar Compra</button>
          <button onclick="ComprasManager.formularioProveedor('${p.id}')">✏️</button>
        </div>
      </div>`).join('');
  },

  async formularioProveedor(id = null) {
    const p = id ? this.proveedoresCache.find(x => x.id === id) : {};
    const modal = document.createElement('div');
    modal.className = 'modal show'; modal.id = 'modalFormProveedor';
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" onclick="UI.modal('modalFormProveedor','close')">✕</button>
        <h2>${id ? '✏️ Editar' : '➕ Nuevo'} Proveedor</h2>
        <form id="formProveedor">
          <input type="text" id="provNombre" placeholder="Nombre comercial" value="${p.nombre || ''}" required>
          <input type="text" id="provContacto" placeholder="Persona de contacto" value="${p.contacto || ''}">
          <input type="tel" id="provTelefono" placeholder="Teléfono" value="${p.telefono || ''}" required>
          <input type="text" id="provDireccion" placeholder="Dirección" value="${p.direccion || ''}">
          <button type="submit" class="btn-submit">${id ? 'Actualizar' : 'Guardar'}</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('formProveedor').onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        nombre: document.getElementById('provNombre').value.trim(),
        contacto: document.getElementById('provContacto').value.trim(),
        telefono: document.getElementById('provTelefono').value.trim(),
        direccion: document.getElementById('provDireccion').value.trim(),
        activo: true,
        fechaActualizacion: serverTimestamp()
      };
      if (!p.fechaCreacion) data.fechaCreacion = serverTimestamp();
      
      try {
        if (id) await updateDoc(doc(DB.db, "proveedores", id), data);
        else await addDoc(collection(DB.db, "proveedores"), data);
        UI.toast('✅ Proveedor guardado', 'success');
        UI.modal('modalFormProveedor', 'close');
        await this.cargarProveedores();
        this.renderListaProveedores();
      } catch (err) { UI.toast('❌ Error al guardar', 'error'); }
    };
  },

  seleccionarProveedor(id, nombre) {
    this.proveedorSeleccionado = { id, nombre };
    this.carritoCompra = [];
    UI.modal('modalProveedores', 'close');
    this.abrirModalCompra();
  },

  // ==========================================
  // 🛒 REGISTRO DE COMPRA
  // ==========================================
    async abrirModalCompra() {  // 👈 AGREGAR 'async' AQUÍ
    const productos = Store.get('productos') || [];
    this._productosCache = productos;

    await this.cargarHistorialFrecuente();

    const modal = document.createElement('div');
    modal.className = 'modal show'; modal.id = 'modalNuevaCompra';
    modal.innerHTML = `
      <div class="modal-content modal-grande compra-modal">
        <button class="modal-close" onclick="UI.modal('modalNuevaCompra','close')">✕</button>
        <h2>🛒 Nueva Compra - ${this.proveedorSeleccionado.nombre}</h2>
        <div class="compra-header">
          <input type="date" id="fechaCompra" value="${new Date().toISOString().slice(0,10)}">
          <input type="text" id="numFactura" placeholder="🧾 N° Factura/Remisión">
        </div>
        
        <!-- ✅ Buscador inteligente con historial -->
        <div class="buscar-producto-wrapper">
          <input type="text" id="buscarProducto" placeholder="🔍 Busca por nombre, ID o código..." autocomplete="off">
          <div id="resultadosBusqueda" class="search-results-dropdown"></div>
          <input type="hidden" id="productoSeleccionadoId">
        </div>

        <div class="agregar-producto-row">
          <input type="number" id="cantidadCompra" placeholder="Cant." min="1" value="1" style="width:90px;">
          <input type="number" id="precioCompra" placeholder="Precio costo (₡)" min="0">
          <button id="btnAgregarProducto" class="btn-primary">➕ Agregar</button>
        </div>

        <div id="carritoCompraGrid" class="carrito-compra-grid"></div>
        
        <!-- ✅ Costos adicionales con desglose -->
        <div class="costos-adicionales">
          <h4>📦 Costos Adicionales a Distribuir</h4>
          <div class="costos-grid">
            <input type="number" id="costoTransporte" placeholder="Transporte/Flete (₡)" value="0" min="0">
            <input type="number" id="costoImpuestos" placeholder="Impuestos Extra (₡)" value="0" min="0">
            <input type="number" id="costoOtros" placeholder="Otros (₡)" value="0" min="0">
          </div>
          <button id="btnCalcularReales" class="btn-secondary">🔍 Calcular & Ver Desglose</button>
          <div id="desgloseProrrateo" class="desglose-box" style="display:none;"></div>
        </div>

        <div class="compra-totales">
          <span>Subtotal: <strong id="subtotalCompra">₡0</strong></span>
          <span>Total Real: <strong id="totalRealCompra">₡0</strong></span>
          <button id="btnExportarReporte" class="btn-small" onclick="ComprasManager.exportarReporteActual()">📥 Exportar CSV</button>
        </div>
        <button id="btnFinalizarCompra" class="btn-checkout">✅ Finalizar Compra & Actualizar Inventario</button>
      </div>
    `;
    document.body.appendChild(modal);

    // 🔍 LÓGICA DE BÚSQUEDA MULTI-CRITERIO
    const buscarInput = document.getElementById('buscarProducto');
    const resultadosDiv = document.getElementById('resultadosBusqueda');
    const hiddenId = document.getElementById('productoSeleccionadoId');

    buscarInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (q.length < 1) { resultadosDiv.innerHTML = ''; this.mostrarHistorialSugerencias(); return; }
      
      const matches = this._productosCache.filter(p => 
        p.nombre.toLowerCase().includes(q) || 
        String(p.id).includes(q) || 
        (p.sku || '').toLowerCase().includes(q)
      ).slice(0, 8);

      resultadosDiv.innerHTML = matches.length 
        ? matches.map(p => `<div class="search-result-item" data-id="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio}"><strong>${p.nombre}</strong><small>ID: ${p.id}</small></div>`).join('')
        : '<p class="no-result">No se encontraron productos</p>';
    });

    resultadosDiv.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (!item) return;
      hiddenId.value = item.dataset.id;
      buscarInput.value = item.dataset.nombre;
      document.getElementById('precioCompra').value = item.dataset.precio;
      resultadosDiv.innerHTML = '';
      document.getElementById('cantidadCompra').focus();
    });

    document.addEventListener('click', (e) => {
      if (!buscarInput.contains(e.target) && !resultadosDiv.contains(e.target)) {
        resultadosDiv.innerHTML = '';
        this.mostrarHistorialSugerencias();
      }
    });

    document.getElementById('btnAgregarProducto').onclick = () => this.agregarAlCarrito();
    document.getElementById('btnCalcularReales').onclick = () => this.calcularYAplicarPreciosReales();
    document.getElementById('btnFinalizarCompra').onclick = () => this.finalizarCompra();
    this.renderCarrito();

    this.mostrarHistorialSugerencias();
  },

  agregarAlCarrito() {
    const id = document.getElementById('productoSeleccionadoId').value;
    if (!id) { UI.toast('⚠️ Selecciona un producto de la lista', 'warning'); return; }
    
    const producto = this._productosCache.find(p => String(p.id) === id);
    if (!producto) { UI.toast('Producto no válido', 'error'); return; }
    
    const cantidad = parseInt(document.getElementById('cantidadCompra').value) || 1;
    const precioBase = parseInt(document.getElementById('precioCompra').value) || producto.precio;
    
    if (cantidad <= 0 || precioBase < 0) { UI.toast('Verifica cantidad y precio', 'warning'); return; }

    this.carritoCompra.push({ id: producto.id, nombre: producto.nombre, cantidad, precioBase, precioReal: precioBase });
    this.renderCarrito();
    UI.toast(`✓ ${producto.nombre} agregado`, 'success');

    // ✅ Limpiar campos para siguiente producto
    document.getElementById('productoSeleccionadoId').value = '';
    document.getElementById('buscarProducto').value = '';
    document.getElementById('precioCompra').value = '';
    document.getElementById('cantidadCompra').value = 1;
    document.getElementById('buscarProducto').focus();
  },

  quitarDelCarrito(index) { this.carritoCompra.splice(index, 1); this.renderCarrito(); },

  renderCarrito() {
    const grid = document.getElementById('carritoCompraGrid');
    if (!grid) return;
    if (!this.carritoCompra.length) { grid.innerHTML = '<p class="no-data">Agrega productos a la compra</p>'; this.actualizarTotales(); return; }
    
    grid.innerHTML = this.carritoCompra.map((item, i) => `
      <div class="carrito-item">
        <div class="item-info"><strong>${item.nombre}</strong><span>Cant: ${item.cantidad}</span></div>
        <div class="item-prices">
          <span class="precio-base">Base: ₡${item.precioBase.toLocaleString()}</span>
          <span class="precio-real">Real: ₡${item.precioReal.toLocaleString()}</span>
          <button onclick="ComprasManager.quitarDelCarrito(${i})">🗑️</button>
        </div>
      </div>`).join('');
    this.actualizarTotales();
  },

  actualizarTotales() {
    const sub = this.carritoCompra.reduce((s, i) => s + (i.precioBase * i.cantidad), 0);
    const total = this.carritoCompra.reduce((s, i) => s + (i.precioReal * i.cantidad), 0);
    const sEl = document.getElementById('subtotalCompra'); const tEl = document.getElementById('totalRealCompra');
    if (sEl) sEl.textContent = `₡${sub.toLocaleString()}`;
    if (tEl) tEl.textContent = `₡${total.toLocaleString()}`;
  },

  // ==========================================
  // 🔍 CÁLCULO DE PRECIO REAL (PRORRATEO)
  // ==========================================
     calcularYAplicarPreciosReales() {
    if (!this.carritoCompra.length) return UI.toast('Agrega productos primero', 'warning');
    
    const extra = (parseInt(document.getElementById('costoTransporte').value) || 0) + 
                  (parseInt(document.getElementById('costoImpuestos').value) || 0) + 
                  (parseInt(document.getElementById('costoOtros').value) || 0);
                  
    if (extra === 0) return UI.toast('Ingresa costos adicionales', 'info');
    
    const sumaBases = this.carritoCompra.reduce((sum, p) => sum + (p.precioBase * p.cantidad), 0);
    if (sumaBases === 0) return UI.toast('Error: suma base es 0', 'error');

    // ✅ Cálculo seguro con desglose
    const desglose = [];
    this.carritoCompra = this.carritoCompra.map(p => {
      const prop = (p.precioBase * p.cantidad) / sumaBases;
      const extraTotal = extra * prop;
      const extraUnitario = Math.round(extraTotal / p.cantidad);
      const precioReal = p.precioBase + extraUnitario;
      
      // ✅ CORREGIDO: Template literal para el porcentaje
      desglose.push({ 
        nombre: p.nombre, 
        prop: `${(prop * 100).toFixed(1)}%`,  // ✅ Ahora es string: "25.3%"
        extraTotal: Math.round(extraTotal), 
        extraUnitario 
      });
      
      return { ...p, precioReal };
    });

    this.renderCarrito();
    
    // ✅ Mostrar desglose visual
    const box = document.getElementById('desgloseProrrateo');
    if (box) {
      box.style.display = 'block';
      box.innerHTML = `
        <div class="desglose-header">📊 Distribución de ₡${extra.toLocaleString()}</div>
        ${desglose.map(d => `
          <div class="desglose-row">
            <span>${d.nombre}</span>
            <span>${d.prop} → +₡${d.extraUnitario}/u (Total: ₡${d.extraTotal.toLocaleString()})</span>
          </div>
        `).join('')}
      `;
    }
    
    UI.toast('🔍 Precios reales calculados', 'success');
  },

  // ==========================================
  // 💾 FINALIZAR & SYNC INVENTARIO
  // ==========================================
  async finalizarCompra() {
    if (!this.carritoCompra.length) return UI.toast('El carrito está vacío', 'warning');
    const btn = document.getElementById('btnFinalizarCompra');
    btn.disabled = true; btn.textContent = '💾 Procesando...';
    
    try {
      const compraDoc = {
        proveedorId: this.proveedorSeleccionado.id,
        proveedorNombre: this.proveedorSeleccionado.nombre,
        fecha: document.getElementById('fechaCompra').value,
        factura: document.getElementById('numFactura').value || 'S/N',
        productos: this.carritoCompra,
        subtotal: this.carritoCompra.reduce((s, i) => s + (i.precioBase * i.cantidad), 0),
        total: this.carritoCompra.reduce((s, i) => s + (i.precioReal * i.cantidad), 0),
        fechaCreacion: serverTimestamp(),
        estado: 'completado'
      };
      await addDoc(collection(DB.db, "comprasProveedor"), compraDoc);
      
      // Sync con colección stock
      const inv = Store.get('inventario') || {};
      for (const item of this.carritoCompra) {
        const key = Utils.normalizeText(item.nombre);
        inv[key] = (inv[key] || 0) + item.cantidad;
        await setDoc(doc(DB.db, "stock", key), {
          nombre: item.nombre,
          cantidad: inv[key],
          costoUnitario: item.precioReal,
          ultimaCompra: compraDoc.fecha,
          ultimaActualizacion: new Date().toISOString()
        }, { merge: true });
      }
      Store.set('inventario', inv);
      Store.emit('inventory:updated', inv);
      
      UI.toast('✅ Compra registrada e inventario actualizado', 'success');
      UI.modal('modalNuevaCompra', 'close');
      this.carritoCompra = []; this.proveedorSeleccionado = null;
    } catch (err) { console.error(err); UI.toast('❌ Error al procesar', 'error'); }
    finally { btn.disabled = false; btn.textContent = '✅ Finalizar Compra & Actualizar Inventario'; }
  },
      async cargarHistorialFrecuente() {
    try {
      const snap = await getDocs(collection(DB.db, "compras_proveedor"));
      const frecuencias = {};
      snap.forEach(doc => {
        const data = doc.data();
        (data.productos || []).forEach(p => {
          frecuencias[p.nombre] = (frecuencias[p.nombre] || 0) + 1;
        });
      });
      this._historialFrecuente = Object.entries(frecuencias)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nombre]) => this._productosCache?.find(p => p.nombre === nombre))
        .filter(Boolean);
    } catch (e) { 
      console.warn('⚠️ Error cargando historial:', e); 
      this._historialFrecuente = []; // ✅ Fallback seguro
    }
  },

   mostrarHistorialSugerencias() {
    const div = document.getElementById('resultadosBusqueda');
    if (!div) return;
    
    // ✅ VALIDACIÓN: Si no hay historial cargado aún, salir silenciosamente
    if (!this._historialFrecuente || this._historialFrecuente.length === 0) {
      // Opcional: mostrar mensaje sutil
      // div.innerHTML = '<p class="no-result">Busca productos por nombre o ID...</p>';
      return;
    }
    
    div.innerHTML = `<div class="historial-label">🕒 Frecuentes:</div>` + 
      this._historialFrecuente.map(p => `
        <div class="search-result-item" data-id="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio}">
          <strong>${p.nombre}</strong><small>Comprado recientemente</small>
        </div>
      `).join('');
  },

  exportarReporteActual() {
    if (!this.carritoCompra.length) return UI.toast('No hay datos para exportar', 'warning');
    const proveedor = this.proveedorSeleccionado?.nombre || 'N/A';
    const fecha = document.getElementById('fechaCompra')?.value || new Date().toISOString().slice(0,10);
    const factura = document.getElementById('numFactura')?.value || 'S/N';
    
    let csv = `Reporte de Compra - Esentia\nProveedor:,${proveedor}\nFecha:,${fecha}\nFactura:,${factura}\n\n`;
    csv += 'Producto,Cantidad,Precio Base,Precio Real,Total Real\n';
    this.carritoCompra.forEach(p => {
      csv += `"${p.nombre}",${p.cantidad},${p.precioBase},${p.precioReal},${(p.precioReal*p.cantidad).toLocaleString()}\n`;
    });
    csv += `\nTotal Compra:,,,,${this.carritoCompra.reduce((s,i)=>s+(i.precioReal*i.cantidad),0).toLocaleString()}`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `compra_${proveedor.replace(/\s+/g,'_')}_${fecha}.csv`;
    a.click();
    UI.toast('📥 Reporte descargado', 'success');
  }
};