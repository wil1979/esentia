// modules/clientes-manager.js
import { getDoc, doc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { Store } from './core.js';
import { UI } from '../components/ui.js';

export const ClientesManager = {
  _personalCache: null,

  // 🔄 Carga personal.json al iniciar
  async init() {
    try {
      const res = await fetch('./data/personal.json');
      this._personalCache = await res.json();
      console.log(`✅ personal.json cargado: ${this._personalCache.length} registros`);
    } catch (e) {
      console.warn('⚠️ personal.json no encontrado o ruta incorrecta');
      this._personalCache = [];
    }
  },

  // 🔍 Búsqueda por cédula (Hacienda API + Fallback local)
  // ✅ 1. Búsqueda optimizada: BD primero → API → JSON
async buscarPorCedula(cedula) {
  if (!cedula || cedula.length < 9) return null;
  const resDiv = document.getElementById('clientesResultados');
  resDiv.innerHTML = '<p style="color:#888">🔍 Verificando en BD y APIs...</p>';

  try {
    // 🔹 PASO 1: Verificar si ya existe en Firestore
    const snap = await getDoc(doc(DB.db, "clientesBD", cedula));
    if (snap.exists()) {
      const data = snap.data();
      resDiv.innerHTML = `<div class="result-item success">✅ Cliente registrado en BD. Listo para editar.</div>`;
      return { ...data, _origen: 'bd' }; // Bandera para UI
    }

    // 🔹 PASO 2: Si no está en BD, consultar API externa
    try {
      let res = await fetch(`https://api.identifik.io/CR/1/${cedula}`);
      if (res.ok) {
        const apiData = await res.json();
        if (apiData.nombre) {
          resDiv.innerHTML = `<div class="result-item info">ℹ️ Nuevo cliente. Datos obtenidos de API.</div>`;
          return this._normalizarDatos({ ...apiData, cedula, _origen: 'api' });
        }
      }
    } catch (e) { /* Silenciar errores de red/API */ }

    // 🔹 PASO 3: Fallback a personal.json (solo nombre/cedula)
    const local = this._personalCache?.find(p => String(p.cedula) === String(cedula));
    if (local) {
      resDiv.innerHTML = `<div class="result-item info">ℹ️ Nuevo cliente. Datos obtenidos de archivo local.</div>`;
      return { ...local, cedula, _origen: 'json' };
    }

    // 🔹 PASO 4: No encontrado en ningún lado
    resDiv.innerHTML = `<div class="result-item warn">⚠️ No encontrado. Puedes registrarlo manualmente.</div>`;
    return { cedula, _origen: 'nuevo' };

  } catch (e) {
    console.error(e);
    resDiv.innerHTML = `<div class="result-item error">❌ Error de conexión</div>`;
    return null;
  }
},

// ✅ 2. Llenado inteligente del formulario según origen
_llenarFormulario(data) {
  const form = document.getElementById('formCliente');
  const isEdicion = data._origen === 'bd';
  
  document.getElementById('formCedula').value = data.cedula || '';
  document.getElementById('formNombre').value = data.nombre || '';
  document.getElementById('formTelefono').value = data.telefono || '';
  document.getElementById('formEmail').value = data.email || '';
  document.getElementById('formDireccion').value = data.direccion || '';

  // Bloquear cédula solo si es edición de BD existente
  document.getElementById('formCedula').toggleAttribute('readonly', isEdicion);
  
  // Cambiar título y botones según modo
  const titulo = document.querySelector('#modalClientes h3');
  const btnEliminar = document.getElementById('btnEliminarCliente');
  const btnGuardar = form.querySelector('button[type="submit"]');
  
  if (titulo) titulo.textContent = isEdicion ? '✏️ Editar Cliente Registrado' : '📝 Registrar Nuevo Cliente';
  if (btnEliminar) btnEliminar.style.display = isEdicion ? 'inline-block' : 'none';
  if (btnGuardar) btnGuardar.textContent = isEdicion ? '💾 Actualizar Cliente' : '💾 Guardar Cliente';
  
  // Auto-cambiar a pestaña de formulario
  document.querySelector('[data-tab="registrar"]')?.click();
},

  // 🔍 Búsqueda por nombre en personal.json
  async buscarPorNombre(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().trim();
    return this._personalCache.filter(p => 
      p.nombre?.toLowerCase().includes(q)
    ).slice(0, 15).map(this._normalizarDatos);
  },

  // 💾 Guardar/Actualizar en Firestore
  async guardarCliente(data) {
    const clienteNormalizado = this._normalizarDatos(data);
    const ref = doc(DB.db, "clientesBD", clienteNormalizado.cedula);
    
    // Mantener puntos existentes si ya existen
    const snap = await getDoc(ref);
    const puntosExistentes = snap.exists() ? (snap.data().puntosLealtad || 0) : 0;
    
    await setDoc(ref, {
      ...clienteNormalizado,
      fechaActualizacion: new Date().toISOString(),
      activo: true,
      puntosLealtad: data.puntosLealtad || puntosExistentes
    }, { merge: true });
    
    return clienteNormalizado;
  },

  // 🔧 Normalización de datos
  _normalizarDatos(data) {
    return {
      cedula: String(data.cedula || '').trim(),
      nombre: (data.nombre || '').toUpperCase().trim(),
      telefono: (data.telefono || '').trim(),
      email: (data.email || '').toLowerCase().trim(),
      direccion: (data.direccion || '').toUpperCase().trim(),
      tipo: (data.tipo || 'Físico').trim()
    };
  },

  // 🖥️ Panel de Gestión (UI)
  async mostrarPanelGestion() {
    if (!Store.get('isAdmin')) { UI.toast('Acceso denegado', 'warning'); return; }
    if (document.getElementById('modalClientes')) document.getElementById('modalClientes').remove();

    const modal = document.createElement('div');
    modal.className = 'modal show'; modal.id = 'modalClientes';
    modal.innerHTML = `
      <div class="modal-content modal-grande">
        <button class="modal-close" onclick="UI.modal('modalClientes','close')">✕</button>
        <h2>👥 Gestión de Clientes</h2>
        
        <div class="clientes-tabs">
          <button class="tab-btn active" data-tab="buscar">🔍 Buscar Cliente</button>
          <button class="tab-btn" data-tab="registrar">📝 Registrar Nuevo</button>
        </div>

        <!-- BUSCAR -->
        <div id="tab-buscar" class="tab-content active">
          <div class="clientes-search-row">
            <input type="text" id="cliSearchCedula" placeholder="🔍 Buscar por Cédula..." style="flex:1">
            <button id="btnBuscarCedula" class="btn-primary">Buscar</button>
          </div>
          <div class="clientes-search-row" style="margin-top:0.5rem">
            <input type="text" id="cliSearchNombre" placeholder="🔍 Buscar por Nombre (local)..." style="flex:1">
            <button id="btnBuscarNombre" class="btn-secondary">Buscar</button>
          </div>
          <div id="clientesResultados" class="clientes-list" style="margin-top:1rem; max-height:180px; overflow-y:auto;"></div>
        </div>

        <!-- REGISTRAR/EDITAR -->
        <div id="tab-registrar" class="tab-content">
          <form id="formCliente" class="clientes-form">
            <div class="form-grid">
              <div class="form-group">
                <label>Cédula *</label>
                <input type="text" id="formCedula" placeholder="Cédula" required readonly>
              </div>
              <div class="form-group">
                <label>Nombre Completo *</label>
                <input type="text" id="formNombre" placeholder="Nombre completo" required 
                       style="text-transform: uppercase;" 
                       oninput="this.value = this.value.toUpperCase()">
              </div>
              <div class="form-group">
                <label>Teléfono</label>
                <input type="tel" id="formTelefono" placeholder="Teléfono">
              </div>
              <div class="form-group">
                <label>Correo</label>
                <input type="email" id="formEmail" placeholder="Correo">
              </div>
              <div class="form-group full-width">
                <label>Dirección</label>
                <input type="text" id="formDireccion" placeholder="Dirección"
                       style="text-transform: uppercase;" 
                       oninput="this.value = this.value.toUpperCase()">
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary">💾 Guardar Cliente</button>
              <button type="button" id="btnNuevoCliente" class="btn-secondary">➕ Limpiar / Nuevo</button>
              <button type="button" id="btnEliminarCliente" class="btn-danger" style="display:none">🗑️ Eliminar</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this.attachClientesEvents();
  },

  attachClientesEvents() {
    const form = document.getElementById('formCliente');
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(`tab-${e.target.dataset.tab}`).classList.add('active');
      });
    });

    // Form submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        cedula: document.getElementById('formCedula').value.trim(),
        nombre: document.getElementById('formNombre').value.trim(),
        telefono: document.getElementById('formTelefono').value.trim(),
        email: document.getElementById('formEmail').value.trim(),
        direccion: document.getElementById('formDireccion').value.trim()
      };
      if (!data.cedula || !data.nombre) return UI.toast('Cédula y nombre son obligatorios', 'warning');
      try {
        await this.guardarCliente(data);
        UI.toast('✅ Cliente guardado/actualizado correctamente', 'success');
        this._limpiarFormulario();
      } catch (err) { 
        console.error(err); 
        UI.toast('❌ Error al guardar en Firestore', 'error'); 
      }
    });

    // Buscar por cédula
    document.getElementById('btnBuscarCedula').onclick = async () => {
      const cedula = document.getElementById('cliSearchCedula').value.trim();
      const resDiv = document.getElementById('clientesResultados');
      resDiv.innerHTML = '<p style="color:#888">🔍 Buscando...</p>';
      
      const result = await this.buscarPorCedula(cedula);
      if (result) {
        this._llenarFormulario(result, true);
        resDiv.innerHTML = `<div class="result-item success">✅ Encontrado: <strong>${result.nombre}</strong></div>`;
        // Cambiar a tab de edición
        document.querySelector('[data-tab="registrar"]').click();
      } else {
        resDiv.innerHTML = `<div class="result-item error">❌ No encontrado en APIs ni local</div>`;
        this._llenarFormulario({ cedula, nombre: '', telefono: '', email: '', direccion: '' }, false);
        document.querySelector('[data-tab="registrar"]').click();
      }
    };

    // Buscar por nombre
    document.getElementById('btnBuscarNombre').onclick = async () => {
      const query = document.getElementById('cliSearchNombre').value.trim();
      const resDiv = document.getElementById('clientesResultados');
      resDiv.innerHTML = '<p style="color:#888">🔍 Buscando...</p>';
      
      const results = await this.buscarPorNombre(query);
      if (results.length > 0) {
        resDiv.innerHTML = results.map(r => `
          <div class="result-item clickable" onclick="ClientesManager._llenarFormulario(${JSON.stringify(r).replace(/"/g, '&quot;')}, true); document.querySelector('[data-tab=\"registrar\"]').click();">
            📄 ${r.nombre} <small>(${r.cedula})</small>
          </div>
        `).join('');
      } else {
        resDiv.innerHTML = '<div class="result-item">No se encontraron coincidencias</div>';
      }
    };

    // Nuevo cliente
    document.getElementById('btnNuevoCliente').onclick = () => {
      this._limpiarFormulario();
      document.getElementById('formCedula').removeAttribute('readonly');
      document.getElementById('formCedula').focus();
    };

    // Eliminar cliente
    document.getElementById('btnEliminarCliente').onclick = async () => {
      const cedula = document.getElementById('formCedula').value.trim();
      if (!cedula) return UI.toast('Selecciona un cliente primero', 'warning');
      if (!confirm(`¿Eliminar permanentemente al cliente ${cedula}?`)) return;
      
      try {
        await setDoc(doc(DB.db, "clientesBD", cedula), { activo: false }, { merge: true });
        UI.toast('🗑️ Cliente desactivado', 'success');
        this._limpiarFormulario();
      } catch (e) { UI.toast('❌ Error al eliminar', 'error'); }
    };
  },

  _llenarFormulario(data, isEdit = false) {
    document.getElementById('formCedula').value = data.cedula || '';
    document.getElementById('formNombre').value = data.nombre || '';
    document.getElementById('formTelefono').value = data.telefono || '';
    document.getElementById('formEmail').value = data.email || '';
    document.getElementById('formDireccion').value = data.direccion || '';
    
    document.getElementById('formCedula').toggleAttribute('readonly', isEdit);
    document.getElementById('btnEliminarCliente').style.display = isEdit ? 'inline-block' : 'none';
  },

  _limpiarFormulario() {
    document.getElementById('formCliente').reset();
    document.getElementById('formCedula').removeAttribute('readonly');
    document.getElementById('btnEliminarCliente').style.display = 'none';
  }
};

export default ClientesManager;