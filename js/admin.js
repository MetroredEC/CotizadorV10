// admin.js
// Lógica de la página de administración de Metrored. Permite gestionar
// tarifarios (múltiples archivos con nombre y logo), ver logs de
// cotizaciones, y administrar usuarios.

document.addEventListener('DOMContentLoaded', async () => {
  const { username, role } = getSessionUser();
  if (!username || role !== 'admin') {
    window.location.href = 'index.html';
    return;
  }
  // Saludo y acción de salida
  document.getElementById('adminGreeting').textContent = `Hola, ${username}`;
  document.getElementById('adminLogout').addEventListener('click', logout);

  // Asegurar que exista al menos un tarifario por defecto y cargar datos base.
  await ensureDefaultTarifario();

  // Renderizar listas iniciales
  renderTarifariosList();
  renderUsers();
  // Cargar logos de aseguradoras (requiere que appState se haya inicializado)
  await loadTarifario();
  renderInsurerLogos();

  // Preparar descarga de logs: se gestiona desde downloadLogBtn
  const downloadBtn = document.getElementById('downloadLogBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadLogs);
  }

  // Evento para agregar un nuevo tarifario
  document.getElementById('addTarifarioBtn').addEventListener('click', async () => {
    const nameInput = document.getElementById('tarifarioName');
    const fileInput = document.getElementById('tarifarioFile');
    const logoInput = document.getElementById('logoFile');
    const messageElem = document.getElementById('uploadMessage');
    messageElem.textContent = '';
    messageElem.style.color = '';
    const name = nameInput.value.trim();
    if (!name) {
      messageElem.textContent = 'Ingrese un nombre para el tarifario';
      messageElem.style.color = 'red';
      return;
    }
    const file = fileInput.files[0];
    if (!file) {
      messageElem.textContent = 'Seleccione un archivo .xlsx';
      messageElem.style.color = 'red';
      return;
    }
    try {
      // Analizar el archivo Excel
      const data = await parseExcelFile(file);
      // Convertir logo a DataURL si existe
      let logoDataUrl = null;
      const logoFile = logoInput.files[0];
      if (logoFile) {
        logoDataUrl = await fileToDataURL(logoFile);
      }
      // Obtener lista actual de tarifarios
      const tarifarios = loadTarifarios();
      // Añadir nuevo
      tarifarios.push({ name, data, logo: logoDataUrl });
      saveTarifarios(tarifarios);
      // Activar el recién añadido
      const newIndex = tarifarios.length - 1;
      setActiveTarifarioIndex(newIndex);
      // Establecer dataset activo para el cotizador
      localStorage.setItem('tarifarioData', JSON.stringify(data));
      // Guardar logo activo
      if (logoDataUrl) {
        localStorage.setItem('tarifarioLogo', logoDataUrl);
      } else {
        localStorage.removeItem('tarifarioLogo');
      }
      // Limpiar campos
      nameInput.value = '';
      fileInput.value = '';
      logoInput.value = '';
      // Actualizar vista
      renderTarifariosList();
      messageElem.textContent = 'Tarifario agregado y activado correctamente';
      messageElem.style.color = 'green';
    } catch (error) {
      console.error(error);
      if (error.message && error.message.includes('estructura_incorrecta')) {
        messageElem.textContent = 'Estructura incorrecta: verifique que el archivo tenga las columnas requeridas';
      } else {
        messageElem.textContent = 'Error al procesar el archivo';
      }
      messageElem.style.color = 'red';
    }
  });

  // Evento para agregar un usuario nuevo
  document.getElementById('addUserBtn').addEventListener('click', () => {
    const usernameInput = document.getElementById('newUsername');
    const passwordInput = document.getElementById('newPassword');
    const roleSelect = document.getElementById('newRole');
    const userMessage = document.getElementById('userMessage');
    userMessage.textContent = '';
    userMessage.style.color = '';
    const uname = usernameInput.value.trim();
    const pass = passwordInput.value;
    const roleVal = roleSelect.value;
    if (!uname || !pass) {
      userMessage.textContent = 'Usuario y contraseña son obligatorios';
      userMessage.style.color = 'red';
      return;
    }
    const users = getUsers();
    if (users[uname]) {
      userMessage.textContent = 'El usuario ya existe';
      userMessage.style.color = 'red';
      return;
    }
    users[uname] = { password: pass, role: roleVal };
    saveUsers(users);
    // Limpiar campos
    usernameInput.value = '';
    passwordInput.value = '';
    roleSelect.value = 'asesor';
    userMessage.textContent = 'Usuario añadido correctamente';
    userMessage.style.color = 'green';
    renderUsers();
  });

  /**
   * Sección de excepciones de cobertura: permite buscar exámenes y añadirlos a una lista de excepciones
   * para que no se aplique cobertura en el cotizador. Usa appState.examenes como base de búsqueda.
   */
  const exceptionSearchInput = document.getElementById('exceptionSearch');
  const exceptionResults = document.getElementById('exceptionResults');
  const exceptionResultsUl = document.getElementById('exceptionResultsUl');
  const exceptionsListElem = document.getElementById('exceptionsList');
  // Cargar excepciones desde localStorage
  let exceptions = loadExceptions();
  renderExceptions();
  // Buscador de exámenes para excepciones
  if (exceptionSearchInput) {
    exceptionSearchInput.addEventListener('input', () => {
      const query = exceptionSearchInput.value.trim().toLowerCase();
      if (query.length >= 2) {
        const exams = appState.examenes || [];
        const results = exams.filter((ex) => {
          return (
            ex.descripcion.toLowerCase().includes(query) ||
            ex.codigo.toLowerCase().includes(query)
          );
        }).slice(0, 20);
        if (results.length > 0) {
          exceptionResultsUl.innerHTML = '';
          results.forEach((ex) => {
            const li = document.createElement('li');
            li.textContent = `${ex.codigo} – ${ex.descripcion}`;
            li.addEventListener('click', () => {
              addException(ex.codigo);
              exceptionResults.style.display = 'none';
              exceptionSearchInput.value = '';
            });
            exceptionResultsUl.appendChild(li);
          });
          exceptionResults.style.display = 'block';
        } else {
          exceptionResults.style.display = 'none';
        }
      } else {
        exceptionResults.style.display = 'none';
      }
    });
  }
  // Funciones para excepciones
  function loadExceptions() {
    const stored = localStorage.getItem('exceptions');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        localStorage.removeItem('exceptions');
      }
    }
    return [];
  }
  function saveExceptions(list) {
    localStorage.setItem('exceptions', JSON.stringify(list));
  }
  function renderExceptions() {
    exceptionsListElem.innerHTML = '';
    if (!exceptions || exceptions.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No hay exámenes sin cobertura.';
      exceptionsListElem.appendChild(li);
      return;
    }
    exceptions.forEach((code) => {
      const exam = (appState.examenes || []).find((e) => e.codigo === code);
      const name = exam ? exam.descripcion : code;
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      const span = document.createElement('span');
      span.style.flex = '1';
      span.textContent = `${code} – ${name}`;
      li.appendChild(span);
      const btn = document.createElement('button');
      btn.textContent = 'Quitar';
      btn.className = 'btn btn-small';
      btn.addEventListener('click', () => {
        exceptions = exceptions.filter((c) => c !== code);
        saveExceptions(exceptions);
        renderExceptions();
      });
      li.appendChild(btn);
      exceptionsListElem.appendChild(li);
    });
  }
  function addException(code) {
    if (!exceptions.includes(code)) {
      exceptions.push(code);
      saveExceptions(exceptions);
      renderExceptions();
    }
  }
});

/**
 * Lee la lista de tarifarios del almacenamiento local.
 * @returns {Array}
 */
function loadTarifarios() {
  const stored = localStorage.getItem('tarifarios');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('No se pudo parsear tarifarios de localStorage', e);
      localStorage.removeItem('tarifarios');
    }
  }
  return [];
}

/**
 * Guarda la lista de tarifarios en localStorage.
 * @param {Array} tarifarios
 */
function saveTarifarios(tarifarios) {
  localStorage.setItem('tarifarios', JSON.stringify(tarifarios));
}

/**
 * Obtiene el índice del tarifario activo. Si no existe, devuelve 0.
 */
function getActiveTarifarioIndex() {
  const idx = localStorage.getItem('activeTarifarioIndex');
  return idx !== null ? parseInt(idx, 10) : 0;
}

/**
 * Establece el índice del tarifario activo en localStorage.
 * @param {number} idx
 */
function setActiveTarifarioIndex(idx) {
  localStorage.setItem('activeTarifarioIndex', idx.toString());
}

/**
 * Convierte un archivo a DataURL usando FileReader. Retorna una promesa.
 * @param {File} file
 */
function fileToDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/**
 * Dibuja la lista de tarifarios con sus controles de activación y eliminación.
 */
function renderTarifariosList() {
  const listElem = document.getElementById('tarifariosList');
  listElem.innerHTML = '';
  const tarifarios = loadTarifarios();
  const active = getActiveTarifarioIndex();
  if (tarifarios.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No hay tarifarios cargados.';
    listElem.appendChild(li);
    return;
  }
  tarifarios.forEach((tar, idx) => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.gap = '10px';
    // Nombre del tarifario
    const nameSpan = document.createElement('span');
    nameSpan.textContent = tar.name;
    if (idx === active) {
      nameSpan.style.fontWeight = 'bold';
    }
    li.appendChild(nameSpan);
    // Botón activar
    const activateBtn = document.createElement('button');
    activateBtn.textContent = 'Activar';
    activateBtn.className = 'btn';
    activateBtn.style.fontSize = '12px';
    activateBtn.disabled = idx === active;
    activateBtn.addEventListener('click', () => {
      // Establecer activo
      setActiveTarifarioIndex(idx);
      // Establecer tarifarioData para cotizador
      localStorage.setItem('tarifarioData', JSON.stringify(tar.data));
      // Guardar logo activo para usar en el PDF
      if (tar.logo) {
        localStorage.setItem('tarifarioLogo', tar.logo);
      } else {
        localStorage.removeItem('tarifarioLogo');
      }
      renderTarifariosList();
    });
    li.appendChild(activateBtn);
    // Botón eliminar
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Eliminar';
    deleteBtn.className = 'btn';
    deleteBtn.style.backgroundColor = '#c00';
    deleteBtn.style.fontSize = '12px';
    deleteBtn.addEventListener('click', () => {
      const tarifariosArr = loadTarifarios();
      // Confirmación
      if (!confirm('¿Está seguro de eliminar este tarifario?')) {
        return;
      }
      tarifariosArr.splice(idx, 1);
      saveTarifarios(tarifariosArr);
      // Si se eliminó el activo, ajustar el índice y dataset activo
      let newActive = getActiveTarifarioIndex();
      if (idx === newActive) {
        newActive = 0;
        if (tarifariosArr.length > 0) {
          const firstTar = tarifariosArr[0];
          localStorage.setItem('tarifarioData', JSON.stringify(firstTar.data));
          if (firstTar.logo) {
            localStorage.setItem('tarifarioLogo', firstTar.logo);
          } else {
            localStorage.removeItem('tarifarioLogo');
          }
        } else {
          localStorage.removeItem('tarifarioData');
          localStorage.removeItem('tarifarioLogo');
        }
      } else if (idx < newActive) {
        newActive--;
      }
      setActiveTarifarioIndex(newActive);
      renderTarifariosList();
    });
    li.appendChild(deleteBtn);
    // Vista previa de logo si existe
    if (tar.logo) {
      const img = document.createElement('img');
      img.src = tar.logo;
      img.alt = 'Logo';
      img.style.width = '40px';
      img.style.height = 'auto';
      li.appendChild(img);
    }
    // Botón para subir o cambiar logo del tarifario
    const logoBtn = document.createElement('button');
    logoBtn.textContent = tar.logo ? 'Cambiar logo' : 'Subir logo';
    logoBtn.className = 'btn';
    logoBtn.style.fontSize = '12px';
    logoBtn.addEventListener('click', () => {
      // Crear input de tipo file y simular clic
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.png,.jpg,.jpeg';
      input.onchange = async () => {
        const file = input.files[0];
        if (file) {
          const dataUrl = await fileToDataURL(file);
          // Actualizar el logo en la lista y guardar en localStorage
          const arr = loadTarifarios();
          arr[idx].logo = dataUrl;
          saveTarifarios(arr);
          // Si es el activo, actualizar logo para el PDF
          if (idx === getActiveTarifarioIndex()) {
            localStorage.setItem('tarifarioLogo', dataUrl);
          }
          renderTarifariosList();
        }
      };
      input.click();
    });
    li.appendChild(logoBtn);
    listElem.appendChild(li);
  });
  // Si los tarifarios cambian (activan, eliminan, etc.), renderizar logos nuevamente
  if (typeof renderInsurerLogos === 'function') {
    renderInsurerLogos();
  }
}

/**
 * Genera un archivo CSV con el historial de cotizaciones y lo descarga.
 */
function downloadLogs() {
  const logMessage = document.getElementById('logDownloadMessage');
  if (logMessage) {
    logMessage.textContent = '';
    logMessage.style.color = '';
  }
  const stored = localStorage.getItem('quotesLog');
  if (!stored) {
    if (logMessage) {
      logMessage.textContent = 'No hay cotizaciones registradas.';
      logMessage.style.color = 'red';
    }
    return;
  }
  let logs;
  try {
    logs = JSON.parse(stored);
  } catch (e) {
    console.error('Error al parsear logs', e);
    if (logMessage) {
      logMessage.textContent = 'Error al leer los registros.';
      logMessage.style.color = 'red';
    }
    return;
  }
  if (!logs || logs.length === 0) {
    if (logMessage) {
      logMessage.textContent = 'No hay cotizaciones registradas.';
      logMessage.style.color = 'red';
    }
    return;
  }
  const csvRows = [];
  csvRows.push('Fecha,Asesor,Paciente,Aseguradora,Subtotal,Cobertura(%),Total');
  logs.forEach((log) => {
    const fields = [
      log.timestamp || '',
      log.asesor || '',
      log.paciente || '',
      log.aseguradora || '',
      log.subtotal != null ? formatCurrency(log.subtotal) : '',
      log.coverage != null ? log.coverage.toString() : '',
      log.total != null ? formatCurrency(log.total) : '',
    ];
    // Escapar comillas dobles duplicándolas
    const escaped = fields.map((f) => {
      const s = String(f);
      if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    });
    csvRows.push(escaped.join(','));
  });
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'historial_cotizaciones.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (logMessage) {
    logMessage.textContent = 'Historial descargado correctamente.';
    logMessage.style.color = 'green';
  }
}

/**
 * Muestra los registros de cotizaciones emitidas en la tabla.
 */
function renderLogs() {
  const tbody = document.getElementById('logTableBody');
  tbody.innerHTML = '';
  const stored = localStorage.getItem('quotesLog');
  if (!stored) {
    return;
  }
  let logs;
  try {
    logs = JSON.parse(stored);
  } catch (e) {
    console.error('Error al parsear logs', e);
    return;
  }
  logs.forEach((log) => {
    const tr = document.createElement('tr');
    const cells = [
      log.timestamp || '',
      log.asesor || '',
      log.paciente || '',
      log.aseguradora || '',
      formatCurrency(log.subtotal || 0),
      log.coverage != null ? log.coverage.toString() : '',
      formatCurrency(log.total || 0),
    ];
    cells.forEach((val) => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

/**
 * Renderiza la lista de usuarios actuales y añade botones para eliminarlos.
 */
function renderUsers() {
  const list = document.getElementById('usersList');
  list.innerHTML = '';
  const users = getUsers();
  const { username } = getSessionUser();
  Object.keys(users).forEach((uname) => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.gap = '10px';
    const span = document.createElement('span');
    span.textContent = `${uname} (${users[uname].role})`;
    li.appendChild(span);
    // Eliminar botón no se muestra para sí mismo
    if (uname !== username) {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Eliminar';
      delBtn.className = 'btn';
      delBtn.style.backgroundColor = '#c00';
      delBtn.style.fontSize = '12px';
      delBtn.addEventListener('click', () => {
        if (!confirm('¿Desea eliminar al usuario ' + uname + '?')) return;
        const allUsers = getUsers();
        delete allUsers[uname];
        saveUsers(allUsers);
        renderUsers();
      });
      li.appendChild(delBtn);
    }
    list.appendChild(li);
  });
}

/**
 * Verifica si hay tarifarios guardados en localStorage y, en caso de no haber ninguno,
 * carga el tarifario por defecto desde el archivo JSON incluido en la aplicación.
 * Esto permite que el administrador tenga un tarifario base disponible al ingresar
 * por primera vez a la página de administración. También establece este tarifario
 * como el activo y guarda sus datos en localStorage para que el cotizador lo use.
 */
async function ensureDefaultTarifario() {
  const existing = loadTarifarios();
  if (existing && existing.length > 0) {
    return;
  }
  // Cargar dataset predeterminado utilizando la función de app.js
  try {
    await loadTarifario();
    if (appState && appState.data) {
      const defaultEntry = {
        name: 'Tarifario base',
        data: appState.data,
        logo: null,
      };
      saveTarifarios([defaultEntry]);
      setActiveTarifarioIndex(0);
      localStorage.setItem('tarifarioData', JSON.stringify(appState.data));
      localStorage.removeItem('tarifarioLogo');
    }
  } catch (e) {
    console.warn('No se pudo cargar el tarifario por defecto', e);
  }
}

/**
 * Devuelve un mapa de logos por aseguradora almacenados en localStorage.
 * Las claves son los nombres de las aseguradoras y los valores son DataURLs.
 */
function loadLogosByInsurer() {
  const stored = localStorage.getItem('logosByInsurer');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('No se pudo parsear logos por aseguradora', e);
      localStorage.removeItem('logosByInsurer');
    }
  }
  return {};
}

/**
 * Guarda el mapa de logos por aseguradora en localStorage.
 * @param {Object} logos
 */
function saveLogosByInsurer(logos) {
  localStorage.setItem('logosByInsurer', JSON.stringify(logos));
}

/**
 * Renderiza la lista de aseguradoras con la opción de subir o cambiar su logo.
 * Utiliza las aseguradoras definidas en appState (exceptuando "Particular").
 */
function renderInsurerLogos() {
  const listElem = document.getElementById('insurerLogoList');
  if (!listElem) return;
  listElem.innerHTML = '';
  const insurers = appState && appState.aseguradoras ? appState.aseguradoras : [];
  const logosMap = loadLogosByInsurer();
  insurers.forEach((ins) => {
    if (ins === 'Particular') return;
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.gap = '10px';
    // nombre
    const nameSpan = document.createElement('span');
    nameSpan.textContent = ins;
    nameSpan.style.minWidth = '120px';
    li.appendChild(nameSpan);
    // preview
    if (logosMap[ins]) {
      const img = document.createElement('img');
      img.src = logosMap[ins];
      img.alt = 'Logo ' + ins;
      img.style.width = '40px';
      img.style.height = 'auto';
      li.appendChild(img);
    }
    // botón para subir/cambiar logo
    const btn = document.createElement('button');
    btn.textContent = logosMap[ins] ? 'Cambiar logo' : 'Subir logo';
    btn.className = 'btn';
    btn.style.fontSize = '12px';
    btn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.png,.jpg,.jpeg';
      input.onchange = async () => {
        const file = input.files[0];
        if (file) {
          const dataUrl = await fileToDataURL(file);
          const logos = loadLogosByInsurer();
          logos[ins] = dataUrl;
          saveLogosByInsurer(logos);
          renderInsurerLogos();
        }
      };
      input.click();
    });
    li.appendChild(btn);
    listElem.appendChild(li);
  });
}

/**
 * Convierte un archivo Excel (.xlsx) en un objeto de tarifario compatible con la aplicación.
 * El archivo debe tener columnas: DESCRIPCIÓN, CODIGO, GRUPO, PRECIO y una columna por aseguradora.
 * @param {File} file
 * @returns {Promise<{aseguradoras: string[], examenes: any[]}>}
 */
function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        const reserved = ['DESCRIPCIÓN', 'CODIGO', 'GRUPO', 'PRECIO'];
        if (!rows || rows.length === 0) {
          throw new Error('estructura_incorrecta');
        }
        const firstRow = rows[0];
        const missing = reserved.filter((col) => !(col in firstRow));
        if (missing.length > 0) {
          throw new Error('estructura_incorrecta');
        }
        const insurers = new Set(['Particular']);
        const examenes = [];
        rows.forEach((row) => {
          const descripcion = row['DESCRIPCIÓN'];
          if (!descripcion) return;
          let codigo = row['CODIGO'] || '';
          if (typeof codigo === 'number') {
            codigo = codigo.toString().split('.')[0];
          } else {
            codigo = codigo.toString();
          }
          const grupo = row['GRUPO'] ? row['GRUPO'].toString().trim() : '';
          const precio = row['PRECIO'] != null ? parseFloat(row['PRECIO']) || 0 : 0;
          const tarifas = {};
          Object.keys(row).forEach((key) => {
            if (!reserved.includes(key)) {
              const val = row[key];
              if (val != null && val !== '') {
                tarifas[key] = parseFloat(val);
              } else {
                tarifas[key] = null;
              }
              insurers.add(key);
            }
          });
          examenes.push({ codigo, descripcion: descripcion.toString().trim(), grupo, precio, tarifas });
        });
        resolve({ aseguradoras: Array.from(insurers), examenes });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => {
      reject(new Error('No se pudo leer el archivo'));
    };
    reader.readAsArrayBuffer(file);
  });
}