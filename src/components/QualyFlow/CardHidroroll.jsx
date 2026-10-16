// ================================= DOCUMENTATION ------------------------------------------
// Script: CardHidroroll
// Purpose: Exibe o resumo diário e a leitura visual ponto a ponto do Hidroroll.
// Relationships:
//   - vw_q_hidroroll_dia
//   - vw_q_hidroroll_ponto
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import './CardHidroroll.css';

// ================================= CONFIGURAÇÃO -------------------------------------------

const DEPTH_SCALE_MIN = 25;
const SAMPLE_COUNT = 12;

// ================================= HELPERS ------------------------------------------------

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatValue = (value, decimals = 1) => {
  const number = toNumber(value);
  if (number === null) return '-';
  return number.toFixed(decimals).replace('.', ',');
};

const formatPercent = (value, decimals = 1) => {
  const number = toNumber(value);
  if (number === null) return '-';
  return `${(number * 100).toFixed(decimals).replace('.', ',')}%`;
};

const getInfiltrationLevel = (value) => {
  const number = toNumber(value);
  if (number === null) return 'neutral';
  if (number >= 18) return 'good';
  if (number >= 14) return 'warning';
  return 'danger';
};

const getPercentLevel = (value) => {
  const number = toNumber(value);
  if (number === null) return 'neutral';
  const percent = number * 100;
  if (percent >= 90) return 'good';
  if (percent >= 80) return 'warning';
  return 'danger';
};

const clampDepth = (value, maxDepth) => {
  const number = toNumber(value);
  if (number === null || maxDepth <= 0) return 0;
  return Math.min(Math.max(number, 0), maxDepth);
};

const fillSamples = (samples) => {
  const byOrder = new Map(
    samples.map((sample) => [Number(sample.ordem_amostra), sample]),
  );

  return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const order = index + 1;
    return byOrder.get(order) || { ordem_amostra: order, isEmpty: true };
  });
};

const buildFieldGroups = (dailyRows, pointRows) => {
  const fields = new Map();

  dailyRows.forEach((row) => {
    const fieldKey = String(row.codigo_campo);

    if (!fields.has(fieldKey)) {
      fields.set(fieldKey, {
        key: fieldKey,
        codigo_campo: row.codigo_campo,
        campo: row.campo,
        setor: row.setor,
        summaries: [],
        points: [],
      });
    }

    fields.get(fieldKey).summaries.push(row);
  });

  const pointMap = new Map();

  pointRows.forEach((row) => {
    const fieldKey = String(row.codigo_campo);
    const pointKey = `${fieldKey}|${row.lote}|${row.ponto}`;

    if (!fields.has(fieldKey)) {
      fields.set(fieldKey, {
        key: fieldKey,
        codigo_campo: row.codigo_campo,
        campo: row.campo,
        setor: row.setor,
        summaries: [],
        points: [],
      });
    }

    if (!pointMap.has(pointKey)) {
      const point = {
        key: pointKey,
        codigo_campo: row.codigo_campo,
        campo: row.campo,
        lote: row.lote,
        setor: row.setor,
        ponto: Number(row.ponto) || 1,
        samples: [],
      };

      pointMap.set(pointKey, point);
      fields.get(fieldKey).points.push(point);
    }

    pointMap.get(pointKey).samples.push(row);
  });

  return [...fields.values()]
    .map((field) => {
      const totalEvaluated = field.summaries.reduce(
        (sum, row) => sum + (toNumber(row.avaliado) || 0),
        0,
      );
      const totalStandard = field.summaries.reduce(
        (sum, row) => sum + (toNumber(row.padrao) || 0),
        0,
      );
      const weightedInfiltration = field.summaries.reduce(
        (sum, row) => sum + ((toNumber(row.media_infiltracao) || 0) * (toNumber(row.avaliado) || 0)),
        0,
      );

      const fullInfiltration = field.points.flatMap((point) =>
        point.samples.map((sample) => toNumber(sample.infiltracao)).filter((value) => value !== null),
      );
      const infiltrationAverage = totalEvaluated > 0
        ? weightedInfiltration / totalEvaluated
        : null;
      const uniformityAverage = fullInfiltration.length > 0 && infiltrationAverage !== 0
        ? 1 - (
          fullInfiltration.reduce(
            (sum, value) => sum + Math.abs(value - infiltrationAverage),
            0,
          ) / (fullInfiltration.length * infiltrationAverage)
        )
        : null;
      const standardPercent = totalEvaluated > 0 ? totalStandard / totalEvaluated : null;

      return {
        ...field,
        summary: {
          media_infiltracao: infiltrationAverage,
          perc_uniformidade: uniformityAverage,
          perc_padrao: standardPercent,
        },
        points: field.points
          .map((point) => ({
            ...point,
            samples: point.samples.sort(
              (a, b) => Number(a.ordem_amostra) - Number(b.ordem_amostra),
            ),
          }))
          .sort((a, b) => {
            const lotComparison = String(a.lote).localeCompare(String(b.lote), 'pt-BR', {
              numeric: true,
            });
            return lotComparison !== 0 ? lotComparison : a.ponto - b.ponto;
          }),
      };
    })
    .sort((a, b) => String(a.codigo_campo).localeCompare(
      String(b.codigo_campo),
      'pt-BR',
      { numeric: true },
    ));
};

// ================================= SUBCOMPONENTES -----------------------------------------

const LoadingSpinner = () => (
  <div className="qf-hr-loading" aria-label="Carregando avaliações de Hidroroll">
    <div className="qf-hr-spinner" />
  </div>
);

const DepthSample = ({ sample, maxDepth }) => {
  if (sample.isEmpty) {
    return (
      <div className="qf-hr-sample qf-hr-sample--empty">
        <span className="qf-hr-sample-value">-</span>
        <div className="qf-hr-depth-track">
          <span className="qf-hr-empty-mark">—</span>
        </div>
        <span className="qf-hr-sample-order">{sample.ordem_amostra}</span>
      </div>
    );
  }

  const infiltration = clampDepth(sample.infiltracao, maxDepth);
  const caneMin = clampDepth(sample.cana_min, maxDepth);
  const caneMax = clampDepth(sample.cana_max, maxDepth);
  const reached = Number(sample.atingiu_padrao) === 1;
  const level = getInfiltrationLevel(sample.infiltracao);

  return (
    <div
      className="qf-hr-sample"
      title={`Amostra ${sample.ordem_amostra} | Infiltração: ${formatValue(sample.infiltracao)} cm | Cana: ${formatValue(sample.cana_min)} a ${formatValue(sample.cana_max)} cm`}
    >
      <span className={`qf-hr-sample-value is-${level}`}>
        {formatValue(sample.infiltracao, 0)}
      </span>

      <div className="qf-hr-depth-track" aria-hidden="true">
        <div
          className={`qf-hr-water-column ${reached ? 'is-reached' : 'is-not-reached'}`}
          style={{ height: `${(infiltration / maxDepth) * 100}%` }}
        />

        <span
          className="qf-hr-cane-mark qf-hr-cane-mark--min"
          style={{ top: `${(caneMin / maxDepth) * 100}%` }}
        />
        <span
          className="qf-hr-cane-mark qf-hr-cane-mark--max"
          style={{ top: `${(caneMax / maxDepth) * 100}%` }}
        />
      </div>

      <span className="qf-hr-sample-order">{sample.ordem_amostra}</span>
    </div>
  );
};

const PointChart = ({ point }) => {
  const samples = fillSamples(point.samples);
  const dataMax = Math.max(
    DEPTH_SCALE_MIN,
    ...point.samples.flatMap((sample) => [
      toNumber(sample.infiltracao) || 0,
      toNumber(sample.cana_max) || 0,
    ]),
  );
  const maxDepth = Math.ceil(dataMax / 5) * 5;

  return (
    <div className="qf-hr-point-chart">
      <div className="qf-hr-point-caption">
        <div>
          <span>Lote {point.lote || '-'}</span>
          <strong>Ponto {point.ponto}</strong>
        </div>

        <div className="qf-hr-point-legend" aria-label="Legenda do gráfico">
          <span><i className="is-water" />Infiltração</span>
          <span><i className="is-cane" />Cana mín./máx.</span>
        </div>
      </div>

      <div className="qf-hr-samples-grid">
        {samples.map((sample) => (
          <DepthSample
            key={`${point.key}-${sample.ordem_amostra}`}
            sample={sample}
            maxDepth={maxDepth}
          />
        ))}
      </div>
    </div>
  );
};

const FieldSection = ({ field, activePointKey, onPointChange }) => {
  const selectedPoint = field.points.find((point) => point.key === activePointKey)
    || field.points[0];

  if (!selectedPoint) return null;

  return (
    <article className="qf-hr-field-block">
      <div className="qf-hr-field-header">
        <div className="qf-hr-field-title">
          <strong>{field.campo || field.codigo_campo}</strong>
          <span>{field.setor}</span>
        </div>

        <div className="qf-hr-kpis">
          <div>
            <small>Méd. infiltração</small>
            <strong className={`is-${getInfiltrationLevel(field.summary.media_infiltracao)}`}>
              {formatValue(field.summary.media_infiltracao)} <em>cm</em>
            </strong>
          </div>
          <div>
            <small>Uniformidade</small>
            <strong className={`is-${getPercentLevel(field.summary.perc_uniformidade)}`}>
              {formatPercent(field.summary.perc_uniformidade)}
            </strong>
          </div>
          <div>
            <small>Padrão</small>
            <strong className={`is-${getPercentLevel(field.summary.perc_padrao)}`}>
              {formatPercent(field.summary.perc_padrao)}
            </strong>
          </div>
        </div>
      </div>

      <div className="qf-hr-point-tabs" role="tablist" aria-label={`Pontos do campo ${field.campo}`}>
        {field.points.map((point) => {
          const active = point.key === selectedPoint.key;
          return (
            <button
              key={point.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? 'is-active' : ''}
              onClick={() => onPointChange(field.key, point.key)}
            >
              <span>P{point.ponto}</span>
              <small>Lote {point.lote}</small>
            </button>
          );
        })}
      </div>

      <PointChart point={selectedPoint} />
    </article>
  );
};

// ================================= COMPONENTE --------------------------------------------

const CardHidroroll = ({ selectedDate }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [dailyRows, setDailyRows] = useState([]);
  const [pointRows, setPointRows] = useState([]);
  const [activePoints, setActivePoints] = useState({});

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      setDailyRows([]);
      setPointRows([]);
      setActivePoints({});

      try {
        if (!selectedDate) return;

        const [dailyResult, pointResult] = await Promise.all([
          supabase
            .from('vw_q_hidroroll_dia')
            .select('ano, mes, semana, data_apontamento, codigo_campo, campo, lote, setor, media_infiltracao, perc_uniformidade, avaliado, padrao, perc_padrao')
            .eq('data_apontamento', selectedDate)
            .order('codigo_campo', { ascending: true })
            .order('lote', { ascending: true }),

          supabase
            .from('vw_q_hidroroll_ponto')
            .select('ano, mes, semana, data_apontamento, codigo_campo, campo, lote, setor, ponto, ordem_amostra, data_hora, infiltracao, cana_min, cana_max, cana_media, diferenca, atingiu_padrao')
            .eq('data_apontamento', selectedDate)
            .order('codigo_campo', { ascending: true })
            .order('lote', { ascending: true })
            .order('ponto', { ascending: true })
            .order('ordem_amostra', { ascending: true }),
        ]);

        if (dailyResult.error) throw dailyResult.error;
        if (pointResult.error) throw pointResult.error;
        if (!mounted) return;

        setDailyRows(dailyResult.data || []);
        setPointRows(pointResult.data || []);
      } catch (error) {
        console.error('[CardHidroroll] Erro ao carregar avaliações:', error);
        if (mounted) {
          setDailyRows([]);
          setPointRows([]);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, [selectedDate]);

  const fieldGroups = useMemo(
    () => buildFieldGroups(dailyRows, pointRows),
    [dailyRows, pointRows],
  );

  useEffect(() => {
    if (fieldGroups.length === 0) return;

    setActivePoints((current) => {
      const next = { ...current };
      fieldGroups.forEach((field) => {
        const stillExists = field.points.some((point) => point.key === next[field.key]);
        if (!stillExists && field.points[0]) next[field.key] = field.points[0].key;
      });
      return next;
    });
  }, [fieldGroups]);

  const handlePointChange = (fieldKey, pointKey) => {
    setActivePoints((current) => ({ ...current, [fieldKey]: pointKey }));
  };

  if (isLoading) return <LoadingSpinner />;
  if (fieldGroups.length === 0) return null;

  return (
    <section className="qf-card qf-hr-card animate-in zoom-in-95 duration-300 mt-4">
      <div className="qf-card-top-bar" />

      <div className="qf-card-header qf-hr-card-header">
        <h2 className="qf-card-title">Avaliação Hidroroll</h2>
      </div>

      <div className="qf-hr-fields-list">
        {fieldGroups.map((field) => (
          <FieldSection
            key={field.key}
            field={field}
            activePointKey={activePoints[field.key]}
            onPointChange={handlePointChange}
          />
        ))}
      </div>

      <div className="qf-card-footer qf-hr-footer">
        <div className="qf-hr-footer-note">
          <span className="is-good">≥ 18</span>
          <span className="is-warning">14 a 17,9</span>
          <span className="is-danger">&lt; 14 cm</span>
        </div>

        <button
          type="button"
          className="qf-hr-detail-button"
          onClick={() => navigate('/qualyflow/hidroroll', { state: { selectedDate } })}
        >
          Detalhado
        </button>
      </div>
    </section>
  );
};

export default CardHidroroll;
