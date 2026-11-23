import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { formatMetaDescription, resolveMetaForYear } from '../utils/timelineMetaUtils';
import './CardTLPlantioMan.css';

const ACTIVITY = { area: 'Plantio', name: 'Plantio Manual' };
const FIRST_YEAR = 2023;
const MAX_VISIBLE_YEARS = 4;

const INDICATORS = [
  {
    key: 'kpi_gemas_viaveis',
    parameterName: 'Gemas Viáveis',
    label: 'Gemas Viáveis',
    unit: 'percent',
    decimals: 2,
    direction: 'higher',
    colorRule: 'viable-buds',
  },
  {
    key: 'kpi_falha',
    parameterName: 'Falha no Plantio',
    label: 'Falha no Plantio',
    unit: 'percent',
    decimals: 2,
    direction: 'lower',
    colorRule: 'failure',
  },
  {
    key: 'coberta_media',
    parameterName: 'Altura da Coberta',
    label: 'Altura da Coberta',
    unit: 'cm',
    decimals: 2,
    direction: 'range',
    targetMin: 5,
    targetMax: 8,
    colorRule: 'range-meta',
  },
  {
    key: 'picote_medio',
    parameterName: 'Tamanho dos Picotes',
    label: 'Tamanho dos Picotes',
    unit: 'cm',
    decimals: 2,
    direction: 'range',
    targetMin: 50,
    targetMax: 70,
    colorRule: 'range-meta',
  },

  // OPCIONAIS: remova "disabled: true" para exibir.
  {
    key: 'kpi_coberta',
    parameterName: 'Altura da Coberta',
    label: 'Conformidade da Coberta',
    unit: 'percent',
    decimals: 2,
    direction: 'higher',
    colorRule: 'kpi-standard',
    disabled: true,
  },
  {
    key: 'kpi_picote',
    parameterName: 'Tamanho dos Picotes',
    label: 'Conformidade dos Picotes',
    unit: 'percent',
    decimals: 2,
    direction: 'higher',
    colorRule: 'kpi-standard',
    disabled: true,
  },
  {
    key: 'peso_medio',
    parameterName: 'Peso',
    label: 'Peso Médio',
    unit: 'kg',
    decimals: 2,
    direction: 'neutral',
    colorRule: 'unknown',
    disabled: true,
  },
];

const ACTIVE_INDICATORS = INDICATORS.filter((indicator) => !indicator.disabled);

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const valueForDisplay = (indicator, rawValue) => {
  const value = toNumber(rawValue);
  if (value === null) return null;
  return indicator.unit === 'percent' ? value * 100 : value;
};

const formatValue = (indicator, rawValue) => {
  const value = valueForDisplay(indicator, rawValue);
  if (value === null) return '—';
  const formatted = value.toFixed(indicator.decimals ?? 2).replace('.', ',');
  if (indicator.unit === 'percent') return `${formatted}%`;
  if (indicator.unit === 'cm') return `${formatted} cm`;
  if (indicator.unit === 'kg') return `${formatted} kg`;
  return formatted;
};

const formatExportNumber = (indicator, rawValue) => {
  const value = valueForDisplay(indicator, rawValue);
  return value === null
    ? ''
    : value.toLocaleString('pt-BR', {
        minimumFractionDigits: indicator.decimals ?? 2,
        maximumFractionDigits: indicator.decimals ?? 2,
        useGrouping: false,
      });
};

const evaluatePlantingValue = (indicator, rawValue, meta = null) => {
  const value = valueForDisplay(indicator, rawValue);
  if (value === null) return { state: 'no-data', label: 'Sem avaliação' };

  if (indicator.colorRule === 'viable-buds') {
    const target = toNumber(meta?.min) ?? 90;
    const warningFrom = Math.max(0, target - 10);
    if (value >= target) return { state: 'on-target', label: 'Faixa verde' };
    if (value >= warningFrom) return { state: 'warning', label: 'Faixa amarela' };
    return { state: 'off-target', label: 'Faixa vermelha' };
  }

  if (indicator.colorRule === 'failure') {
    if (Math.abs(value) < 0.000001) return { state: 'on-target', label: 'Faixa verde' };
    if (value <= 1) return { state: 'warning', label: 'Faixa amarela' };
    return { state: 'off-target', label: 'Faixa vermelha' };
  }

  if (indicator.colorRule === 'range-meta') {
    const min = toNumber(meta?.min) ?? indicator.targetMin;
    const max = toNumber(meta?.max) ?? indicator.targetMax;
    return value >= min && value <= max
      ? { state: 'on-target', label: 'Faixa verde' }
      : { state: 'off-target', label: 'Faixa vermelha' };
  }

  if (indicator.colorRule === 'kpi-standard') {
    if (value >= 90) return { state: 'on-target', label: 'Faixa verde' };
    if (value >= 80) return { state: 'warning', label: 'Faixa amarela' };
    return { state: 'off-target', label: 'Faixa vermelha' };
  }

  return { state: 'unknown', label: 'Sem regra' };
};

const distanceFromTarget = (indicator, rawValue, meta = null) => {
  const value = valueForDisplay(indicator, rawValue);
  if (value === null) return null;
  if (indicator.direction === 'higher') return -value;
  if (indicator.direction === 'lower') return value;
  if (indicator.direction === 'range') {
    const min = toNumber(meta?.min) ?? indicator.targetMin;
    const max = toNumber(meta?.max) ?? indicator.targetMax;
    if (value < min) return min - value;
    if (value > max) return value - max;
    return 0;
  }
  return 0;
};

const getTrend = (indicator, currentRaw, referenceRaw, currentMeta = null, referenceMeta = null) => {
  const currentValue = valueForDisplay(indicator, currentRaw);
  const referenceValue = valueForDisplay(indicator, referenceRaw);
  const currentScore = distanceFromTarget(indicator, currentRaw, currentMeta);
  const referenceScore = distanceFromTarget(indicator, referenceRaw, referenceMeta);

  if ([currentValue, referenceValue, currentScore, referenceScore].some((value) => value === null)) return null;

  const difference = currentValue - referenceValue;
  if (Math.abs(difference) < 0.005) return { state: 'stable', symbol: '•', delta: '0,00' };

  const favorable = currentScore < referenceScore;
  const attention = currentScore > referenceScore;

  return {
    state: favorable ? 'favorable' : attention ? 'attention' : 'stable',
    symbol: difference < 0 ? '▼' : '▲',
    delta: Math.abs(difference).toFixed(2).replace('.', ','),
  };
};

const CardTLPlantioMan = ({ selectedYear }) => {
  const [annualRows, setAnnualRows] = useState([]);
  const [parameterRows, setParameterRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [modalIndicator, setModalIndicator] = useState(null);

  const year = Number(selectedYear) || new Date().getFullYear();
  const allYears = useMemo(
    () => Array.from({ length: Math.max(1, year - FIRST_YEAR + 1) }, (_, index) => FIRST_YEAR + index),
    [year]
  );
  const visibleYears = useMemo(
    () => Array.from({ length: MAX_VISIBLE_YEARS }, (_, index) => year - MAX_VISIBLE_YEARS + 1 + index),
    [year]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const fields = [...new Set(ACTIVE_INDICATORS.map((item) => item.key))].join(', ');
        const [annualRes, paramRes] = await Promise.all([
          supabase.from('vw_q_plantioman_ano').select(`ano, ${fields}`).in('ano', allYears),
          supabase
            .from('tb_q_parametros_agricolas')
            .select('*')
            .eq('area', ACTIVITY.area)
            .eq('atividade', ACTIVITY.name),
        ]);

        if (!mounted) return;
        if (annualRes.error) throw annualRes.error;

        setAnnualRows(annualRes.data || []);
        setParameterRows(paramRes.error ? [] : paramRes.data || []);
      } catch (error) {
        console.error('[CardTLPlantioMan] Erro:', error);
        if (mounted) setHasError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [allYears]);

  useEffect(() => {
    if (!modalIndicator) return undefined;
    const close = (event) => { if (event.key === 'Escape') setModalIndicator(null); };
    document.addEventListener('keydown', close);
    document.body.classList.add('qf-modal-open');
    return () => {
      document.removeEventListener('keydown', close);
      document.body.classList.remove('qf-modal-open');
    };
  }, [modalIndicator]);

  const rowsByYear = useMemo(
    () => new Map(annualRows.map((row) => [Number(row.ano), row])),
    [annualRows]
  );

  const getMeta = (indicator, targetYear) =>
    resolveMetaForYear(parameterRows, indicator.parameterName, targetYear, null);

  const firstValidYear = (indicator) =>
    allYears.find((targetYear) => toNumber(rowsByYear.get(targetYear)?.[indicator.key]) !== null) ?? null;

  const lastValidYear = (indicator) =>
    [...allYears].reverse().find((targetYear) => toNumber(rowsByYear.get(targetYear)?.[indicator.key]) !== null) ?? null;

  const annualTrend = (indicator, targetYear) => {
    const index = allYears.indexOf(targetYear);
    if (index <= 0) return null;
    const referenceYear = allYears[index - 1];
    return getTrend(
      indicator,
      rowsByYear.get(targetYear)?.[indicator.key],
      rowsByYear.get(referenceYear)?.[indicator.key],
      getMeta(indicator, targetYear),
      getMeta(indicator, referenceYear)
    );
  };

  const generalTrend = (indicator) => {
    const first = firstValidYear(indicator);
    const last = lastValidYear(indicator);
    return {
      first,
      last,
      trend:
        first !== null && last !== null && first !== last
          ? getTrend(
              indicator,
              rowsByYear.get(last)?.[indicator.key],
              rowsByYear.get(first)?.[indicator.key],
              getMeta(indicator, last),
              getMeta(indicator, first)
            )
          : null,
    };
  };

  const mobileHidden = (index) => visibleYears.length > 2 && index < visibleYears.length - 2;

  const metaText = (indicator, targetYear, rawValue) => {
    if (toNumber(rawValue) === null) return 'Sem avaliação';
    const meta = getMeta(indicator, targetYear);
    const description = formatMetaDescription(meta);
    return description && description !== 'Sem meta'
      ? description
      : evaluatePlantingValue(indicator, rawValue, meta).label;
  };

  if (isLoading) return <div className="qf-mx-card qf-mx-msg"><div className="qf-mx-spinner" /></div>;
  if (hasError) return <div className="qf-mx-card qf-mx-msg is-error">Erro ao carregar o painel.</div>;

  return (
    <section className="qf-mx-card qf-pm-card qf-pman-card">
      <header className="qf-mx-header"><h2>Plantio Manual</h2></header>

      <div className="qf-mx-body">
        <div className="qf-mx-row qf-mx-row-head">
          <div className="qf-mx-col-ind">Indicador</div>
          <div className="qf-mx-track">
            {visibleYears.map((targetYear, index) => (
              <div className={`qf-mx-year-group${mobileHidden(index) ? ' is-mobile-hidden' : ''}`} key={targetYear}>
                <div className="qf-mx-node-head">{targetYear}</div>
              </div>
            ))}
          </div>
          <div className="qf-mx-summary-head">Evolução geral</div>
        </div>

        {ACTIVE_INDICATORS.map((indicator) => {
          const baseYear = firstValidYear(indicator);
          const general = generalTrend(indicator);

          return (
            <div className="qf-mx-row" key={indicator.key}>
              <button type="button" className="qf-mx-col-ind qf-mx-ind-button" onClick={() => setModalIndicator(indicator)}>
                <strong>{indicator.label}</strong><span>›</span>
              </button>

              <div className="qf-mx-track">
                {visibleYears.map((targetYear, index) => {
                  const rawValue = rowsByYear.get(targetYear)?.[indicator.key];
                  const meta = getMeta(indicator, targetYear);
                  const evaluation = evaluatePlantingValue(indicator, rawValue, meta);
                  const trend = annualTrend(indicator, targetYear);

                  return (
                    <div className={`qf-mx-year-group${mobileHidden(index) ? ' is-mobile-hidden' : ''}`} key={targetYear}>
                      {index > 0 && (
                        <div className={`qf-mx-bridge${trend ? '' : ' has-no-comparison'}`}>
                          <div className={`qf-mx-bridge-line is-${trend?.state || 'neutral'}`} />
                          <span className={`qf-mx-diff is-${trend?.state || 'neutral'}`}>
                            {trend ? `${trend.symbol} ${trend.delta}` : '—'}
                          </span>
                        </div>
                      )}
                      <div className={`qf-mx-node${targetYear === baseYear ? ` is-baseline is-baseline-${evaluation.state}` : ''}`}>
                        <span className={`qf-mx-val is-${evaluation.state}`}>{formatValue(indicator, rawValue)}</span>
                        <span className="qf-mx-meta">{metaText(indicator, targetYear, rawValue)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`qf-mx-summary is-${general.trend?.state || 'neutral'}`}>
                <span>{general.first && general.last ? `${general.first} - ${general.last}` : 'S/ período'}</span>
                <strong>{general.trend ? `${general.trend.symbol} ${general.trend.delta} p.p.` : '—'}</strong>
                <small>{general.trend?.state === 'favorable' ? 'Melhora no indicador' : general.trend?.state === 'attention' ? 'Ponto de atenção' : 'Sem comparação'}</small>
              </div>
            </div>
          );
        })}
      </div>

      {modalIndicator && (() => {
        const general = generalTrend(modalIndicator);
        return (
          <div className="qf-mx-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalIndicator(null); }}>
            <section className="qf-mx-modal" role="dialog" aria-modal="true">
              <header>
                <div><span>Timeline completa</span><h3>{modalIndicator.label}</h3></div>
                <button type="button" onClick={() => setModalIndicator(null)} aria-label="Fechar">×</button>
              </header>
              <div className={`qf-mx-modal-general is-${general.trend?.state || 'neutral'}`}>
                <span>Evolução geral</span>
                <strong>{general.first && general.last ? `${general.first} - ${general.last}` : 'S/ período'}</strong>
                <b>{general.trend ? `${general.trend.symbol} ${general.trend.delta} p.p.` : '—'}</b>
                <small>{general.trend?.state === 'favorable' ? 'Melhora no indicador' : general.trend?.state === 'attention' ? 'Ponto de atenção' : 'Sem comparação'}</small>
              </div>
              <div className="qf-mx-modal-list">
                {allYears.map((targetYear) => {
                  const rawValue = rowsByYear.get(targetYear)?.[modalIndicator.key];
                  const meta = getMeta(modalIndicator, targetYear);
                  const evaluation = evaluatePlantingValue(modalIndicator, rawValue, meta);
                  const trend = annualTrend(modalIndicator, targetYear);
                  return (
                    <div className="qf-mx-modal-item" key={targetYear}>
                      <div className="qf-mx-modal-year">{targetYear}</div>
                      <div className={`qf-mx-modal-value is-${evaluation.state}`}>
                        <strong>{formatValue(modalIndicator, rawValue)}</strong>
                        <small>{metaText(modalIndicator, targetYear, rawValue)}</small>
                      </div>
                      <div className={`qf-mx-modal-diff is-${trend?.state || 'neutral'}`}>
                        {trend ? `${trend.symbol} ${trend.delta}` : targetYear === firstValidYear(modalIndicator) ? 'Início' : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        );
      })()}

      <table className="qf-mx-export-table" aria-hidden="true">
        <thead><tr><th>Área</th><th>Atividade</th><th>Indicador</th><th>Ano</th><th>Resultado</th><th>Meta</th></tr></thead>
        <tbody>
          {ACTIVE_INDICATORS.flatMap((indicator) =>
            allYears.map((targetYear) => {
              const rawValue = rowsByYear.get(targetYear)?.[indicator.key];
              return (
                <tr key={`${indicator.key}-${targetYear}`}>
                  <td>{ACTIVITY.area}</td><td>{ACTIVITY.name}</td><td>{indicator.label}</td><td>{targetYear}</td>
                  <td className="qf-xls-number">{formatExportNumber(indicator, rawValue)}</td>
                  <td>{metaText(indicator, targetYear, rawValue)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
};

export default CardTLPlantioMan;
