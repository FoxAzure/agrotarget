// ================================= DOCUMENTATION ------------------------------------------
// Script: rulesPlantioMec.js
// Purpose: Gerenciador temporal das faixas do histograma de gemas viaveis por metro.
// ==========================================================================================

const REGRAS_HISTORICAS = [
  {
    data_inicio: '2024-01-01',
    faixas: [
      { label: '<10', min: 0, max: 9.999999, status: 'danger' },
      { label: '10-13', min: 10, max: 13.999999, status: 'warning' },
      { label: '14-28', min: 14, max: 28, status: 'good' },
      { label: '29-32', min: 28.000001, max: 32, status: 'warning' },
      { label: '>32', min: 32.000001, max: null, status: 'danger' },
    ],
  },
];

const dateToInt = dateStr => parseInt(String(dateStr || '').replace(/-/g, ''), 10);

export const getRegraHistogramaParaData = dataSelecionada => {
  const dataInt = dateToInt(dataSelecionada);
  const regra = REGRAS_HISTORICAS.find(item => dataInt >= dateToInt(item.data_inicio));
  return regra || REGRAS_HISTORICAS[REGRAS_HISTORICAS.length - 1];
};

export const getFaixaGemas = (valor, regra) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || !regra) return null;
  return regra.faixas.find(faixa => numero >= faixa.min && (faixa.max === null || numero <= faixa.max)) || null;
};

export const getCorFaixaGemas = status => {
  if (status === 'good') return 'var(--q-success, #16a34a)';
  if (status === 'warning') return 'var(--q-warning, #d69e00)';
  if (status === 'danger') return 'var(--q-danger, #dc2626)';
  return 'var(--q-gray, #94a3b8)';
};
