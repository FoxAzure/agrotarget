// Regras corporativas do Dashboard CUC.
// Ajuste metas, faixas e cores somente neste arquivo.
export const CUC_RULES = {
  cuc: { target: 90, warningMin: 80, direction: 'higher_is_better', unit: '%' },
  vazao: { target: 1, idealMin: 0.9, idealMax: 1.1, warningMin: 0.8, warningMax: 1.2, direction: 'target_range', unit: 'L/h' },
  entup: { targetMin: 0, targetMax: 5, warningMax: 10, direction: 'lower_is_better', unit: '%' },
};

const COLORS = { green: '#10b981', warning: '#f59e0b', danger: '#ef4444', orange: '#f97316', blue: '#3b82f6', muted: '#64748b' };
const valid = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
export const getCucColor = value => !valid(value) ? COLORS.muted : Number(value) >= 90 ? COLORS.green : Number(value) >= 80 ? COLORS.warning : COLORS.danger;
export const getEntupColor = value => !valid(value) ? COLORS.muted : Number(value) <= 5 ? COLORS.green : Number(value) <= 10 ? COLORS.warning : COLORS.danger;
export const getVazaoColor = value => {
  if (!valid(value)) return COLORS.muted;
  const v=Number(value); if(v>=.9&&v<=1.1)return COLORS.green; if(v>=.8&&v<.9)return COLORS.orange; if(v>1.1&&v<=1.2)return COLORS.warning; return v>1.2?COLORS.blue:COLORS.danger;
};
export const getMetricMetaLabel = metric => metric==='cuc'?'Meta ≥ 90%':metric==='vazao'?'Ideal 0,9–1,1 L/h':'Meta 0–5%';
export const getComparison = (metric,current,previous) => {
  if(!valid(current)||!valid(previous))return{tone:'neutral',icon:'•',label:'S/Histórico'};
  const delta=Number(current)-Number(previous); if(Math.abs(delta)<.005)return{tone:'neutral',icon:'•',label:'0,0 p.p.'};
  let good; if(metric==='entup')good=delta<0; else if(metric==='vazao')good=Math.abs(Number(current)-1)<Math.abs(Number(previous)-1); else good=delta>0;
  return{tone:good?'good':'bad',icon:delta>0?'▲':'▼',label:`${delta>0?'+':''}${delta.toFixed(metric==='vazao'?2:1).replace('.',',')} ${metric==='vazao'?'L/h':'p.p.'}`};
};
