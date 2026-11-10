import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { formatMetaDescription, resolveMetaForYear } from '../utils/timelineMetaUtils';
import './CardTLSemente.css';

const ACTIVITY = { area: 'Semente', name: 'Semente Mecanizada' };
const FIRST_YEAR = 2023;
const MAX_VISIBLE_YEARS = 4;


const INDICATORS = [
  {
    key: 'kpi_gemas_viaveis',
    parameterName: 'Gemas Viáveis',
    label: 'Gemas Viáveis',
    unit: 'percent-ratio',
    decimals: 2,
    direction: 'higher',
    colorRule: 'higher-meta-warning',
  },
  {
    key: 'rebolo_tamanho_medio',
    parameterName: 'Tamanho dos Rebolos',
    label: 'Tamanho dos Rebolos',
    unit: 'cm',
    decimals: 2,
    direction: 'neutral',
    colorRule: 'informative',
    metricFilter: 'cm',
  },
  {
    key: 'kpi_pisoteio_simples',
    parameterName: 'Pisoteio - Sulco',
    label: 'Pisoteio - Sulco',
    unit: 'percent-ratio',
    decimals: 2,
    direction: 'lower',
    colorRule: 'lower-meta',
  },
  {
    key: 'kpi_pisoteio_duplo',
    parameterName: 'Pisoteio - Gotejo',
    label: 'Pisoteio - Gotejo',
    unit: 'percent-ratio',
    decimals: 2,
    direction: 'lower',
    colorRule: 'zero-only',
  },
  {
    key: 'kpi_rachado',
    parameterName: 'Rebolos Rachados',
    label: 'Rebolos Rachados',
    unit: 'percent-ratio',
    decimals: 2,
    direction: 'lower',
    colorRule: 'lower-meta',
  },
  {
    key: 'kpi_amassado',
    parameterName: 'Rebolos Amassados',
    label: 'Rebolos Amassados',
    unit: 'percent-ratio',
    decimals: 2,
    direction: 'lower',
    colorRule: 'lower-meta',
  },
  {
    key: 'kpi_palmito',
    parameterName: 'Palmitos',
    label: 'Palmitos',
    unit: 'percent-ratio',
    decimals: 2,
    direction: 'lower',
    colorRule: 'lower-meta',
  },
  {
    key: 'kpi_brocado',
    parameterName: 'Índice de Broca',
    label: 'Índice de Broca',
    unit: 'percent-ratio',
    decimals: 2,
    direction: 'lower',
    colorRule: 'lower-meta',
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
  return indicator.unit === 'percent-ratio' ? value * 100 : value;
};

const formatValue = (indicator, rawValue) => {
  const value = valueForDisplay(indicator, rawValue);
  if (value === null) return '—';
  const formatted = value.toFixed(indicator.decimals ?? 2).replace('.', ',');
  if (indicator.unit === 'percent' || indicator.unit === 'percent-ratio') return `${formatted}%`;
  if (indicator.unit === 'cm') return `${formatted}`;
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

const evaluateSementeValue = (indicator, rawValue, meta = null) => {
  const value = valueForDisplay(indicator, rawValue);
  if (value === null) return { state: 'no-data', label: 'Sem avaliação' };

  if (indicator.colorRule === 'informative') {
    return { state: 'informative', label: 'Informativo' };
  }

  // Gemas Viáveis: verde na meta, amarelo até 10 p.p. abaixo e vermelho abaixo disso.
  if (indicator.colorRule === 'higher-meta-warning') {
    const target = toNumber(meta?.min) ?? 90;
    if (value >= target) return { state: 'on-target', label: 'Faixa verde' };
    if (value >= Math.max(0, target - 10)) return { state: 'warning', label: 'Faixa amarela' };
    return { state: 'off-target', label: 'Faixa vermelha' };
  }

  // Pisoteio no sulco, rachados, amassados, palmitos e broca.
  if (indicator.colorRule === 'lower-meta') {
    const target = toNumber(meta?.min);
    if (target === null) return { state: 'unknown', label: 'Sem regra' };
    return value <= target
      ? { state: 'on-target', label: 'Faixa verde' }
      : { state: 'off-target', label: 'Faixa vermelha' };
  }

  // Pisoteio no gotejo: somente zero é verde.
  if (indicator.colorRule === 'zero-only') {
    return Math.abs(value) < 0.000001
      ? { state: 'on-target', label: 'Faixa verde' }
      : { state: 'off-target', label: 'Faixa vermelha' };
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
  if (indicator.direction === 'neutral') return 0;
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
    state: indicator.direction === 'neutral' ? 'stable' : favorable ? 'favorable' : attention ? 'attention' : 'stable',
    symbol: difference < 0 ? '▼' : '▲',
    delta: Math.abs(difference).toFixed(2).replace('.', ','),
  };
};

const CardTLSemente = ({ selectedYear }) => {
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
          supabase.from('vw_q_sementemec_ano').select(`ano, ${fields}`).in('ano', allYears),
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
        console.error('[CardTLSemente] Erro:', error);
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

  const getMeta = (indicator, targetYear) => {
    const rows = indicator.metricFilter
      ? parameterRows.filter((row) => String(row.metrica || '').trim().toLowerCase() === indicator.metricFilter)
      : parameterRows;
    return resolveMetaForYear(rows, indicator.parameterName, targetYear, null);
  };

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
    return description && description !== 'Sem meta' ? description : evaluateSementeValue(indicator, rawValue, getMeta(indicator, targetYear)).label;
  };

  if (isLoading) return <div className="qf-mx-card qf-mx-msg"><div className="qf-mx-spinner" /></div>;
  if (hasError) return <div className="qf-mx-card qf-mx-msg is-error">Erro ao carregar o painel.</div>;

  return (
    <section className="qf-mx-card qf-sm-card">
      <header className="qf-mx-header"><h2>Semente Mecanizada</h2></header>

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
                  const evaluation = evaluateSementeValue(indicator, rawValue, getMeta(indicator, targetYear));
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
                  const evaluation = evaluateSementeValue(modalIndicator, rawValue);
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

export default CardTLSemente;
