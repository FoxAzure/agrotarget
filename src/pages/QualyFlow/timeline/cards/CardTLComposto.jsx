import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { formatMetaDescription, resolveMetaForYear } from '../utils/timelineMetaUtils';
import './CardTLComposto.css';

const ACTIVITY = { area: 'Preparo de Solo', name: 'Composto' };
const FIRST_YEAR = 2024;
const MAX_VISIBLE_YEARS = 4;

const INDICATORS = [
  { key: 'media_ton', parameterName: 'ton/ha', label: 'Média Ton/ha', unit: 'ton', decimals: 2, multiplier: 1, defaultMin: 22, defaultMax: 28 },
  { key: 'kpi_variacao', parameterName: 'Variação de aplicação', label: 'Variação da Aplicação', unit: 'percent', decimals: 2, multiplier: 100, defaultMin: -12, defaultMax: 12 },
];

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const valueForDisplay = (rawValue, indicator) => {
  const value = toNumber(rawValue);
  return value === null ? null : value * indicator.multiplier;
};

const formatValue = (rawValue, indicator) => {
  const value = valueForDisplay(rawValue, indicator);
  if (value === null) return '—';
  const formatted = value.toFixed(indicator.decimals).replace('.', ',');
  return indicator.unit === 'percent' ? `${formatted}%` : `${formatted}`;
};

const formatExportNumber = (rawValue, indicator) => {
  const value = valueForDisplay(rawValue, indicator);
  return value === null ? '' : value.toLocaleString('pt-BR', {
    minimumFractionDigits: indicator.decimals,
    maximumFractionDigits: indicator.decimals,
    useGrouping: false,
  });
};

const metaLimits = (meta, indicator) => ({
  min: toNumber(meta?.min) ?? indicator.defaultMin,
  max: toNumber(meta?.max) ?? indicator.defaultMax,
});

const evaluateValue = (rawValue, indicator, meta = null) => {
  const value = valueForDisplay(rawValue, indicator);
  if (value === null) return { state: 'no-data', label: 'Sem avaliação' };
  const { min, max } = metaLimits(meta, indicator);
  if (value < min) return { state: 'below-target', label: 'Abaixo da meta' };
  if (value > max) return { state: 'above-target', label: 'Acima da meta' };
  return { state: 'on-target', label: 'Dentro da meta' };
};

const distanceToRange = (value, min, max) => {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
};

const getTrend = (currentRaw, referenceRaw, indicator, currentMeta = null, referenceMeta = null) => {
  const current = valueForDisplay(currentRaw, indicator);
  const reference = valueForDisplay(referenceRaw, indicator);
  if (current === null || reference === null) return null;

  const currentLimits = metaLimits(currentMeta, indicator);
  const referenceLimits = metaLimits(referenceMeta, indicator);
  const currentDistance = distanceToRange(current, currentLimits.min, currentLimits.max);
  const referenceDistance = distanceToRange(reference, referenceLimits.min, referenceLimits.max);
  const difference = current - reference;

  if (Math.abs(difference) < 0.005) return { state: 'stable', symbol: '•', delta: '0,00' };

  let state;
  if (currentDistance < referenceDistance || currentDistance === 0) {
    state = 'favorable';
  } else if (current > currentLimits.max) {
    state = 'above-target';
  } else if (current < currentLimits.min) {
    state = 'below-target';
  } else {
    state = 'stable';
  }

  return {
    state,
    symbol: difference < 0 ? '▼' : '▲',
    delta: Math.abs(difference).toFixed(indicator.decimals).replace('.', ','),
  };
};

const trendDescription = (trend) => {
  if (!trend) return 'Sem comparação';
  if (trend.state === 'favorable') return 'Dentro da Meta';
  if (trend.state === 'above-target') return 'Acima da Meta';
  if (trend.state === 'below-target') return 'Abaixo da Meta';
  return 'Dentro da Meta';
};

const trendClassName = (trend) => {
  if (!trend) return 'is-neutral';
  if (trend.state === 'above-target') return 'is-attention is-above-target';
  if (trend.state === 'below-target') return 'is-attention is-below-target';
  return `is-${trend.state}`;
};

const summaryTrendClassName = (trend) => {
  if (!trend) return 'is-neutral';
  return `is-${trend.state}`;
};

const CardTLComposto = ({ selectedYear }) => {
  const [annualRows, setAnnualRows] = useState([]);
  const [parameterRows, setParameterRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [activeIndicator, setActiveIndicator] = useState(null);

  const year = Number(selectedYear) || new Date().getFullYear();
  const allYears = useMemo(() => Array.from({ length: Math.max(1, year - FIRST_YEAR + 1) }, (_, index) => FIRST_YEAR + index), [year]);
  const visibleYears = useMemo(() => Array.from({ length: MAX_VISIBLE_YEARS }, (_, index) => year - MAX_VISIBLE_YEARS + 1 + index), [year]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const [annualRes, paramRes] = await Promise.all([
          supabase.from('vw_q_composto_ano').select('ano, pontos, media_ton, kpi_variacao').in('ano', allYears),
          supabase.from('tb_q_parametros_agricolas').select('*').eq('area', ACTIVITY.area).eq('atividade', ACTIVITY.name).eq('status', 'ATIVO'),
        ]);
        if (!mounted) return;
        if (annualRes.error) throw annualRes.error;
        setAnnualRows(annualRes.data || []);
        setParameterRows(paramRes.error ? [] : paramRes.data || []);
      } catch (error) {
        console.error('[CardTLComposto] Erro:', error);
        if (mounted) setHasError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [allYears]);

  useEffect(() => {
    if (!activeIndicator) return undefined;
    const close = (event) => { if (event.key === 'Escape') setActiveIndicator(null); };
    document.addEventListener('keydown', close);
    document.body.classList.add('qf-modal-open');
    return () => {
      document.removeEventListener('keydown', close);
      document.body.classList.remove('qf-modal-open');
    };
  }, [activeIndicator]);

  const rowsByYear = useMemo(() => new Map(annualRows.map((row) => [Number(row.ano), row])), [annualRows]);
  const getMeta = (indicator, targetYear) => resolveMetaForYear(parameterRows, indicator.parameterName, targetYear, null);
  const validYears = (indicator) => allYears.filter((targetYear) => toNumber(rowsByYear.get(targetYear)?.[indicator.key]) !== null);

  const annualTrend = (indicator, targetYear) => {
    const index = allYears.indexOf(targetYear);
    if (index <= 0) return null;
    const referenceYear = allYears[index - 1];
    return getTrend(rowsByYear.get(targetYear)?.[indicator.key], rowsByYear.get(referenceYear)?.[indicator.key], indicator, getMeta(indicator, targetYear), getMeta(indicator, referenceYear));
  };

  const generalTrend = (indicator) => {
    const years = validYears(indicator);
    if (years.length < 2) return null;
    const firstYear = years[0];
    const lastYear = years[years.length - 1];
    return getTrend(rowsByYear.get(lastYear)?.[indicator.key], rowsByYear.get(firstYear)?.[indicator.key], indicator, getMeta(indicator, lastYear), getMeta(indicator, firstYear));
  };

  const mobileHidden = (index) => visibleYears.length > 2 && index < visibleYears.length - 2;
  const metaText = (indicator, targetYear, rawValue) => {
    if (toNumber(rawValue) === null) return 'Sem avaliação';
    const meta = getMeta(indicator, targetYear);
    const description = formatMetaDescription(meta);
    return description && description !== 'Sem meta' ? description : evaluateValue(rawValue, indicator, meta).label;
  };

  if (isLoading) return <div className="qf-mx-card qf-mx-msg"><div className="qf-mx-spinner" /></div>;
  if (hasError) return <div className="qf-mx-card qf-mx-msg is-error">Erro ao carregar o painel.</div>;

  const modalIndicator = INDICATORS.find((indicator) => indicator.key === activeIndicator) || null;

  return (
    <section className="qf-mx-card qf-composto-card">
      <header className="qf-mx-header"><h2>Composto</h2></header>
      <div className="qf-mx-body">
        <div className="qf-mx-row qf-mx-row-head">
          <div className="qf-mx-col-ind">Indicador</div>
          <div className="qf-mx-track">{visibleYears.map((targetYear, index) => <div className={`qf-mx-year-group${mobileHidden(index) ? ' is-mobile-hidden' : ''}`} key={targetYear}><div className="qf-mx-node-head">{targetYear}</div></div>)}</div>
          <div className="qf-mx-summary-head">Evolução geral</div>
        </div>

        {INDICATORS.map((indicator) => {
          const years = validYears(indicator);
          const firstValidYear = years[0] ?? null;
          const lastValidYear = years[years.length - 1] ?? null;
          const overallTrend = generalTrend(indicator);
          return (
            <div className="qf-mx-row" key={indicator.key}>
              <button type="button" className="qf-mx-col-ind qf-mx-ind-button" onClick={() => setActiveIndicator(indicator.key)}><strong>{indicator.label}</strong><span>›</span></button>
              <div className="qf-mx-track">
                {visibleYears.map((targetYear, index) => {
                  const rawValue = rowsByYear.get(targetYear)?.[indicator.key];
                  const meta = getMeta(indicator, targetYear);
                  const evaluation = evaluateValue(rawValue, indicator, meta);
                  const trend = annualTrend(indicator, targetYear);
                  return (
                    <div className={`qf-mx-year-group${mobileHidden(index) ? ' is-mobile-hidden' : ''}`} key={targetYear}>
                      {index > 0 && <div className={`qf-mx-bridge${trend ? '' : ' has-no-comparison'}`}><div className={`qf-mx-bridge-line ${trendClassName(trend)}`} /><span className={`qf-mx-diff ${trendClassName(trend)}`}>{trend ? `${trend.symbol} ${trend.delta}` : '—'}</span></div>}
                      <div className={`qf-mx-node${targetYear === firstValidYear ? ` is-baseline is-baseline-${evaluation.state}` : ''}`}><span className={`qf-mx-val is-${evaluation.state}`}>{formatValue(rawValue, indicator)}</span><span className="qf-mx-meta">{metaText(indicator, targetYear, rawValue)}</span></div>
                    </div>
                  );
                })}
              </div>
              <div className={`qf-mx-summary ${summaryTrendClassName(overallTrend)}`}><span>{firstValidYear && lastValidYear ? `${firstValidYear} - ${lastValidYear}` : 'S/ período'}</span><strong>{overallTrend ? `${overallTrend.symbol} ${overallTrend.delta}${indicator.unit === 'percent' ? ' p.p.' : ''}` : '—'}</strong><small>{trendDescription(overallTrend)}</small></div>
            </div>
          );
        })}
      </div>

      {modalIndicator && (() => {
        const years = validYears(modalIndicator);
        const firstValidYear = years[0] ?? null;
        const lastValidYear = years[years.length - 1] ?? null;
        const overallTrend = generalTrend(modalIndicator);
        return (
          <div className="qf-mx-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveIndicator(null); }}>
            <section className="qf-mx-modal" role="dialog" aria-modal="true" aria-labelledby="qf-composto-modal-title">
              <header><div><span>Timeline completa</span><h3 id="qf-composto-modal-title">{modalIndicator.label}</h3></div><button type="button" onClick={() => setActiveIndicator(null)} aria-label="Fechar">×</button></header>
              <div className={`qf-mx-modal-general ${summaryTrendClassName(overallTrend)}`}><span>Evolução geral</span><strong>{firstValidYear && lastValidYear ? `${firstValidYear} - ${lastValidYear}` : 'S/ período'}</strong><b>{overallTrend ? `${overallTrend.symbol} ${overallTrend.delta}${modalIndicator.unit === 'percent' ? ' p.p.' : ''}` : '—'}</b><small>{trendDescription(overallTrend)}</small></div>
              <div className="qf-mx-modal-list">{allYears.map((targetYear) => {
                const rawValue = rowsByYear.get(targetYear)?.[modalIndicator.key];
                const meta = getMeta(modalIndicator, targetYear);
                const evaluation = evaluateValue(rawValue, modalIndicator, meta);
                const trend = annualTrend(modalIndicator, targetYear);
                return <div className="qf-mx-modal-item" key={targetYear}><div className="qf-mx-modal-year">{targetYear}</div><div className={`qf-mx-modal-value is-${evaluation.state}`}><strong>{formatValue(rawValue, modalIndicator)}</strong><small>{metaText(modalIndicator, targetYear, rawValue)}</small></div><div className={`qf-mx-modal-diff ${trendClassName(trend)}`}>{trend ? `${trend.symbol} ${trend.delta}` : targetYear === firstValidYear ? 'Início' : '—'}</div></div>;
              })}</div>
            </section>
          </div>
        );
      })()}

      <table className="qf-mx-export-table" aria-hidden="true"><thead><tr><th>Área</th><th>Atividade</th><th>Indicador</th><th>Ano</th><th>Resultado</th><th>Meta</th></tr></thead><tbody>{INDICATORS.flatMap((indicator) => allYears.map((targetYear) => {
        const rawValue = rowsByYear.get(targetYear)?.[indicator.key];
        return <tr key={`${indicator.key}-${targetYear}`}><td>{ACTIVITY.area}</td><td>{ACTIVITY.name}</td><td>{indicator.label}</td><td>{targetYear}</td><td className="qf-xls-number">{formatExportNumber(rawValue, indicator)}</td><td>{metaText(indicator, targetYear, rawValue)}</td></tr>;
      }))}</tbody></table>
    </section>
  );
};

export default CardTLComposto;
