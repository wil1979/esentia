// modules/loyalty-control.js
import { getDocs, collection, getDoc, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { Store } from './core.js';
import { UI } from '../components/ui.js';

export const LoyaltyControl = {
  _clientesCache: [],
  _selectedClientId: null,

  async mostrarPanelPuntos() {
    const modal = document.createElement('div');
    modal.className = 'modal show'; modal.id = 'modalLoyaltyAdmin';
    modal.innerHTML = `
      <div class="modal-content modal-grande">
        <button class="modal-close" onclick="UI.modal('modalLoyaltyAdmin','close')">✕</button>
        <h2>🏆 Control de Puntos de Lealtad</h2>
        <div class="loyalty-search">
          <input type="text" id="loyaltySearch" placeholder="🔍 Buscar por nombre, cédula o teléfono...">
          <div id="loyaltyResults" class="search-dropdown"></div>
        </div>
        <div id="loyaltyClientPanel" style="display:none; margin-top:1.5rem;">
          <h3 id="loyaltyClientName">-</h3>
          <div class="loyalty-stats">
            <div class="stat-box"><strong id="loyaltyCurrentPoints">0</strong><small>Puntos Actuales</small></div>
            <div class="stat-box"><strong id="loyaltyTotalEarned">0</strong><small>Acumulados</small></div>
          </div>
          <div class="loyalty-adjust">
            <input type="number" id="adjustAmount" placeholder="Cantidad (+/-)">
            <input type="text" id="adjustReason" placeholder="Motivo (ej: Corrección, Bono)">
            <button id="btnApplyAdjust" class="btn-primary">✅ Aplicar Ajuste</button>
          </div>
          <h4>📜 Historial</h4>
          <div id="loyaltyHistory" class="history-list"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // ✅ Carga inicial asíncrona
    await this.cargarClientesCache();
    this.attachLoyaltyEvents();
  },

  async cargarClientesCache() {
    try {
      const snap = await getDocs(collection(DB.db, "clientesBD"));
      this._clientesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('⚠️ Error cargando clientes para lealtad:', e);
      this._clientesCache = [];
    }
  },

  attachLoyaltyEvents() {
    const input = document.getElementById('loyaltySearch');
    const results = document.getElementById('loyaltyResults');
    let timeout;

    // ✅ Búsqueda con debounce
    input.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => this.filtrarClientes(e.target.value), 300);
    });

    // ✅ Listener único para selección (evita duplicados)
    results.addEventListener('click', (e) => {
      const item = e.target.closest('.search-item');
      if (!item) return;
      this.cargarPanelCliente(item.dataset.id, item.dataset.nombre);
      results.innerHTML = '';
      input.value = item.dataset.nombre;
    });

    document.getElementById('btnApplyAdjust').onclick = () => this.aplicarAjuste();
  },

  filtrarClientes(query) {
    const results = document.getElementById('loyaltyResults');
    if (!query || query.length < 2) { results.innerHTML = ''; return; }
    
    const q = query.toLowerCase().trim();
    const matches = this._clientesCache.filter(c => 
      c.nombre?.toLowerCase().includes(q) ||
      c.cedula?.toLowerCase().includes(q) ||
      c.telefono?.includes(q)
    ).slice(0, 10);

    if (matches.length === 0) {
      results.innerHTML = '<div class="no-result">No se encontraron clientes</div>';
    } else {
      results.innerHTML = matches.map(c => `
        <div class="search-item" data-id="${c.id}" data-nombre="${c.nombre}">
          <strong>${c.nombre}</strong>
          <small>CC: ${c.cedula || 'N/A'} | 📱 ${c.telefono || 'N/A'}</small>
        </div>
      `).join('');
    }
  },

    async cargarPanelCliente(clienteId, nombre) {
    this._selectedClientId = clienteId;
    document.getElementById('loyaltyClientPanel').style.display = 'block';
    document.getElementById('loyaltyClientName').textContent = nombre || clienteId;

    try {
      // 🔍 CORRECCIÓN: Leer desde 'facturas' donde se guarda el historial real
      const snap = await getDoc(doc(DB.db, "facturas", clienteId));
      
      // Si no existe en facturas, intentamos en clientesBD (por si acaso)
      let data = snap.exists() ? snap.data() : {};
      if (!snap.exists()) {
          const snapClient = await getDoc(doc(DB.db, "clientesBD", clienteId));
          if (snapClient.exists()) data = snapClient.data();
      }

      // --- CÁLCULO REAL DE PUNTOS ---
      // 1. Buscar si ya tenemos puntos manuales guardados (de ajustes anteriores)
      const puntosManuales = data.puntosLealtad || 0;
      
      // 2. Calcular puntos por compras (1 punto por cada 4000)
      const compras = data.compras || [];
      const totalGastado = compras.reduce((acc, c) => {
        if (c.estado !== 'anulado') return acc + (Number(c.total) || 0);
        return acc;
      }, 0);

      const puntosPorCompras = Math.floor(totalGastado / 4000);
      
      // 3. Total combinado (Manuales + Automáticos)
      const puntosTotales = puntosManuales + puntosPorCompras;
      
      // Historial de ajustes manuales (si existe)
      const historial = data.historialPuntos || [];

      // 🖥️ Actualizar UI
      document.getElementById('loyaltyCurrentPoints').textContent = puntosTotales;
      document.getElementById('loyaltyTotalEarned').textContent = puntosPorCompras; // Muestra los ganados por compra
      
      document.getElementById('loyaltyHistory').innerHTML = historial.length > 0
        ? historial.slice(-10).reverse().map(h => `
            <div class="hist-item ${h.cantidad >= 0 ? 'pos' : 'neg'}">
              <span>${new Date(h.fecha).toLocaleDateString() || 'Hoy'}</span>
              <span>${h.cantidad >= 0 ? '+' : ''}${h.cantidad} pts</span>
              <small>${h.motivo || 'Ajuste'}</small>
            </div>
          `).join('')
        : '<p class="no-data">Sin ajustes manuales registrados</p>';
        
    } catch(e) { 
      console.error(e); 
      document.getElementById('loyaltyHistory').innerHTML = '<p class="no-data">Error al cargar datos</p>';
    }
  },

  async aplicarAjuste() {
    if (!this._selectedClientId) return UI.toast('Selecciona un cliente primero', 'warning');
    
    const monto = parseInt(document.getElementById('adjustAmount').value) || 0;
    const motivo = document.getElementById('adjustReason').value || 'Ajuste manual';
    if (monto === 0) return UI.toast('Ingresa una cantidad válida', 'warning');

    try {
      const ref = doc(DB.db, "clientesBD", this._selectedClientId);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : { puntosLealtad: 0, historialPuntos: [] };
      
      const puntosActuales = data.puntosLealtad || 0;
      const nuevosPuntos = Math.max(0, puntosActuales + monto);

      await updateDoc(ref, {
        puntosLealtad: nuevosPuntos,
        historialPuntos: arrayUnion({
          cantidad: monto,
          fecha: new Date().toISOString(),
          motivo,
          autor: 'admin'
        })
      });

      UI.toast(`✅ ${monto > 0 ? 'Sumados' : 'Restados'} ${Math.abs(monto)} puntos`, 'success');
      this.cargarPanelCliente(this._selectedClientId, document.getElementById('loyaltyClientName').textContent);
    } catch(e) { 
      console.error(e); 
      UI.toast('❌ Error al ajustar puntos', 'error'); 
    }
  }
};