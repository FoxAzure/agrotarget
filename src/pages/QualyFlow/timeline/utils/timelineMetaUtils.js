// ================================= DOCUMENTATION ------------------------------------------
// Module: timelineMetaUtils
// Purpose: Resolve and format agricultural targets precisely based on effective dates.
// Includes debug logging to trace target selection per indicator and year.
// ==========================================================================================

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveMetaForYear = (parameterRows, indicatorName, year) => {
  const targetYear = Number(year);
  if (!Number.isInteger(targetYear) || !parameterRows) return null;

  const cleanName = (indicatorName || '').trim().toLowerCase();
  const matchingRows = parameterRows.filter(
    (row) => (row.indicador || '').trim().toLowerCase() === cleanName
  );
  
  if (matchingRows.length === 0) {
    //console.warn(`[Meta Debug] Sem metas encontradas no banco para o indicador: '${indicatorName}'`);
    return null;
  }

  // Ordena da mais recente para a mais antiga pela data de atualização
  matchingRows.sort((a, b) => {
    const dateA = a.data_atualizacao || '';
    const dateB = b.data_atualizacao || '';
    return dateB.localeCompare(dateA); 
  });

  // Busca a primeira meta que entrou em vigor NO ano ou ANTES do ano selecionado
  const effectiveTarget = matchingRows.find(row => {
    const rowYear = parseInt((row.data_atualizacao || '').slice(0, 4), 10);
    return !isNaN(rowYear) && rowYear <= targetYear;
  });

  // Fallback: Se não tem meta velha para aquele ano, pega a mais antiga cadastrada
  const finalMeta = effectiveTarget || matchingRows[matchingRows.length - 1];

  // LOGS ESTRUTURADOS PARA DEBUG (F12)
  //console.groupCollapsed(`[Meta Debug] 🎯 ${indicatorName} | Ref: ${targetYear}`);
  //console.log(`Banco retornou ${matchingRows.length} opções para este indicador:`, matchingRows);
  //if (effectiveTarget) {
  //  console.log(`✓ Meta vigente encontrada (Data: ${effectiveTarget.data_atualizacao}):`, effectiveTarget);
  //} else {
  //  console.log(`⚠ Nenhuma meta ativa em ou antes de ${targetYear}. Usando fallback (mais antiga):`, finalMeta);
  //}
  //console.groupEnd();

  return finalMeta;
};

export const formatMetaDescription = (meta) => {
  if (!meta) return 'S/ Meta';

  const rule = (meta.regra_meta || '').trim().toLowerCase();
  const min = toNumber(meta.min);
  const max = toNumber(meta.max);
  
  const unit = (meta.metrica || '').toLowerCase().includes('percentual') ? '%' : '';
  const fmt = (v) => v !== null ? `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}${unit}` : '';

  if (rule.includes('menor ou igual') || rule === '<=') return min !== null ? `≤ ${fmt(min)}` : 'S/ Meta';
  if (rule.includes('maior ou igual') || rule === '>=') return min !== null ? `≥ ${fmt(min)}` : 'S/ Meta';
  if (rule.includes('entre')) return (min !== null && max !== null) ? `${fmt(min)} a ${fmt(max)}` : 'S/ Meta';
  if (rule.includes('igual') || rule === '=') return min !== null ? `= ${fmt(min)}` : 'S/ Meta';
  if (rule.includes('menor') || rule === '<') return min !== null ? `< ${fmt(min)}` : 'S/ Meta';
  if (rule.includes('maior') || rule === '>') return min !== null ? `> ${fmt(min)}` : 'S/ Meta';

  return min !== null ? fmt(min) : 'S/ Meta';
};

export const evaluateMeta = (value, meta) => {
  const actual = toNumber(value);
  if (actual === null) return { state: 'no-data', passes: null };
  if (!meta) return { state: 'unknown', passes: null };

  const rule = (meta.regra_meta || '').trim().toLowerCase();
  const min = toNumber(meta.min);
  const max = toNumber(meta.max);
  const epsilon = 1e-9;
  let passes = null;

  if (rule.includes('menor ou igual') || rule === '<=') passes = (min !== null) ? actual <= min + epsilon : null;
  else if (rule.includes('maior ou igual') || rule === '>=') passes = (min !== null) ? actual >= min - epsilon : null;
  else if (rule.includes('entre')) passes = (min !== null && max !== null) ? actual >= min - epsilon && actual <= max + epsilon : null;
  else if (rule.includes('igual') || rule === '=') passes = (min !== null) ? Math.abs(actual - min) <= epsilon : null;
  else if (rule.includes('menor') || rule === '<') passes = (min !== null) ? actual < min : null;
  else if (rule.includes('maior') || rule === '>') passes = (min !== null) ? actual > min : null;

  if (passes === null) return { state: 'unknown', passes: null };
  return passes ? { state: 'on-target', passes: true } : { state: 'off-target', passes: false };
};