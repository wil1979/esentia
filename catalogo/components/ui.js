// components/ui.js
import { Store } from '../modules/core.js';

export const UI = {
  // Toast notifications
  toast(message, type = 'info', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const colors = {
      success: '#25d366',
      error: '#ff6b6b', 
      warning: '#f39c12',
      info: '#6c4ba3'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
    `;
    toast.style.cssText = `
      background: ${colors[type]};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideInRight 0.3s ease;
      margin-top: 10px;
      pointer-events: auto;
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Modal management - ✅ CORREGIDO
  modal(id, action = 'toggle') {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    if (action === 'open') {
      modal.style.display = 'flex';
      modal.classList.add('show');
      Store.set('ui.modalOpen', id);
      document.body.style.overflow = 'hidden';
    } else if (action === 'close') {
      modal.style.display = 'none';
      modal.classList.remove('show');
      Store.set('ui.modalOpen', null);
      document.body.style.overflow = '';
    } else {
      // Toggle por defecto
      const isOpen = modal.classList.contains('show') || modal.style.display === 'flex';
      this.modal(id, isOpen ? 'close' : 'open');
    }
  },

  // Skeleton loader
  showSkeleton(container, count = 6) {
    container.innerHTML = Array(count).fill(0).map((_, i) => 
      `<div class="skeleton-card" style="animation-delay: ${i * 0.1}s">
        <div class="skeleton-img"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text short"></div>
      </div>`
    ).join('');
  },

  hideSkeleton(container) {
    const skeleton = container.querySelector('.skeleton-grid');
    if (skeleton) {
      skeleton.style.opacity = '0';
      setTimeout(() => skeleton.remove(), 300);
    }
  }
};

// Escuchar eventos de toast desde otros módulos
Store.on('toast', ({ message, type }) => {
  UI.toast(message, type);
});