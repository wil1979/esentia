
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';

// ⚠️ Reemplaza con tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDuMNZrLgxBs6CbuPp8j0iyynejt6WCpnQ",
      authDomain: "esentiacreditos-8345f.firebaseapp.com",
      projectId: "esentiacreditos-8345f",
      storageBucket: "esentiacreditos-8345f.firebasestorage.app",
      messagingSenderId: "888658236080",
      appId: "1:888658236080:web:506e5e2085b5a452dba175"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Exportar la base de datos para usar en script.js
export { db };
  