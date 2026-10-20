// ================================= DOCUMENTATION ------------------------------------------
// Script: CardPlantioMec
// Purpose: Exibe campos, indicadores e histograma diario do Plantio Mecanizado.
// Relationships:
//   - vw_q_plantiomec_detalhe
//   - vw_q_plantiomec_gemas
//   - rulesPlantioMec.js
//   - QualyFlowHome
// Route:
//   - /qualyflow/plantiomec
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { getRegraHistogramaParaData, getFaixaGemas } from './rulesPlantioMec';
import './CardPlantioMec.css';

// ================================= CONFIGURACAO -------------------------------------------

const COLUMN_WIDTHS = { campo: 1.7, gemas: 0.72, falha: 0.72, coberta: 0.72 };
const FONT_SIZES = { header: '10px', content: '12px' };
const GRID_COLUMN_GAP = '5px';
const TABLE_MAX_HEIGHT = '220px';

const buildGridColumns = () => [
  `minmax(0, ${COLUMN_WIDTHS.campo}fr)`,
  `minmax(0, ${COLUMN_WIDTHS.gemas}fr)`,
  `minmax(0, ${COLUMN_WIDTHS.falha}fr)`,
  `minmax(0, ${COLUMN_WIDTHS.coberta}fr)`,
].join(' ');

// ================================= HELPERS ------------------------------------------------

const asArray = value => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? '').trim() || fallback;
const toNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const formatNumber = (value, decimals = 1) => {
  const numeric = toNumber(value);
  return numeric === null ? '-' : numeric.toFixed(decimals).replace('.', ',');
};
const formatPercent = (value, decimals = 1) => {
  const numeric = toNumber(value);
  return numeric === null ? '-' : `${numeric.toFixed(decimals).replace('.', ',')}%`;
};
const safePercent = (numerator, denominator) => {
  const top = toNumber(numerator, 0);
  const bottom = toNumber(denominator, 0);
  return bottom > 0 ? (top / bottom) * 100 : null;
};
const getIndicatorLevel = (type, value) => {
  const numeric = toNumber(value);
  if (numeric === null) return 'neutral';
  if (type === 'gemas') return numeric >= 80 ? 'good' : numeric >= 70 ? 'warning' : 'danger';
  if (type === 'falha') return numeric === 0 ? 'good' : numeric <= 1 ? 'warning' : 'danger';
  if (type === 'coberta') return numeric >= 90 ? 'good' : numeric >= 80 ? 'warning' : 'danger';
  return 'neutral';
};
const getCoverAverageLevel = value => {
  const numeric = toNumber(value);
  if (numeric === null) return 'neutral';
  return numeric >= 5 && numeric <= 8 ? 'good' : 'danger';
};
const getHistogramRule = selectedDate => getRegraHistogramaParaData(selectedDate);

const buildFieldSummaries = rows => {
  const map = new Map();
  rows.forEach(row => {
    const code = text(row.codigo_campo, 'SEM-CODIGO');
    if (!map.has(code)) map.set(code, { codigo_campo: code, campo: text(row.campo, code), setor: text(row.setor, '-'), depa: text(row.depa, '-'), gemas_totais: 0, gemas_viaveis: 0, falha_avaliado: 0, falha_metro: 0, coberta_avaliada: 0, coberta_padrao: 0, coberta_soma: 0 });
    const item = map.get(code);
    item.gemas_totais += toNumber(row.gemas_totais, 0);
    item.gemas_viaveis += toNumber(row.gemas_viaveis, 0);
    item.falha_avaliado += toNumber(row.falha_avaliado, 0);
    item.falha_metro += toNumber(row.falha_metro, 0);
    const covered = toNumber(row.coberta_avaliada, 0);
    item.coberta_avaliada += covered;
    item.coberta_padrao += toNumber(row.coberta_padrao, 0);
    item.coberta_soma += toNumber(row.coberta_media, 0) * covered;
  });

  return [...map.values()].map(item => ({
    ...item,
    has_gemas: item.gemas_totais > 0,
    has_falha: item.falha_avaliado > 0,
    has_coberta: item.coberta_avaliada > 0,
    gemas_percent: safePercent(item.gemas_viaveis, item.gemas_totais),
    falha_percent: safePercent(item.falha_metro, item.falha_avaliado),
    coberta_percent: safePercent(item.coberta_padrao, item.coberta_avaliada),
    coberta_media: item.coberta_avaliada > 0 ? item.coberta_soma / item.coberta_avaliada : null,
  })).filter(item => item.has_gemas || item.has_falha || item.has_coberta).sort((a, b) => Number(b.has_gemas) - Number(a.has_gemas) || a.campo.localeCompare(b.campo, 'pt-BR', { numeric: true }));
};

const buildHistogram = (rows, rule) => {
  const values = rows.map(row => toNumber(row.gemas_viaveis)).filter(value => value !== null);
  const ranges = asArray(rule?.faixas).map(range => ({
    ...range,
    status: getFaixaGemas(range.min, rule)?.status || range.status || 'neutral',
    count: values.filter(value => value >= range.min && (range.max === null || value <= range.max)).length,
  }));
  return { ranges, metrosAvaliados: values.length, maxCount: Math.max(1, ...ranges.map(range => range.count)) };
};

// ================================= SUBCOMPONENTES -----------------------------------------

const LoadingSpinner = () => <div className="qf-pm-loading" aria-label="Carregando avaliacoes de Plantio Mecanizado"><div className="qf-pm-spinner" /></div>;

const IndicatorBar = ({ type, label, value }) => {
  const level = getIndicatorLevel(type, value);
  const width = value === null ? 0 : Math.min(Math.max(value, 0), 100);
  return <div className="qf-pm-indicator"><div className="qf-pm-indicator-head"><strong>{label}</strong><span className={`is-${level}`}>{formatPercent(value)}</span></div><div className="qf-pm-indicator-track"><i className={`is-${level}`} style={{ width: `${width}%` }} /></div></div>;
};

const Histogram = ({ histogram, rule }) => (
  <div className="qf-pm-histogram">
    <div className="qf-pm-histogram-head"><strong>Gemas Viaveis/m</strong><span>{histogram.metrosAvaliados}m avaliado</span></div>
    {histogram.ranges.length ? <div className="qf-pm-histogram-bars">{histogram.ranges.map(range => {
      const normalized = histogram.maxCount > 0 ? (range.count / histogram.maxCount) * 100 : 0;
      const height = range.count > 0 ? Math.max(6, normalized) : 0;
      return <div className="qf-pm-histogram-item" key={`${rule?.data_inicio}-${range.label}`} title={`${range.label}: ${range.count} metro(s)`}><b className={`is-${range.status}`}>{range.count}</b><div className="qf-pm-histogram-track"><i className={`is-${range.status}`} style={{ height: `${height}%` }} /></div><span>{range.label}</span></div>;
    })}</div> : <div className="qf-pm-histogram-empty">Regra de histograma nao configurada.</div>}
  </div>
);

// ================================= COMPONENTE --------------------------------------------

const CardPlantioMec = ({ selectedDate }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [detailRows, setDetailRows] = useState([]);
  const [gemRows, setGemRows] = useState([]);
  const [activeFieldCode, setActiveFieldCode] = useState('');
  const gridColumns = useMemo(() => buildGridColumns(), []);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setIsLoading(true); setDetailRows([]); setGemRows([]); setActiveFieldCode('');
      try {
        if (!selectedDate) return;
        const [detailResponse, gemsResponse] = await Promise.all([
          supabase.from('vw_q_plantiomec_detalhe').select('data,codigo_campo,campo,setor,depa,gemas_totais,gemas_viaveis,falha_avaliado,falha_metro,coberta_avaliada,coberta_padrao,coberta_media').eq('data', selectedDate).order('campo', { ascending: true }),
          supabase.from('vw_q_plantiomec_gemas').select('data,codigo_campo,campo,lote,ponto,amostra,gemas_viaveis').eq('data', selectedDate).order('codigo_campo', { ascending: true }).order('lote', { ascending: true }).order('ponto', { ascending: true }).order('amostra', { ascending: true }),
        ]);
        if (detailResponse.error) throw detailResponse.error;
        if (gemsResponse.error) throw gemsResponse.error;
        if (!mounted) return;
        setDetailRows(asArray(detailResponse.data));
        setGemRows(asArray(gemsResponse.data));
      } catch (error) {
        console.error('[CardPlantioMec] Erro ao carregar avaliacoes:', error);
        if (mounted) { setDetailRows([]); setGemRows([]); }
      } finally { if (mounted) setIsLoading(false); }
    };
    loadData();
    return () => { mounted = false; };
  }, [selectedDate]);

  const fields = useMemo(() => buildFieldSummaries(detailRows), [detailRows]);
  const gemFields = useMemo(() => fields.filter(field => field.has_gemas), [fields]);

  useEffect(() => {
    if (!fields.length) { setActiveFieldCode(''); return; }
    if (!fields.some(field => field.codigo_campo === activeFieldCode)) setActiveFieldCode((gemFields[0] || fields[0]).codigo_campo);
  }, [fields, gemFields, activeFieldCode]);

  const activeField = fields.find(field => field.codigo_campo === activeFieldCode) || gemFields[0] || fields[0] || null;
  const histogramRule = useMemo(() => getHistogramRule(selectedDate), [selectedDate]);
  const histogram = useMemo(() => buildHistogram(gemRows.filter(row => String(row.codigo_campo) === String(activeFieldCode)), histogramRule), [gemRows, activeFieldCode, histogramRule]);

  if (isLoading) return <LoadingSpinner />;
  if (!activeField) return null;

  return <section className="qf-card qf-pm-card animate-in zoom-in-95 duration-300">
    <div className="qf-card-top-bar" />
    <div className="qf-card-header qf-pm-card-header"><h2 className="qf-card-title">Plantio Mecanizado</h2></div>

    <div className="qf-pm-table">
      <div className="qf-pm-table-header" style={{ gridTemplateColumns: gridColumns, columnGap: GRID_COLUMN_GAP }}><span style={{ fontSize: FONT_SIZES.header }}>Campo</span><span style={{ fontSize: FONT_SIZES.header }}>Gemas</span><span style={{ fontSize: FONT_SIZES.header }}>Falha</span><span style={{ fontSize: FONT_SIZES.header }}>Coberta</span></div>
      <div className="qf-pm-table-body custom-scrollbar" style={{ maxHeight: TABLE_MAX_HEIGHT }}>{fields.map(field => {
        const gemLevel = getIndicatorLevel('gemas', field.gemas_percent);
        const failureLevel = getIndicatorLevel('falha', field.falha_percent);
        const coverLevel = getCoverAverageLevel(field.coberta_media);
        return <button type="button" className="qf-pm-table-row" key={field.codigo_campo} style={{ gridTemplateColumns: gridColumns, columnGap: GRID_COLUMN_GAP }} onClick={() => setActiveFieldCode(field.codigo_campo)}>
          <span className="qf-pm-field" style={{ fontSize: FONT_SIZES.content }} title={field.campo}>{field.campo}</span>
          <span className="qf-pm-number" style={{ fontSize: FONT_SIZES.content }} title={`Gemas viaveis: ${formatPercent(field.gemas_percent)}`}><em className={`is-${gemLevel}`}>{field.has_gemas ? formatNumber(field.gemas_viaveis, 0) : '-'}</em>{field.has_gemas ? `/${formatNumber(field.gemas_totais, 0)}` : ''}</span>
          <span className={`qf-pm-number is-${field.has_falha ? failureLevel : 'neutral'}`} style={{ fontSize: FONT_SIZES.content }}>{field.has_falha ? `${formatNumber(field.falha_metro, 2)} m` : '-'}</span>
          <span className={`qf-pm-number is-${field.has_coberta ? coverLevel : 'neutral'}`} style={{ fontSize: FONT_SIZES.content }}>{field.has_coberta ? `${formatNumber(field.coberta_media, 2)} cm` : '-'}</span>
        </button>;
      })}</div>
    </div>

    <div className="qf-pm-indicators">
      <IndicatorBar type="gemas" label="Gemas Viaveis" value={activeField.gemas_percent} />
      <IndicatorBar type="falha" label="Falha no Plantio" value={activeField.falha_percent} />
      <IndicatorBar type="coberta" label="Cobertura no Plantio" value={activeField.coberta_percent} />
    </div>

    {activeField.has_gemas && <Histogram histogram={histogram} rule={histogramRule} />}

    <div className="qf-card-footer qf-pm-footer"><button type="button" className="qf-pm-detail-button" onClick={() => navigate('/qualyflow/plantiomec', { state: { selectedDate, codigoCampo: activeField.codigo_campo } })}>Detalhado</button></div>
  </section>;
};

export default CardPlantioMec;
