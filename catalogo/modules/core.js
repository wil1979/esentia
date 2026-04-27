// modules/core.js
/**
 * ESENTIA CORE v5.3
 * Single Source of Truth - State Management
 */
export const Store = (() => {
  const state = {
    productos: [],
    inventario: {},
    carrito: [],
    cliente: null,
    isAdmin: false,
    ui: {
      loading: false,
      modalOpen: null,
      searchQuery: '',
      filtros: {}
    },
    initialized: false
  };
  
  const listeners = new Map();

  return {
    get: (path) => {
      if (!path) return { ...state };
      return path.split('.').reduce((obj, key) => obj?.[key], state);
    },

    set: (path, value) => {
      const keys = path.split('.');
      const lastKey = keys.pop();
      const target = keys.reduce((obj, key) => {
        if (!obj[key]) obj[key] = {};
        return obj[key];
      }, state);
      
      const oldValue = target[lastKey];
      target[lastKey] = value;
      Store.emit(path, value, oldValue);
      return value;
    },

      addToCart: (item) => {
    // ✅ CORRECCIÓN CRÍTICA: Buscar por ID + Variante para permitir líneas separadas
    const exists = state.carrito.find(i =>
      String(i.id) === String(item.id) && i.variante === item.variante
    );

    if (exists) {
      exists.cantidad += item.cantidad || 1;
    } else {
      state.carrito.push({ ...item, cantidad: item.cantidad || 1 });
    }
    Store.emit('cart:updated', state.carrito);
    Store.persist('cart');
  },

    // ✅ CORREGIDO: Comparación segura de tipos (String vs Number)
    removeFromCart: (id) => {
      state.carrito = state.carrito.filter(i => String(i.id) !== String(id));
      Store.emit('cart:updated', state.carrito);
      Store.persist('cart');
    },

    clearCart: () => {
      state.carrito = [];
      Store.emit('cart:updated', state.carrito);
      Store.persist('cart');
    },

    on: (event, callback) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(callback);
      return () => listeners.get(event).delete(callback);
    },

    emit: (event, ...args) => {
      listeners.get(event)?.forEach(cb => {
        try { cb(...args); } catch (e) { console.error(e); }
      });
    },

    persist: (key) => {
      try {
        localStorage.setItem(`esentia_${key}`, JSON.stringify(state[key]));
      } catch (e) { console.warn('Storage error:', e); }
    },

    restore: (key) => {
      try {
        const data = localStorage.getItem(`esentia_${key}`);
        if (data) state[key] = JSON.parse(data);
      } catch (e) { console.warn('Restore error:', e); }
    },

init: async () => {
  if (state.initialized) return;
 Store.restore('cliente');
Store.restore('carrito');

// ✅ CAMBIO: Quitar la validación fija y dejarla en false inicialmente
state.isAdmin = false; 

state.initialized = true;
Store.emit('store:initialized');
}
  };
})();


export const Utils = {
  debounce: (fn, ms) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), ms);
    };
  },
  formatPrice: (price) => {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'CRC',
      minimumFractionDigits: 0
    }).format(price || 0);
  },
  normalizeText: (text) => {
    return text?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '') || '';
  },
  levenshtein: (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
    return matrix[b.length][a.length];
  }
};