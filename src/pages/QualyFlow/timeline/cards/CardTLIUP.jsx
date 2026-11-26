import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { formatMetaDescription, resolveMetaForYear } from '../utils/timelineMetaUtils';
import './CardTLIUP.css';

const ACTIVITY = { area: 'Falha no Canavial', name: 'IUP' };
const FIRST_YEAR = 2023;
const DISPLAY_FROM_YEAR = 2024;
const MAX_VISIBLE_YEARS = 4;

// Valores em percentual. Exemplo: 8.67 representa 8,67%.
// Quando um ano estiver preenchido aqui, o valor manual substitui o Supabase.
// Para voltar a usar o banco, remova o ano ou atribua null.
const MANUAL_VALUES = {
  2023: null,
  2024: 15.93,
};

const INDICATOR = {
  key: 'kpi_falha',
  parameterName: 'Índice de Uniformidade do Plantio',
  label: 'IUP',
  unit: 'percent',
  decimals: 2,
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const hasManualValue = (targetYear) =>
  Object.prototype.hasOwnProperty.call(MANUAL_VALUES, targetYear)
  && toNumber(MANUAL_VALUES[targetYear]) !== null;

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

const metaLimit = (meta) => toNumber(meta?.min) ?? toNumber(meta?.max) ?? 3;

// IUP: até 3% verde; acima de 3% até 5% amarelo; acima de 5% vermelho.
const evaluateValue = (rawValue, meta = null) => {
  const value = valueForDisplay(rawValue);
  if (value === null) return { state: 'no-data', label: 'Sem avaliação' };

  const target = metaLimit(meta);
  if (value <= target) return { state: 'on-target', label: 'Dentro da meta' };
  if (value <= 5) return { state: 'attention', label: 'Faixa de atenção' };
  return { state: 'off-target', label: 'Fora da meta' };
};

// Para falha no canavial, quanto menor o percentual, melhor.
const getTrend = (currentRaw, referenceRaw) => {
  const current = valueForDisplay(currentRaw);
  const reference = valueForDisplay(referenceRaw);
  if (current === null || reference === null) return null;

  const difference = current - reference;
  if (Math.abs(difference) < 0.005) {
    return { state: 'stable', symbol: '•', delta: '0,00' };
  }

  return {
    state: difference < 0 ? 'favorable' : 'attention',
    symbol: difference < 0 ? '▼' : '▲',
    delta: Math.abs(difference).toFixed(2).replace('.', ','),
  };
};

const CardTLIUP = ({ selectedYear }) => {
  const [annualRows, setAnnualRows] = useState([]);
  const [parameterRows, setParameterRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);

  const year = Number(selectedYear) || new Date().getFullYear();
  const allYears = useMemo(
    () => Array.from(
      { length: Math.max(1, year - FIRST_YEAR + 1) },
      (_, index) => FIRST_YEAR + index
    ),
    [year]
  );
  const visibleYears = useMemo(
    () => Array.from(
      { length: MAX_VISIBLE_YEARS },
      (_, index) => year - MAX_VISIBLE_YEARS + 1 + index
    ),
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
            .from('vw_q_iup_ano')
            .select('ano, kpi_falha')
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
        console.error('[CardTLIUP] Erro:', error);
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

  const getRawValue = (targetYear) => {
    if (hasManualValue(targetYear)) return Number(MANUAL_VALUES[targetYear]) / 100;
    if (targetYear < DISPLAY_FROM_YEAR) return null;
    return rowsByYear.get(targetYear)?.[INDICATOR.key] ?? null;
  };

  const getMeta = (targetYear) =>
    resolveMetaForYear(parameterRows, INDICATOR.parameterName, targetYear, null);

  const firstValidYear = useMemo(
    () => allYears.find((targetYear) => toNumber(getRawValue(targetYear)) !== null) ?? null,
    [allYears, rowsByYear]
  );

  const lastValidYear = useMemo(
    () => [...allYears].reverse().find(
      (targetYear) => toNumber(getRawValue(targetYear)) !== null
    ) ?? null,
    [allYears, rowsByYear]
  );

  const annualTrend = (targetYear) => {
    const validYearsBefore = allYears.filter(
      (candidateYear) => candidateYear < targetYear
        && toNumber(getRawValue(candidateYear)) !== null
    );
    const referenceYear = validYearsBefore.at(-1);
    if (referenceYear === undefined) return null;
    return getTrend(getRawValue(targetYear), getRawValue(referenceYear));
  };

  const generalTrend =
    firstValidYear !== null && lastValidYear !== null && firstValidYear !== lastValidYear
      ? getTrend(getRawValue(lastValidYear), getRawValue(firstValidYear))
      : null;

  const mobileHidden = (index) =>
    visibleYears.length > 2 && index < visibleYears.length - 2;

  const metaText = (targetYear, rawValue) => {
    if (toNumber(rawValue) === null) {
      return targetYear < DISPLAY_FROM_YEAR ? 'Sem avaliação' : 'Sem avaliação';
      //return targetYear < DISPLAY_FROM_YEAR ? 'Exibição bloqueada' : 'Sem avaliação';
    }
    const evaluation = evaluateValue(rawValue, getMeta(targetYear));
    if (evaluation.state === 'attention') return evaluation.label;
    const description = formatMetaDescription(getMeta(targetYear));
    return description && description !== 'Sem meta' ? description : evaluation.label;
  };

  if (isLoading) {
    return <div className="qf-mx-card qf-mx-msg"><div className="qf-mx-spinner" /></div>;
  }
  if (hasError) {
    return <div className="qf-mx-card qf-mx-msg is-error">Erro ao carregar o painel.</div>;
  }

  return (
    <section className="qf-mx-card qf-iup-card">
      <header className="qf-mx-header"><h2>IUP - Índice de Uniformidade do Plantio</h2></header>

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

        <div className="qf-mx-row">
          <button
            type="button"
            className="qf-mx-col-ind qf-mx-ind-button"
            onClick={() => setModalOpen(true)}
          >
            <strong>{INDICATOR.label}</strong><span>›</span>
          </button>

          <div className="qf-mx-track">
            {visibleYears.map((targetYear, index) => {
              const rawValue = getRawValue(targetYear);
              const evaluation = evaluateValue(rawValue, getMeta(targetYear));
              const trend = annualTrend(targetYear);

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
            <small>
              {generalTrend?.state === 'favorable'
                ? 'Redução da falha'
                : generalTrend?.state === 'attention'
                  ? 'Aumento da falha'
                  : 'Sem comparação'}
            </small>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="qf-mx-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <section
            className="qf-mx-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qf-iup-modal-title"
          >
            <header>
              <div>
                <span>Timeline completa</span>
                <h3 id="qf-iup-modal-title">{INDICATOR.label}</h3>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Fechar">×</button>
            </header>

            <div className={`qf-mx-modal-general is-${generalTrend?.state || 'neutral'}`}>
              <span>Evolução geral</span>
              <strong>{firstValidYear && lastValidYear ? `${firstValidYear} - ${lastValidYear}` : 'S/ período'}</strong>
              <b>{generalTrend ? `${generalTrend.symbol} ${generalTrend.delta} p.p.` : '—'}</b>
              <small>
                {generalTrend?.state === 'favorable'
                  ? 'Redução da falha'
                  : generalTrend?.state === 'attention'
                    ? 'Aumento da falha'
                    : 'Sem comparação'}
              </small>
            </div>

            <div className="qf-mx-modal-list">
              {allYears.map((targetYear) => {
                const rawValue = getRawValue(targetYear);
                const evaluation = evaluateValue(rawValue, getMeta(targetYear));
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
        <thead>
          <tr>
            <th>Área</th><th>Atividade</th><th>Indicador</th>
            <th>Ano</th><th>Resultado</th><th>Meta</th>
          </tr>
        </thead>
        <tbody>
          {allYears.map((targetYear) => {
            const rawValue = getRawValue(targetYear);
            return (
              <tr key={targetYear}>
                <td>{ACTIVITY.area}</td>
                <td>{ACTIVITY.name}</td>
                <td>{INDICATOR.label}</td>
                <td>{targetYear}</td>
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

export default CardTLIUP;
