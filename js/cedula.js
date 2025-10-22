// cedula.js
// Validación de cédula ecuatoriana (10 dígitos)

/**
 * Valida un número de cédula ecuatoriana para personas naturales.
 * @param {string} cedula
 * @returns {boolean}
 */
function validarCedula(cedula) {
  if (!cedula) return false;
  // eliminar espacios y validar longitud
  const num = cedula.trim();
  if (!/^[0-9]{10}$/.test(num)) return false;
  const province = parseInt(num.substring(0, 2), 10);
  // provincia válida (01 a 24)
  if (province < 1 || province > 24) return false;
  const third = parseInt(num[2], 10);
  // el tercer dígito debe ser menor a 6 (para personas naturales)
  if (third > 5) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(num[i], 10);
    if (i % 2 === 0) {
      // posiciones impares (0-indexed) se multiplican por 2
      let mult = digit * 2;
      if (mult > 9) mult -= 9;
      sum += mult;
    } else {
      sum += digit;
    }
  }
  const residue = sum % 10;
  const checkDigit = residue === 0 ? 0 : 10 - residue;
  return checkDigit === parseInt(num[9], 10);
}

// Exponer al objeto global para uso en scripts embebidos
window.validarCedula = validarCedula;