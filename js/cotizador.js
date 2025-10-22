/* cotizador.js – Metrored
   - Tabla PDF sin columna “Subtotal”
   - Anti-superposición header/rows
   - Logos proporcionados (sin aplastarse)
   - Excepciones de cobertura (Admin)
*/

(() => {
  // ---------- Utilidades de estado ----------
  const state = {
    cart: [], // [{codigo, descripcion, pvp, pva, cant}]
    aseguradoras: [],
    examenes: [],
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const fmt = (n) => Number(n || 0).toFixed(2);

  // Carga de datos del tarifario desde appState o localStorage
  function loadDataFromAppStateOrStorage() {
    // appState (inyectado por app.js)
    const as = (window.appState && window.appState.data) ? window.appState.data : null;
    if (as && as.examenes && as.aseguradoras) {
      state.examenes = as.examenes;
      state.aseguradoras = as.aseguradoras;
      return;
    }
    // fallback: localStorage (por si admin activó un tarifario)
    const raw = localStorage.getItem('tarifarioDataActive');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        state.examenes = data.examenes || [];
        state.aseguradoras = data.aseguradoras || ['Particular'];
      } catch {}
    }
    // fallback mínimo
    if (!state.aseguradoras.length) state.aseguradoras = ['Particular'];
    if (!state.examenes.length) state.examenes = [];
  }

  // Excepciones de cobertura
  function getNoCoverageExceptions() {
    try {
      return JSON.parse(localStorage.getItem('noCoverageExceptions') || '[]'); // array de códigos
    } catch {
      return [];
    }
  }

  // Logos de aseguradoras (mapa nombre -> dataURL)
  function getInsurerLogosMap() {
    try {
      return JSON.parse(localStorage.getItem('insurerLogos') || '{}');
    } catch {
      return {};
    }
  }

  // ---------- Vistas y eventos ----------
  function renderAseguradoras() {
    const sel = $('#aseguradoraSelect');
    sel.innerHTML = '';
    state.aseguradoras.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      sel.appendChild(opt);
    });
    sel.value = 'Particular';
    toggleCoverageField();
  }

  function toggleCoverageField() {
    const aseg = $('#aseguradoraSelect').value;
    const group = $('#coverageGroup');
    if (!group) return;
    group.style.display = (aseg && aseg !== 'Particular') ? 'block' : 'none';
  }

  function hookEvents() {
    // Buscar examen
    const search = $('#searchExam');
    const list = $('#searchResults');
    if (search) {
      search.addEventListener('input', () => {
        const q = (search.value || '').trim().toLowerCase();
        list.innerHTML = '';
        if (!q) return;
        const hits = state.examenes.filter((e) =>
          String(e.codigo).includes(q) ||
          (e.descripcion && e.descripcion.toLowerCase().includes(q))
        ).slice(0, 30);
        hits.forEach((e) => {
          const li = document.createElement('li');
          li.className = 'result-item';
          li.textContent = `${e.codigo} – ${e.descripcion} (PVP ${fmt(e.pvp)} / PVA ${fmt(e.pva)})`;
          li.addEventListener('click', () => {
            addToCart({
              codigo: e.codigo,
              descripcion: e.descripcion,
              pvp: Number(e.pvp || 0),
              pva: Number(e.pva || 0),
              cant: 1,
            });
            search.value = '';
            list.innerHTML = '';
          });
          list.appendChild(li);
        });
      });
    }

    // Cambio de aseguradora o cobertura
    $('#aseguradoraSelect')?.addEventListener('change', () => {
      toggleCoverageField();
      updateSummary();
    });
    $('#coverageInput')?.addEventListener('input', () => updateSummary());

    // Generar PDF
    $('#generatePdfBtn')?.addEventListener('click', () => {
      const name = ($('#clientName')?.value || '').trim();
      const dni = ($('#clientCedula')?.value || '').trim();
      if (!name) return alert('Ingrese el nombre del cliente.');
      if (!dni || !validarCedulaEcuador(dni)) return alert('Ingrese una cédula válida.');
      if (!state.cart.length) return alert('Agregue al menos un examen.');
      generatePdf(name, dni);
    });
  }

  function addToCart(item) {
    // si ya existe, incrementa cantidad
    const idx = state.cart.findIndex((it) => String(it.codigo) === String(item.codigo));
    if (idx >= 0) state.cart[idx].cant += 1;
    else state.cart.push(item);
    renderCart();
    updateSummary();
  }

  function removeFromCart(code) {
    state.cart = state.cart.filter((it) => String(it.codigo) !== String(code));
    renderCart();
    updateSummary();
  }

  function renderCart() {
    const tbody = $('#cartBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.cart.forEach((it) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${it.codigo}</td>
        <td>${it.descripcion}</td>
        <td class="num">${fmt(it.pvp)}</td>
        <td class="num">${fmt(it.pva)}</td>
        <td class="num">
          <input type="number" min="1" value="${it.cant}" class="qty-input" style="width:60px" />
        </td>
        <td><button class="btn btn-small danger">Quitar</button></td>
      `;
      tr.querySelector('.qty-input').addEventListener('input', (e) => {
        const v = Math.max(1, Number(e.target.value || 1));
        it.cant = v;
        updateSummary();
      });
      tr.querySelector('button').addEventListener('click', () => removeFromCart(it.codigo));
      tbody.appendChild(tr);
    });
  }

  function updateSummary() {
    const aseg = $('#aseguradoraSelect')?.value || 'Particular';
    const coverage = Math.min(100, Math.max(0, Number($('#coverageInput')?.value || 80)));
    const exceptions = getNoCoverageExceptions(); // [codigos sin cobertura]

    let subtotal = 0;
    let copago = 0;

    state.cart.forEach((it) => {
      const line = Number(it.pva || 0) * Number(it.cant || 1); // usamos PVA para la cotización
      subtotal += line;
      const sinCobertura = exceptions.includes(String(it.codigo));
      if (aseg !== 'Particular' && !sinCobertura) {
        copago += line * (100 - coverage) / 100;
      } else {
        copago += line; // particular o excepción => paga completo
      }
    });

    $('#subtotal') && ($('#subtotal').textContent = fmt(subtotal));
    $('#copagoAmount') && ($('#copagoAmount').textContent = fmt(copago));
    $('#copagoPerc') && ($('#copagoPerc').textContent = String(100 - coverage));
    $('#total') && ($('#total').textContent = fmt(copago));
  }

  // ---------- Validación de cédula Ecuador ----------
  function validarCedulaEcuador(cedula) {
    const c = String(cedula || '').trim();
    if (!/^\d{10}$/.test(c)) return false;
    const provincia = parseInt(c.slice(0, 2), 10);
    if (provincia < 1 || provincia > 24) return false;
    const d = c.split('').map(n => parseInt(n, 10));
    const verificador = d.pop();
    const pares = d.filter((_, i) => i % 2 === 1).reduce((a, n) => a + n, 0);
    const imp = d.filter((_, i) => i % 2 === 0).map(n => {
      let m = n * 2; if (m > 9) m -= 9; return m;
    }).reduce((a, n) => a + n, 0);
    const suma = pares + imp;
    const decena = Math.ceil(suma / 10) * 10;
    const val = (decena - suma) % 10;
    return val === verificador;
  }

  // ---------- PDF ----------
  function addLogoScaled(doc, imgData, x, y, maxW, maxH, format = 'PNG', ratioHint) {
    try {
      // Si conoces la relación exacta, pásala vía ratioHint
      let w = maxW;
      let h;
      if (ratioHint && ratioHint > 0) {
        h = w / ratioHint;
      } else {
        // fallback razonable si no se conoce: 3:1 (ancho:alto)
        const ratio = 3;
        h = w / ratio;
      }
      if (h > maxH) { h = maxH; w = h * (ratioHint || 3); }
      doc.addImage(imgData, format, x, y, w, h);
    } catch {}
  }

  async function generatePdf(clientName, clientCedula) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;

    // Logos
    // Metrored (asset en <img id="logoMetroredPDF" data-img="dataURL"> o desde /images)
    let logoMetrored = null;
    const logoEl = document.getElementById('logoMetroredPDF');
    if (logoEl && logoEl.dataset && logoEl.dataset.img) {
      logoMetrored = logoEl.dataset.img;
    }

    // Logo de aseguradora desde localStorage
    const aseguradora = $('#aseguradoraSelect')?.value || 'Particular';
    const logosMap = getInsurerLogosMap();
    const insurerLogo = logosMap[aseguradora] || null;

    // Header
    const headerTop = 15;
    if (logoMetrored) addLogoScaled(doc, logoMetrored, margin, headerTop, 36, 14, 'PNG', 2.8);
    if (insurerLogo) addLogoScaled(doc, insurerLogo, pageW - margin - 30, headerTop, 30, 12, 'PNG', 3.0);

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('COTIZACIÓN', pageW / 2, headerTop + 16, { align: 'center' });

    // Datos (izquierda / derecha)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    const leftX = margin;
    const rightX = pageW / 2 + 20;

    const hoy = new Date();
    const emision = hoy.toLocaleDateString('es-EC');
    const validez = new Date(hoy.getTime() + 30 * 86400000).toLocaleDateString('es-EC');
    const copagoPerc = (() => {
      const coverage = Math.min(100, Math.max(0, Number($('#coverageInput')?.value || 80)));
      return 100 - coverage;
    })();

    const cotNumber = Math.floor(100000 + Math.random() * 900000);

    const left = [
      `Cliente: ${clientName}`,
      `Aseguradora: ${aseguradora}`,
      `N° Cotización: ${cotNumber}`,
      `Validez hasta: ${validez}`
    ];
    const right = [
      `Cédula: ${clientCedula}`,
      `Copago ref.: ${copagoPerc}%`,
      `Fecha: ${emision}`
    ];

    let infoY = headerTop + 28;
    left.forEach((t) => { doc.text(t, leftX, infoY); infoY += 6; });
    infoY = headerTop + 28;
    right.forEach((t) => { doc.text(t, rightX, infoY); infoY += 6; });

    // ----------------- TABLA (sin Subtotal) -----------------
    const tableY = headerTop + 48;
    const rowH = 9; // altura uniforme
    const headPad = 2;

    // columnas: Código, Descripción, PVP, PVA, Cant.
    const colW = [28, 110, 22, 22, 18];
    const X = [margin]; for (let i = 0; i < colW.length - 1; i++) X.push(X[i] + colW[i]);

    // Encabezado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const headH = rowH + headPad;
    const totalTableW = colW.reduce((a, b) => a + b, 0);

    doc.setFillColor(24, 86, 156);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, tableY, totalTableW, headH, 'F');

    const headBaseY = tableY + headH / 2 + 3;
    doc.text('Código',      X[0] + 2,  headBaseY);
    doc.text('Descripción', X[1] + 2,  headBaseY);
    doc.text('PVP',         X[2] + 18, headBaseY, { align: 'right' });
    doc.text('PVA',         X[3] + 18, headBaseY, { align: 'right' });
    doc.text('Cant.',       X[4] + 13, headBaseY, { align: 'right' });

    // Filas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    let y = tableY + headH + 1; // colchón anti-roce
    const ellipsis = (s, max) => s && s.length > max ? s.slice(0, max - 1) + '…' : (s || '');

    const items = state.cart.map((it) => ({
      codigo: it.codigo,
      descripcion: it.descripcion,
      pvp: Number(it.pvp || 0),
      pva: Number(it.pva || 0),
      cant: Number(it.cant || 1),
    }));

    items.forEach((it) => {
      if (y + rowH > pageH - margin - 40) { // deja espacio para el resumen y el legal
        // Nueva página y repetir header
        doc.addPage();
        doc.setFillColor(24, 86, 156);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, margin, totalTableW, headH, 'F');
        const hy = margin + headH / 2 + 3;
        doc.text('Código',      X[0] + 2,  hy);
        doc.text('Descripción', X[1] + 2,  hy);
        doc.text('PVP',         X[2] + 18, hy, { align: 'right' });
        doc.text('PVA',         X[3] + 18, hy, { align: 'right' });
        doc.text('Cant.',       X[4] + 13, hy, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y = margin + headH + 1;
      }

      const baseY = y + rowH - 2;
      doc.text(String(it.codigo), X[0] + 2, baseY);
      doc.text(ellipsis(it.descripcion, 70), X[1] + 2, baseY);
      doc.text(fmt(it.pvp), X[2] + 18, baseY, { align: 'right' });
      doc.text(fmt(it.pva), X[3] + 18, baseY, { align: 'right' });
      doc.text(String(it.cant), X[4] + 13, baseY, { align: 'right' });

      doc.setDrawColor(230);
      doc.line(margin, y + rowH, margin + totalTableW, y + rowH);
      y += rowH;
    });

    // ----------------- RESUMEN -----------------
    const coverage = Math.min(100, Math.max(0, Number($('#coverageInput')?.value || 80)));
    const exceptions = getNoCoverageExceptions();
    let subtotal = 0;
    let copago = 0;

    items.forEach((it) => {
      const line = it.pva * it.cant;
      subtotal += line;
      const sinCobertura = exceptions.includes(String(it.codigo));
      if (aseguradora !== 'Particular' && !sinCobertura) {
        copago += line * (100 - coverage) / 100;
      } else {
        copago += line;
      }
    });

    const summaryW = 110;
    const sumX = pageW - margin - summaryW;
    let sumY = y + 8;
    if (sumY + 30 > pageH - margin - 18) {
      doc.addPage();
      sumY = margin + 10;
    }

    // caja resumen
    doc.setFillColor(236, 244, 252);
    doc.setDrawColor(220);
    doc.roundedRect(sumX, sumY, summaryW, 28, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    // filas del resumen
    const row = (label, val, bold) => {
      if (bold) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
      const yLine = sumY + 7;
      doc.text(label, sumX + 6, yLine);
      doc.text(`$${fmt(val)}`, sumX + summaryW - 6, yLine, { align: 'right' });
      sumY += 10;
    };

    row('Subtotal', subtotal, false);
    row(`Copago referencial (${100 - coverage}%)`, copago, false);

    // total destacado
    doc.setFillColor(24, 86, 156);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(sumX, sumY, summaryW, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Total', sumX + 6, sumY + 7);
    doc.text(`$${fmt(copago)}`, sumX + summaryW - 6, sumY + 7, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    // ----------------- LEGAL -----------------
    const legal = 'Esta cotización tiene carácter informativo y no constituye una oferta o compromiso de venta. ' +
      'Los valores presentados son referenciales y podrán variar según la validación de las condiciones de seguros ' +
      'y coberturas al momento del pago en caja.';
    const legalY = pageH - margin - 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(legal, margin, legalY, { maxWidth: pageW - 2 * margin, align: 'left' });

    // Pie de página: numeración
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 4, { align: 'right' });
    }

    // Nombre del archivo
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const filename = `Cotización_${clientName.replace(/\s+/g, '_')}_${dd}-${mm}-${yy}.pdf`;
    doc.save(filename);
  }

  // ---------- Init ----------
  function init() {
    loadDataFromAppStateOrStorage();
    renderAseguradoras();
    hookEvents();
    renderCart();
    updateSummary();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
