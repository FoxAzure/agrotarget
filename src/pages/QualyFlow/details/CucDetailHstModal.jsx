import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { QUALY_RULES } from '../rules';

const CUC_OCORRENCIAS = ['CUC - Gotejo', 'CUC - Gotejo 9E'];
const EMITTER_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}º Emissor`);

const HIST_BINS = [
  { key: 'lt08', label: '<0,8', color: 'var(--q-danger)' },
  { key: 'r08_09', label: '0,8 a 0,9', color: 'var(--q-orange)' },
  { key: 'r09_11', label: '0,9 a 1,1', color: 'var(--q-success)' },
  { key: 'r11_12', label: '1,1 a 1,2', color: 'var(--q-warning)' },
  { key: 'gt12', label: '>1,2', color: '#21618C' }
];

const AnimatedProgressBar = ({ value, color }) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 150);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1.5 shadow-inner border border-slate-200/50">
      <div
        className="h-full rounded-full transition-all duration-[1500ms] ease-out"
        style={{
          width: `${Math.min(width, 100)}%`,
          backgroundColor: color,
          boxShadow: width > 0 ? `0 0 8px ${color}60` : 'none'
        }}
      />
    </div>
  );
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const raw = String(value).trim();

  if (raw.includes(',')) {
    const normalized = raw.replace(/\./g, '').replace(',', '.');
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }

  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};

const formatNumber = (value, decimals = 2) => {
  const num = Number(value || 0);
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const formatInt = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString('pt-BR', {
    maximumFractionDigits: 0
  });
};

const formatLote = (val) => {
  if (!val || val === '-') return 'SEM LOTE';
  const num = Number(val);
  if (!isNaN(num)) return String(num).padStart(2, '0');
  return String(val).trim().toUpperCase();
};

const sortLotes = (a, b) => {
  const na = parseInt(String(a).match(/\d+/)?.[0] || '999999', 10);
  const nb = parseInt(String(b).match(/\d+/)?.[0] || '999999', 10);

  if (na !== nb) return na - nb;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
};

const calcCuc = (values) => {
  if (!values || values.length === 0) return 0;

  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  if (!mean) return 0;

  const sumAbs = values.reduce((acc, v) => acc + Math.abs(v - mean), 0);
  const cuc = 100 * (1 - (sumAbs / (values.length * mean)));

  return Number.isFinite(cuc) ? Math.max(0, cuc) : 0;
};

const getHistRanges = (values) => {
  const hist = {
    lt08: 0,
    r08_09: 0,
    r09_11: 0,
    r11_12: 0,
    gt12: 0
  };

  values.forEach((v) => {
    if (v < 0.8) hist.lt08 += 1;
    else if (v >= 0.8 && v < 0.9) hist.r08_09 += 1;
    else if (v >= 0.9 && v < 1.1) hist.r09_11 += 1;
    else if (v >= 1.1 && v <= 1.2) hist.r11_12 += 1;
    else if (v > 1.2) hist.gt12 += 1;
  });

  return hist;
};

const Histograma = ({ hist }) => {
  const maxVal = Math.max(...HIST_BINS.map((b) => hist[b.key] || 0), 1);

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 text-center">
        Histograma de Vazões
      </h3>

      <div className="flex items-end justify-between h-[120px] pt-4 px-2 gap-2">
        {HIST_BINS.map((bar) => {
          const value = hist[bar.key] || 0;
          const heightPerc = (value / maxVal) * 100;

          return (
            <div key={bar.key} className="flex flex-col items-center justify-end h-full gap-2 group w-full">
              <span className="text-[10px] font-black text-slate-600 leading-none">
                {value}
              </span>

              <div
                className="w-8 bg-slate-100 rounded-t-sm relative border-x border-t border-slate-200/50 flex items-end justify-center overflow-hidden"
                style={{ height: '100%' }}
              >
                <div
                  className="w-full transition-all duration-700"
                  style={{
                    height: `${heightPerc}%`,
                    backgroundColor: bar.color
                  }}
                />
              </div>

              <span className="text-[9px] font-bold text-slate-400 text-center leading-tight">
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SummaryItem = ({ label, value, color }) => (
  <div className="flex flex-col justify-end border-b border-slate-200 pb-2 min-w-[120px]">
    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
      {label}
    </span>
    <span
      className="text-[15px] font-black tracking-tight leading-none"
      style={{ color: color || 'var(--q-dark)' }}
    >
      {value}
    </span>
  </div>
);

const buildEngine = (rows) => {
  const lotesMap = new Map();
  const allEmitterValues = [];
  let totalEntupidosAbs = 0;

  rows.forEach((row) => {
    const lote = formatLote(row.lote);
    const indicador = String(row.indicador || '').trim();
    const valor = toNumber(row.valor);

    if (!lotesMap.has(lote)) {
      lotesMap.set(lote, {
        lote,
        emitterValues: [],
        entupidosAbs: 0
      });
    }

    const group = lotesMap.get(lote);

    if (valor === null) return;

    // Conversão para L/h
    if (EMITTER_LABELS.includes(indicador)) {
      const vazaoLh = valor * 0.02;
      group.emitterValues.push(vazaoLh);
      allEmitterValues.push(vazaoLh);
    }

    if (indicador === 'Emissores Entupidos') {
      group.entupidosAbs += valor;
      totalEntupidosAbs += valor;
    }
  });

  const lotes = Array.from(lotesMap.values())
    .map((group) => {
      const totalEmissores = group.emitterValues.length;
      const somaVazoes = group.emitterValues.reduce((acc, v) => acc + v, 0);
      const vazaoMedia = totalEmissores > 0 ? somaVazoes / totalEmissores : 0;
      const entupidosPerc =
        totalEmissores > 0 ? (group.entupidosAbs / totalEmissores) * 100 : 0;
      const cucPerc = calcCuc(group.emitterValues);

      return {
        lote: group.lote,
        totalEmissores,
        entupidosAbs: group.entupidosAbs,
        vazaoMedia,
        entupidosPerc,
        cucPerc,
        hist: getHistRanges(group.emitterValues)
      };
    })
    .sort((a, b) => sortLotes(a.lote, b.lote));

  const totalEmissores = allEmitterValues.length;
  const vazaoMediaGeral =
    totalEmissores > 0
      ? allEmitterValues.reduce((acc, v) => acc + v, 0) / totalEmissores
      : 0;
  const entupidosPercGeral =
    totalEmissores > 0 ? (totalEntupidosAbs / totalEmissores) * 100 : 0;
  const cucGeral = calcCuc(allEmitterValues);

  return {
    lotes,
    resumo: {
      totalLotes: lotes.length,
      totalEmissores,
      totalEntupidosAbs,
      cucGeral,
      vazaoMediaGeral,
      entupidosPercGeral
    },
    histGeral: getHistRanges(allEmitterValues)
  };
};

const CucDetailHstModal = ({ item, onClose }) => {
  const [detalhesData, setDetalhesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetalhesCampo = async () => {
      if (!item) return;

      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('tb_agrotarget')
          .select('lote, indicador, valor, ocorrencia')
          .eq('ano', item.ano)
          .eq('codigo_campo', item.cod_campo)
          .eq('extra1', item.avaliacao)
          .in('ocorrencia', CUC_OCORRENCIAS)
          .order('lote', { ascending: true });

        if (error) throw error;

        setDetalhesData(data || []);
      } catch (err) {
        console.error('Erro ao buscar detalhes no Modal:', err);
        setDetalhesData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDetalhesCampo();
  }, [item]);

  const engine = useMemo(() => buildEngine(detalhesData), [detalhesData]);

  if (!item) return null;

  const campoLabel = item.campo || item.cod_campo || 'Campo';
  const avaliacaoLabel = `${item.avaliacao}ª Avaliação`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative bg-white w-full md:w-[60vw] max-w-[980px] h-[78vh] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
        
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all font-black z-20 shadow-sm"
        >
          ✕
        </button>

        <div className="h-full flex flex-col">
          {/* CABEÇALHO */}
          <div className="flex flex-col p-6 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-xl font-black text-[var(--q-dark)] uppercase tracking-tighter leading-none mb-1.5 pr-10">
              Detalhe da Avaliação
            </h2>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black text-[var(--q-green)] bg-[var(--q-green)]/10 px-2 py-0.5 rounded border border-[var(--q-green)]/20 uppercase">
                {campoLabel}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Ano {item.ano} • {avaliacaoLabel}
              </span>
            </div>
          </div>

          {/* CONTEÚDO */}
          <div className="flex-1 overflow-y-auto p-6 bg-[var(--q-bg)] custom-scrollbar">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-4 border-[var(--q-green)]/20 border-t-[var(--q-green)] rounded-full animate-spin mb-3" />
                <span className="text-[10px] font-bold text-[var(--q-green)] uppercase tracking-widest animate-pulse">
                  Consultando Banco de Dados...
                </span>
              </div>
            ) : engine.lotes.length === 0 ? (
              <div className="bg-white border border-slate-200 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-slate-400">
                <span className="text-3xl mb-2">💧</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-[var(--q-dark)]">
                  Nenhum dado encontrado
                </span>
                <p className="text-[10px] mt-1 opacity-70 text-center">
                  Não existem registros suficientes para montar o detalhamento dessa avaliação.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {/* RESUMO */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-x-4 gap-y-3 items-end">
                    <SummaryItem
                      label="Total de Lotes Avaliados"
                      value={formatInt(engine.resumo.totalLotes)}
                    />
                    <SummaryItem
                      label="Emissores Avaliados"
                      value={formatInt(engine.resumo.totalEmissores)}
                    />
                    <SummaryItem
                      label="Emissores Entupidos"
                      value={formatInt(engine.resumo.totalEntupidosAbs)}
                    />
                    <SummaryItem
                      label="CUC Geral %"
                      value={`${formatNumber(engine.resumo.cucGeral, 1)}%`}
                      color={QUALY_RULES.CUC.meta(engine.resumo.cucGeral)}
                    />
                    <SummaryItem
                      label="Vazão L/h Média"
                      value={`${formatNumber(engine.resumo.vazaoMediaGeral, 2)}`}
                      color={QUALY_RULES.CUC.vazaoMeta(engine.resumo.vazaoMediaGeral)}
                    />
                    <SummaryItem
                      label="Entupidos %"
                      value={`${formatNumber(engine.resumo.entupidosPercGeral, 1)}%`}
                      color={QUALY_RULES.CUC.entupimentoMeta(engine.resumo.entupidosPercGeral)}
                    />
                  </div>
                </div>

                {/* HISTOGRAMA */}
                <Histograma hist={engine.histGeral} />

                {/* RESULTADO POR LOTE */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-5 pt-5 pb-3 border-b border-slate-100 bg-slate-50/30">
                    <h3 className="text-title">Lotes Avaliados</h3>
                  </div>

                  <div className="px-5 py-5 flex flex-col gap-3">
                    <div className="grid grid-cols-4 pb-2 border-b border-slate-200">
                      <span className="text-left text-micro">Lote</span>
                      <span className="text-center text-micro">CUC %</span>
                      <span className="text-center text-micro">Vazão</span>
                      <span className="text-right text-micro">Entup %</span>
                    </div>

                    {engine.lotes.map((lote, idx) => {
                      const cucColor = QUALY_RULES.CUC.meta(lote.cucPerc);
                      const vazaoColor = QUALY_RULES.CUC.vazaoMeta(lote.vazaoMedia);
                      const entupColor = QUALY_RULES.CUC.entupimentoMeta(lote.entupidosPerc);

                      return (
                        <div
                          key={`${lote.lote}-${idx}`}
                          className="flex flex-col gap-1.5"
                        >
                          <div className="grid grid-cols-4 items-end">
                            <span
                              className="text-left text-[12px] font-black text-slate-700 uppercase truncate pr-1"
                              title={lote.lote}
                            >
                              {lote.lote}
                            </span>

                            <span
                              className="text-center text-[13px] font-black tracking-tighter"
                              style={{ color: cucColor }}
                            >
                              {formatNumber(lote.cucPerc, 2)}%
                            </span>

                            <span
                              className="text-center text-[13px] font-black tracking-tighter"
                              style={{ color: vazaoColor }}
                            >
                              {formatNumber(lote.vazaoMedia, 2)}
                              <span className="text-[8px] font-bold opacity-40 ml-0.5">L/h</span>
                            </span>

                            <span
                              className="text-right text-[13px] font-black tracking-tighter"
                              style={{ color: entupColor }}
                            >
                              {formatNumber(lote.entupidosPerc, 1)}%
                            </span>
                          </div>

                          <AnimatedProgressBar value={lote.cucPerc} color={cucColor} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CucDetailHstModal;
