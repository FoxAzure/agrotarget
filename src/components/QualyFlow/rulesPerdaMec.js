// ================================= DOCUMENTATION ------------------------------------------
// Script: rulesPerdaMec.js
// Purpose: Gerenciador de metas temporais para os indicadores de Perdas Mecanizadas.
// ==========================================================================================

const METAS_HISTORICAS = [
  {
    data_inicio: '2025-01-01',
    perda: 4.5,            // Menor ou igual a 4.5%
    pisoteio_simples: 50.0,// Menor ou igual a 50%
    pisoteio_duplo: 2.0,   // Menor ou igual a 2%
    arranquio: 2.5,        // Menor ou igual a 2.5%
  },
  {
    data_inicio: '2024-01-01',
    perda: 5.0,            // Menor ou igual a 5.0%
    pisoteio_simples: 50.0,// Menor ou igual a 50%
    pisoteio_duplo: 2.0,   // Menor ou igual a 2%
    arranquio: 4.5,        // Menor ou igual a 4.5%
  }
];

// Helper para converter string YYYY-MM-DD em número para comparação fácil
const dateToInt = (dateStr) => parseInt(dateStr.replace(/-/g, ''), 10);

export const getMetasParaData = (dataSelecionada) => {
  const dataInt = dateToInt(dataSelecionada);
  
  // Procura a primeira regra onde a data selecionada é maior ou igual a data_inicio da regra
  // (O array deve estar ordenado da regra mais recente para a mais antiga)
  const meta = METAS_HISTORICAS.find(m => dataInt >= dateToInt(m.data_inicio));
  
  // Retorna a meta encontrada ou um fallback padrão de segurança
  return meta || METAS_HISTORICAS[METAS_HISTORICAS.length - 1];
};

export const getStatusColor = (valor, metaLimite) => {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 'var(--q-gray)';
  return valor <= metaLimite ? 'var(--q-green)' : 'var(--q-danger)';
};