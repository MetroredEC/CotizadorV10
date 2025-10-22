// app.js
// Contiene utilidades comunes y gestión de datos para el cotizador

const appState = {
  data: null,
  aseguradoras: [],
  examenes: [],
};

/**
 * Carga el tarifario desde localStorage o desde el archivo JSON por defecto.
 * Se almacena en appState.data, appState.aseguradoras y appState.examenes.
 */
async function loadTarifario() {
  // Si el usuario subió un tarifario nuevo, se guarda en localStorage con la clave 'tarifarioData'
  const stored = localStorage.getItem('tarifarioData');
  if (stored) {
    try {
      appState.data = JSON.parse(stored);
    } catch (e) {
      console.error('No se pudo parsear el tarifario del almacenamiento local', e);
      localStorage.removeItem('tarifarioData');
    }
  }
  if (!appState.data) {
    // Cargar desde el archivo por defecto
    try {
      // Intenta cargar desde ruta relativa con prefijo './' para compatibilidad con file:// y GitHub Pages
      const response = await fetch('./data/tarifario.json');
      if (!response.ok) {
        throw new Error('Respuesta no OK');
      }
      appState.data = await response.json();
    } catch (err) {
      console.warn('Fallo al cargar data/tarifario.json, se requiere subir un tarifario mediante la página de administración.', err);
      appState.data = null;
    }
  }
  appState.aseguradoras = appState.data.aseguradoras;
  appState.examenes = appState.data.examenes;
}

/**
 * Guarda el tarifario actual en localStorage para que persista en siguientes sesiones.
 */
function saveTarifarioToLocal() {
  if (appState.data) {
    localStorage.setItem('tarifarioData', JSON.stringify(appState.data));
  }
}

/**
 * Formatea un número como precio con dos decimales.
 * @param {number} value
 * @returns {string}
 */
function formatCurrency(value) {
  return value.toFixed(2);
}

// Usuarios predefinidos. Estos se utilizan como valores iniciales cuando aún
// no existen usuarios persistidos en localStorage. Se recomienda utilizar un
// backend seguro para producción. Si se añade o elimina un usuario desde
// la página de administración, se actualizará localStorage.
const DEFAULT_USERS = {
  admin: {
    password: 'admin123',
    role: 'admin',
  },
  asesor: {
    password: 'asesor123',
    role: 'asesor',
  },
  xguerra: {
    password: 'Metrored2024',
    role: 'asesor',
  },
};

/**
 * Devuelve los usuarios guardados en localStorage o crea los usuarios por
 * defecto si no existen. Los usuarios están almacenados como un objeto
 * cuyas claves son los nombres de usuario.
 * @returns {Object}
 */
function getUsers() {
  const stored = localStorage.getItem('users');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('No se pudo parsear usuarios de localStorage', e);
      localStorage.removeItem('users');
    }
  }
  // Inicializar con los usuarios por defecto y guardarlos
  localStorage.setItem('users', JSON.stringify(DEFAULT_USERS));
  return { ...DEFAULT_USERS };
}

/**
 * Guarda el mapa de usuarios en localStorage. Se usa al agregar o eliminar
 * usuarios desde la interfaz de administración.
 * @param {Object} users
 */
function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

// Carga los usuarios activos (ya sea de localStorage o por defecto).
const USERS = getUsers();

/**
 * Verifica las credenciales de inicio de sesión.
 * @param {string} username
 * @param {string} password
 * @returns {string|null} El rol del usuario si es válido, o null si no.
 */
function authenticate(username, password) {
  // Recargar usuarios desde localStorage para reflejar cambios dinámicos
  const users = getUsers();
  const user = users[username];
  if (user && user.password === password) {
    return user.role;
  }
  return null;
}

/**
 * Guarda en sessionStorage el usuario autenticado y su rol.
 * @param {string} username
 * @param {string} role
 */
function setSessionUser(username, role) {
  sessionStorage.setItem('username', username);
  sessionStorage.setItem('role', role);
}

/**
 * Devuelve la información de usuario guardada en la sesión.
 */
function getSessionUser() {
  const username = sessionStorage.getItem('username');
  const role = sessionStorage.getItem('role');
  return { username, role };
}

/**
 * Cierra la sesión actual.
 */
function logout() {
  sessionStorage.removeItem('username');
  sessionStorage.removeItem('role');
  // no borrar datos del tarifario en localStorage para mantener actualizaciones
  window.location.href = 'index.html';
}

// Exportar funciones globalmente (para uso en HTML inline)
window.appState = appState;
window.loadTarifario = loadTarifario;
window.saveTarifarioToLocal = saveTarifarioToLocal;
window.formatCurrency = formatCurrency;
window.authenticate = authenticate;
window.setSessionUser = setSessionUser;
window.getSessionUser = getSessionUser;
window.logout = logout;
window.getUsers = getUsers;
window.saveUsers = saveUsers;

/**
 * Registra una cotización en el historial de logs. Cada registro contiene
 * la fecha y hora, el asesor que realizó la cotización, el nombre del
 * paciente, la aseguradora utilizada, el subtotal calculado, el
 * porcentaje de cobertura referencial aplicado y el total. Los logs se
 * almacenan en localStorage bajo la clave 'quotesLog' como un array de
 * objetos.
 *
 * @param {Object} logData - Objeto con las propiedades:
 *   - asesor {string}: nombre de usuario del asesor
 *   - paciente {string}: nombre del paciente cotizado
 *   - aseguradora {string}: nombre de la aseguradora seleccionada
 *   - subtotal {number}: subtotal de la cotización (sin redondear)
 *   - coverage {number|null}: porcentaje de cobertura referencial, o null si particular
 *   - total {number}: total calculado para el cliente
 */
function logQuote(logData) {
  const stored = localStorage.getItem('quotesLog');
  let logs = [];
  if (stored) {
    try {
      logs = JSON.parse(stored);
    } catch (e) {
      console.error('No se pudo parsear logs de cotizaciones', e);
    }
  }
  const timestamp = new Date().toLocaleString('es-EC');
  logs.push({
    timestamp,
    asesor: logData.asesor,
    paciente: logData.paciente,
    aseguradora: logData.aseguradora,
    subtotal: logData.subtotal,
    coverage: logData.coverage,
    total: logData.total,
  });
  localStorage.setItem('quotesLog', JSON.stringify(logs));
}

// Exportar logQuote para que esté disponible globalmente
window.logQuote = logQuote;