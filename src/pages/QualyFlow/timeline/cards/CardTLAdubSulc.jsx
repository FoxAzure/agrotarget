import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { formatMetaDescription, resolveMetaForYear } from '../utils/timelineMetaUtils';
import './CardTLAdubSulc.css';

const ACTIVITY = { area: 'Preparo de Solo', name: 'Adubação de Sulcamento' };
const FIRST_YEAR = 2024;
const MAX_VISIBLE_YEARS = 4;

const INDICATORS = [
  {
    key: 'kpi_variacao_2l',
    parameterName: 'Adubação 2 linhas',
    label: 'Variação 2 Linhas',
    decimals: 2,
  },
  {
    key: 'kpi_variacao_3l',
    parameterName: 'Adubação 3 linhas',
    label: 'Variação 3 Linhas',
    decimals: 2,
  },
  {
    key: 'kpi_variacao_geral',
    parameterName: null,
    label: 'Variação Geral',
    decimals: 2,
  },
];

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const valueForDisplay = (rawValue) => {
  const value = toNumber(rawValue);
  return value === null ? null : value * 100;
};

const formatValue = (indicator, rawValue) => {
  const value = valueForDisplay(rawValue);
  return value === null ? '—' : `${value.toFixed(indicator.decimals).replace('.', ',')}%`;
};

const formatExportNumber = (indicator, rawValue) => {
  const value = valueForDisplay(rawValue);
  return value === null
    ? ''
    : value.toLocaleString('pt-BR', {
        minimumFractionDigits: indicator.decimals,
        maximumFractionDigits: indicator.decimals,
        useGrouping: false,
      });
};

const metaLimits = (meta) => ({
  min: toNumber(meta?.min) ?? -8,
  max: toNumber(meta?.max) ?? 8,
});

const evaluateValue = (rawValue, meta = null) => {
  const value = valueForDisplay(rawValue);
  if (value === null) return { state: 'no-data', label: 'Sem avaliação' };
  const { min, max } = metaLimits(meta);
  return value >= min && value <= max
    ? { state: 'on-target', label: 'Dentro da meta' }
    : { state: 'off-target', label: 'Fora da meta' };
};

// Quanto menor a distância absoluta até zero, melhor.
const getTrend = (currentRaw, referenceRaw) => {
  const current = valueForDisplay(currentRaw);
  const reference = valueForDisplay(referenceRaw);
  if (current === null || reference === null) return null;

  const difference = current - reference;
  const distanceChange = Math.abs(current) - Math.abs(reference);
  if (Math.abs(distanceChange) < 0.005) {
    return { state: 'stable', symbol: '•', delta: '0,00' };
  }

  return {
    state: Math.abs(current) < Math.abs(reference) ? 'favorable' : 'attention',
    symbol: difference < 0 ? '▼' : '▲',
    delta: Math.abs(difference).toFixed(2).replace('.', ','),
  };
};

const CardTLAdubSulc = ({ selectedYear }) => {
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
        const fields = INDICATORS.map((item) => item.key).join(', ');
        const [annualRes, paramRes] = await Promise.all([
          supabase.from('vw_q_adubsulc_ano').select(`ano, ${fields}`).in('ano', allYears),
          supabase
            .from('tb_q_parametros_agricolas')
            .select('*')
            .eq('area', ACTIVITY.area)
            .eq('atividade', ACTIVITY.name)
            .eq('status', 'ATIVO'),
        ]);

        if (!mounted) return;
        if (annualRes.error) throw annualRes.error;
        setAnnualRows(annualRes.data || []);
        setParameterRows(paramRes.error ? [] : paramRes.data || []);
      } catch (error) {
        console.error('[CardTLAdubSulc] Erro:', error);
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
    if (indicator.parameterName) {
      return resolveMetaForYear(parameterRows, indicator.parameterName, targetYear, null);
    }

    // A variação geral usa a mesma faixa operacional de -8% a 8%.
    const references = INDICATORS
      .filter((item) => item.parameterName)
      .map((item) => resolveMetaForYear(parameterRows, item.parameterName, targetYear, null))
      .filter(Boolean);

    return references[0] || { min: -8, max: 8, regra_meta: 'Entre', metrica: 'percentual' };
  };

  const firstValidYear = (indicator) =>
    allYears.find((targetYear) => toNumber(rowsByYear.get(targetYear)?.[indicator.key]) !== null) ?? null;

  const lastValidYear = (indicator) =>
    [...allYears].reverse().find((targetYear) => toNumber(rowsByYear.get(targetYear)?.[indicator.key]) !== null) ?? null;

  const annualTrend = (indicator, targetYear) => {
    const index = allYears.indexOf(targetYear);
    if (index <= 0) return null;
    const referenceYear = allYears[index - 1];
    return getTrend(
      rowsByYear.get(targetYear)?.[indicator.key],
      rowsByYear.get(referenceYear)?.[indicator.key]
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
          ? getTrend(rowsByYear.get(last)?.[indicator.key], rowsByYear.get(first)?.[indicator.key])
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
      : evaluateValue(rawValue, meta).label;
  };

  if (isLoading) return <div className="qf-mx-card qf-mx-msg"><div className="qf-mx-spinner" /></div>;
  if (hasError) return <div className="qf-mx-card qf-mx-msg is-error">Erro ao carregar o painel.</div>;

  return (
    <section className="qf-mx-card qf-adubsulc-card">
      <header className="qf-mx-header"><h2>Adubação de Sulcamento</h2></header>

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

        {INDICATORS.map((indicator) => {
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
                  const evaluation = evaluateValue(rawValue, meta);
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
                <small>{general.trend?.state === 'favorable' ? 'Mais próximo de zero' : general.trend?.state === 'attention' ? 'Mais distante de zero' : 'Sem comparação'}</small>
              </div>
            </div>
          );
        })}
      </div>

      {modalIndicator && (() => {
        const general = generalTrend(modalIndicator);
        return (
          <div className="qf-mx-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalIndicator(null); }}>
            <section className="qf-mx-modal" role="dialog" aria-modal="true" aria-labelledby="qf-adubsulc-modal-title">
              <header>
                <div><span>Timeline completa</span><h3 id="qf-adubsulc-modal-title">{modalIndicator.label}</h3></div>
                <button type="button" onClick={() => setModalIndicator(null)} aria-label="Fechar">×</button>
              </header>
              <div className={`qf-mx-modal-general is-${general.trend?.state || 'neutral'}`}>
                <span>Evolução geral</span>
                <strong>{general.first && general.last ? `${general.first} - ${general.last}` : 'S/ período'}</strong>
                <b>{general.trend ? `${general.trend.symbol} ${general.trend.delta} p.p.` : '—'}</b>
                <small>{general.trend?.state === 'favorable' ? 'Mais próximo de zero' : general.trend?.state === 'attention' ? 'Mais distante de zero' : 'Sem comparação'}</small>
              </div>
              <div className="qf-mx-modal-list">
                {allYears.map((targetYear) => {
                  const rawValue = rowsByYear.get(targetYear)?.[modalIndicator.key];
                  const meta = getMeta(modalIndicator, targetYear);
                  const evaluation = evaluateValue(rawValue, meta);
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
          {INDICATORS.flatMap((indicator) =>
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

export default CardTLAdubSulc;
