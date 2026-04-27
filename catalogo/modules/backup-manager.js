// modules/backup-manager.js
import { Store } from './core.js';
import { UI } from '../components/ui.js';

export const BackupManager = {
  generarRespaldo() {
    if (!confirm('¿Deseas descargar una copia de seguridad del inventario y productos actuales?')) return;

    const data = {
      fecha: new Date().toISOString(),
      inventario: Store.get('inventario'),
      productos: Store.get('productos'),
      carrito: Store.get('carrito')
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `esentia_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    UI.toast('💾 Respaldo descargado', 'success');
  }
};

export default BackupManager;