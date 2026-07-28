import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Style.css';

import HeaderAgroTools from '../../../components/AgroTools/HeaderAgroTools';
import SidebarAgroTools from '../../../components/AgroTools/SidebarAgroTools';

const VinhacaTools = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Estados com localStorage para Configuração
  const [espacamento, setEspacamento] = useState(() => localStorage.getItem('at_vin_espac') || 'Simples');
  const [metaM3, setMetaM3] = useState(() => Number(localStorage.getItem('at_vin_meta')) || 30.0);
  const [coletor, setColetor] = useState(() => Number(localStorage.getItem('at_vin_col')) || 0.4);
  
  // Histórico de coletas
  const [historico, setHistorico] = useState(() => JSON.parse(localStorage.getItem('at_vin_hist')) || []);

  // Coletas Individuais (mL)
  const [c1, setC1] = useState('');
  const [c2, setC2] = useState('');
  const [c3, setC3] = useState('');
  const [c4, setC4] = useState('');

  // Persistência automática
  useEffect(() => {
    localStorage.setItem('at_vin_espac', espacamento);
    localStorage.setItem('at_vin_meta', metaM3);
    localStorage.setItem('at_vin_col', coletor);
    localStorage.setItem('at_vin_hist', JSON.stringify(historico));
  }, [espacamento, metaM3, coletor, historico]);

  // Regras de Negócio e Cálculos Dinâmicos
  const CONST_SIMPLES = 6666;
  const CONST_DUPLO = 4545;

  const espConst = espacamento === 'Simples' ? CONST_SIMPLES : CONST_DUPLO;

  // Fórmula solicitada: (vazão/espaçamento*coletor)*1000
  const vazaoAlvo = useMemo(() => {
    if (metaM3 > 0 && espConst > 0 && coletor > 0) {
      return (metaM3 / espConst * coletor) * 1000;
    }
    return 0;
  }, [metaM3, espConst, coletor]);

  // Helpers Matemáticos
  const calcVariacao = (coletaVal) => {
    if (!coletaVal || vazaoAlvo === 0) return null;
    const val = parseFloat(coletaVal.replace(',', '.'));
    if (isNaN(val)) return null;
    return ((val - vazaoAlvo) / vazaoAlvo) * 100;
  };

  const calcM3 = (coletaVal) => {
    if (!coletaVal) return null;
    const val = parseFloat(coletaVal.replace(',', '.'));
    if (isNaN(val)) return null;
    // Fórmula reversa ajustada: (Coleta * espaçamento / coletor) / 1000
    return (val * espConst / coletor) / 1000; 
  };

  // Cores Baseadas na Nova Meta de Qualidade (10% e 15%)
  const getColor = (varPercent) => {
    if (varPercent === null) return 'var(--at-text-muted)';
    const abs = Math.abs(varPercent);
    if (abs <= 10) return '#16a34a'; // Verde
    if (abs <= 15) return '#eab308'; // Amarelo
    return '#ef4444'; // Vermelho
  };

  const getBgColor = (varPercent) => {
    if (varPercent === null) return '#f8fafc';
    const abs = Math.abs(varPercent);
    if (abs <= 10) return '#f0fdf4'; // Verde Pastel
    if (abs <= 15) return '#fefce8'; // Amarelo Pastel
    return '#fef2f2'; // Vermelho Pastel
  };

  const getIcon = (varPercent) => {
    if (varPercent === null) return '▫️';
    const abs = Math.abs(varPercent);
    if (abs <= 10) return '🟢';
    if (abs <= 15) return '🟡';
    return '🔴';
  };

  const formatPercent = (val) => val !== null ? `${val > 0 ? '+' : ''}${val.toFixed(2)}%` : '--';

  // Variáveis Coletadas
  const varC1 = calcVariacao(c1);
  const varC2 = calcVariacao(c2);
  const varC3 = calcVariacao(c3);
  const varC4 = calcVariacao(c4);

  // Cálculos AO VIVO da Média Geral
  const { media, m3haGeral, varGeral } = useMemo(() => {
    let sum = 0; let count = 0;
    const vals = [c1, c2, c3, c4].map(v => parseFloat(v.replace(',', '.')));
    
    vals.forEach(v => { if (!isNaN(v)) { sum += v; count++; } });
    if (count === 0) return { media: null, m3haGeral: null, varGeral: null };
    
    const med = sum / count;
    const vol = (med * espConst / coletor) / 1000;
    const vGeral = vazaoAlvo > 0 ? ((med - vazaoAlvo) / vazaoAlvo) * 100 : null;

    return { media: med, m3haGeral: vol, varGeral: vGeral };
  }, [c1, c2, c3, c4, espConst, coletor, vazaoAlvo]);

  // Ações
  const handleSave = (e) => {
    e.preventDefault();
    if (vazaoAlvo === 0) return alert('Verifique os parâmetros de configuração.');
    if (!c1 || !c2 || !c3 || !c4) return alert('Preencha as 4 coletas obrigatórias!');

    const novaAmostra = {
      id: Date.now(),
      data: new Date().toLocaleDateString('pt-BR'),
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      espacamento,
      metaM3,
      coletor,
      alvo: vazaoAlvo,
      c1: parseFloat(c1.replace(',', '.')), c2: parseFloat(c2.replace(',', '.')),
      c3: parseFloat(c3.replace(',', '.')), c4: parseFloat(c4.replace(',', '.')),
      varC1, varC2, varC3, varC4,
      media, m3haGeral, varGeral
    };

    setHistorico([novaAmostra, ...historico]);
    setC1(''); setC2(''); setC3(''); setC4('');
  };

  const handleRemove = (id) => setHistorico(historico.filter(h => h.id !== id));
  const handleClear = () => { if (window.confirm('Limpar histórico?')) setHistorico([]); };

  // ================= TEXTOS PARA WHATSAPP =================
  const copySingle = (item) => {
    const texto = `📋 *Avaliação Vinhaça Localizada*
Data: ${item.data}
Hora: ${item.hora}
Espaçamento: ${item.espacamento}

${getIcon(item.varC1)} 1ª Coleta......${item.c1} (${formatPercent(item.varC1)})
${getIcon(item.varC2)} 2ª Coleta......${item.c2} (${formatPercent(item.varC2)})
${getIcon(item.varC3)} 3ª Coleta......${item.c3} (${formatPercent(item.varC3)})
${getIcon(item.varC4)} 4ª Coleta......${item.c4} (${formatPercent(item.varC4)})

Meta Vol.......${item.metaM3} m³/ha
Volume Calc....${item.m3haGeral.toFixed(2)} m³/ha

${getIcon(item.varGeral)} Geral..............${formatPercent(item.varGeral)}`;

    navigator.clipboard.writeText(texto);
    alert('Resumo copiado!');
  };

  const copyAll = () => {
    if (historico.length === 0) return;
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    
    let texto = `📋 *Avaliação Vinhaça Localizada*
Histórico de Aplicação
Data: ${dataHoje}
`;
    historico.forEach(item => {
      texto += `
🕒 Hora: ${item.hora} | ${item.espacamento}
Vol Aplicado...${item.m3haGeral.toFixed(2)} m³/ha
${getIcon(item.varGeral)} Geral..............${formatPercent(item.varGeral)}
----------------------------------------`;
    });

    navigator.clipboard.writeText(texto);
    alert('Histórico completo copiado!');
  };

  return (
    <div className="at-theme">
      <HeaderAgroTools onMenuOpen={() => setSidebarOpen(true)}>
        <span className="font-bold text-slate-500 uppercase text-xs tracking-widest hidden md:inline-block">
          Módulo de Tratos Culturais
        </span>
      </HeaderAgroTools>

      <SidebarAgroTools isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="at-container py-8 max-w-lg mx-auto fade-in pb-20">
        
        {/* Cabeçalho */}
        <div className="mb-6">
          <h2 className="at-page-title text-center md:text-left">Vinhaça Localizada</h2>
          <p className="at-page-subtitle text-center md:text-left">
            Variação das coletas de Vinhaça Localizada, Vazão (m³/ha) e histórico de coletas. Meta Ideal: ±15%.
          </p>
        </div>

        {/* Abas Simples / Duplo */}
        <div className="at-tabs mb-6">
          <button 
            className={`at-tab-btn ${espacamento === 'Simples' ? 'active' : ''}`} 
            onClick={() => setEspacamento('Simples')}
          >
            Espaçamento Simples
          </button>
          <button 
            className={`at-tab-btn ${espacamento === 'Duplo' ? 'active' : ''}`} 
            onClick={() => setEspacamento('Duplo')}
          >
            Espaçamento Duplo
          </button>
        </div>

        {/* Configuração Alvo - Agora Inteligente */}
        <div className="at-panel mb-6 border-slate-200">
          <div className="at-panel-header bg-slate-100 text-slate-600">Parâmetros Base</div>
          <div className="at-panel-body p-4 grid grid-cols-2 gap-4">
            <div className="at-input-group m-0">
              <label>Meta (m³/ha)</label>
              <input type="number" step="0.1" value={metaM3} onChange={e => setMetaM3(Number(e.target.value))} className="at-input font-black text-slate-700" />
            </div>
            <div className="at-input-group m-0">
              <label>Coletor (m)</label>
              <input type="number" step="0.01" value={coletor} onChange={e => setColetor(Number(e.target.value))} className="at-input font-bold text-slate-500" />
            </div>
            <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-xl p-3 flex justify-between items-center shadow-inner">
              <span className="text-xs uppercase font-black text-blue-600">Vazão Alvo Calculada:</span>
              <span className="text-xl font-black text-blue-700">{vazaoAlvo > 0 ? vazaoAlvo.toFixed(2) : '--'}</span>
            </div>
          </div>
        </div>

        {/* Área de Coletas (2x2) */}
        <form onSubmit={handleSave} className="mb-8">
          <div className="grid grid-cols-2 gap-3 mb-4">
            
            {[
              { id: '1', label: '1ª Coleta', val: c1, set: setC1, vari: varC1 },
              { id: '2', label: '2ª Coleta', val: c2, set: setC2, vari: varC2 },
              { id: '3', label: '3ª Coleta', val: c3, set: setC3, vari: varC3 },
              { id: '4', label: '4ª Coleta', val: c4, set: setC4, vari: varC4 },
            ].map((coleta) => (
              <div key={coleta.id} className="at-adub-card relative overflow-hidden" style={{ borderBottom: `4px solid ${getColor(coleta.vari)}` }}>
                <span className="at-adub-label">{coleta.label}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                  Vol: {calcM3(coleta.val) !== null ? calcM3(coleta.val).toFixed(1) : '--'} m³
                </span>
                <input 
                  type="number" inputMode="decimal" step="0.01" required
                  value={coleta.val} onChange={e => coleta.set(e.target.value)}
                  className="at-adub-input h-10 text-lg" placeholder="0.0"
                />
                <span className="at-adub-var text-sm" style={{ color: getColor(coleta.vari) }}>
                  {formatPercent(coleta.vari)}
                </span>
              </div>
            ))}

          </div>

          {/* MÉDIA GERAL AO VIVO */}
          {varGeral !== null && (
            <div 
              className="at-vin-live-geral mb-4"
              style={{ backgroundColor: getBgColor(varGeral), borderColor: getColor(varGeral) }}
            >
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-black text-slate-500">Vol. Aplicado</span>
                <span className="font-black text-xl text-slate-700">{m3haGeral.toFixed(2)} <span className="text-xs">m³/ha</span></span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-black text-slate-500">Var. Média</span>
                <span className="font-black text-2xl" style={{ color: getColor(varGeral) }}>
                  {formatPercent(varGeral)}
                </span>
              </div>
            </div>
          )}
          
          <button type="submit" className="at-btn at-btn--primary w-full h-[54px] text-[1rem]">
            SALVAR REGISTRO
          </button>
        </form>

        {/* Histórico */}
        <div className="at-list-header mb-3">
          <span className="font-bold text-xs text-slate-500 uppercase">Histórico ({historico.length})</span>
          {historico.length > 0 && (
            <div className="flex gap-3">
              <button type="button" onClick={copyAll} className="at-btn-text text-green-600">Copiar Geral</button>
              <button type="button" onClick={handleClear} className="at-btn-text text-red-500">Limpar</button>
            </div>
          )}
        </div>

        <div className="at-slim-list mt-2">
          {historico.length === 0 ? (
            <div className="at-empty-state">Nenhum registro de Vinhaça.</div>
          ) : (
            historico.map((item) => {
              const bgColor = getBgColor(item.varGeral);
              const borderColor = getColor(item.varGeral);

              return (
                <div key={item.id} className="at-hist-card-v2" style={{ backgroundColor: bgColor, borderColor: borderColor }}>
                  {/* Topo */}
                  <div className="at-hist-row-top">
                    <div className="flex items-center gap-2">
                      <span className="at-hist-tag-lines bg-white shadow-sm">{item.espacamento}</span>
                      <span className="at-hist-time">{item.hora}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Volume</span>
                      <span className="font-black text-slate-700">{item.m3haGeral.toFixed(2)} m³</span>
                    </div>
                  </div>

                  {/* Variação Geral Destacada */}
                  <div className="py-2 flex justify-between items-center border-b border-slate-200 border-dashed">
                    <span className="text-xs font-black text-slate-600 uppercase">Variação Geral</span>
                    <span className="font-black text-xl" style={{ color: borderColor }}>
                      {formatPercent(item.varGeral)}
                    </span>
                  </div>

                  {/* Ações */}
                  <div className="at-hist-row-bot pt-1">
                    <button type="button" onClick={() => handleRemove(item.id)} className="at-btn-remove-v2">Excluir</button>
                    <button type="button" onClick={() => copySingle(item)} className="at-btn-copy-v2 shadow-sm">Copiar Resumo</button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>
    </div>
  );
};

export default VinhacaTools;