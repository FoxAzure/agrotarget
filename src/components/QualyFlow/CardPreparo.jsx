// ================================= DOCUMENTATION ------------------------------------------
// Script: CardPreparo
// Purpose: Exibe os campos avaliados e o resumo diário dos indicadores de Preparo de Solo.
// Relationships:
//   - vw_q_preparo_datas
//   - QualyFlowHome
// Route:
//   - /qualyflow/preparo
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import './CardPreparo.css';

// ================================= CONFIGURAÇÃO -------------------------------------------

const COLUMN_WIDTHS = { campo: 1.7, pontos: 0.55, sulco: 0.72, fita: 0.72 };
const FONT_SIZES = { header: '10px', content: '12px' };
const GRID_COLUMN_GAP = '5px';
const TABLE_MAX_HEIGHT = '220px';

const INDICATORS = [
  { key: 'haste', label: 'Haste', standard: 'profund_haste_padrao', evaluated: 'profund_haste_avaliadas', group: 'depth' },
  { key: 'cana', label: 'Cana', standard: 'profund_cana_padrao', evaluated: 'profund_cana_avaliadas', group: 'depth' },
  { key: 'sulco', label: 'P. Sulco', standard: 'paralelismo_sulco_padrao', evaluated: 'paralelismo_sulco_avaliadas', group: 'parallel' },
  { key: 'fita', label: 'P. Fita', standard: 'paralelismo_fita_padrao', evaluated: 'paralelismo_fita_avaliadas', group: 'parallel' },
  { key: 'profundFita', label: 'Profund. F', standard: 'profund_fita_padrao', evaluated: 'profund_fita_avaliadas', group: 'depth' },
];

const buildGridColumns = () => [
  `minmax(0, ${COLUMN_WIDTHS.campo}fr)`,
  `minmax(0, ${COLUMN_WIDTHS.pontos}fr)`,
  `minmax(0, ${COLUMN_WIDTHS.sulco}fr)`,
  `minmax(0, ${COLUMN_WIDTHS.fita}fr)`,
].join(' ');

// ================================= HELPERS ------------------------------------------------

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatNumber = (value, decimals = 2) => {
  const number = toNumber(value);
  if (number === null) return '-';
  return number.toFixed(decimals).replace('.', ',');
};

const formatPercent = (value, decimals = 1) => {
  const number = toNumber(value);
  if (number === null) return '-';
  return `${number.toFixed(decimals).replace('.', ',')}%`;
};

const calculatePercent = (standard, evaluated) => {
  const standardNumber = toNumber(standard);
  const evaluatedNumber = toNumber(evaluated);
  if (standardNumber === null || evaluatedNumber === null || evaluatedNumber <= 0) return null;
  return (standardNumber / evaluatedNumber) * 100;
};

const getIndicatorLevel = (value, group) => {
  const number = toNumber(value);
  if (number === null) return 'neutral';
  if (group === 'depth') {
    if (number >= 90) return 'good';
    if (number >= 80) return 'warning';
    return 'danger';
  }
  if (number >= 80) return 'good';
  if (number >= 70) return 'warning';
  return 'danger';
};

const getParallelismLevel = (value, min, max) => {
  const number = toNumber(value);
  if (number === null) return 'neutral';
  return number >= min && number <= max ? 'good' : 'danger';
};

const buildIndicators = (rows) => INDICATORS.map((indicator) => {
  const totals = rows.reduce((accumulator, row) => ({
    standard: accumulator.standard + (toNumber(row[indicator.standard]) || 0),
    evaluated: accumulator.evaluated + (toNumber(row[indicator.evaluated]) || 0),
  }), { standard: 0, evaluated: 0 });

  const percent = calculatePercent(totals.standard, totals.evaluated);
  return { ...indicator, ...totals, percent, level: getIndicatorLevel(percent, indicator.group) };
});

// ================================= SUBCOMPONENTES -----------------------------------------

const LoadingSpinner = () => (
  <div className="qf-pr-loading" aria-label="Carregando avaliações de Preparo de Solo">
    <div className="qf-pr-spinner" />
  </div>
);

const IndicatorChart = ({ indicators }) => (
  <div className="qf-pr-chart" aria-label="Indicadores de conformidade do Preparo de Solo">
    <div className="qf-pr-chart__head">
      <strong>Indicadores</strong>
    </div>

    <div className="qf-pr-bars">
      {indicators.map((indicator) => {
        const barHeight = indicator.percent === null ? 0 : Math.min(Math.max(indicator.percent, 0), 100);
        return (
          <div className="qf-pr-bar-item" key={indicator.key} title={`${indicator.label}: ${formatPercent(indicator.percent)} | ${indicator.standard} de ${indicator.evaluated}`}>
            <strong className={`qf-pr-bar-value is-${indicator.level}`}>{formatPercent(indicator.percent)}</strong>
            <div className="qf-pr-bar-track" aria-hidden="true">
              <span className={`qf-pr-bar-fill is-${indicator.level}`} style={{ height: `${barHeight}%` }} />
            </div>
            <span className="qf-pr-bar-label">{indicator.label}</span>
            <small>{indicator.evaluated > 0 ? `${indicator.standard}/${indicator.evaluated}` : '-'}</small>
          </div>
        );
      })}
    </div>
  </div>
);

// ================================= COMPONENTE --------------------------------------------

const CardPreparo = ({ selectedDate }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const gridColumns = useMemo(() => buildGridColumns(), []);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      setRows([]);

      try {
        if (!selectedDate) return;

        const { data, error } = await supabase
          .from('vw_q_preparo_datas')
          .select('data, pontos, campos, profund_haste_padrao, profund_haste_avaliadas, profund_cana_padrao, profund_cana_avaliadas, paralelismo_sulco_media, paralelismo_sulco_padrao, paralelismo_sulco_avaliadas, paralelismo_fita_media, paralelismo_fita_padrao, paralelismo_fita_avaliadas, profund_fita_padrao, profund_fita_avaliadas')
          .eq('data', selectedDate)
          .order('campos', { ascending: true });

        if (error) throw error;
        if (mounted) setRows(data || []);
      } catch (error) {
        console.error('[CardPreparo] Erro ao carregar avaliações:', error);
        if (mounted) setRows([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, [selectedDate]);

  const indicators = useMemo(() => buildIndicators(rows), [rows]);

  if (isLoading) return <LoadingSpinner />;
  if (rows.length === 0) return null;

  return (
    <section className="qf-card qf-pr-card animate-in zoom-in-95 duration-300">
      <div className="qf-card-top-bar" />

      <div className="qf-card-header qf-pr-card-header">
        <h2 className="qf-card-title">Preparo de Solo</h2>
      </div>

      <div className="qf-pr-table">
        <div className="qf-pr-table-header" style={{ gridTemplateColumns: gridColumns, columnGap: GRID_COLUMN_GAP }}>
          <span style={{ fontSize: FONT_SIZES.header }}>Campo</span>
          <span style={{ fontSize: FONT_SIZES.header }}>Pontos</span>
          <span style={{ fontSize: FONT_SIZES.header }}>P. Sulco</span>
          <span style={{ fontSize: FONT_SIZES.header }}>P. Fita</span>
        </div>

        <div className="qf-pr-table-body custom-scrollbar" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
          {rows.map((row, index) => (
            <div className="qf-pr-table-row" key={`${selectedDate}-${row.campos}-${index}`} style={{ gridTemplateColumns: gridColumns, columnGap: GRID_COLUMN_GAP }}>
              <span className="qf-pr-field" style={{ fontSize: FONT_SIZES.content }} title={row.campos || '-'}>{row.campos || '-'}</span>
              <span className="qf-pr-number" style={{ fontSize: FONT_SIZES.content }}>{toNumber(row.pontos) ?? '-'}</span>
              <span className={`qf-pr-number is-${getParallelismLevel(row.paralelismo_sulco_media, 1.45, 1.55)}`} style={{ fontSize: FONT_SIZES.content }} title={`${formatNumber(row.paralelismo_sulco_media)} m`}>{formatNumber(row.paralelismo_sulco_media)}</span>
              <span className={`qf-pr-number is-${getParallelismLevel(row.paralelismo_fita_media, 2.15, 2.25)}`} style={{ fontSize: FONT_SIZES.content }} title={`${formatNumber(row.paralelismo_fita_media)} m`}>{formatNumber(row.paralelismo_fita_media)}</span>
            </div>
          ))}
        </div>
      </div>

      <IndicatorChart indicators={indicators} />

      <div className="qf-card-footer qf-pr-footer">
        <button type="button" className="qf-pr-detail-button" onClick={() => navigate('/qualyflow/preparo', { state: { selectedDate } })}>Detalhado</button>
      </div>
    </section>
  );
};

export default CardPreparo;
