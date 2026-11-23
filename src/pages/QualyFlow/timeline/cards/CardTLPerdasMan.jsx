import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { evaluateMeta, formatMetaDescription, resolveMetaForYear } from '../utils/timelineMetaUtils';
import './CardTLPerdasMan.css';

const ACTIVITY = { area: 'Colheita', name: 'Perdas na Colheita Manual' };
const FIRST_YEAR = 2023;
const MAX_VISIBLE_YEARS = 5;

const INDICATORS = [
  { key: 'perda_perc', parameterName: 'Perda', label: 'Perdas', direction: 'lower' },
  { key: 'pisoteio_perc', parameterName: 'Pisoteio', label: 'Pisoteio', direction: 'lower' },
  { key: 'arranquio_perc', parameterName: 'Arranquio', label: 'Arranquio', direction: 'lower' },
  //{ key: 'abalo_perc', parameterName: 'Abalo', label: 'Abalo', direction: 'lower' },
];

const toNumber = (value) =>
  value === null || value === undefined || value === ''
    ? null
    : Number.isFinite(Number(value))
      ? Number(value)
      : null;

const formatPercent = (value) => {
  const number = toNumber(value);
  return number === null ? '—' : `${number.toFixed(2).replace('.', ',')}%`;
};

const formatExportNumber = (value) => {
  const number = toNumber(value);
  return number === null
    ? ''
    : number.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
      });
};

const getTrend = (currentValue, referenceValue, direction = 'lower') => {
  const current = toNumber(currentValue);
  const reference = toNumber(referenceValue);

  if (current === null || reference === null) return null;

  const difference = current - reference;
  if (Math.abs(difference) < 0.005) {
    return { state: 'stable', symbol: '•', delta: '0,00' };
  }

  const favorable = direction === 'higher' ? difference > 0 : difference < 0;

  return {
    state: favorable ? 'favorable' : 'attention',
    symbol: difference < 0 ? '▼' : '▲',
    delta: Math.abs(difference).toFixed(2).replace('.', ','),
  };
};

const CardTLPerdasMan = ({ selectedYear }) => {
  const [annualRows, setAnnualRows] = useState([]);
  const [parameterRows, setParameterRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [modalIndicator, setModalIndicator] = useState(null);

  const year = Number(selectedYear) || new Date().getFullYear();

  const allYears = useMemo(
    () => Array.from(
      { length: Math.max(1, year - FIRST_YEAR + 1) },
      (_, index) => FIRST_YEAR + index,
    ),
    [year],
  );

  const visibleYears = useMemo(
    () => allYears.slice(-MAX_VISIBLE_YEARS),
    [allYears],
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const [annualRes, paramRes] = await Promise.all([
          supabase
            .from('vw_q_perdaman_ano')
            .select(`ano, ${INDICATORS.map((item) => item.key).join(', ')}`)
            .in('ano', allYears),
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
        console.error('[CardTLPerdaMan] Erro:', error);
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

    const close = (event) => {
      if (event.key === 'Escape') setModalIndicator(null);
    };

    document.addEventListener('keydown', close);
    document.body.classList.add('qf-modal-open');

    return () => {
      document.removeEventListener('keydown', close);
      document.body.classList.remove('qf-modal-open');
    };
  }, [modalIndicator]);

  const rowsByYear = useMemo(
    () => new Map(annualRows.map((row) => [Number(row.ano), row])),
    [annualRows],
  );

  const getMeta = (indicator, targetYear) =>
    resolveMetaForYear(
      parameterRows,
      indicator.parameterName,
      targetYear,
      null,
    );

  const firstValidYear = (indicator) =>
    allYears.find(
      (targetYear) => toNumber(rowsByYear.get(targetYear)?.[indicator.key]) !== null,
    ) ?? null;

  const lastValidYear = (indicator) =>
    [...allYears].reverse().find(
      (targetYear) => toNumber(rowsByYear.get(targetYear)?.[indicator.key]) !== null,
    ) ?? null;

  const annualTrend = (indicator, targetYear) => {
    const index = allYears.indexOf(targetYear);
    return index > 0
      ? getTrend(
          rowsByYear.get(targetYear)?.[indicator.key],
          rowsByYear.get(allYears[index - 1])?.[indicator.key],
          indicator.direction,
        )
      : null;
  };

  const generalTrend = (indicator) => {
    const first = firstValidYear(indicator);
    const last = lastValidYear(indicator);

    return {
      first,
      last,
      trend: first !== null && last !== null && first !== last
        ? getTrend(
            rowsByYear.get(last)?.[indicator.key],
            rowsByYear.get(first)?.[indicator.key],
            indicator.direction,
          )
        : null,
    };
  };

  const mobileHidden = (index) =>
    visibleYears.length > 2 && index < visibleYears.length - 2;

  if (isLoading) {
    return <div className="qf-mx-card qf-mx-msg"><div className="qf-mx-spinner" /></div>;
  }

  if (hasError) {
    return <div className="qf-mx-card qf-mx-msg is-error">Erro ao carregar o painel.</div>;
  }

  return (
    <section className="qf-mx-card">
      <header className="qf-mx-header">
        <h2>Perdas na Colheita Manual</h2>
      </header>

      <div className="qf-mx-body">
        <div className="qf-mx-row qf-mx-row-head">
          <div className="qf-mx-col-ind">Indicador</div>
          <div className="qf-mx-track">
            {visibleYears.map((targetYear, index) => (
              <div
                className={`qf-mx-year-group${mobileHidden(index) ? ' is-mobile-hidden' : ''}`}
                key={targetYear}
              >
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
              <button
                type="button"
                className="qf-mx-col-ind qf-mx-ind-button"
                onClick={() => setModalIndicator(indicator)}
              >
                <strong>{indicator.label}</strong>
                <span>›</span>
              </button>

              <div className="qf-mx-track">
                {visibleYears.map((targetYear, index) => {
                  const value = toNumber(rowsByYear.get(targetYear)?.[indicator.key]);
                  const meta = getMeta(indicator, targetYear);
                  const evaluation = evaluateMeta(value, meta);
                  const trend = annualTrend(indicator, targetYear);

                  return (
                    <div
                      className={`qf-mx-year-group${mobileHidden(index) ? ' is-mobile-hidden' : ''}`}
                      key={targetYear}
                    >
                      {index > 0 && (
                        <div className={`qf-mx-bridge${trend ? '' : ' has-no-comparison'}`}>
                          <div className={`qf-mx-bridge-line is-${trend?.state || 'neutral'}`} />
                          <span className={`qf-mx-diff is-${trend?.state || 'neutral'}`}>
                            {trend ? `${trend.symbol} ${trend.delta}` : '—'}
                          </span>
                        </div>
                      )}

                      <div className={`qf-mx-node${targetYear === baseYear ? ` is-baseline is-baseline-${evaluation.state}` : ''}`}>
                        <span className={`qf-mx-val is-${evaluation.state}`}>
                          {formatPercent(value)}
                        </span>
                        <span className="qf-mx-meta">
                          {value === null ? 'Sem avaliação' : formatMetaDescription(meta)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`qf-mx-summary is-${general.trend?.state || 'neutral'}`}>
                <span>{general.first && general.last ? `${general.first} - ${general.last}` : 'S/ período'}</span>
                <strong>{general.trend ? `${general.trend.symbol} ${general.trend.delta} p.p.` : '—'}</strong>
                <small>
                  {general.trend?.state === 'favorable'
                    ? 'Melhora no indicador'
                    : general.trend?.state === 'attention'
                      ? 'Ponto de atenção'
                      : 'Sem comparação'}
                </small>
              </div>
            </div>
          );
        })}
      </div>

      {modalIndicator && (() => {
        const general = generalTrend(modalIndicator);

        return (
          <div
            className="qf-mx-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setModalIndicator(null);
            }}
          >
            <section className="qf-mx-modal" role="dialog" aria-modal="true">
              <header>
                <div>
                  <span>Timeline completa</span>
                  <h3>{modalIndicator.label}</h3>
                </div>
                <button type="button" onClick={() => setModalIndicator(null)} aria-label="Fechar">×</button>
              </header>

              <div className={`qf-mx-modal-general is-${general.trend?.state || 'neutral'}`}>
                <span>Evolução geral</span>
                <strong>{general.first && general.last ? `${general.first} - ${general.last}` : 'S/ período'}</strong>
                <b>{general.trend ? `${general.trend.symbol} ${general.trend.delta} p.p.` : '—'}</b>
                <small>
                  {general.trend?.state === 'favorable'
                    ? 'Melhora no indicador'
                    : general.trend?.state === 'attention'
                      ? 'Ponto de atenção'
                      : 'Sem comparação'}
                </small>
              </div>

              <div className="qf-mx-modal-list">
                {allYears.map((targetYear) => {
                  const value = toNumber(rowsByYear.get(targetYear)?.[modalIndicator.key]);
                  const meta = getMeta(modalIndicator, targetYear);
                  const evaluation = evaluateMeta(value, meta);
                  const trend = annualTrend(modalIndicator, targetYear);

                  return (
                    <div className="qf-mx-modal-item" key={targetYear}>
                      <div className="qf-mx-modal-year">{targetYear}</div>
                      <div className={`qf-mx-modal-value is-${evaluation.state}`}>
                        <strong>{formatPercent(value)}</strong>
                        <small>{value === null ? 'Sem avaliação' : formatMetaDescription(meta)}</small>
                      </div>
                      <div className={`qf-mx-modal-diff is-${trend?.state || 'neutral'}`}>
                        {trend
                          ? `${trend.symbol} ${trend.delta}`
                          : targetYear === firstValidYear(modalIndicator)
                            ? 'Início'
                            : '—'}
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
        <thead>
          <tr>
            <th>Área</th>
            <th>Atividade</th>
            <th>Indicador</th>
            <th>Ano</th>
            <th>Resultado (%)</th>
            <th>Meta</th>
          </tr>
        </thead>
        <tbody>
          {INDICATORS.flatMap((indicator) =>
            allYears.map((targetYear) => {
              const value = rowsByYear.get(targetYear)?.[indicator.key];
              const meta = getMeta(indicator, targetYear);

              return (
                <tr key={`${indicator.key}-${targetYear}`}>
                  <td>{ACTIVITY.area}</td>
                  <td>{ACTIVITY.name}</td>
                  <td>{indicator.label}</td>
                  <td>{targetYear}</td>
                  <td className="qf-xls-number">{formatExportNumber(value)}</td>
                  <td>{formatMetaDescription(meta)}</td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </section>
  );
};

export default CardTLPerdasMan;
