// ================================= DOCUMENTATION ------------------------------------------
// Module: timelineMetaUtils
// Purpose: Resolve, format and evaluate agricultural targets by effective date.
// ==========================================================================================

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

export const resolveMetaForYear = (parameterRows = [], indicatorName, year, manualMeta = null) => {
  if (manualMeta) return manualMeta;

  const targetYear = Number(year);
  if (!Number.isInteger(targetYear) || !Array.isArray(parameterRows)) return null;

  const cleanName = normalizeText(indicatorName);
  const matchingRows = parameterRows
    .filter((row) => normalizeText(row.indicador) === cleanName)
    .sort((a, b) => String(b.data_atualizacao || '').localeCompare(String(a.data_atualizacao || '')));

  if (!matchingRows.length) return null;

  const effectiveTarget = matchingRows.find((row) => {
    const rowYear = Number.parseInt(String(row.data_atualizacao || '').slice(0, 4), 10);
    return Number.isInteger(rowYear) && rowYear <= targetYear;
  });

  return effectiveTarget || matchingRows[matchingRows.length - 1] || null;
};

export const formatMetaDescription = (meta) => {
  if (!meta) return 'S/ Meta';

  const rule = normalizeText(meta.regra_meta);
  const min = toNumber(meta.min);
  const max = toNumber(meta.max);
  const unit = normalizeText(meta.metrica).includes('percentual') ? '%' : '';
  const fmt = (value) => value === null ? '' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}${unit}`;

  if (rule.includes('menor ou igual') || rule === '<=') return min !== null ? `≤ ${fmt(min)}` : 'S/ Meta';
  if (rule.includes('maior ou igual') || rule === '>=') return min !== null ? `≥ ${fmt(min)}` : 'S/ Meta';
  if (rule.includes('entre')) return min !== null && max !== null ? `${fmt(min)} a ${fmt(max)}` : 'S/ Meta';
  if (rule.includes('igual') || rule === '=') return min !== null ? `= ${fmt(min)}` : 'S/ Meta';
  if (rule.includes('menor') || rule === '<') return min !== null ? `< ${fmt(min)}` : 'S/ Meta';
  if (rule.includes('maior') || rule === '>') return min !== null ? `> ${fmt(min)}` : 'S/ Meta';
  return min !== null ? fmt(min) : 'S/ Meta';
};

export const evaluateMeta = (value, meta) => {
  const actual = toNumber(value);
  if (actual === null) return { state: 'no-data', passes: null };
  if (!meta) return { state: 'unknown', passes: null };

  const rule = normalizeText(meta.regra_meta);
  const min = toNumber(meta.min);
  const max = toNumber(meta.max);
  const epsilon = 1e-9;
  let passes = null;

  if (rule.includes('menor ou igual') || rule === '<=') passes = min !== null ? actual <= min + epsilon : null;
  else if (rule.includes('maior ou igual') || rule === '>=') passes = min !== null ? actual >= min - epsilon : null;
  else if (rule.includes('entre')) passes = min !== null && max !== null ? actual >= min - epsilon && actual <= max + epsilon : null;
  else if (rule.includes('igual') || rule === '=') passes = min !== null ? Math.abs(actual - min) <= epsilon : null;
  else if (rule.includes('menor') || rule === '<') passes = min !== null ? actual < min : null;
  else if (rule.includes('maior') || rule === '>') passes = min !== null ? actual > min : null;

  if (passes === null) return { state: 'unknown', passes: null };
  return passes ? { state: 'on-target', passes: true } : { state: 'off-target', passes: false };
};
