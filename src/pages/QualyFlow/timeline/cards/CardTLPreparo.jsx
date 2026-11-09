import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { formatMetaDescription, resolveMetaForYear } from '../utils/timelineMetaUtils';
import './CardTLPreparo.css';

const ACTIVITY = { area: 'Preparo de Solo', name: 'Preparo' };
const FIRST_YEAR = 2023;
const MAX_VISIBLE_YEARS = 4;


const INDICATORS = [
  {
    key: 'profund_haste',
    parameterName: 'Profundidade do Adubo (%)',
    label: 'Profundidade da Haste',
    unit: 'percent',
    decimals: 2,
    direction: 'higher',
    colorRule: 'meta-with-warning',
  },
  {
    key: 'profund_cana',
    parameterName: 'Profundidade da Cana (%)',
    label: 'Profundidade da Cana',
    unit: 'percent',
    decimals: 2,
    direction: 'higher',
    colorRule: 'meta-with-warning',
  },
  {
    key: 'paralelismo_sulco',
    parameterName: 'Paralelismo entre Sulcos (%)',
    label: 'Paralelismo entre Sulcos',
    unit: 'percent',
    decimals: 2,
    direction: 'higher',
    colorRule: 'meta-with-warning',
  },
  {
    key: 'paralelismo_fita',
    parameterName: 'Paralelismo entre Fitas Gotejadoras',
    label: 'Paralelismo entre Fitas',
    unit: 'percent',
    decimals: 2,
    direction: 'higher',
    colorRule: 'meta-with-warning',
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
  return value;
};

const formatValue = (indicator, rawValue) => {
  const value = valueForDisplay(indicator, rawValue);
  if (value === null) return '—';
  const formatted = value.toFixed(indicator.decimals ?? 2).replace('.', ',');
  if (indicator.unit === 'percent') return `${formatted}%`;
  if (indicator.unit === 'cm') return `${formatted} cm`;
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

const evaluatePreparoValue = (indicator, rawValue, meta = null) => {
  const value = valueForDisplay(indicator, rawValue);
  if (value === null) return { state: 'no-data', label: 'Sem avaliação' };

  /*
   * Usa a meta vigente do respectivo ano:
   * - verde: resultado maior ou igual à meta;
   * - amarelo: até 10 pontos percentuais abaixo da meta;
   * - vermelho: mais de 10 pontos percentuais abaixo da meta.
   */
  if (indicator.colorRule === 'meta-with-warning') {
    const target = toNumber(meta?.min);
    const greenFrom = target ?? 90;
    const yellowFrom = Math.max(0, greenFrom - 10);

    if (value >= greenFrom) return { state: 'on-target', label: 'Faixa verde' };
    if (value >= yellowFrom) return { state: 'warning', label: 'Faixa amarela' };
    return { state: 'off-target', label: 'Faixa vermelha' };
  }

  return { state: 'unknown', label: 'Sem regra' };
};

const distanceFromTarget = (indicator, rawValue) => {
  const value = valueForDisplay(indicator, rawValue);
  if (value === null) return null;
  if (indicator.direction === 'higher') return -value;
  if (indicator.direction === 'lower') return value;
  if (indicator.direction === 'range') {
    if (value < indicator.targetMin) return indicator.targetMin - value;
    if (value > indicator.targetMax) return value - indicator.targetMax;
    return 0;
  }
  return value;
};

const getTrend = (indicator, currentRaw, referenceRaw) => {
  const currentValue = valueForDisplay(indicator, currentRaw);
  const referenceValue = valueForDisplay(indicator, referenceRaw);
  const currentScore = distanceFromTarget(indicator, currentRaw);
  const referenceScore = distanceFromTarget(indicator, referenceRaw);

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

const CardTLPreparo = ({ selectedYear }) => {
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

  // Mantém exatamente quatro colunas no card, mesmo quando algum ano ainda não possui dados.
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
          supabase.from('vw_q_preparo_ano').select(`ano, ${fields}`).in('ano', allYears),
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
        console.error('[CardTLPreparo] Erro:', error);
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
    return index > 0
      ? getTrend(
          indicator,
          rowsByYear.get(targetYear)?.[indicator.key],
          rowsByYear.get(allYears[index - 1])?.[indicator.key]
        )
      : null;
  };

  const generalTrend = (indicator) => {
    const first = firstValidYear(indicator);
    const last = lastValidYear(indicator);
    return {
      first,
      last,
      trend:
        first !== null && last !== null && first !== last
          ? getTrend(indicator, rowsByYear.get(last)?.[indicator.key], rowsByYear.get(first)?.[indicator.key])
          : null,
    };
  };

  const mobileHidden = (index) => visibleYears.length > 2 && index < visibleYears.length - 2;
  const metaText = (indicator, targetYear, rawValue) => {
    if (toNumber(rawValue) === null) return 'Sem avaliação';
    const description = formatMetaDescription(getMeta(indicator, targetYear));
    return description && description !== 'Sem meta' ? description : evaluatePreparoValue(indicator, rawValue, getMeta(indicator, targetYear)).label;
  };

  if (isLoading) return <div className="qf-mx-card qf-mx-msg"><div className="qf-mx-spinner" /></div>;
  if (hasError) return <div className="qf-mx-card qf-mx-msg is-error">Erro ao carregar o painel.</div>;

  return (
    <section className="qf-mx-card qf-pr-card">
      <header className="qf-mx-header"><h2>Preparo de Solo</h2></header>

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
                  const evaluation = evaluatePreparoValue(indicator, rawValue, getMeta(indicator, targetYear));
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
                  const evaluation = evaluatePreparoValue(modalIndicator, rawValue);
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

export default CardTLPreparo;
