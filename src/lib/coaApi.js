import { supabase } from './supabaseClient';

const RESUMO_COLUMNS = [
  'data',
  'semana',
  'mes',
  'ano',
  'desc_area',
  'categoria',
  'hrs_total_seg',
  'hrs_disp_seg',
  'hrs_produtivas_seg',
  'hrs_s_apont_seg',
  'hrs_indeter_seg',
  'hrs_manutencao_seg',
  'hrs_deslocamento_seg',
  'hrs_total',
  'hrs_disp',
  'hrs_produtivas',
  'hrs_s_apont',
  'hrs_indeter',
  'hrs_manutencao',
  'hrs_deslocamento',
  'ef_op',
  'ef_real',
  'perc_s_apont',
  'perc_indeter',
  'disp_mec',
].join(',');

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeResumoRow = (row = {}) => ({
  ...row,
  semana: toNumber(row.semana),
  mes: toNumber(row.mes),
  ano: toNumber(row.ano),
  hrs_total_seg: toNumber(row.hrs_total_seg),
  hrs_disp_seg: toNumber(row.hrs_disp_seg),
  hrs_produtivas_seg: toNumber(row.hrs_produtivas_seg),
  hrs_s_apont_seg: toNumber(row.hrs_s_apont_seg),
  hrs_indeter_seg: toNumber(row.hrs_indeter_seg),
  hrs_manutencao_seg: toNumber(row.hrs_manutencao_seg),
  hrs_deslocamento_seg: toNumber(row.hrs_deslocamento_seg),
  hrs_total: toNumber(row.hrs_total),
  hrs_disp: toNumber(row.hrs_disp),
  hrs_produtivas: toNumber(row.hrs_produtivas),
  hrs_s_apont: toNumber(row.hrs_s_apont),
  hrs_indeter: toNumber(row.hrs_indeter),
  hrs_manutencao: toNumber(row.hrs_manutencao),
  hrs_deslocamento: toNumber(row.hrs_deslocamento),
  ef_op: toNumber(row.ef_op),
  ef_real: toNumber(row.ef_real),
  perc_s_apont: toNumber(row.perc_s_apont),
  perc_indeter: toNumber(row.perc_indeter),
  disp_mec: toNumber(row.disp_mec),
});

export async function fetchVwCEficiencias() {
  const { data, error } = await supabase
    .from('vw_c_eficiencias')
    .select(RESUMO_COLUMNS)
    .order('ano', { ascending: true })
    .order('mes', { ascending: true })
    .order('semana', { ascending: true })
    .order('data', { ascending: true })
    .order('desc_area', { ascending: true });

  if (error) {
    console.error('Erro ao consultar vw_c_eficiencias:', error);
    throw error;
  }

  return (data || []).map(normalizeResumoRow);
}
