// modules/factura-editor.js
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { UI } from '../components/ui.js';

export const FacturaEditor = {
  async abrirEditor() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'modalFacturaEditor';
    modal.innerHTML = `
      <div class="modal-content modal-xl">
        <button class="modal-close" onclick="UI.modal('modalFacturaEditor','close')">✕</button>
        <h2>📝 Editor de Facturas</h2>
        <input type="text" id="buscarFactura" placeholder="🔍 Buscar por ID o cliente..." style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px;">
        <div id="facturasLista" class="facturas-lista">
          <div class="loading-state">🔄 Cargando facturas...</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    await this.cargarFacturas();
    
    document.getElementById('buscarFactura').addEventListener('input', (e) => this.filtrarFacturas(e.target.value));
  },

  async cargarFacturas() {
    const container = document.getElementById('facturasLista');
    try {
      const snap = await getDocs(collection(DB.db, "facturas_rapidas"));
      const facturas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      this._facturasCache = facturas;
      this.renderFacturas(facturas);
    } catch (e) {
      console.error(e);
      container.innerHTML = '<p style="color:red">❌ Error al cargar</p>';
    }
  },

  renderFacturas(facturas) {
    const container = document.getElementById('facturasLista');
    
    if (facturas.length === 0) {
      container.innerHTML = '<p class="no-data">No se encontraron facturas</p>';
      return;
    }

    container.innerHTML = facturas.map(f => `
      <div class="factura-item" data-id="${f.id}">
        <div class="factura-header" onclick="FacturaEditor.toggleDetalle('${f.id}')">
          <div class="factura-info">
            <strong>📄 ${f.id.slice(-8)}</strong>
            <span>${f.clienteNombre}</span>
            <small>${new Date(f.fecha).toLocaleDateString()}</small>
          </div>
          <div class="factura-actions">
            <span class="badge ${f.estado === 'completado' ? 'badge-success' : 'badge-warning'}">${f.estado}</span>
            <span>₡${f.total.toLocaleString()}</span>
            <button class="btn-edit" onclick="event.stopPropagation(); FacturaEditor.editar('${f.id}')">✏️</button>
          </div>
        </div>
        <div class="factura-detalle" id="detalle-${f.id}" style="display: none;">
          <div class="productos-mini">
            <strong>Productos (${f.productos?.length || 0}):</strong>
            <ul>
              ${(f.productos || []).map(p => `
                <li>${p.cantidad}x ${p.nombre} (${p.variante}) - ₡${p.subtotal.toLocaleString()}</li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
    `).join('');
  },

  toggleDetalle(facturaId) {
    const detalle = document.getElementById(`detalle-${facturaId}`);
    detalle.style.display = detalle.style.display === 'none' ? 'block' : 'none';
  },

  filtrarFacturas(query) {
    if (!query.trim()) {
      this.renderFacturas(this._facturasCache);
      return;
    }
    
    const filtradas = this._facturasCache.filter(f => 
      f.id.includes(query) || 
      f.clienteNombre?.toLowerCase().includes(query.toLowerCase())
    );
    this.renderFacturas(filtradas);
  },

  async editar(facturaId) {
    UI.toast('Función de edición en desarrollo', 'info');
  }
};

export default FacturaEditor;