import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Style.css';

import HeaderAgroTools from '../../../components/AgroTools/HeaderAgroTools';
import SidebarAgroTools from '../../../components/AgroTools/SidebarAgroTools';
import camposData from '../../../data/campos.json'; 

const CUCTools = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('cuc'); 
  const [histTab, setHistTab] = useState('cuc'); 

  // ================= CONFIGURAÇÕES E METAS =================
  const metaCUC = 90.0;
  
  // ================= ESTADOS: NOVO CUC =================
  const defaultFormCUC = {
    data: new Date().toISOString().split('T')[0],
    campo: '', lote: '', tempoColeta: '3', vazaoNominal: '1.0', currentColeta: ''
  };
  const [formCUC, setFormCUC] = useState(() => {
    const saved = localStorage.getItem('at_cuc_form');
    const parsed = saved ? JSON.parse(saved) : defaultFormCUC;
    parsed.data = new Date().toISOString().split('T')[0];
    return parsed;
  });
  
  const [coletas, setColetas] = useState(() => {
    const saved = localStorage.getItem('at_cuc_coletas');
    return saved ? JSON.parse(saved) : [];
  });

  const [confirmModalCUC, setConfirmModalCUC] = useState(false);

  // ================= ESTADOS: ANÁLISE =================
  const defaultFormAnalise = {
    data: new Date().toISOString().split('T')[0],
    campo: '', lote: '', totalAvaliados: '', areia: '', organica: '', raizes: ''
  };
  const [formAnalise, setFormAnalise] = useState(() => {
    const saved = localStorage.getItem('at_cuc_analise_form');
    const parsed = saved ? JSON.parse(saved) : defaultFormAnalise;
    parsed.data = new Date().toISOString().split('T')[0];
    return parsed;
  });

  // ================= HISTÓRICOS =================
  const [historicoCUC, setHistoricoCUC] = useState(() => {
    const saved = localStorage.getItem('at_cuc_hist');
    return saved ? JSON.parse(saved) : [];
  });
  const [historicoAnalise, setHistoricoAnalise] = useState(() => {
    const saved = localStorage.getItem('at_cuc_analise_hist');
    return saved ? JSON.parse(saved) : [];
  });

  const [modalItemCUC, setModalItemCUC] = useState(null);
  const [modalGroupAnalise, setModalGroupAnalise] = useState(null);

  // ================= PERSISTÊNCIA OFFLINE =================
  useEffect(() => { localStorage.setItem('at_cuc_form', JSON.stringify(formCUC)); }, [formCUC]);
  useEffect(() => { localStorage.setItem('at_cuc_coletas', JSON.stringify(coletas)); }, [coletas]);
  useEffect(() => { localStorage.setItem('at_cuc_analise_form', JSON.stringify(formAnalise)); }, [formAnalise]);
  useEffect(() => { localStorage.setItem('at_cuc_hist', JSON.stringify(historicoCUC)); }, [historicoCUC]);
  useEffect(() => { localStorage.setItem('at_cuc_analise_hist', JSON.stringify(historicoAnalise)); }, [historicoAnalise]);

  // ================= HELPERS: CORES E REGRAS MODULARES =================
  const getColetaColorInfo = (val, tempoMin, nominalLh) => {
    if (val === 0) return { icon: '🔴', text: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' };
    
    const vazaoCalc = (val * 60 / tempoMin) / 1000;
    const ratio = vazaoCalc / nominalLh;

    if (ratio < 0.8) return { icon: '🔴', text: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' };
    if (ratio >= 0.8 && ratio < 0.9) return { icon: '🟠', text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' };
    if (ratio >= 0.9 && ratio <= 1.1) return { icon: '🟢', text: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' };
    if (ratio > 1.1 && ratio <= 1.2) return { icon: '🟡', text: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200' };
    return { icon: '🔵', text: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' };
  };

  // ================= LÓGICA DE CÁLCULO CUC =================
  const calcCUC = useMemo(() => {
    const n = coletas.length;
    if (n === 0) return { mediaML: 0, cuc: 0, vazaoMedia: 0, entupidos: 0 };

    const sum = coletas.reduce((a, b) => a + b, 0);
    const media = sum / n;
    const meanDev = coletas.reduce((a, b) => a + Math.abs(b - media), 0) / n;
    
    const cuc = media > 0 ? 100 * (1 - (meanDev / media)) : 0;
    const tempo = parseFloat(formCUC.tempoColeta) || 3;
    const vazaoMedia = (media * 60 / tempo) / 1000;
    const zeros = coletas.filter(c => c === 0).length;
    const entupidos = (zeros / n) * 100;

    return { mediaML: media, cuc, vazaoMedia, entupidos };
  }, [coletas, formCUC.tempoColeta]);

  const addColeta = (e) => {
    e.preventDefault();
    if (formCUC.currentColeta === '') return;
    const val = parseFloat(formCUC.currentColeta.replace(',', '.'));
    
    if (val < 0) return alert('Valores negativos não são permitidos!');
    
    if (!isNaN(val)) {
      setColetas([...coletas, val]);
      setFormCUC({ ...formCUC, currentColeta: '' });
    }
  };

  const removeColeta = (index) => {
    setColetas(coletas.filter((_, i) => i !== index));
  };

  const handlePreSaveCUC = () => {
    if (coletas.length === 0) return alert('Adicione pelo menos uma coleta para salvar!');
    if (!parseFloat(formCUC.vazaoNominal)) return alert('Informe a vazão nominal corretamente!');
    
    // O CUC permite salvar sem campo/lote, mas vamos abrir o modal de qualquer forma pra confirmar
    setConfirmModalCUC(true);
  };

  const saveCUC = () => {
    const novoPonto = {
      id: Date.now(),
      horaStr: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      ...formCUC,
      coletas: [...coletas],
      results: calcCUC
    };

    setHistoricoCUC([novoPonto, ...historicoCUC]);
    setColetas([]);
    // Mantém o campo, zera apenas o lote e o input atual
    setFormCUC(prev => ({ ...prev, lote: '', currentColeta: '' }));
    setConfirmModalCUC(false);
  };

  // Verifica se já tem esse Lote salvo hoje para o aviso no Modal
  const isDuplicateCUC = useMemo(() => {
    if (!formCUC.campo || !formCUC.lote) return false;
    return historicoCUC.some(h => 
      h.campo === formCUC.campo && 
      h.lote === formCUC.lote && 
      h.data === formCUC.data
    );
  }, [formCUC.campo, formCUC.lote, formCUC.data, historicoCUC]);

  // ================= LÓGICA DE ANÁLISE =================
  const saveAnalise = (e) => {
    e.preventDefault();
    if (!formAnalise.campo || !formAnalise.lote) return alert('Obrigatório preencher Campo e Lote!');
    
    const tot = parseFloat(formAnalise.totalAvaliados) || 0;
    const areia = parseFloat(formAnalise.areia) || 0;
    const organica = parseFloat(formAnalise.organica) || 0;
    const raizes = parseFloat(formAnalise.raizes) || 0;

    if (tot <= 0) return alert('Informe um total válido de emissores avaliados (maior que zero)!');
    if (areia < 0 || organica < 0 || raizes < 0) return alert('Os valores de entupimento não podem ser negativos!');

    const somaCausas = areia + organica + raizes;

    // TRAVA: A soma das causas não pode ser maior que o total de emissores
    if (somaCausas > tot) {
      return alert(`As causas informadas (${somaCausas}) ultrapassam o total de emissores avaliados no lote (${tot})! Verifique os números.`);
    }

    const novoPonto = {
      id: Date.now(),
      ...formAnalise,
      totalAvaliados: tot,
      areia, organica, raizes
    };

    setHistoricoAnalise([novoPonto, ...historicoAnalise]);
    // Limpa lote e causas, mas mantém o Campo
    setFormAnalise(prev => ({ ...defaultFormAnalise, data: prev.data, campo: prev.campo }));
    alert('Análise salva com sucesso!');
  };

  const analisesAgrupadas = useMemo(() => {
    const grupos = {};
    historicoAnalise.forEach(item => {
      const chave = `${item.data}_${item.campo.toUpperCase()}`;
      if (!grupos[chave]) {
        grupos[chave] = { data: item.data, campo: item.campo.toUpperCase(), lotes: [] };
      }
      grupos[chave].lotes.push(item);
    });
    return Object.values(grupos);
  }, [historicoAnalise]);

  // ================= GERADORES DE TEXTO (WHATSAPP) =================
  const getResumoCUC = (item) => {
    const tempo = parseFloat(item.tempoColeta) || 3;
    const nominal = parseFloat(item.vazaoNominal) || 1.0;
    
    let txt = `📋 *Resumo CUC - Gotejo*\n`;
    txt += `Data: ${item.data.split('-').reverse().join('/')}\n`;
    if (item.campo) txt += `Campo: ${item.campo.toUpperCase()}\n`;
    if (item.lote) txt += `Lote: ${item.lote}\n`;
    txt += `Tempo de Coleta: ${tempo} min\n`;
    txt += `Vazão Nominal: ${nominal.toFixed(2)} L/h\n`;
    txt += `Total Coletas: ${item.coletas.length}\n`;
    txt += `Média mL: ${item.results.mediaML.toFixed(1)}\n\n`;

    const checkCor = (val, meta) => (val >= meta ? '🟢' : '🔴');
    // CORREÇÃO: Ícone da vazão média agora segue as mesmas regras dinâmicas
    const vazaoStatus = getColetaColorInfo(item.results.mediaML, tempo, nominal);

    txt += `${checkCor(item.results.cuc, metaCUC)}CUC.................${item.results.cuc.toFixed(1)}%\n`;
    txt += `${vazaoStatus.icon}Vazão..............${item.results.vazaoMedia.toFixed(2)} L/h\n`;
    txt += `${item.results.entupidos > 0 ? '🔴' : '🟢'}Entupidos.......${item.results.entupidos.toFixed(1)}%\n\n`;

    txt += `📊 *Coletas Realizadas*\n`;
    item.coletas.forEach(val => {
      const status = getColetaColorInfo(val, tempo, nominal);
      const vazao = (val * 60 / tempo) / 1000;
      txt += `${status.icon}${val}ml......${vazao.toFixed(2)} L/h\n`;
    });

    return txt;
  };

  const getResumoAnaliseGroup = (grupo) => {
    let txt = `📋 *Análise Emissores CUC*\n`;
    txt += `Campo: ${grupo.campo}\n`;
    txt += `Data: ${grupo.data.split('-').reverse().join('/')}\n`;
    txt += `Lotes Avaliados: ${grupo.lotes.length}\n`;
    
    const totalEmissoresGeral = grupo.lotes.reduce((acc, l) => acc + l.totalAvaliados, 0);
    txt += `Emissores Avaliados: ${totalEmissoresGeral}\n\n`;

    const lotesSorted = [...grupo.lotes].sort((a, b) => a.lote - b.lote);

    lotesSorted.forEach(lote => {
      txt += `📌 *Lote ${lote.lote.toString().padStart(2, '0')}* (${lote.totalAvaliados} emissores)\n`;
      const calcPerc = (qtd) => ((qtd / lote.totalAvaliados) * 100).toFixed(1);
      
      if (lote.areia > 0) txt += `Areia...........................${calcPerc(lote.areia)}%\n`;
      if (lote.organica > 0) txt += `Matéria Orgânica....${calcPerc(lote.organica)}%\n`;
      if (lote.raizes > 0) txt += `Raízes.........................${calcPerc(lote.raizes)}%\n`;
      
      if (lote.areia === 0 && lote.organica === 0 && lote.raizes === 0) {
        txt += `Sem obstruções mapeadas.\n`;
      }
      txt += `\n`;
    });

    return txt.trim();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Resumo copiado para a área de transferência!');
  };

  return (
    <div className="at-theme">
      <HeaderAgroTools onMenuOpen={() => setSidebarOpen(true)} />
      <SidebarAgroTools isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <datalist id="campos-list">
        {camposData.map(c => <option key={c.CODIGO} value={c.CAMPO} />)}
      </datalist>

      <main className="at-container py-6 pb-24 max-w-lg mx-auto fade-in min-h-screen">
        
        {/* ================= ABA: NOVO CUC ================= */}
        {activeTab === 'cuc' && (
          <div className="fade-in">
            <div className="mb-4">
              <h2 className="at-page-title text-center md:text-left text-blue-600">Calculadora CUC</h2>
              <p className="at-page-subtitle text-center md:text-left">Coleta rápida de vazão e uniformidade</p>
            </div>

            <div className="at-card-section mb-4">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="at-input-group">
                  <label className="truncate text-xs">Data</label>
                  <input type="date" className="at-input text-xs px-1" value={formCUC.data} onChange={e => setFormCUC({...formCUC, data: e.target.value})} required />
                </div>
                <div className="at-input-group">
                  <label className="truncate text-xs">Tempo (min)</label>
                  <input type="number" min="0" step="0.1" className="at-input font-bold text-center" value={formCUC.tempoColeta} onChange={e => setFormCUC({...formCUC, tempoColeta: e.target.value})} />
                </div>
                <div className="at-input-group">
                  <label className="truncate text-xs text-blue-600 font-bold">Vazão Padrão</label>
                  <input type="number" min="0" step="0.1" className="at-input font-bold text-center bg-blue-50 text-blue-700" value={formCUC.vazaoNominal} onChange={e => setFormCUC({...formCUC, vazaoNominal: e.target.value})} title="Vazão Nominal Alvo" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="at-input-group">
                  <label>Campo</label>
                  <input list="campos-list" className="at-input uppercase" placeholder="Procurar" value={formCUC.campo} onChange={e => setFormCUC({...formCUC, campo: e.target.value.toUpperCase()})} />
                </div>
                <div className="at-input-group">
                  <label>Lote</label>
                  <input type="number" min="0" className="at-input" placeholder="Digite o Lote" value={formCUC.lote} onChange={e => setFormCUC({...formCUC, lote: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Inserção Rápida */}
            <div className="at-card-section mb-4 bg-blue-50/50">
              <label className="font-black text-sm uppercase text-slate-600 mb-2 block">Lançar Coleta (mL)</label>
              <form onSubmit={addColeta} className="flex gap-2">
                <input 
                  type="number" inputMode="decimal" step="0.1" min="0"
                  className="at-input flex-1 h-14 text-2xl text-center font-black" 
                  placeholder="0"
                  value={formCUC.currentColeta} 
                  onChange={e => setFormCUC({...formCUC, currentColeta: e.target.value})} 
                />
                <button type="submit" className="at-btn--primary w-14 h-14 rounded-xl text-2xl font-black shadow-md hover:scale-105 transition-transform">+</button>
              </form>
            </div>

            {/* Painel de Resultados ao Vivo */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-center items-center">
                <span className="text-[10px] font-black uppercase text-slate-400">CUC Atual</span>
                <span className={`text-3xl font-black ${calcCUC.cuc >= metaCUC ? 'text-green-500' : 'text-red-500'}`}>
                  {calcCUC.cuc.toFixed(1)}%
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-center items-center">
                <span className="text-[10px] font-black uppercase text-slate-400">Vazão Média</span>
                <span className="text-2xl font-black text-blue-600">{calcCUC.vazaoMedia.toFixed(2)} <span className="text-sm">L/h</span></span>
              </div>
            </div>

            {/* Lista de Coletas com Cores Dinâmicas */}
            {coletas.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 shadow-sm max-h-60 overflow-y-auto">
                <div className="flex justify-between items-center mb-2 border-b pb-1 sticky top-0 bg-white z-10">
                  <span className="text-xs font-bold text-slate-500 uppercase">Coletas ({coletas.length})</span>
                  <span className="text-xs font-bold text-slate-500">Média: {calcCUC.mediaML.toFixed(1)} mL</span>
                </div>
                <div className="flex flex-col gap-1 mt-2">
                  {[...coletas].reverse().map((val, idx) => {
                    const realIndex = coletas.length - 1 - idx;
                    const tempo = parseFloat(formCUC.tempoColeta || 3);
                    const nominal = parseFloat(formCUC.vazaoNominal || 1.0);
                    const status = getColetaColorInfo(val, tempo, nominal);
                    const vazao = (val * 60 / tempo) / 1000;
                    
                    return (
                      <div key={realIndex} className={`flex justify-between items-center py-2 px-3 border border-transparent rounded-lg ${status.bg} ${status.border} shadow-sm transition-all`}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm">#{String(realIndex + 1).padStart(2, '0')}</span>
                          <span className="text-lg">{status.icon}</span>
                          <span className={`font-black text-lg ${status.text}`}>{val} mL</span>
                          <span className="text-xs text-slate-500 font-bold">({vazao.toFixed(2)} L/h)</span>
                        </div>
                        <button onClick={() => removeColeta(realIndex)} className="text-red-400 hover:text-red-600 font-black px-2 active:scale-90 transition-transform">✕</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <button onClick={handlePreSaveCUC} className="at-btn at-btn--primary w-full h-[54px] text-[1rem]">SALVAR PONTO CUC</button>
          </div>
        )}

        {/* ================= ABA: ANÁLISE DE EMISSORES ================= */}
        {activeTab === 'analise' && (
          <div className="fade-in">
             <div className="mb-4">
              <h2 className="at-page-title text-center md:text-left text-orange-500">Análise de Entupimento</h2>
              <p className="at-page-subtitle text-center md:text-left">Mapeie as causas das obstruções por Lote</p>
            </div>

            <form onSubmit={saveAnalise}>
              <div className="at-card-section mb-4 grid grid-cols-2 gap-3">
                <div className="at-input-group col-span-2">
                  <label>Data</label>
                  <input type="date" className="at-input" value={formAnalise.data} onChange={e => setFormAnalise({...formAnalise, data: e.target.value})} required />
                </div>
                <div className="at-input-group">
                  <label>Campo</label>
                  <input list="campos-list" className="at-input uppercase" placeholder="Procurar" value={formAnalise.campo} onChange={e => setFormAnalise({...formAnalise, campo: e.target.value.toUpperCase()})} required />
                </div>
                <div className="at-input-group">
                  <label>Lote</label>
                  <input type="number" min="0" className="at-input" placeholder="Digite o Lote" value={formAnalise.lote} onChange={e => setFormAnalise({...formAnalise, lote: e.target.value})} required />
                </div>
              </div>

              <div className="at-card-section mb-4 border-l-4 border-orange-400">
                <div className="at-input-group mb-4">
                  <label className="text-orange-600 font-black">Emissores Entupidos (Avaliados)</label>
                  <input type="number" min="0" className="at-input h-12 text-xl text-center font-black bg-orange-50" placeholder="Total no Lote" value={formAnalise.totalAvaliados} onChange={e => setFormAnalise({...formAnalise, totalAvaliados: e.target.value})} required />
                </div>
                
                <h3 className="text-xs font-black text-slate-400 uppercase mb-2 border-b pb-1">Causas Encontradas</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 mb-1">Areia</span>
                    <input type="number" min="0" className="at-input text-center" value={formAnalise.areia} onChange={e => setFormAnalise({...formAnalise, areia: e.target.value})} placeholder="0" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 mb-1">Mat. Orgânica</span>
                    <input type="number" min="0" className="at-input text-center" value={formAnalise.organica} onChange={e => setFormAnalise({...formAnalise, organica: e.target.value})} placeholder="0" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 mb-1">Raízes</span>
                    <input type="number" min="0" className="at-input text-center" value={formAnalise.raizes} onChange={e => setFormAnalise({...formAnalise, raizes: e.target.value})} placeholder="0" />
                  </div>
                </div>
              </div>

              <button type="submit" className="at-btn at-btn--primary w-full h-[54px] text-[1rem] !bg-orange-500 hover:!bg-orange-600">SALVAR LOTE</button>
            </form>
          </div>
        )}

        {/* ================= ABA: HISTÓRICO ================= */}
        {activeTab === 'historico' && (
          <div className="fade-in">
            <div className="flex bg-slate-200 rounded-xl p-1 mb-4 shadow-inner">
              <button 
                onClick={() => setHistTab('cuc')} 
                className={`flex-1 py-2 text-sm font-black rounded-lg transition-colors ${histTab === 'cuc' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                💧 Histórico CUC
              </button>
              <button 
                onClick={() => setHistTab('analise')} 
                className={`flex-1 py-2 text-sm font-black rounded-lg transition-colors ${histTab === 'analise' ? 'bg-white shadow-sm text-orange-500' : 'text-slate-500 hover:text-slate-700'}`}
              >
                🔬 Histórico Análise
              </button>
            </div>

            {/* HISTÓRICO CUC */}
            {histTab === 'cuc' && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1 mb-1">
                  <span className="text-xs font-bold text-slate-400 uppercase">{historicoCUC.length} Pontos Salvos</span>
                  <button onClick={() => { if(window.confirm('Limpar CUC?')) setHistoricoCUC([]); }} className="text-xs text-red-400 font-bold hover:text-red-600 transition-colors">Limpar Tudo</button>
                </div>
                {historicoCUC.length === 0 ? <div className="at-empty-state">Nenhum ponto CUC registrado.</div> : (
                  historicoCUC.map(item => (
                    <div key={item.id} onClick={() => setModalItemCUC(item)} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:bg-blue-50 cursor-pointer active:scale-[0.98] transition-all flex justify-between items-center">
                      <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded w-fit mb-1">{item.data.split('-').reverse().join('/')} • {item.horaStr}</span>
                         <span className="font-black text-slate-700">{item.campo || 'Sem Campo'} {item.lote ? `- Lote ${item.lote}` : ''}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase text-slate-400">CUC</span>
                        <span className={`font-black text-lg ${item.results.cuc >= metaCUC ? 'text-green-500' : 'text-red-500'}`}>{item.results.cuc.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* HISTÓRICO ANÁLISE */}
            {histTab === 'analise' && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center px-1 mb-1">
                  <span className="text-xs font-bold text-slate-400 uppercase">{historicoAnalise.length} Lotes Avaliados</span>
                  <button onClick={() => { if(window.confirm('Limpar Análises?')) setHistoricoAnalise([]); }} className="text-xs text-red-400 font-bold hover:text-red-600 transition-colors">Limpar Tudo</button>
                </div>
                
                {analisesAgrupadas.length === 0 ? <div className="at-empty-state">Nenhuma análise registrada.</div> : (
                  analisesAgrupadas.map((grupo, idx) => (
                    <div key={idx} className="bg-white border border-orange-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="bg-orange-50 px-4 py-3 flex justify-between items-center border-b border-orange-100">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-orange-400 uppercase">{grupo.data.split('-').reverse().join('/')}</span>
                          <span className="font-black text-orange-700 text-lg">Campo {grupo.campo}</span>
                        </div>
                        <div className="text-right">
                          <span className="block font-black text-orange-600">{grupo.lotes.length} Lotes</span>
                        </div>
                      </div>
                      <div className="p-3 bg-white flex gap-2">
                        <button onClick={() => setModalGroupAnalise(grupo)} className="flex-1 border border-orange-200 text-orange-600 font-bold text-xs py-2 rounded-lg hover:bg-orange-50 uppercase transition-colors">Ver Resumo Completo</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ================= NAVEGAÇÃO INFERIOR FIXA ================= */}
      <div className="at-bottom-nav">
        <button onClick={() => setActiveTab('historico')} className={`at-nav-btn ${activeTab === 'historico' ? 'active' : ''}`}>
          <span className="text-xl leading-none">📋</span>
          <span className="text-[10px] font-bold uppercase mt-1">Histórico</span>
        </button>
        <button onClick={() => setActiveTab('cuc')} className={`at-nav-btn ${activeTab === 'cuc' ? 'active text-blue-600' : ''}`}>
          <span className="text-xl leading-none">💧</span>
          <span className="text-[10px] font-bold uppercase mt-1">Novo CUC</span>
        </button>
        <button onClick={() => setActiveTab('analise')} className={`at-nav-btn ${activeTab === 'analise' ? 'active text-orange-500' : ''}`}>
          <span className="text-xl leading-none">🔬</span>
          <span className="text-[10px] font-bold uppercase mt-1">Análise</span>
        </button>
      </div>

      {/* ================= MODAIS DE RESUMO ================= */}
      
      {/* Modal Pré-Salvar CUC */}
      {confirmModalCUC && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[85vw] md:max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col m-auto fade-in">
            <div className="bg-slate-100 p-4 border-b flex justify-between items-center">
              <h3 className="font-black text-slate-700 uppercase text-sm">Confirmar Salvamento</h3>
              <button onClick={() => setConfirmModalCUC(false)} className="text-slate-400 font-bold text-2xl leading-none hover:text-red-500 transition-colors">&times;</button>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              {isDuplicateCUC && (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 p-3 rounded-lg text-xs font-bold shadow-sm">
                  ⚠️ Atenção: Já existe um registro salvo para o Campo {formCUC.campo} e Lote {formCUC.lote} nesta data. Deseja registrar mesmo assim?
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Campo</span>
                  <span className="font-black text-slate-700 text-lg">{formCUC.campo || 'N/A'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Lote</span>
                  <span className="font-black text-slate-700 text-lg">{formCUC.lote || 'N/A'}</span>
                </div>
                <div className="flex flex-col border-t pt-2 mt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Emissores</span>
                  <span className="font-black text-slate-700">{coletas.length} avaliados</span>
                </div>
                <div className="flex flex-col border-t pt-2 mt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Vazão Média</span>
                  <span className="font-black text-blue-600">{calcCUC.vazaoMedia.toFixed(2)} L/h</span>
                </div>
                <div className="flex flex-col col-span-2 border-t pt-2 mt-1 bg-slate-50 p-2 rounded-lg items-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">CUC Calculado</span>
                  <span className={`font-black text-2xl ${calcCUC.cuc >= metaCUC ? 'text-green-500' : 'text-red-500'}`}>{calcCUC.cuc.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex gap-3">
               <button onClick={() => setConfirmModalCUC(false)} className="flex-1 bg-white border border-slate-300 text-slate-600 font-bold uppercase text-xs rounded-lg py-3 hover:bg-slate-100 transition-colors">Cancelar</button>
               <button onClick={saveCUC} className="flex-[1.5] bg-blue-600 text-white font-black uppercase text-xs rounded-lg py-3 hover:bg-blue-700 transition-colors shadow-md">Salvar Amostra</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico CUC */}
      {modalItemCUC && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[85vw] md:max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] m-auto fade-in">
            <div className="bg-slate-100 p-4 border-b flex justify-between items-center">
              <h3 className="font-black text-slate-700 uppercase text-sm">Resumo CUC</h3>
              <button onClick={() => setModalItemCUC(null)} className="text-slate-400 font-bold text-2xl leading-none hover:text-red-500 transition-colors">&times;</button>
            </div>
            <div className="p-5 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 flex-1">
              {getResumoCUC(modalItemCUC)}
            </div>
            <div className="p-4 border-t bg-slate-50 flex gap-3">
               <button onClick={() => {
                 setHistoricoCUC(historicoCUC.filter(h => h.id !== modalItemCUC.id));
                 setModalItemCUC(null);
               }} className="flex-1 bg-white border border-red-200 text-red-500 font-bold uppercase text-xs rounded-lg py-3 hover:bg-red-50 transition-colors">Excluir</button>
               
               <button onClick={() => copyToClipboard(getResumoCUC(modalItemCUC))} className="flex-[1.5] bg-blue-600 text-white font-black uppercase text-xs rounded-lg py-3 hover:bg-blue-700 transition-colors shadow-sm">Copiar Resumo</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Grupo Análise */}
      {modalGroupAnalise && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[85vw] md:max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] m-auto fade-in">
            <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
              <h3 className="font-black text-orange-700 uppercase text-sm">Resumo do Campo</h3>
              <button onClick={() => setModalGroupAnalise(null)} className="text-orange-400 font-bold text-2xl leading-none hover:text-red-500 transition-colors">&times;</button>
            </div>
            <div className="p-5 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 flex-1">
              {getResumoAnaliseGroup(modalGroupAnalise)}
            </div>
            <div className="p-4 border-t bg-slate-50 flex gap-3">
               <button onClick={() => copyToClipboard(getResumoAnaliseGroup(modalGroupAnalise))} className="w-full bg-orange-500 text-white font-black uppercase text-xs rounded-lg py-3 hover:bg-orange-600 transition-colors shadow-sm">Copiar para WhatsApp</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CUCTools;