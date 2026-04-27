// modules/historial-compras.js
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { UI } from '../components/ui.js';

export const HistorialComprasManager = {
  async mostrarPanel() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'modalHistorialCompras';
    modal.innerHTML = `
      <div class="modal-content modal-xl">
        <button class="modal-close" onclick="UI.modal('modalHistorialCompras','close')">✕</button>
        <h2>📦 Historial de Compras a Proveedores</h2>
        <div id="historialContent" class="historial-list">
          <div class="loading-state">🔄 Cargando...</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    await this.cargarHistorial();
  },

  async cargarHistorial() {
    const container = document.getElementById('historialContent');
    try {
      const snap = await getDocs(collection(DB.db, "compras_proveedores"));
      const compras = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      if (compras.length === 0) {
        container.innerHTML = '<p class="no-data">Sin compras registradas</p>';
        return;
      }

      container.innerHTML = compras.map(c => `
        <div class="compra-card">
          <div class="compra-header">
            <strong>📅 ${new Date(c.fecha).toLocaleDateString()}</strong>
            <span class="badge ${c.estado === 'recibida' ? 'badge-success' : 'badge-warning'}">${c.estado || 'pendiente'}</span>
          </div>
          <div class="compra-body">
            <p><strong>Proveedor:</strong> ${c.proveedorNombre || 'N/A'}</p>
            <p><strong>Total:</strong> ₡${(c.total || 0).toLocaleString()}</p>
            <p><strong>Productos:</strong> ${c.items?.length || 0}</p>
          </div>
          <div class="compra-actions">
            <button onclick="HistorialComprasManager.verDetalle('${c.id}')">👁️ Ver Detalle</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error(e);
      container.innerHTML = '<p style="color:red">❌ Error al cargar</p>';
    }
  },

  async verDetalle(compraId) {
    UI.toast('Función en desarrollo', 'info');
  }
};

export default HistorialComprasManager;