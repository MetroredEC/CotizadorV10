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
