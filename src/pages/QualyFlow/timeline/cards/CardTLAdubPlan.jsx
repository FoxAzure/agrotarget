import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { formatMetaDescription, resolveMetaForYear } from '../utils/timelineMetaUtils';
import './CardTLAdubPlan.css';

const ACTIVITY = { area: 'Plantio', name: 'Adubação da Plantadora' };
const FIRST_YEAR = 2024;
const MAX_VISIBLE_YEARS = 4;

const INDICATOR = {
  key: 'kpi_variacao',
  parameterName: 'Adubação 2 linhas',
  label: 'Variação 2 Linhas',
  decimals: 2,
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const valueForDisplay = (rawValue) => {
  const value = toNumber(rawValue);
  return value === null ? null : value * 100;
};

const formatValue = (rawValue) => {
  const value = valueForDisplay(rawValue);
  return value === null ? '—' : `${value.toFixed(INDICATOR.decimals).replace('.', ',')}%`;
};

const formatExportNumber = (rawValue) => {
  const value = valueForDisplay(rawValue);
  return value === null
    ? ''
    : value.toLocaleString('pt-BR', {
        minimumFractionDigits: INDICATOR.decimals,
        maximumFractionDigits: INDICATOR.decimals,
        useGrouping: false,
      });
};

const metaLimits = (meta) => ({
  min: toNumber(meta?.min) ?? -5,
  max: toNumber(meta?.max) ?? 5,
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
    delta: Math.abs(difference).toFixed(INDICATOR.decimals).replace('.', ','),
  };
};

const CardTLAdubPlan = ({ selectedYear }) => {
  const [annualRows, setAnnualRows] = useState([]);
  const [parameterRows, setParameterRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);

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
        const [annualRes, paramRes] = await Promise.all([
          supabase
            .from('vw_q_adubplan')
            .select('ano, pontos, kpi_variacao')
            .in('ano', allYears),
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
        console.error('[CardTLAdubPlan] Erro:', error);
        if (mounted) setHasError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [allYears]);

  useEffect(() => {
    if (!isModalOpen) return undefined;
    const close = (event) => { if (event.key === 'Escape') setModalOpen(false); };
    document.addEventListener('keydown', close);
    document.body.classList.add('qf-modal-open');
    return () => {
      document.removeEventListener('keydown', close);
      document.body.classList.remove('qf-modal-open');
    };
  }, [isModalOpen]);

  const rowsByYear = useMemo(
    () => new Map(annualRows.map((row) => [Number(row.ano), row])),
    [annualRows]
  );

  const getMeta = (targetYear) =>
    resolveMetaForYear(parameterRows, INDICATOR.parameterName, targetYear, null);

  const firstValidYear = useMemo(
    () => allYears.find((targetYear) => toNumber(rowsByYear.get(targetYear)?.kpi_variacao) !== null) ?? null,
    [allYears, rowsByYear]
  );

  const lastValidYear = useMemo(
    () => [...allYears].reverse().find((targetYear) => toNumber(rowsByYear.get(targetYear)?.kpi_variacao) !== null) ?? null,
    [allYears, rowsByYear]
  );

  const annualTrend = (targetYear) => {
    const index = allYears.indexOf(targetYear);
    if (index <= 0) return null;
    const referenceYear = allYears[index - 1];
    return getTrend(
      rowsByYear.get(targetYear)?.kpi_variacao,
      rowsByYear.get(referenceYear)?.kpi_variacao
    );
  };

  const generalTrend =
    firstValidYear !== null && lastValidYear !== null && firstValidYear !== lastValidYear
      ? getTrend(
          rowsByYear.get(lastValidYear)?.kpi_variacao,
          rowsByYear.get(firstValidYear)?.kpi_variacao
        )
      : null;

  const mobileHidden = (index) => visibleYears.length > 2 && index < visibleYears.length - 2;

  const metaText = (targetYear, rawValue) => {
    if (toNumber(rawValue) === null) return 'Sem avaliação';
    const meta = getMeta(targetYear);
    const description = formatMetaDescription(meta);
    return description && description !== 'Sem meta'
      ? description
      : evaluateValue(rawValue, meta).label;
  };

  if (isLoading) return <div className="qf-mx-card qf-mx-msg"><div className="qf-mx-spinner" /></div>;
  if (hasError) return <div className="qf-mx-card qf-mx-msg is-error">Erro ao carregar o painel.</div>;

  return (
    <section className="qf-mx-card qf-adubplan-card">
      <header className="qf-mx-header"><h2>Adubação da Plantadora</h2></header>

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

        <div className="qf-mx-row">
          <button type="button" className="qf-mx-col-ind qf-mx-ind-button" onClick={() => setModalOpen(true)}>
            <strong>{INDICATOR.label}</strong><span>›</span>
          </button>

          <div className="qf-mx-track">
            {visibleYears.map((targetYear, index) => {
              const rawValue = rowsByYear.get(targetYear)?.kpi_variacao;
              const meta = getMeta(targetYear);
              const evaluation = evaluateValue(rawValue, meta);
              const trend = annualTrend(targetYear);

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
                  <div className={`qf-mx-node${targetYear === firstValidYear ? ` is-baseline is-baseline-${evaluation.state}` : ''}`}>
                    <span className={`qf-mx-val is-${evaluation.state}`}>{formatValue(rawValue)}</span>
                    <span className="qf-mx-meta">{metaText(targetYear, rawValue)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`qf-mx-summary is-${generalTrend?.state || 'neutral'}`}>
            <span>{firstValidYear && lastValidYear ? `${firstValidYear} - ${lastValidYear}` : 'S/ período'}</span>
            <strong>{generalTrend ? `${generalTrend.symbol} ${generalTrend.delta} p.p.` : '—'}</strong>
            <small>{generalTrend?.state === 'favorable' ? 'Mais próximo de zero' : generalTrend?.state === 'attention' ? 'Mais distante de zero' : 'Sem comparação'}</small>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="qf-mx-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section className="qf-mx-modal" role="dialog" aria-modal="true" aria-labelledby="qf-adubplan-modal-title">
            <header>
              <div><span>Timeline completa</span><h3 id="qf-adubplan-modal-title">{INDICATOR.label}</h3></div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Fechar">×</button>
            </header>
            <div className={`qf-mx-modal-general is-${generalTrend?.state || 'neutral'}`}>
              <span>Evolução geral</span>
              <strong>{firstValidYear && lastValidYear ? `${firstValidYear} - ${lastValidYear}` : 'S/ período'}</strong>
              <b>{generalTrend ? `${generalTrend.symbol} ${generalTrend.delta} p.p.` : '—'}</b>
              <small>{generalTrend?.state === 'favorable' ? 'Mais próximo de zero' : generalTrend?.state === 'attention' ? 'Mais distante de zero' : 'Sem comparação'}</small>
            </div>
            <div className="qf-mx-modal-list">
              {allYears.map((targetYear) => {
                const rawValue = rowsByYear.get(targetYear)?.kpi_variacao;
                const meta = getMeta(targetYear);
                const evaluation = evaluateValue(rawValue, meta);
                const trend = annualTrend(targetYear);
                return (
                  <div className="qf-mx-modal-item" key={targetYear}>
                    <div className="qf-mx-modal-year">{targetYear}</div>
                    <div className={`qf-mx-modal-value is-${evaluation.state}`}>
                      <strong>{formatValue(rawValue)}</strong>
                      <small>{metaText(targetYear, rawValue)}</small>
                    </div>
                    <div className={`qf-mx-modal-diff is-${trend?.state || 'neutral'}`}>
                      {trend ? `${trend.symbol} ${trend.delta}` : targetYear === firstValidYear ? 'Início' : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <table className="qf-mx-export-table" aria-hidden="true">
        <thead><tr><th>Área</th><th>Atividade</th><th>Indicador</th><th>Ano</th><th>Resultado</th><th>Meta</th></tr></thead>
        <tbody>
          {allYears.map((targetYear) => {
            const rawValue = rowsByYear.get(targetYear)?.kpi_variacao;
            return (
              <tr key={targetYear}>
                <td>{ACTIVITY.area}</td><td>{ACTIVITY.name}</td><td>{INDICATOR.label}</td><td>{targetYear}</td>
                <td className="qf-xls-number">{formatExportNumber(rawValue)}</td>
                <td>{metaText(targetYear, rawValue)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};

export default CardTLAdubPlan;
