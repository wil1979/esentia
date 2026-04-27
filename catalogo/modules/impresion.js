// modules/impresion.js
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { UI } from '../components/ui.js';

export const ImpresionManager = {
  async mostrarMenu() {
    const opciones = prompt(
      'Seleccione opción:\n1. Imprimir Factura\n2. Imprimir Recordatorio de Pago\n3. Exportar Datos',
      '1'
    );
    
    switch(opciones) {
      case '1':
        await this.imprimirFactura();
        break;
      case '2':
        await this.imprimirRecordatorio();
        break;
      case '3':
        this.exportarDatos();
        break;
      default:
        UI.toast('Opción cancelada', 'info');
    }
  },

  async imprimirFactura() {
    const facturaId = prompt('Ingrese ID de factura:');
    if (!facturaId) return;
    
    try {
      // Buscar en facturas_rapidas primero
      const snap = await getDocs(collection(DB.db, "facturas_rapidas"));
      const factura = snap.docs.find(d => d.id.includes(facturaId))?.data();
      
      if (!factura) {
        UI.toast('Factura no encontrada', 'error');
        return;
      }

      this.generarPDFFactura(factura);
    } catch (e) {
      console.error(e);
      UI.toast('Error al buscar factura', 'error');
    }
  },

  generarPDFFactura(factura) {
    const ventana = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Factura ${factura.id?.slice(-6) || 'N/A'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .cliente { margin-bottom: 20px; }
          .productos { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .productos th, .productos td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          .productos th { background: #f5f5f5; }
          .totales { text-align: right; margin-top: 20px; font-size: 1.2em; }
          .footer { margin-top: 50px; text-align: center; font-size: 0.9em; color: #666; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🌸 ESENTIA</h1>
          <p>Factura #${factura.id?.slice(-6) || 'N/A'}</p>
          <p>${new Date(factura.fecha).toLocaleString()}</p>
        </div>
        <div class="cliente">
          <strong>Cliente:</strong> ${factura.clienteNombre}<br>
          <strong>Cédula:</strong> ${factura.clienteId}<br>
          <strong>Teléfono:</strong> ${factura.clienteTelefono || 'N/A'}
        </div>
        <table class="productos">
          <thead>
            <tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
            ${factura.productos.map(p => `
              <tr>
                <td>${p.nombre} (${p.variante})</td>
                <td>${p.cantidad}</td>
                <td>₡${p.precio.toLocaleString()}</td>
                <td>₡${p.subtotal.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="totales">
          <p><strong>Subtotal: ₡${factura.subtotal.toLocaleString()}</strong></p>
          ${factura.descuento > 0 ? `<p>Descuento: -₡${factura.descuento.toLocaleString()}</p>` : ''}
          <p style="font-size: 1.3em; color: #25d366;"><strong>TOTAL: ₡${factura.total.toLocaleString()}</strong></p>
          <p>Método: ${factura.metodoPago || 'Contado'}</p>
        </div>
        <div class="footer">
          <p>¡Gracias por su compra! 🌸</p>
          <p>Tel: 25525503 | WhatsApp: 72952454</p>
        </div>
        <button class="no-print" onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">🖨️ Imprimir</button>
      </body>
      </html>
    `;
    ventana.document.write(html);
    ventana.document.close();
  },

  async imprimirRecordatorio() {
    const clienteId = prompt('Ingrese cédula del cliente:');
    if (!clienteId) return;
    
    UI.toast('Función en desarrollo', 'info');
  },

  exportarDatos() {
    const datos = {
      fecha: new Date().toISOString(),
      productos: JSON.parse(localStorage.getItem('esentia_productos') || '[]'),
      inventario: JSON.parse(localStorage.getItem('esentia_inventario') || '{}')
    };
    
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esentia_backup_${Date.now()}.json`;
    a.click();
    
    UI.toast('📥 Datos exportados', 'success');
  }
};

export default ImpresionManager;