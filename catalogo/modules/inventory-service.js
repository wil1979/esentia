// modules/inventory-service.js
import { doc, setDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { Utils } from './core.js';

export const InventoryService = {
  // Cache interno para mapeo nombre → ID de Firestore
  _docMap: null,

  /**
   * Carga y cachea el mapeo de productos en stock
   * @returns {Promise<Object>} { [nombreNormalizado]: firestoreDocId }
   */
  async _loadDocMap() {
    if (this._docMap) return this._docMap;
    
    this._docMap = {};
    try {
      const snap = await getDocs(collection(DB.db, "stock"));
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const key = Utils.normalizeText(data.nombre);
        this._docMap[key] = docSnap.id;
      });
    } catch (e) {
      console.warn("⚠️ Error cargando mapeo de stock:", e);
    }
    return this._docMap;
  },

  /**
   * Guarda un solo producto en Firestore
   * @param {string} nombre - Nombre del producto
   * @param {number} cantidad - Nuevo stock
   * @returns {Promise<{success: boolean, nombre: string, error?: string}>}
   */
  async saveOne(nombre, cantidad) {
    try {
      const key = Utils.normalizeText(nombre);
      const docMap = await this._loadDocMap();
      const docId = docMap[key] || key; // Usa ID existente o crea nuevo con clave normalizada

      // ✅ setDoc con merge: true crea si no existe, actualiza si existe
      await setDoc(doc(DB.db, "stock", docId), {
        nombre: nombre,
        cantidad: cantidad, // ✅ Campo real de tu colección
        ultimaActualizacion: new Date().toISOString()
      }, { merge: true });

      // Actualizar cache para próximas operaciones
      this._docMap[key] = docId;
      
      return { success: true, nombre, docId };
    } catch (error) {
      console.error(`Error guardando "${nombre}":`, error);
      return { success: false, nombre, error: error.message };
    }
  },

  /**
   * Guarda múltiples productos (usado por admin.js)
   * @param {NodeList} rows - Elementos DOM con clase .inventory-row.modified
   * @returns {Promise<Array<{success: boolean, nombre: string, error?: string}>>}
   */
  async saveMultiple(rows) {
    const results = [];
    for (const row of rows) {
      const nombre = row.querySelector('strong')?.textContent?.trim();
      const cantidad = parseInt(row.dataset.stock);
      if (!nombre || isNaN(cantidad)) continue;
      
      const result = await this.saveOne(nombre, cantidad);
      results.push(result);
    }
    return results;
  },

  /**
   * Limpia el cache (útil para recargar datos)
   */
  clearCache() {
    this._docMap = null;
  }
};