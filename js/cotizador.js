// cotizador.js
// Lógica para la página de cotización de Metrored

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar sesión
  const { username, role } = getSessionUser();
  if (!username || role !== 'asesor') {
    // Redirigir a inicio si no hay sesión o rol incorrecto
    window.location.href = 'index.html';
    return;
  }
  // Saludo y botón de salida
  const greeting = document.getElementById('userGreeting');
  if (greeting) greeting.textContent = `Hola, ${username}`;
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Cargar tarifario
  await loadTarifario();
  initCotizador();
});

/**
 * Inicializa la lógica de la página de cotización una vez cargados los datos.
 */
function initCotizador() {
  // DOM references
  const aseguradoraSelect = document.getElementById('aseguradoraSelect');
  const coverageGroup = document.getElementById('coverageGroup');
  const coverageInput = document.getElementById('coverageInput');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearch');
  const resultsList = document.getElementById('resultsList');
  const resultsUl = document.getElementById('resultsUl');
  const itemsBody = document.getElementById('itemsBody');
  const noItemsMsg = document.getElementById('noItemsMsg');
  const subtotalElem = document.getElementById('subtotal');
  // Elementos para mostrar el copago referencial.  Se calculan dinámicamente
  const copagoSummary = document.getElementById('copagoSummary');
  const copagoPercElem = document.getElementById('copagoPerc');
  const copagoAmountElem = document.getElementById('copagoAmount');
  const totalAmountElem = document.getElementById('totalAmount');
  const generatePdfBtn = document.getElementById('generatePdf');
  const generateError = document.getElementById('generateError');
  const clientNameInput = document.getElementById('clientName');
  const clientCedulaInput = document.getElementById('clientCedula');
  const cedulaErrorElem = document.getElementById('cedulaError');

  // Variables de estado
  let cart = [];

  // Rellena lista de aseguradoras
  if (aseguradoraSelect) {
    aseguradoraSelect.innerHTML = '';
    appState.aseguradoras.forEach((aseg) => {
      const opt = document.createElement('option');
      opt.value = aseg;
      opt.textContent = aseg;
      aseguradoraSelect.appendChild(opt);
    });
  }

  // Función para actualizar visibilidad de cobertura
  function updateCoverageVisibility() {
    const current = aseguradoraSelect ? aseguradoraSelect.value : '';
    if (coverageGroup) {
      if (current && current !== 'Particular') {
        coverageGroup.style.display = 'block';
        // Cuando hay aseguradora se muestra el copago referencial
        if (copagoSummary) copagoSummary.style.display = 'block';
      } else {
        coverageGroup.style.display = 'none';
        if (copagoSummary) copagoSummary.style.display = 'none';
      }
    }
    updateSummary();
  }
  if (aseguradoraSelect) {
    aseguradoraSelect.addEventListener('change', () => {
      // Si cambia la aseguradora, recalcular precios y mostrar/ocultar cobertura
      updateCoverageVisibility();
      recalcCartPrices();
      renderCart();
    });
  }
  // Inicializar visibilidad
  updateCoverageVisibility();

  // Búsqueda de exámenes
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      if (query.length >= 2) {
        const results = appState.examenes
          .filter((exam) => {
            return (
              exam.descripcion.toLowerCase().includes(query) ||
              exam.codigo.toLowerCase().includes(query)
            );
          })
          .slice(0, 20);
        if (results.length > 0) {
          if (resultsUl) resultsUl.innerHTML = '';
          results.forEach((exam) => {
            // Calcular precios PVP y PVA para mostrar en la lista de resultados
            const pvp = parseFloat(exam.precio) || 0;
            let pva = null;
            const currentAseg = aseguradoraSelect ? aseguradoraSelect.value : '';
            if (currentAseg && currentAseg !== 'Particular' && exam.tarifas) {
              const tarifa = exam.tarifas[currentAseg];
              if (tarifa != null && !isNaN(tarifa)) {
                pva = parseFloat(tarifa);
              }
            }
            const li = document.createElement('li');
            li.innerHTML = `<strong>${exam.codigo}</strong> – ${exam.descripcion}<br/><small>PVP: ${formatCurrency(pvp)} ${pva != null ? '– PVA: ' + formatCurrency(pva) : ''}</small>`;
            li.style.lineHeight = '1.2';
            li.addEventListener('click', () => {
              addExamToCart(exam);
              if (resultsUl) resultsUl.innerHTML = '';
              if (resultsList) resultsList.style.display = 'none';
              if (searchInput) searchInput.value = '';
            });
            if (resultsUl) resultsUl.appendChild(li);
          });
          if (resultsList) resultsList.style.display = 'block';
        } else {
          if (resultsList) resultsList.style.display = 'none';
        }
      } else {
        if (resultsList) resultsList.style.display = 'none';
      }
    });
  }
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (resultsList) resultsList.style.display = 'none';
    });
  }

  // Añade examen al carrito
  function addExamToCart(exam) {
    const existing = cart.find((item) => item.codigo === exam.codigo);
    if (existing) {
      existing.cantidad += 1;
    } else {
      const price = getExamPrice(exam, aseguradoraSelect ? aseguradoraSelect.value : '');
      cart.push({
        codigo: exam.codigo,
        descripcion: exam.descripcion,
        priceUnit: price,
        cantidad: 1,
      });
    }
    renderCart();
  }

  // Obtiene el precio para un examen según la aseguradora seleccionada
  function getExamPrice(exam, aseguradora) {
    if (!aseguradora || aseguradora === 'Particular') {
      return parseFloat(exam.precio) || 0;
    }
    const tarifa = exam.tarifas[aseguradora];
    if (tarifa != null && !isNaN(tarifa)) {
      return parseFloat(tarifa);
    }
    return parseFloat(exam.precio) || 0;
  }

  // Recalcula precios unitarios del carrito cuando cambia la aseguradora
  function recalcCartPrices() {
    cart.forEach((item) => {
      const exam = appState.examenes.find((e) => e.codigo === item.codigo);
      if (exam) {
        item.priceUnit = getExamPrice(exam, aseguradoraSelect ? aseguradoraSelect.value : '');
      }
    });
  }

  // Renderiza el carrito en la tabla
  function renderCart() {
    if (itemsBody) itemsBody.innerHTML = '';
    if (cart.length === 0) {
      if (noItemsMsg) noItemsMsg.style.display = 'block';
    } else {
      if (noItemsMsg) noItemsMsg.style.display = 'none';
    }
    cart.forEach((item, index) => {
      const tr = document.createElement('tr');
      // obtener examen original para calcular PVP y PVA
      const exam = appState.examenes.find((e) => e.codigo === item.codigo);
      const pvp = exam ? parseFloat(exam.precio) : item.priceUnit;
      let pva = null;
      const currentAseg = aseguradoraSelect ? aseguradoraSelect.value : '';
      if (currentAseg && currentAseg !== 'Particular' && exam && exam.tarifas) {
        const tarifa = exam.tarifas[currentAseg];
        if (tarifa != null && !isNaN(tarifa)) {
          pva = parseFloat(tarifa);
        }
      }
      // código
      const tdCode = document.createElement('td');
      tdCode.textContent = item.codigo;
      tr.appendChild(tdCode);
      // descripción
      const tdDesc = document.createElement('td');
      tdDesc.textContent = item.descripcion;
      tr.appendChild(tdDesc);
      // PVP
      const tdPvp = document.createElement('td');
      tdPvp.textContent = formatCurrency(pvp);
      tr.appendChild(tdPvp);
      // PVA
      const tdPva = document.createElement('td');
      tdPva.textContent = (pva != null) ? formatCurrency(pva) : '-';
      tr.appendChild(tdPva);
      // cantidad (editable)
      const tdQty = document.createElement('td');
      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.value = item.cantidad;
      qtyInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 1) {
          qtyInput.value = item.cantidad;
          return;
        }
        item.cantidad = val;
        updateSummary();
        // actualizar fila total
        // el renderCart volverá a escribir la tabla más adelante si es necesario
        tdTotal.textContent = formatCurrency(item.priceUnit * item.cantidad);
      });
      tdQty.appendChild(qtyInput);
      tr.appendChild(tdQty);
      // total
      const tdTotal = document.createElement('td');
      tdTotal.textContent = formatCurrency(item.priceUnit * item.cantidad);
      tr.appendChild(tdTotal);
      // eliminar
      const tdRemove = document.createElement('td');
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Eliminar';
      removeBtn.className = 'btn';
      removeBtn.style.fontSize = '12px';
      removeBtn.addEventListener('click', () => {
        cart.splice(index, 1);
        renderCart();
      });
      tdRemove.appendChild(removeBtn);
      tr.appendChild(tdRemove);
      if (itemsBody) itemsBody.appendChild(tr);
    });
    updateSummary();
  }

  // Recalcula el subtotal a partir del estado actual del carrito
  function calculateSubtotal() {
    return cart.reduce((acc, item) => {
      const price = Number(item.priceUnit ?? item.precio ?? item.price) || 0;
      const qty = Number(item.cantidad ?? item.qty) || 1;
      return acc + price * qty;
    }, 0);
  }

  // Actualiza los totales y copago en el resumen
  function updateSummary() {
    const subtotal = calculateSubtotal();
    if (subtotalElem) subtotalElem.textContent = formatCurrency(subtotal);

    const aseg = aseguradoraSelect ? aseguradoraSelect.value : '';
    const coverage = coverageInput ? parseFloat(coverageInput.value) || 0 : 0;

    if (aseg && aseg !== 'Particular') {
      // Obtiene la lista de exámenes sin cobertura desde localStorage
      let exceptions = [];
      try {
        const excStr = localStorage.getItem('exceptions');
        if (excStr) {
          exceptions = JSON.parse(excStr);
        }
      } catch (e) {
        exceptions = [];
      }
      // Copago referencial: complemento al porcentaje de cobertura
      const copagoPercent = 100 - coverage;
      if (copagoPercElem) copagoPercElem.textContent = copagoPercent.toString();
      // Calcular copago total considerando excepciones (sin cobertura)
      let totalCopago = 0;
      cart.forEach((item) => {
        const priceItem = (Number(item.priceUnit) || 0) * (Number(item.cantidad) || 1);
        if (exceptions.includes(item.codigo)) {
          // Este examen no tiene cobertura, se paga completo
          totalCopago += priceItem;
        } else {
          // Aplicar copago según el porcentaje general
          totalCopago += priceItem * (copagoPercent / 100);
        }
      });
      if (copagoAmountElem) copagoAmountElem.textContent = formatCurrency(totalCopago);
      if (totalAmountElem) totalAmountElem.textContent = formatCurrency(subtotal);
      if (copagoSummary) copagoSummary.style.display = 'block';
    } else {
      // Particular o sin aseguradora: todo se paga como copago
      if (copagoAmountElem) copagoAmountElem.textContent = formatCurrency(subtotal);
      if (totalAmountElem) totalAmountElem.textContent = formatCurrency(subtotal);
      if (copagoSummary) copagoSummary.style.display = 'none';
      if (copagoPercElem) copagoPercElem.textContent = '0';
    }

    // Compatibilidad hacia atrás: si hay código externo que lee window.subtotal
    try {
      window.subtotal = subtotal;
    } catch (e) {
      // ignorar si no se puede asignar
    }
  }

  // Validación de cédula en tiempo real
  if (clientCedulaInput) {
    clientCedulaInput.addEventListener('input', () => {
      const ced = clientCedulaInput.value.trim();
      if (ced === '') {
        if (cedulaErrorElem) cedulaErrorElem.textContent = '';
        return;
      }
      if (validarCedula(ced)) {
        if (cedulaErrorElem) cedulaErrorElem.textContent = '';
      } else {
        if (cedulaErrorElem) cedulaErrorElem.textContent = 'Cédula inválida';
      }
    });
  }

  // Evento para actualizar el resumen cuando cambia la cobertura referencial
  if (coverageInput) {
    coverageInput.addEventListener('input', () => {
      // Limitar valor entre 0 y 100 y redondear a entero
      let val = parseFloat(coverageInput.value);
      if (isNaN(val) || val < 0) val = 0;
      if (val > 100) val = 100;
      coverageInput.value = val;
      updateSummary();
    });
  }

  // Acción para generar PDF
  if (generatePdfBtn) {
    generatePdfBtn.addEventListener('click', async () => {
      if (generateError) generateError.textContent = '';
      // Validar campos
      const clientName = clientNameInput ? clientNameInput.value.trim() : '';
      const clientCedula = clientCedulaInput ? clientCedulaInput.value.trim() : '';
      if (!clientName) {
        if (generateError) generateError.textContent = 'Ingrese el nombre del cliente';
        return;
      }
      if (!validarCedula(clientCedula)) {
        if (generateError) generateError.textContent = 'Número de cédula inválido';
        return;
      }
      if (cart.length === 0) {
        if (generateError) generateError.textContent = 'Añada al menos un examen para cotizar';
        return;
      }
      // Recoger datos
      const aseguradora = aseguradoraSelect ? aseguradoraSelect.value : '';
      const coverage = coverageInput ? parseFloat(coverageInput.value) || 0 : 0;
      // Obtener subtotal desde la fuente de la verdad (cart)
      const subtotal = calculateSubtotal();
      // total se calculará tras recalcular copago/covered
      let total = subtotal;

      // Recalcular copago y cubierto considerando excepciones
      let covered = 0;
      let copago = 0;
      if (aseguradora && aseguradora !== 'Particular') {
        // Cargar lista de exámenes sin cobertura
        let exceptions = [];
        try {
          const excStr = localStorage.getItem('exceptions');
          if (excStr) exceptions = JSON.parse(excStr);
        } catch (e) {
          exceptions = [];
        }
        // Calcula copago y cubierto por ítem
        cart.forEach((item) => {
          const priceItem = (Number(item.priceUnit) || 0) * (Number(item.cantidad) || 1);
          if (exceptions.includes(item.codigo)) {
            // Sin cobertura para este examen: todo es copago
            copago += priceItem;
          } else {
            copago += priceItem * ((100 - coverage) / 100);
          }
        });
        covered = subtotal - copago;
        total = covered + copago;
      } else {
        // Particular: todo es copago y no hay cobertura
        copago = subtotal;
        covered = 0;
        total = subtotal;
      }

      // Preparar PDF
      const { jsPDF } = window.jspdf;
      // Utilizar formato A4 para mostrar toda la información y permitir texto más grande
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      // Dimensiones de página en milímetros para A4 (210×297)
      const pageWidth = 210;
      const pageHeight = 297;
      // Cargar logos en DataURL: logo de Metrored y logo de la aseguradora
      const metroLogoUrl = 'images/logo.png';
      let metroLogoDataUrl = null;
      try {
        metroLogoDataUrl = await toDataURL(metroLogoUrl);
      } catch (e) {
        console.warn('No se pudo cargar logo Metrored:', e);
        metroLogoDataUrl = null;
      }
      // Determinar el logo de aseguradora: prioridad al logo cargado por aseguradora, luego el logo asociado al tarifario
      let insurerLogoDataUrl = null;
      try {
        const logosStr = localStorage.getItem('logosByInsurer');
        if (logosStr) {
          const logosObj = JSON.parse(logosStr);
          if (logosObj && logosObj[aseguradora]) {
            insurerLogoDataUrl = logosObj[aseguradora];
          }
        }
      } catch (e) {
        console.warn('No se pudo parsear logosByInsurer', e);
      }
      // Si no hay logo específico pero existe uno en el tarifario, usarlo
      if (!insurerLogoDataUrl) {
        const logoFromTarifario = localStorage.getItem('tarifarioLogo');
        if (logoFromTarifario) {
          insurerLogoDataUrl = logoFromTarifario;
        }
      }
      // Definiciones de layout
      // Altura de cada fila en la tabla. Para A4 usamos filas más altas para evitar superposiciones
      // Aumentamos ligeramente la altura para garantizar que el encabezado de la tabla
      // y las filas de los exámenes no se superpongan visualmente incluso con textos largos.
      const rowHeight = 15;
      // Márgenes del documento en A4. Dejar 20 mm a cada lado para texto más grande
      const margin = 20;
      // Calcular número de cotización y fechas
      const quoteNumber = String(Date.now() % 1000000).padStart(6, '0');
      const todayDate = new Date();
      const dayStr = String(todayDate.getDate()).padStart(2, '0');
      const monthStr = String(todayDate.getMonth() + 1).padStart(2, '0');
      const yearStr = todayDate.getFullYear();
      const quoteDateStr = `${dayStr}-${monthStr}-${yearStr}`;
      const dueDate = new Date(todayDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const dueDayStr = String(dueDate.getDate()).padStart(2, '0');
      const dueMonthStr = String(dueDate.getMonth() + 1).padStart(2, '0');
      const dueYearStr = dueDate.getFullYear();
      const dueDateStr = `${dueDayStr}-${dueMonthStr}-${dueYearStr}`;
      // Copago porcentual para mostrar en el encabezado
      const copagoPercentHeader = aseguradora !== 'Particular' ? 100 - coverage : 0;
      // Determinar la altura del resumen (tres filas para aseguradora, dos para particular)
      const resumenLineas = aseguradora !== 'Particular' ? 3 : 2;
      const resumenHeight = resumenLineas * rowHeight + 4; // Altura del resumen con margen interno
      // Calcular cuántas filas caben por página
      // Primer margen para header y espacio después del header (deja lugar para detalles y encabezado de tabla)
      // Altura aproximada de la cabecera (incluyendo logos y detalles). Para A4 damos más espacio
      const headerYEnd = 70;
      // Altura del pie de página para número de página y textos legales en A4
      const footerHeight = 40;
      const availableHeightNoSummary = pageHeight - headerYEnd - footerHeight;
      const maxRowsNoSummary = Math.floor(availableHeightNoSummary / rowHeight);
      const availableHeightWithSummary = pageHeight - headerYEnd - footerHeight - resumenHeight;
      const maxRowsWithSummary = Math.floor(availableHeightWithSummary / rowHeight);
      // Distribuir filas entre páginas
      const filas = cart.map((it) => it);
      const pageRows = [];
      let remaining = filas.length;
      while (remaining > maxRowsWithSummary) {
        pageRows.push(maxRowsNoSummary);
        remaining -= maxRowsNoSummary;
      }
      pageRows.push(remaining);
      const totalPages = pageRows.length;
      let currentRowIndex = 0;
      let pageNum = 1;
      /**
       * Dibuja el encabezado de cada página. Incluye logos, título, detalles del cliente, aseguradora y cotización.
       */
      function drawHeader() {
        // No dibujar marco exterior para formato A4
        // Logos
        // Logo de Metrored a la izquierda
        // Ajustar el tamaño de los logos para que no se aplasten.  Usamos proporciones más
        // pequeñas y mantenemos una relación aproximada 3:1 (ancho:alto).  Al reducir
        // el tamaño se mejora la calidad visual del PDF.
        const logoW = 35;
        const logoH = 23;
        const logoY = margin + 2;
        if (metroLogoDataUrl) {
          try {
            doc.addImage(metroLogoDataUrl, 'PNG', margin, logoY, logoW, logoH);
          } catch (e) {
            // Ignorar si la imagen no se puede añadir
          }
        }
        // Logo del seguro a la derecha si existe
        if (insurerLogoDataUrl) {
          try {
            doc.addImage(insurerLogoDataUrl, 'PNG', pageWidth - margin - logoW, logoY, logoW, logoH);
          } catch (e) {
            // Ignorar
          }
        }
        // Título centrado con tamaño de letra mayor para A4
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(20);
        doc.text('Cotización de Servicios', pageWidth / 2, logoY + logoH + 15, { align: 'center' });
        // Detalles de cliente y cotización en dos columnas. Fuente ligeramente más grande en A4
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        let infoY = logoY + logoH + 25;
        const col1X = margin;
        const col2X = pageWidth / 2 + 4;
        // Primera fila
        doc.text(`Cliente: ${clientName}`, col1X, infoY);
        doc.text(`Cédula: ${clientCedula}`, col2X, infoY);
        infoY += 4;
        // Segunda fila: aseguradora y copago/cobertura
        doc.text(`Aseguradora: ${aseguradora}`, col1X, infoY);
        if (aseguradora !== 'Particular') {
          doc.text(`Copago ref.: ${copagoPercentHeader}%`, col2X, infoY);
        }
        infoY += 4;
        // Tercera fila: número de cotización y fecha
        doc.text(`N° Cotización: ${quoteNumber}`, col1X, infoY);
        doc.text(`Fecha: ${quoteDateStr}`, col2X, infoY);
        infoY += 4;
        // Cuarta fila: validez
        doc.text(`Validez hasta: ${dueDateStr}`, col1X, infoY);
        // Línea separadora bajo los detalles
        const yLine = headerYEnd - 3;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yLine, pageWidth - margin, yLine);
        // Encabezado de la tabla
        const tableHeaderY = headerYEnd;
        const headerLabels = ['Código', 'Descripción',  'Cant.', 'PVP', 'PVA'];
        // Anchuras de columna adaptadas a formato A4 (suma 190 mm):
        // Código, Descripción, PVP, PVA, Cant.
        const colWidths = [25, 90, 20, 20, 15];
        const xPositions = [margin];
        for (let i = 0; i < colWidths.length - 1; i++) {
          xPositions.push(xPositions[i] + colWidths[i]);
        }
        // Draw background
        doc.setFillColor(0, 91, 171);
        doc.rect(margin, tableHeaderY, pageWidth - 2 * margin, rowHeight, 'F');
        // Draw header text
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        for (let i = 0; i < headerLabels.length; i++) {
          const x = xPositions[i] + 1;
          const align = i >= 2 ? 'right' : 'left';
          const colWidth = colWidths[i];
          let textX = x;
          if (align === 'right') {
            textX = xPositions[i] + colWidths[i] - 1;
          }
          doc.text(headerLabels[i], textX, tableHeaderY + rowHeight - 2, { align: align });
        }
        // Reset text color for body
        doc.setTextColor(0, 0, 0);
      }

      /**
       * Dibuja el pie de página con número de página y texto legal.
       */
      function drawFooter() {
        doc.setFontSize(7.5);
        doc.setFont('Helvetica', 'normal');
        // Número de página
        doc.text(`Página ${pageNum} de ${totalPages}`, margin, pageHeight - 8);
        // Texto legal (varias líneas si es necesario)
        const legal = 'Esta cotización tiene carácter informativo y no constituye una oferta o compromiso de venta. Los valores presentados son referenciales y podrán variar según la validación de las condiciones de seguros y coberturas al momento del pago en caja.';
        const maxWidth = pageWidth - 2 * margin - 60;
        // Ajustar texto legal en varias líneas
        const legalLines = doc.splitTextToSize(legal, maxWidth);
        const legalY = pageHeight - 8;
        doc.text(legalLines, pageWidth - margin - maxWidth, legalY, { align: 'left' });
      }
      // Variables para dibujo de filas: coinciden con la cabecera
      // Anchos de columnas para A4 (suma 190 mm)
      const colWidths = [25, 90, 20, 20, 15, 20];
      const xPositions = [margin];
      for (let i = 0; i < colWidths.length - 1; i++) {
        xPositions.push(xPositions[i] + colWidths[i]);
      }
      // Dibujar páginas y filas
      let filaIndex = 0;
      for (let p = 0; p < pageRows.length; p++) {
        if (p > 0) {
          doc.addPage();
          pageNum++;
        }
        drawHeader();
        // Y inicial para la primera fila de datos en esta página
        // La primera fila de datos comienza dos filas por debajo del encabezado de la tabla.
        // Sumamos un pequeño margen adicional (30 mm) para evitar cualquier solapamiento con textos altos.
        let yPos = headerYEnd + rowHeight + 30;
        const rowsInPage = pageRows[p];
        // Dibujar filas
        doc.setFontSize(9);
        doc.setFont('Helvetica', 'normal');
        for (let i = 0; i < rowsInPage; i++) {
          const item = cart[filaIndex];
          // Encontrar examen original para precios
          const exam = appState.examenes.find((e) => e.codigo === item.codigo);
          const pvp = exam ? parseFloat(exam.precio) : item.priceUnit;
          let pva = '';
          if (aseguradora !== 'Particular') {
            const val = exam && exam.tarifas ? exam.tarifas[aseguradora] : null;
            if (val != null && !isNaN(val)) {
              pva = parseFloat(val);
            }
          }
          const desc = item.descripcion.length > 50 ? item.descripcion.substring(0, 47) + '...' : item.descripcion;
          // Column values
          const values = [
            item.codigo,
            desc,
            item.cantidad.toString(),
            formatCurrency(pvp),
            pva === '' ? '-' : formatCurrency(pva),
            formatCurrency(item.priceUnit * item.cantidad),
          ];
          for (let c = 0; c < values.length; c++) {
            const align = c >= 2 ? 'right' : 'left';
            let textX = xPositions[c] + 1;
            if (align === 'right') {
              textX = xPositions[c] + colWidths[c] - 1;
            }
            doc.text(String(values[c]), textX, yPos - 2, { align: align });
          }
          yPos += rowHeight;
          filaIndex++;
        }
        // Si es la última página, dibujar resumen debajo de la tabla
        if (p === pageRows.length - 1) {
          let summaryY = yPos + 4;
          // Si no hay suficiente espacio, empezar una nueva página
          if (summaryY + resumenHeight + footerHeight > pageHeight - 5) {
            drawFooter();
            doc.addPage();
            pageNum++;
            drawHeader();
            summaryY = headerYEnd + rowHeight + 4;
          }
          // Construir líneas de resumen: Subtotal, Copago (si aplica) y Total
          const summaryLines = [];
          summaryLines.push(['Subtotal', formatCurrency(subtotal)]);
          if (aseguradora !== 'Particular') {
            const copagoPercent = 100 - coverage;
            summaryLines.push([`Copago referencial (${copagoPercent}%)`, formatCurrency(copago)]);
          }
          summaryLines.push(['Total', formatCurrency(total)]);
          // Dibujar cada línea del resumen
          doc.setFontSize(9);
          // Posición horizontal del resumen ajustada al nuevo formato A4. Ancho total 110 mm (70 para etiquetas y 40 para valores)
          const totalSummaryWidth = 110;
          // Centrar el recuadro dentro del ancho disponible (ancho útil = pageWidth - 2*margin)
          const summaryX = margin + ((pageWidth - 2 * margin) - totalSummaryWidth);
          let rowY = summaryY;
          for (let i = 0; i < summaryLines.length; i++) {
            const [label, value] = summaryLines[i];
            // Establecer colores de fondo y texto
            if (i === summaryLines.length - 1) {
              // total en azul oscuro con texto blanco
              doc.setFillColor(0, 91, 171);
              doc.setTextColor(255, 255, 255);
            } else {
              // otras filas en azul claro con texto negro
              doc.setFillColor(230, 241, 255);
              doc.setTextColor(0, 0, 0);
            }
            // Dibujar celdas de fondo para la etiqueta y el valor. La columna de etiqueta tiene 70 mm y la de valor 40 mm
            doc.rect(summaryX, rowY, 70, rowHeight, 'F');
            doc.rect(summaryX + 70, rowY, 40, rowHeight, 'F');
            // Texto
            doc.setFont('Helvetica', i === summaryLines.length - 1 ? 'bold' : 'normal');
            // Etiqueta alineada a la izquierda en la celda de 70 mm
            doc.text(label, summaryX + 2, rowY + (rowHeight - 2));
            // Valor alineado a la derecha dentro de la celda de 40 mm
            doc.text('$' + value, summaryX + 70 + 40 - 2, rowY + (rowHeight - 2), { align: 'right' });
            rowY += rowHeight;
          }
        }
        // Dibujar pie de página
        drawFooter();
      }
      // Formatear nombre de archivo: Cotización + Nombre + Fecha
      const today = new Date();
      const d = String(today.getDate()).padStart(2, '0');
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const y = String(today.getFullYear()).slice(-2);
      const dateStr = `${d}-${m}-${y}`;
      const safeName = clientName.replace(/\s+/g, '_');
      const fileName = `Cotización_${safeName}_${dateStr}.pdf`;
      doc.save(fileName);

      // Registrar cotización en el log
      try {
        const user = getSessionUser();
        const asesorName = user && user.username ? user.username : '';
        const logData = {
          asesor: asesorName,
          paciente: clientName,
          aseguradora: aseguradora,
          subtotal: subtotal,
          coverage: aseguradora !== 'Particular' ? coverage : null,
          total: total,
        };
        if (typeof logQuote === 'function') {
          logQuote(logData);
        }
      } catch (e) {
        console.error('Error al registrar log de la cotización', e);
      }
    });
  }
}

/**
 * Convierte una URL de imagen a un DataURL utilizando FileReader.
 * @param {string} url
 * @returns {Promise<string>}
 */
function toDataURL(url) {
  return fetch(url)
    .then((response) => response.blob())
    .then(
      (blob) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        })
    );
}
