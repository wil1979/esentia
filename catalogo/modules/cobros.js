// modules/cobros.js
import { getDocs, collection, updateDoc, doc, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { Store, Utils } from './core.js'; // ✅ Agregar Utils
import { UI } from '../components/ui.js';

export const CobrosManager = {
  todosLosClientes: [], // Base completa: pagados, parciales, anulados y deudores
  clientesCache: [],
  clienteSeleccionado: null,

  async init() {
    console.log('💰 Módulo de Cobros cargado');
    await this.cargarClientes();
  },

  async cargarClientes() {
    try {
      const snap = await getDocs(collection(DB.db, "clientesBD"));
      this.clientesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { 
      console.warn('⚠️ Error cargando clientes:', e); 
      this.clientesCache = [];
    }
  },

  // ✅ NUEVO: Carga TODOS los clientes con historial (no solo deudores)
  async cargarBaseCobros() {
    try {
      this.todosLosClientes = [];
      const snap = await getDocs(collection(DB.db, "facturas"));
      
      snap.forEach(docSnap => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const compras = Array.isArray(data.compras) ? data.compras : [];
        if (compras.length === 0) return;

        const clienteInfo = this.clientesCache.find(c => c.id === docSnap.id) || {};
        const deudas = compras.filter(c => (Number(c.saldo) || 0) > 0);

        this.todosLosClientes.push({
          id: docSnap.id,
          nombre: clienteInfo.nombre || 'Cliente sin nombre',
          cedula: clienteInfo.cedula || '',
          telefono: clienteInfo.telefono || '',
          historial: compras,          // ✅ TODAS las facturas
          deudas: deudas,              // ✅ Solo las pendientes/parciales
          totalDeuda: deudas.reduce((s,d) => s + (Number(d.saldo)||0), 0),
          totalPagado: compras.reduce((s,c) => s + (Number(c.pagado)||0), 0)
        });
      });
    } catch (e) { 
      console.warn('⚠️ Error cargando base:', e); 
      this.todosLosClientes = [];
    }
  },

    // Agrega esto en CobrosManager
  async sincronizarVentaPagada(clienteId, facturaIndex) {
  try {
    const snap = await getDocs(collection(DB.db, "facturas"));
    const docSnap = snap.docs.find(d => d.id === clienteId);
    const compra = docSnap.data().compras[facturaIndex];

    // Si ya está despachado/completado, no hacer nada
    if (compra.estado === 'despachado' || compra.estado === 'completado') return;

    const inventario = Store.get('inventario') || {};
    
    // 📉 Descontar Stock
    for (const prod of compra.productos) {
      const key = Utils.normalizeText(prod.nombre);
      inventario[key] = Math.max(0, (inventario[key] || 0) - prod.cantidad);
    }

    // 🏆 Sumar Puntos de Lealtad (1 pt por cada ₡4,000)
    const puntos = Math.floor(compra.total / 4000);
    if (puntos > 0) {
      try {
        const clienteRef = doc(DB.db, "clientesBD", clienteId);
        const clienteSnap = await getDoc(clienteRef);
        const puntosActuales = clienteSnap.exists() ? (clienteSnap.data().puntosLealtad || 0) : 0;
        
        await updateDoc(clienteRef, {
          puntosLealtad: puntosActuales + puntos,
          historialPuntos: arrayUnion({
            cantidad: puntos,
            fecha: new Date().toISOString(),
            motivo: `Compra #${facturaIndex + 1} pagada`,
            autor: 'sistema'
          })
        });
      } catch (e) { console.warn("⚠️ No se sumaron puntos:", e); }
    }

    // 📝 Actualizar Estado y Guardar
    const compras = docSnap.data().compras;
    compras[facturaIndex].estado = 'completado'; // O 'despachado'
    compras[facturaIndex].fechaCompletado = new Date().toISOString();
    
    await updateDoc(doc(DB.db, "facturas", clienteId), { compras });
    Store.set('inventario', inventario);
    Store.persist('inventario');
    Store.emit('inventory:updated');
    
    console.log(`✅ Sincronización OK: Stock actualizado y ${puntos} puntos sumados.`);
  } catch(e) { console.error(e); }
},

  async mostrarPanelCobros() {
    const modal = document.createElement('div');
    modal.className = 'modal show'; 
    modal.id = 'modalCobros';
    modal.innerHTML = `
      <div class="modal-content modal-grande">
        <button class="modal-close" onclick="UI.modal('modalCobros','close')">✕</button>
        <h2>💰 Gestión de Cobros</h2>
        
        <div class="cobros-tabs">
          <button class="tab-btn active" data-tab="deudas">💳 Deudas Pendientes</button>
          <button class="tab-btn" data-tab="historial">📜 Historial Completo</button>
        </div>

        <div id="tab-deudas" class="tab-content active">
          <div class="cobros-toolbar">
            <button id="btnRefreshCobros" class="btn-secondary">🔄 Actualizar</button>
            <input type="text" id="buscarDeudor" placeholder="🔍 Buscar deudor...">
          </div>
          <div id="listaDeudores" class="deudores-grid">
            <div class="loading-state">🔄 Cargando base de clientes...</div>
          </div>
        </div>

        <div id="tab-historial" class="tab-content">
          <div class="cobros-toolbar">
            <input type="text" id="buscarHistorial" placeholder="🔍 Buscar cliente en historial...">
          </div>
          <div id="listaHistorial" class="historial-grid">
            <div class="loading-state">Cargando historial...</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // ✅ Carga inicial asíncrona
    await this.cargarClientes();
    await this.cargarBaseCobros();
    this.renderListaDeudores();
    this.renderListaHistorial();

    // Tabs
    modal.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        modal.querySelector(`#tab-${btn.dataset.tab}`).classList.add('active');
      });
    });

    // Listeners
    document.getElementById('btnRefreshCobros').onclick = async () => {
      await this.cargarBaseCobros();
      this.renderListaDeudores();
      this.renderListaHistorial();
      UI.toast('✅ Base actualizada', 'success');
    };
    document.getElementById('buscarDeudor').oninput = (e) => this.renderListaDeudores(e.target.value);
    document.getElementById('buscarHistorial').oninput = (e) => this.renderListaHistorial(e.target.value);
  },

  // ✅ PESTAÑA 1: SOLO DEUDORES ACTIVOS
  renderListaDeudores(filtro = '') {
    const container = document.getElementById('listaDeudores');
    if (!container) return;

    const f = filtro.toLowerCase().trim();
    // Filtramos: solo clientes con deuda > 0 Y que coincidan con búsqueda
    const deudoresActivos = this.todosLosClientes.filter(c => 
      c.totalDeuda > 0 && (
        f === '' || 
        c.nombre?.toLowerCase().includes(f) || 
        c.cedula?.includes(f) || 
        c.telefono?.includes(f)
      )
    );

    container.innerHTML = deudoresActivos.length 
      ? deudoresActivos.map(c => `
          <div class="deudor-card">
            <h3>👤 ${c.nombre}</h3>
            <p class="deudor-info">📱 ${c.telefono || 'N/A'} | 🆔 ${c.cedula || 'N/A'}</p>
            <p>💳 Facturas pendientes: <strong>${c.deudas.length}</strong></p>
            <p>💰 Saldo total: <strong style="color:#e74c3c">₡${c.totalDeuda.toLocaleString()}</strong></p>
            <div class="deudor-actions">
              <button onclick="CobrosManager.verDetalleDeuda('${c.id}')">👁️ Ver y Abonar</button>
              <button onclick="CobrosManager.enviarRecordatorioDeuda('${c.id}')" class="btn-whatsapp-reminder">📱 Recordatorio</button>
            </div>
          </div>
        `).join('')
      : '<p class="no-data">No hay deudas pendientes activas</p>';
  },

  // ✅ PESTAÑA 2: HISTORIAL COMPLETO (Pagados, Anulados, Parciales, Pendientes)
  renderListaHistorial(filtro = '') {
    const container = document.getElementById('listaHistorial');
    if (!container) return;

    const f = filtro.toLowerCase().trim();
    const clientesFiltrados = f.length === 0 
      ? this.todosLosClientes 
      : this.todosLosClientes.filter(c => 
          c.nombre?.toLowerCase().includes(f) || 
          c.cedula?.includes(f) || 
          c.telefono?.includes(f)
        );

    if (clientesFiltrados.length === 0) {
      container.innerHTML = '<p class="no-data">No se encontraron registros</p>';
      return;
    }

    container.innerHTML = clientesFiltrados.map(c => {
      const tieneDeuda = c.totalDeuda > 0;
      return `
        <div class="historial-cliente-box">
          <div class="hc-header">
            <h3>👤 ${c.nombre} ${tieneDeuda ? '<span class="badge-deuda">⚠️ Debe ₡'+c.totalDeuda.toLocaleString()+'</span>' : '<span class="badge-pagado">✅ Al día</span>'}</h3>
            <small>📱 ${c.telefono || ''} | 🆔 ${c.cedula || ''}</small>
          </div>
          <div class="historial-facturas">
            ${c.historial.map((fact, idx) => {
              const saldo = Number(fact.saldo) || 0;
              const total = Number(fact.total) || 0;
              const estado = fact.estado || (saldo > 0 ? 'parcial' : 'completado');
              const esAnulada = estado === 'anulada';
              const esPagada = estado === 'completado' && saldo === 0;
              
              let badgeClass = 'badge-pendiente';
              let badgeText = '⏳ Pendiente';
              if (esAnulada) { badgeClass = 'badge-anulada'; badgeText = '🚫 Anulada'; }
              else if (esPagada) { badgeClass = 'badge-completado'; badgeText = '✅ Pagada'; }
              else if (saldo > 0) { badgeClass = 'badge-parcial'; badgeText = '🔄 Parcial'; }

              return `
                <div class="hist-factura ${esAnulada ? 'anulada' : ''} ${esPagada ? 'pagada' : ''}">
                  <div class="hf-header">
                    <span>📅 ${new Date(fact.fecha).toLocaleDateString()}</span>
                    <span class="hf-estado badge ${badgeClass}">${badgeText}</span>
                  </div>
                  <div class="hf-body">
                    <div class="hf-items">${fact.productos?.map(p=>`<small>• ${p.nombre} x${p.cantidad}</small>`).join('')}</div>
                    <div class="hf-montos">
                      <span>Total: ₡${total.toLocaleString()}</span>
                      <span>Pagado: ₡${(Number(fact.pagado)||0).toLocaleString()}</span>
                      ${!esAnulada && !esPagada ? `<span class="hf-saldo">Saldo: ₡${saldo.toLocaleString()}</span>` : ''}
                    </div>
                  </div>
                  ${fact.abonos?.length > 0 ? `
                    <div class="hf-abonos">
                      <strong>Abonos:</strong>
                      ${fact.abonos.map(a => `<small>${new Date(a.fecha).toLocaleDateString()} | ₡${a.monto.toLocaleString()} (${a.metodo})</small>`).join('')}
                    </div>
                  ` : ''}
                  <div class="hf-actions">
                    ${!esAnulada && !esPagada ? `
                      <button onclick="CobrosManager.revertirAbono('${c.id}', ${idx})" class="btn-sm btn-warn">↩️ Revertir</button>
                      <button onclick="CobrosManager.anularFactura('${c.id}', ${idx})" class="btn-sm btn-danger">🚫 Anular</button>
                      <button onclick="FacturaEditor.abrirEditor('${c.id}', ${idx})" class="btn-sm btn-edit">✏️ Editar</button>
                    ` : '<small class="text-muted">Sin acciones disponibles</small>'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  },

  // ==========================================
  // 💸 ABONO Y GESTIÓN DE FACTURAS (Sin cambios lógicos, solo seguridad)
  // ==========================================
    async verDetalleDeuda(clienteId) {
    this.clienteSeleccionado = clienteId;
    
    // ✅ Evitar modales duplicados
    if (document.getElementById('modalDetalleDeuda')) {
      document.getElementById('modalDetalleDeuda').remove();
    }

    const clienteInfo = this.clientesCache.find(c => c.id === clienteId) || {};
    try {
      const snap = await getDoc(doc(DB.db, "facturas", clienteId));
      if (!snap.exists()) return UI.toast('Cliente no encontrado', 'error');
      
      const data = snap.data();
      const compras = data.compras || [];
      const deudas = compras.filter(c => (Number(c.saldo) || 0) > 0);
      const recordatorios = data.recordatorios || []; // ✅ Cargar log

      const modal = document.createElement('div');
      modal.className = 'modal show'; 
      modal.id = 'modalDetalleDeuda';
      modal.innerHTML = `
        <div class="modal-content modal-grande">
          <button class="modal-close" onclick="UI.modal('modalDetalleDeuda','close')">✕</button>
          <h2>📋 Gestión de Cuenta</h2>
          
          <div class="cliente-info-box">
            <p><strong>👤</strong> ${clienteInfo.nombre || clienteId}</p>
            <p><strong>📱</strong> ${clienteInfo.telefono || 'N/A'}</p>
            <p><strong>💰</strong> Saldo Total: <span style="color:#e74c3c;font-weight:700">₡${deudas.reduce((s,d)=>s+(Number(d.saldo)||0),0).toLocaleString()}</span></p>
          </div>

          <h3>📄 Facturas Pendientes</h3>
          <div id="facturasPendientes">
            ${deudas.length === 0 ? '<p class="no-data">Sin deudas pendientes</p>' : deudas.map((fact, i) => {
              const realIdx = compras.indexOf(fact);
              return `
                <div class="factura-pendiente">
                  <div class="fp-header">
                    <span>📅 ${new Date(fact.fecha).toLocaleDateString()}</span>
                    <span class="fp-saldo">Saldo: ₡${Number(fact.saldo).toLocaleString()}</span>
                  </div>
                  <div class="fp-items">${fact.productos.map(p=>`<small>• ${p.nombre} (x${p.cantidad})</small>`).join('')}</div>
                  <button class="btn-abonar" onclick="CobrosManager.abrirModalAbono(${realIdx}, ${Number(fact.saldo)})">💸 Registrar Abono</button>
                </div>
              `;
            }).join('')}
          </div>

          <!-- ✅ SECCIÓN DE LOG DE RECORDATORIOS -->
          <div class="historial-recordatorios">
            <h4>📱 Historial de Contactos</h4>
            ${recordatorios.length 
              ? recordatorios.map(r => `
                  <div class="log-item">
                    <span class="log-date">${new Date(r.fecha).toLocaleString()}</span>
                    <span class="log-info">₡${r.monto.toLocaleString()} → ${r.telefono}</span>
                  </div>
                `).join('')
              : '<p class="no-data">Sin recordatorios enviados</p>'}
          </div>

        </div>
      `;
      document.body.appendChild(modal);
    } catch(e) { console.error(e); UI.toast('Error al cargar', 'error'); }
  },

  abrirModalAbono(index, saldo) {
    const modal = document.createElement('div');
    modal.className = 'modal show'; modal.id = 'modalAbono';
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" onclick="UI.modal('modalAbono','close')">✕</button>
        <h2>💸 Registrar Pago</h2>
        <p>Saldo pendiente: <strong>₡${saldo.toLocaleString()}</strong></p>
        <form id="formAbono">
          <input type="number" id="montoAbono" placeholder="Monto" max="${saldo}" required>
          <select id="metodoAbono">
            <option value="Efectivo">Efectivo</option>
            <option value="SINPE">SINPE</option>
            <option value="Transferencia">Transferencia</option>
          </select>
          <input type="text" id="notaAbono" placeholder="Nota (opcional)">
          <button type="submit" class="btn-submit">✅ Confirmar</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('formAbono').onsubmit = (e) => { e.preventDefault(); this.procesarAbono(index); };
  },

  async procesarAbono(index) {
  const monto = Number(document.getElementById('montoAbono').value) || 0;
  const metodo = document.getElementById('metodoAbono').value;
  const nota = document.getElementById('notaAbono').value;
  const btn = document.querySelector('#formAbono button');
  if (monto <= 0) return UI.toast('Monto inválido', 'warning');
  
  btn.disabled = true; btn.textContent = 'Procesando...';
  try {
    const snap = await getDoc(doc(DB.db, "facturas", this.clienteSeleccionado));
    const data = snap.data();
    const compras = data.compras || [];
    const fact = compras[index];
    
    const nuevoPagado = (Number(fact.pagado) || 0) + monto;
    const nuevoSaldo = Math.max(0, (Number(fact.total) || 0) - nuevoPagado);
    const estado = nuevoSaldo <= 0 ? 'completado' : 'parcial';
    const abonoData = { fecha: new Date().toISOString(), monto, metodo, nota: nota || '' };

    await updateDoc(doc(DB.db, "facturas", this.clienteSeleccionado), {
      [`compras.${index}.pagado`]: nuevoPagado,
      [`compras.${index}.saldo`]: nuevoSaldo,
      [`compras.${index}.estado`]: estado,
      abonos: [...(data.abonos || []), abonoData]
    });

    // ✅ LLAMADA: Si quedó pagada, sincronizar inventario y puntos
    if (nuevoSaldo <= 0) {
      await this.sincronizarVentaPagada(this.clienteSeleccionado, index);
      UI.toast('✅ Pago registrado. Stock y puntos actualizados.', 'success');
    } else {
      UI.toast('✅ Abono registrado', 'success');
    }

    UI.modal('modalAbono', 'close');
    UI.modal('modalDetalleDeuda', 'close');
    await this.cargarBaseCobros();
    this.renderListaDeudores();
    this.renderListaHistorial();
  } catch(err) { 
    console.error(err); 
    UI.toast('❌ Error al procesar pago', 'error'); 
  }
  finally { btn.disabled = false; btn.textContent = '✅ Confirmar'; }
},

  async revertirAbono(clienteId, facturaIdx) {
    if (!confirm('⚠️ ¿Revertir el ÚLTIMO abono? Restaurará el saldo.')) return;
    try {
      const snap = await getDoc(doc(DB.db, "facturas", clienteId));
      const data = snap.data();
      const compras = data.compras || [];
      const fact = compras[facturaIdx];
      const abonos = data.abonos || [];
      if (abonos.length === 0) return UI.toast('No hay abonos para revertir', 'warning');
      
      const ultimoAbono = abonos[abonos.length - 1];
      const nuevoPagado = Math.max(0, (Number(fact.pagado)||0) - ultimoAbono.monto);
      const nuevoSaldo = (Number(fact.total)||0) - nuevoPagado;
      const abonosActualizados = abonos.slice(0, -1);

      await updateDoc(doc(DB.db, "facturas", clienteId), {
        [`compras.${facturaIdx}.pagado`]: nuevoPagado,
        [`compras.${facturaIdx}.saldo`]: nuevoSaldo,
        [`compras.${facturaIdx}.estado`]: nuevoSaldo <= 0 ? 'completado' : 'parcial',
        abonos: abonosActualizados
      });

      UI.toast('↩️ Abono revertido', 'success');
      await this.cargarBaseCobros();
      this.renderListaHistorial();
      this.renderListaDeudores();
    } catch(e) { console.error(e); UI.toast('❌ Error al revertir', 'error'); }
  },

  async anularFactura(clienteId, facturaIdx) {
    if (!confirm('🚫 ¿Anular esta factura? Se marcará como anulada y el saldo irá a 0.')) return;
    try {
      await updateDoc(doc(DB.db, "facturas", clienteId), {
        [`compras.${facturaIdx}.estado`]: 'anulada',
        [`compras.${facturaIdx}.saldo`]: 0,
        [`compras.${facturaIdx}.notaAnulacion`]: `Anulada el ${new Date().toLocaleString()}`
      });
      UI.toast('🚫 Factura anulada', 'success');
      await this.cargarBaseCobros();
      this.renderListaHistorial();
      this.renderListaDeudores();
    } catch(e) { console.error(e); UI.toast('❌ Error al anular', 'error'); }
  },
    // ==========================================
  // 📱 RECORDATORIO DE DEUDA POR WHATSAPP

async enviarRecordatorioDeuda(clienteId, tipo = 'auto') {
  const clienteInfo = this.clientesCache.find(c => c.id === clienteId) || {};
  const clienteData = this.todosLosClientes.find(c => c.id === clienteId);
  let rawPhone = clienteInfo.telefono || '';
  let cleanPhone = rawPhone.replace(/\D/g, '');
  if (cleanPhone.length === 8) cleanPhone = '506' + cleanPhone;
  if (cleanPhone.length < 10) return UI.toast('⚠️ Teléfono inválido', 'warning');

  const deudas = clienteData?.deudas || [];
  if (deudas.length === 0) return UI.toast('✅ No tiene deudas', 'info');

  const hoy = new Date();
  let maxDiasAtraso = 0;
  let detalleFacturas = '';
  let totalDeuda = 0;

  deudas.forEach(f => {
    const dias = Math.floor((hoy - new Date(f.fecha)) / (1000 * 60 * 60 * 24));
    if (dias > maxDiasAtraso) maxDiasAtraso = dias;
    totalDeuda += Number(f.saldo) || 0;
    detalleFacturas += `\n📅 ${new Date(f.fecha).toLocaleDateString()} | Saldo: ₡${(Number(f.saldo)||0).toLocaleString()}`;
  });

  // Determinar plantilla
  const plantilla = tipo === 'auto' ? (maxDiasAtraso > 15 ? 'strong' : 'friendly') : tipo;

  // Crear modal con opciones
  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.id = 'modalRecordatorio';
  modal.innerHTML = `
    <div class="modal-content modal-grande recordatorio-modal">
      <button class="modal-close" onclick="UI.modal('modalRecordatorio','close')">✕</button>
      <h2>📱 Enviar Recordatorio</h2>
      
      <div class="recordatorio-info">
        <p><strong>Cliente:</strong> ${clienteInfo.nombre || clienteId}</p>
        <p><strong>Teléfono:</strong> ${clienteInfo.telefono}</p>
        <p><strong>Total Pendiente:</strong> <span style="color:#e74c3c;font-weight:bold">₡${totalDeuda.toLocaleString()}</span></p>
      </div>

      <!-- QR para SINPE -->
      <div class="qr-section">
        <h3>📲 Código QR SINPE</h3>
        <div class="qr-container">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=SINPE%20Móvil%0AMonto:%20₡${totalDeuda}%0ATel:%2072952454" alt="QR SINPE">
        </div>
        <small>El cliente puede escanear para ver datos de pago</small>
      </div>

      <!-- Botones de acción -->
      <div class="recordatorio-actions">
        <button class="btn-whatsapp" onclick="CobrosManager.enviarWA('${clienteId}', '${plantilla}')">
          💬 WhatsApp ${plantilla === 'strong' ? '⚠️' : '🌸'}
        </button>
        
        <button class="btn-sms" onclick="CobrosManager.enviarSMS('${cleanPhone}', ${totalDeuda})">
          📩 SMS (PASE)
        </button>
        
        <button class="btn-copy" onclick="CobrosManager.copiarDatos(${totalDeuda})">
          📋 Copiar Datos
        </button>
      </div>

      <div class="pago-info">
        <h4>💳 Datos de Pago:</h4>
        <p><strong>SINPE Móvil:</strong> 72952454</p>
        <p><strong>IBAN BN:</strong> CR76015114620010283743</p>
        <p><small>✅ Para BN/BCR: SMS "PASE ${Math.round(totalDeuda)} 72952454" al 72952454</small></p>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  this.registrarLogRecordatorio(clienteId, totalDeuda, cleanPhone, plantilla);
},

// Enviar WhatsApp
enviarWA(clienteId, plantilla) {
  const clienteInfo = this.clientesCache.find(c => c.id === clienteId) || {};
  const clienteData = this.todosLosClientes.find(c => c.id === clienteId);
  let rawPhone = clienteInfo.telefono || '';
  let cleanPhone = rawPhone.replace(/\D/g, '');
  if (cleanPhone.length === 8) cleanPhone = '506' + cleanPhone;
  
  const totalDeuda = clienteData?.totalDeuda || 0;
  
  let mensaje = '';
  if (plantilla === 'friendly') {
    mensaje = `Hola ${clienteInfo.nombre || 'cliente'} 👋,\n\n` +
      `Esperamos que esté muy bien. Le recordamos amablemente su saldo pendiente de *₡${totalDeuda.toLocaleString()}*.\n\n` +
      `💳 *Métodos de pago:*\n` +
      `• 📱 SINPE: 72952454\n` +
      `• 🏦 IBAN: CR76015114620010283743\n` +
      `📲 *Opción rápida BN/BCR:*\nEnvíe SMS "PASE ${Math.round(totalDeuda)} 72952454"\n\n` +
      `¡Gracias por su preferencia! 🌸`;
  } else {
    mensaje = `Estimado/a ${clienteInfo.nombre || 'cliente'},\n\n` +
      `Le informamos que su cuenta presenta un saldo vencido de *₡${totalDeuda.toLocaleString()}*.\n\n` +
      `💳 *Regularice su pago:*\n` +
      `• SINPE: 72952454\n` +
      `• SMS: "PASE ${Math.round(totalDeuda)} 72952454"\n\n` +
      `⚠️ Evite cargos adicionales.`;
  }
  
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensaje)}`, '_blank');
  UI.modal('modalRecordatorio', 'close');
  UI.toast('📱 WhatsApp abierto', 'success');
},

// Enviar SMS con formato PASE
enviarSMS(phone, monto) {
  const mensaje = `PASE ${Math.round(monto)} 72952454`;
  // En Costa Rica, los SMS a números cortos funcionan así
  window.open(`sms:${phone}?body=${encodeURIComponent(mensaje)}`, '_blank');
  UI.toast('📩 SMS listo para enviar', 'success');
},

// Copiar datos al portapapeles
async copiarDatos(monto) {
  const texto = `SINPE: 72952454\nMonto: ₡${monto.toLocaleString()}\nIBAN: CR76015114620010283743\n\nOpción BN/BCR: SMS "PASE ${Math.round(monto)} 72952454"`;
  await navigator.clipboard.writeText(texto);
  UI.toast('📋 Datos copiados', 'success');
},

// Actualiza también esta función para aceptar el tipo de plantilla en el log
async registrarLogRecordatorio(clienteId, monto, telefono, tipo = 'amigable') {
  try {
    const logEntry = {
      fecha: new Date().toISOString(),
      monto,
      telefono,
      tipo,
      estado: 'Enviado a WhatsApp'
    };
    await updateDoc(doc(DB.db, "facturas", clienteId), {
      recordatorios: arrayUnion(logEntry)
    });
  } catch (e) { console.error('Error guardando log:', e); }
},

    async registrarLogRecordatorio(clienteId, monto, telefono) {
    try {
      const logEntry = {
        fecha: new Date().toISOString(),
        monto: monto,
        telefono: telefono,
        estado: 'Enviado a WhatsApp'
      };
      // Guarda en el array 'recordatorios' del documento del cliente
      await updateDoc(doc(DB.db, "facturas", clienteId), {
        recordatorios: arrayUnion(logEntry)
      });
      console.log('✅ Log de recordatorio guardado');
    } catch (e) {
      console.error('Error guardando log:', e);
    }
  },
};