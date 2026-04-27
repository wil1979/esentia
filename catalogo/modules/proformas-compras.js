// modules/proformas-compras.js
import { collection, addDoc, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { Store } from './core.js';
import { UI } from '../components/ui.js';

export const ProformasManager = {
  proveedores: [],

  async init() {
    console.log('📋 Cargando proveedores para proformas...');
    try {
      const snap = await getDocs(collection(DB.db, "proveedores"));
      
      // ✅ Función que limpia campos con comillas escapadas o formato extraño
      const clean = (val) => {
        if (typeof val === 'string') {
          return val.replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim();
        }
        return val;
      };

      this.proveedores = snap.docs.map(docSnap => {
        const raw = docSnap.data();
        
        // Buscar nombre en cualquier variante de clave
        const nombre = clean(
          raw.nombre || raw.Nombre || raw.NOMBRE || 
          raw['nombre '] || raw[' Nombre'] || 
          Object.values(raw).find(v => typeof v === 'string' && v.includes('Almacen')) ||
          docSnap.id
        );

        return {
          id: docSnap.id,
          nombre: nombre || 'Proveedor sin nombre',
          telefono: clean(raw.telefono || raw.Telefono || raw['telefono '] || ''),
          sitioWeb: clean(raw.sitioWeb || raw.SitioWeb || ''),
          notas: clean(raw.notas || raw.Notas || ''),
          ...Object.keys(raw).reduce((acc, key) => {
            const cleanKey = key.trim();
            acc[cleanKey] = clean(raw[key]);
            return acc;
          }, {})
        };
      }).filter(p => p.nombre && p.nombre !== 'Proveedor sin nombre');

      console.log(`✅ ${this.proveedores.length} proveedores cargados.`, 
        this.proveedores.map(p => p.nombre));
    } catch (e) {
      console.error('❌ Error cargando proveedores:', e);
      this.proveedores = [];
    }
  },

  async mostrarPanel() {
    if (!Store.get('isAdmin')) { UI.toast('Acceso denegado', 'warning'); return; }
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'modalProformas';
    modal.innerHTML = `
      <div class="modal-content modal-xl proformas-modal">
        <button class="modal-close" onclick="UI.modal('modalProformas','close')">✕</button>
        <h2>📄 Proformas de Compra (Reabastecimiento)</h2>
        <button class="btn-primary" onclick="ProformasManager.crearNueva()">➕ Nueva Proforma</button>
        <div id="listaProformas" class="proformas-list">
          <div class="loading-state">Cargando historial...</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this.renderLista();
  },

  async renderLista() {
    const container = document.getElementById('listaProformas');
    try {
      const snap = await getDocs(collection(DB.db, "proformas"));
      const proformas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      if (proformas.length === 0) {
        container.innerHTML = '<p class="no-data">No hay proformas registradas</p>';
        return;
      }

      container.innerHTML = proformas.map(p => `
        <div class="proforma-card ${p.estado}">
          <div class="pf-header">
            <span><strong>🏢 ${p.proveedorNombre || 'Sin nombre'}</strong></span>
            <span class="badge ${this._getEstadoClass(p.estado)}">${(p.estado||'PENDIENTE').toUpperCase()}</span>
          </div>
          <div class="pf-body">
            <small>📅 ${new Date(p.fecha).toLocaleDateString()}</small>
            <small>📦 ${p.items?.length || 0} productos</small>
            <small>💰 ₡${(p.totalEstimado||0).toLocaleString()}</small>
          </div>
          <div class="pf-actions">
            ${p.estado === 'pendiente' ? `<button onclick="ProformasManager.enviar('${p.id}')">📤 Enviar</button>` : ''}
            ${p.estado === 'enviada' ? `<button onclick="ProformasManager.marcar('${p.id}','aprobada')">✅ Aprobada</button>
                                        <button onclick="ProformasManager.marcar('${p.id}','rechazada')">❌ Rechazada</button>` : ''}
            ${p.estado === 'aprobada' ? `<button onclick="ProformasManager.recibir('${p.id}')">📥 Recibir Stock</button>` : ''}
            <button onclick="ProformasManager.exportar('${p.id}')">📋 Copiar</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = '<p style="color:red">❌ Error al cargar</p>';
    }
  },

  _getEstadoClass(estado) {
    const map = { pendiente:'bg-yellow', enviada:'bg-blue', aprobada:'bg-green', rechazada:'bg-red', recibida:'bg-gray' };
    return map[estado] || 'bg-gray';
  },

  async crearNueva() {
    // ✅ LÓGICA MEJORADA: Si hay proveedores muestra select, si no, muestra input manual
    let proveedorHTML = '';
    if (this.proveedores.length > 0) {
      const opciones = this.proveedores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
      proveedorHTML = `
        <label>Seleccionar Proveedor:</label>
        <select id="pfProveedor">${opciones}</select>
        <p style="font-size:0.8rem; color:#888; margin:5px 0;">O escribe uno nuevo abajo si no está en la lista:</p>
        <input type="text" id="pfProveedorManual" placeholder="Nombre del proveedor manual...">
      `;
    } else {
      proveedorHTML = `
        <label>Proveedor (No se cargó lista de DB):</label>
        <input type="text" id="pfProveedorManual" placeholder="Escribe aquí el nombre del proveedor..." required>
      `;
    }

    // Productos desde el Store local (JSONs)
    const todosProductos = Store.get('productos') || [];
    const prodOptions = todosProductos.filter(p => p.activo !== false)
      .map(p => `<option value="${p.id}" data-precio="${p.precio}">${p.nombre} (₡${p.precio})</option>`).join('');

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'modalNuevaProforma';
    modal.innerHTML = `
      <div class="modal-content modal-grande">
        <button class="modal-close" onclick="UI.modal('modalNuevaProforma','close')">✕</button>
        <h2>📝 Nueva Proforma de Compra</h2>
        
        <div style="margin-bottom:15px;">
          ${proveedorHTML}
        </div>

        <label>Productos (Inventario Local):</label>
        <div class="pf-item-row" style="display:grid; grid-template-columns: 2fr 1fr 1fr 40px; gap:5px; margin-bottom:5px; font-weight:bold; font-size:0.8rem;">
          <span>Producto</span><span>Cant.</span><span>Precio</span><span></span>
        </div>
        
        <div id="pfItems" class="pf-items-container">
          <div class="pf-item-row" style="display:grid; grid-template-columns: 2fr 1fr 1fr 40px; gap:5px;">
            <select class="pf-prod-select" onchange="ProformasManager.actualizarPrecio(this)">${prodOptions}</select>
            <input type="number" class="pf-cant" value="10" min="1">
            <input type="number" class="pf-precio" value="0">
            <button class="btn-remove" onclick="this.parentElement.remove()">❌</button>
          </div>
        </div>

        <button class="btn-secondary" style="margin-top:5px; width:100%" onclick="ProformasManager.agregarFila()">➕ Agregar otro producto</button>
        
        <textarea id="pfNotas" placeholder="Notas: Ej. Entregar antes del lunes..." style="width:100%; margin-top:10px; height:60px; padding:8px;"></textarea>
        
        <button class="btn-primary" style="margin-top:10px; width:100%" onclick="ProformasManager.guardarProforma()">💾 Guardar Proforma</button>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Inicializar precio del primer producto
    setTimeout(() => {
      const select = document.querySelector('.pf-prod-select');
      if (select) this.actualizarPrecio(select);
    }, 100);
  },

  actualizarPrecio(selectElement) {
    const row = selectElement.closest('.pf-item-row');
    const precioInput = row.querySelector('.pf-precio');
    const precio = selectElement.options[selectElement.selectedIndex]?.getAttribute('data-precio');
    if (precio) precioInput.value = precio;
  },

  agregarFila() {
    const container = document.getElementById('pfItems');
    const todosProductos = Store.get('productos') || [];
    const prodOptions = todosProductos.filter(p => p.activo !== false)
      .map(p => `<option value="${p.id}" data-precio="${p.precio}">${p.nombre} (₡${p.precio})</option>`).join('');
    
    const row = document.createElement('div');
    row.style = "display:grid; grid-template-columns: 2fr 1fr 1fr 40px; gap:5px; margin-bottom:5px;";
    row.innerHTML = `
      <select class="pf-prod-select" onchange="ProformasManager.actualizarPrecio(this)">${prodOptions}</select>
      <input type="number" class="pf-cant" value="10" min="1">
      <input type="number" class="pf-precio" value="0">
      <button onclick="this.parentElement.remove()">❌</button>
    `;
    container.appendChild(row);
  },

  async guardarProforma() {
    const manualInput = document.getElementById('pfProveedorManual');
    const selectInput = document.getElementById('pfProveedor');
    const proveedorNombre = (manualInput?.value?.trim()) || (selectInput?.value) || 'Proveedor Desconocido';

    if (proveedorNombre === 'Proveedor Desconocido') return UI.toast('⚠️ Debes escribir o seleccionar un proveedor', 'warning');

    const notas = document.getElementById('pfNotas').value.trim();
    const items = [];
    let total = 0;

    document.querySelectorAll('.pf-item-row').forEach(row => {
      const select = row.querySelector('.pf-prod-select');
      const cant = parseInt(row.querySelector('.pf-cant').value) || 0;
      const precio = parseInt(row.querySelector('.pf-precio').value) || 0;
      
      if (select && cant > 0 && precio > 0) {
        const prodNombre = select.options[select.selectedIndex]?.text.split(' (')[0];
        items.push({ producto: prodNombre, cantidad: cant, precioSugerido: precio, subtotal: cant * precio });
        total += cant * precio;
      }
    });

    if (items.length === 0) return UI.toast('⚠️ Agrega al menos un producto con cantidad y precio', 'warning');

    try {
      await addDoc(collection(DB.db, "proformas"), {
        proveedorNombre,
        fecha: new Date().toISOString(),
        items, totalEstimado: total, estado: 'pendiente', notas,
        creadoPor: Store.get('cliente')?.nombre || 'admin'
      });
      UI.toast('✅ Proforma guardada', 'success');
      UI.modal('modalNuevaProforma', 'close');
      this.renderLista();
    } catch (e) {
      console.error(e);
      UI.toast('❌ Error al guardar', 'error');
    }
  },

  async enviar(id) { await updateDoc(doc(DB.db, "proformas", id), { estado: 'enviada' }); this.renderLista(); },
  async marcar(id, estado) { await updateDoc(doc(DB.db, "proformas", id), { estado }); this.renderLista(); },

  async recibir(id) {
    if (!confirm('¿Confirmar recepción y actualizar stock?')) return;
    try {
      const snap = await getDoc(doc(DB.db, "proformas", id));
      const data = snap.data();
      const inventario = Store.get('inventario') || {};

      for (const item of data.items) {
        const productoStore = Store.get('productos')?.find(p => p.nombre === item.producto);
        const nombreLimpio = productoStore ? Utils.normalizeText(productoStore.nombre) : Utils.normalizeText(item.producto);
        inventario[nombreLimpio] = (inventario[nombreLimpio] || 0) + item.cantidad;
      }

      await updateDoc(doc(DB.db, "proformas", id), { estado: 'recibida', recibidoEn: new Date().toISOString() });
      Store.set('inventario', inventario);
      Store.persist('inventario');
      Store.emit('inventory:updated');
      UI.toast('📥 Stock actualizado', 'success');
      this.renderLista();
    } catch (e) {
      console.error(e);
      UI.toast('❌ Error al recibir', 'error');
    }
  },

  async exportar(id) {
    const snap = await getDoc(doc(DB.db, "proformas", id));
    const p = snap.data();
    let texto = `📄 *SOLICITUD PROFORMA*\n🏢 Para: ${p.proveedorNombre}\n\n*Productos:*\n`;
    p.items.forEach(i => { texto += `• ${i.producto} x${i.cantidad}\n`; });
    texto += `\nTotal Ref: ₡${p.totalEstimado.toLocaleString()}`;
    await navigator.clipboard.writeText(texto);
    UI.toast('📋 Copiado al portapapeles', 'success');
  }
};

export default ProformasManager;