// modules/loyalty.js
import { Store } from './core.js';

export default {
  CONFIG: {
    SELLOS_OBJETIVO: 6,
    PUNTOS_POR_MONTO: 4000
  },

  init() {
    this.renderCard();
  },

  // ✅ VERSIÓN BLINDADA: Evita el error "Cannot read properties of null"
  // En modules/loyalty.js -> reemplaza renderCard() por:
renderCard() {
  const container = document.getElementById('loyaltyContainer');
  if (!container) return;
  
  const cliente = Store.get('cliente');
  if (!cliente) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  const puntos = cliente.puntosLealtad || 0;
  const objetivo = 6; // Puntos para recompensa
  const progreso = Math.min(((puntos % objetivo) / objetivo) * 100, 100);
  const faltan = objetivo - (puntos % objetivo);

  // Render compacto por defecto
  container.innerHTML = `
    <div class="loyalty-widget" id="loyaltyWidget">
      <div class="loyalty-minimized">
        <span>🎁</span>
        <span>${puntos} pts</span>
        <span class="loyalty-toggle">▼</span>
      </div>
      <div class="loyalty-expanded-content">
        <div class="loyalty-progress-bar">
          <div class="loyalty-progress-fill" style="width: ${progreso}%"></div>
        </div>
        <small style="color:#666; display:block; margin-top:4px;">
          ${faltan > 0 ? `Faltan ${faltan} pts para tu recompensa` : '🎉 ¡Tienes una recompensa lista!'}
        </small>
      </div>
    </div>
  `;

  // Lógica de toggle al hacer clic
  const widget = document.getElementById('loyaltyWidget');
  widget.addEventListener('click', (e) => {
    if (e.target.closest('.loyalty-expanded-content')) return;
    widget.classList.toggle('expanded');
    const content = widget.querySelector('.loyalty-expanded-content');
    const toggle = widget.querySelector('.loyalty-toggle');
    
    if (widget.classList.contains('expanded')) {
      content.style.display = 'block';
      toggle.textContent = '▲';
    } else {
      content.style.display = 'none';
      toggle.textContent = '▼';
    }
  });
},
  
  // Método para sumar puntos (usado por admin o tras compra)
  addStamp(clienteId) {
    console.log("Sumando puntos a:", clienteId);
    // Lógica de actualización...
  }
};