// modules/auth.js
import { Store, Utils } from './core.js';
import { DB } from './firebase.js';

const AuthManager = {
  async login(cedulaOTelefono) {
    try {
      // Buscar por cédula
      let snap = await DB.getClient(cedulaOTelefono);
      if (snap.empty) {
        // Buscar por teléfono
        snap = await DB.getClientByPhone(cedulaOTelefono);
      }
      
      if (snap.empty) {
        return { success: false, message: 'Cliente no registrado' };
      }
      
      const doc = snap.docs[0];
      const cliente = {
        id: doc.id,
        ...doc.data()
      };
      
      // Verificar admin
      const isAdmin = cliente.cedula === '110350666';
      
      Store.set('cliente', cliente);
      Store.set('isAdmin', isAdmin);
      Store.persist('cliente');
      
      // Registrar visita
      DB.registerVisit(cliente.id, {
        nombre: cliente.nombre,
        cedula: cliente.cedula,
        pagina: 'catalogo'
      });
      
      Store.emit('auth:success', { cliente, isAdmin });
      return { success: true, cliente, isAdmin };
      
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Error de conexión' };
    }
  },
  
  async register(cedula, telefono) {
    try {
      // Verificar cédula con Hacienda
      const nombre = await this.verifyCedula(cedula);
      if (!nombre) {
        return { success: false, message: 'Cédula inválida' };
      }
      
      const docRef = await DB.addClient({
        nombre,
        cedula,
        telefono: telefono.replace(/\\D/g, '')
      });
      
      const cliente = {
        id: docRef.id,
        nombre,
        cedula,
        telefono
      };
      
      Store.set('cliente', cliente);
      Store.persist('cliente');
      
      Store.emit('auth:success', { cliente, isAdmin: false });
      return { success: true, cliente };
      
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, message: 'Error al registrar' };
    }
  },
  
  async verifyCedula(cedula) {
    try {
      const resp = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${cedula}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.nombre;
    } catch {
      return null;
    }
  },
  
  logout() {
    Store.set('cliente', null);
    Store.set('isAdmin', false);
    localStorage.removeItem('esentia_cliente');
    Store.emit('auth:logout');
  },
  
  checkSession() {
    Store.restore('cliente');
    const cliente = Store.get('cliente');
    if (cliente) {
      Store.set('isAdmin', cliente.cedula === '110350666');
      Store.emit('auth:restored', cliente);
      return true;
    }
    return false;
  }
};

export default AuthManager;