import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Style.css';

import HeaderAgroTools from '../../../components/AgroTools/HeaderAgroTools';
import SidebarAgroTools from '../../../components/AgroTools/SidebarAgroTools';
import camposData from '../../../data/campos.json'; 

const PerdasColheitaTools = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('novo'); 

  // ================= CONFIGURAÇÕES =================
  const defaultConfig = {
    showCampo: true, showLote: true, showCat: true, 
    showPisoteio: false, showArranquio: false, showAbalo: false,
    metaPerda: 4.5, metaPisoSimples: 50, metaPisoDuplo: 2.0, metaArranquio: 2.5
  };
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('at_perdas_config');
    return saved ? JSON.parse(saved) : defaultConfig;
  });

  // ================= ESTADO DO FORMULÁRIO =================
  const defaultForm = {
    data: new Date().toISOString().split('T')[0],
    turno: '1', colhedora: '', campo: '', lote: '', tch: '',
    cat: { solto: '', lasca: '', estilhaco: '', repicado: '', inteira: '', fixo: '', toco7: '', ponta: '' },
    totalManual: '',
    pisoTipo: 'Simples', pisoMetros: '',
    tocosFixos: '', tocosArrancados: '', tocosAbalados: '',
    justificativa: '' // Novo campo adicionado
  };

  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem('at_perdas_form');
    const parsed = saved ? JSON.parse(saved) : defaultForm;
    // Força a data do dia atual ao carregar o app, evitando datas presas de dias anteriores
    parsed.data = new Date().toISOString().split('T')[0];
    return parsed;
  });

  // ================= HISTÓRICO E FILTROS =================
  const [historico, setHistorico] = useState(() => {
    const saved = localStorage.getItem('at_perdas_hist');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [groupMode, setGroupMode] = useState('colhedora'); 
  const [expandedGroups, setExpandedGroups] = useState({}); 
  const [modalItem, setModalItem] = useState(null); 

  const [filtroData, setFiltroData] = useState('');
  const [filtroCampo, setFiltroCampo] = useState('');
  const [filtroColhedora, setFiltroColhedora] = useState('');

  // Persistência
  useEffect(() => { localStorage.setItem('at_perdas_config', JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem('at_perdas_form', JSON.stringify(form)); }, [form]);
  useEffect(() => { localStorage.setItem('at_perdas_hist', JSON.stringify(historico)); }, [historico]);

  // ================= LÓGICA DE CÁLCULO AO VIVO =================
  const calcTotals = useMemo(() => {
    let totalPerdasKg = 0;
    if (config.showCat) {
      const { solto, lasca, estilhaco, repicado, inteira, fixo, toco7, ponta } = form.cat;
      totalPerdasKg = [solto, lasca, estilhaco, repicado, inteira, fixo, toco7, ponta]
        .reduce((acc, val) => acc + (parseFloat(val.replace(',', '.')) || 0), 0);
    } else {
      totalPerdasKg = parseFloat(form.totalManual.replace(',', '.')) || 0;
    }

    const tch = parseFloat(form.tch.replace(',', '.')) || 0;
    const perdasPercent = (totalPerdasKg > 0 && tch > 0) ? (totalPerdasKg / (totalPerdasKg + tch)) * 100 : 0;

    const areaPiso = form.pisoTipo === 'Simples' ? 6.66 : 9.08;
    const metrosPiso = parseFloat(form.pisoMetros.replace(',', '.')) || 0;
    // CORRIGIDO: Adicionado o * 100 para o cálculo correto da porcentagem
    const pisoteioPercent = metrosPiso > 0 ? (metrosPiso / areaPiso) * 100 : 0;

    const fixos = parseFloat(form.tocosFixos.replace(',', '.')) || 0;
    const arrancados = parseFloat(form.tocosArrancados.replace(',', '.')) || 0;
    const abalados = parseFloat(form.tocosAbalados.replace(',', '.')) || 0;
    
    const arranquioPercent = (arrancados > 0 && fixos > 0) ? (arrancados / fixos) * 100 : 0;
    const abaloPercent = (abalados > 0 && fixos > 0) ? (abalados / fixos) * 100 : 0;

    return { totalPerdasKg, perdasPercent, pisoteioPercent, arranquioPercent, abaloPercent };
  }, [form, config]);

  const checkColor = (val, meta) => (val <= meta ? '🟢' : '🔴');
  const hexColor = (val, meta) => (val <= meta ? '#16a34a' : '#ef4444');

  // ================= AÇÕES DO FORMULÁRIO =================
  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const updateCat = (field, value) => setForm(prev => ({ ...prev, cat: { ...prev.cat, [field]: value } }));

  const handleCampoChange = (val) => {
    const upperCampo = val.toUpperCase();
    let newTch = form.tch;
    const lastEntry = historico.find(h => h.campo === upperCampo);
    if (lastEntry && lastEntry.tch) {
      newTch = lastEntry.tch;
    }
    setForm(prev => ({ ...prev, campo: upperCampo, tch: newTch }));
  };

  const handleClearCampo = () => {
    setForm(prev => ({ ...prev, campo: '', lote: '', tch: '' }));
  };

  const handleClearColhedora = () => {
    setForm(prev => ({ ...prev, colhedora: '' }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.colhedora) return alert('Informe a Colhedora!');
    if (!form.tch) return alert('Informe o TCH Estimado!');

    // Validação da Justificativa
    if (calcTotals.perdasPercent > config.metaPerda && (!form.justificativa || form.justificativa.trim() === '')) {
      return alert('Perda acima da meta! A justificativa é obrigatória.');
    }

    const novoPonto = {
      id: Date.now(),
      horaStr: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      hasCat: config.showCat,
      ...form,
      results: calcTotals
    };

    setHistorico([novoPonto, ...historico]);
    
    // Zera os inputs de perda, mas mantém cabeçalho para facilitar o próximo lançamento
    setForm(prev => ({
      ...defaultForm,
      data: prev.data, 
      turno: prev.turno, 
      colhedora: prev.colhedora, 
      campo: prev.campo, 
      lote: prev.lote, 
      tch: prev.tch,
      justificativa: '' 
    }));
    alert('Ponto salvo com sucesso!');
  };

  // ================= FORMATAÇÃO RESUMO =================
  const getResumoText = (item) => {
    const { results } = item;
    let txt = `📋 *Perdas na Colheita MEC*
Data: ${item.data.split('-').reverse().join('/')}
${item.campo ? `Campo: ${item.campo}\n` : ''}${item.lote ? `Lote: ${item.lote}\n` : ''}Colhedora: ${item.colhedora}
${item.turno}º Turno\n`;

    if (item.hasCat) {
      txt += `\n📊 *Categorias*\n`;
      txt += `Pedaço Solto......${item.cat.solto || '0'}\nLascas......${item.cat.lasca || '0'}\nEstilhaço......${item.cat.estilhaco || '0'}\n`;
      txt += `Tolete Repicado......${item.cat.repicado || '0'}\nCana Inteira......${item.cat.inteira || '0'}\nPedaço Fixo......${item.cat.fixo || '0'}\n`;
      txt += `Toco > 7cm......${item.cat.toco7 || '0'}\nCana Ponta......${item.cat.ponta || '0'}\n`;
    }

    txt += `\nTotal kg.......${results.totalPerdasKg.toFixed(2)}
TCH Est........${item.tch}\n
${checkColor(results.perdasPercent, config.metaPerda)} Perdas.................${results.perdasPercent.toFixed(2)}%\n`;

    if (item.pisoMetros > 0) {
      const metaPiso = item.pisoTipo === 'Simples' ? config.metaPisoSimples : config.metaPisoDuplo;
      txt += `${checkColor(results.pisoteioPercent, metaPiso)} Pisoteio ${item.pisoTipo}....${results.pisoteioPercent.toFixed(2)}%\n`;
    }
    if (item.tocosArrancados > 0) {
      txt += `${checkColor(results.arranquioPercent, config.metaArranquio)} Arranquio............${results.arranquioPercent.toFixed(2)}%\n`;
    }
    if (item.tocosAbalados > 0) {
      txt += `▫️ Abalo...................${results.abaloPercent.toFixed(2)}%\n`;
    }
    
    // Adiciona justificativa no resumo se existir
    if (item.justificativa) {
      txt += `\n⚠️ *Justificativa:*\n${item.justificativa}\n`;
    }
    
    return txt;
  };

  const copyToClipboard = (item) => {
    navigator.clipboard.writeText(getResumoText(item));
    alert('Resumo copiado!');
  };

  // ================= FILTROS E AGRUPAMENTO =================
  const historicoFiltrado = useMemo(() => {
    return historico.filter(item => {
      const matchData = filtroData ? item.data === filtroData : true;
      const matchCampo = filtroCampo ? (item.campo || '').includes(filtroCampo.toUpperCase()) : true;
      const matchColh = filtroColhedora ? (item.colhedora || '').includes(filtroColhedora.toUpperCase()) : true;
      return matchData && matchCampo && matchColh;
    });
  }, [historico, filtroData, filtroCampo, filtroColhedora]);

  const groupedHistory = useMemo(() => {
    const groups = {};
    historicoFiltrado.forEach(item => {
      const key = item[groupMode] || 'Não Informado';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [historicoFiltrado, groupMode]);

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  return (
    <div className="at-theme">
      <HeaderAgroTools onMenuOpen={() => setSidebarOpen(true)}>
      </HeaderAgroTools>
      <SidebarAgroTools isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <datalist id="campos-list">
        {camposData.map(c => <option key={c.CODIGO} value={c.CAMPO} />)}
      </datalist>

      <main className="at-container py-6 pb-24 max-w-lg mx-auto fade-in min-h-screen">
        
        {/* ================= ABA: NOVO PONTO ================= */}
        {activeTab === 'novo' && (
          <form onSubmit={handleSave}>
            <div className="at-card-section mb-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="at-input-group">
                  <label>Data</label>
                  <input type="date" className="at-input font-bold" value={form.data} onChange={e => updateForm('data', e.target.value)} required />
                </div>
                <div className="at-input-group">
                  <label>Turno</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateForm('turno', '1')} className={`at-turno-btn ${form.turno === '1' ? 'turno-1' : ''}`}>☀️ 1º</button>
                    <button type="button" onClick={() => updateForm('turno', '2')} className={`at-turno-btn ${form.turno === '2' ? 'turno-2' : ''}`}>🌙 2º</button>
                  </div>
                </div>
              </div>
              <div className="at-input-group">
                <label>Colhedora</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Digite o Código" className="at-input font-bold text-lg flex-1" value={form.colhedora} onChange={e => updateForm('colhedora', e.target.value.toUpperCase())} required />
                  {form.colhedora && (
                    <button type="button" onClick={handleClearColhedora} className="at-btn-clear" title="Limpar Colhedora">✕</button>
                  )}
                </div>
              </div>
            </div>

            <div className="at-card-section mb-4 grid grid-cols-2 gap-3">
              {config.showCampo && (
                <div className="at-input-group col-span-2">
                  <label>Campo</label>
                  <div className="flex gap-2">
                    <input list="campos-list" placeholder="Selecione o campo..." className="at-input uppercase flex-1" value={form.campo} onChange={e => handleCampoChange(e.target.value)} />
                    {form.campo && (
                      <button type="button" onClick={handleClearCampo} className="at-btn-clear" title="Limpar Campo, Lote e TCH">✕</button>
                    )}
                  </div>
                </div>
              )}
              {config.showLote && (
                <div className="at-input-group">
                  <label>Lote</label>
                  <input type="number" className="at-input" value={form.lote} onChange={e => updateForm('lote', e.target.value)} />
                </div>
              )}
              <div className="at-input-group">
                <label>TCH Estimado</label>
                <input type="number" step="0.1" className="at-input font-bold text-blue-600 bg-blue-50" value={form.tch} onChange={e => updateForm('tch', e.target.value)} required />
              </div>
            </div>

            {/* CARD DE RESULTADOS: PERDAS */}
            <div className="at-card-section mb-4 border-l-4" style={{ borderColor: hexColor(calcTotals.perdasPercent, config.metaPerda) }}>
              <div className="flex justify-between items-center mb-3 border-b pb-2">
                <label className="font-black text-sm uppercase text-slate-600">Perdas (kg)</label>
                <span className="font-black text-xl" style={{ color: hexColor(calcTotals.perdasPercent, config.metaPerda) }}>
                  {calcTotals.perdasPercent.toFixed(2)}%
                </span>
              </div>
              
              {config.showCat ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {[
                    { id: 'solto', label: 'Pedaço Solto' }, { id: 'lasca', label: 'Lascas' },
                    { id: 'estilhaco', label: 'Estilhaço' }, { id: 'repicado', label: 'Repicado' },
                    { id: 'inteira', label: 'Cana Inteira' }, { id: 'fixo', label: 'Pedaço Fixo' },
                    { id: 'toco7', label: 'Toco > 7cm' }, { id: 'ponta', label: 'Cana Ponta' }
                  ].map(cat => (
                    <div key={cat.id} className="flex justify-between items-center text-xs border-b border-slate-100 py-1">
                      <span className="text-slate-500 font-bold">{cat.label}</span>
                      <input type="number" inputMode="decimal" className="w-16 h-8 text-center bg-slate-50 border rounded font-bold outline-none focus:border-green-500"
                        value={form.cat[cat.id]} onChange={e => updateCat(cat.id, e.target.value)} />
                    </div>
                  ))}
                  <div className="col-span-2 flex justify-between pt-2 mt-1 border-t text-sm font-black">
                    <span>TOTAL KG:</span>
                    <span className="text-blue-600">{calcTotals.totalPerdasKg.toFixed(2)} kg</span>
                  </div>
                </div>
              ) : (
                <div className="at-input-group">
                  <label>Total Perda (kg)</label>
                  <input type="number" inputMode="decimal" className="at-input" value={form.totalManual} onChange={e => updateForm('totalManual', e.target.value)} />
                </div>
              )}
            </div>

            {/* JUSTIFICATIVA OBRIGATÓRIA (Aparece apenas se perder > meta) */}
            {calcTotals.perdasPercent > config.metaPerda && (
              <div className="at-card-section mb-4 border-l-4 border-red-500 bg-red-50/40 fade-in">
                <label className="font-black text-sm uppercase text-red-600 mb-2 block">
                  Justificativa Obrigatória
                </label>
                <textarea 
                  className="at-input w-full h-20 resize-none text-sm" 
                  placeholder="A perda excedeu a meta. Qual o motivo?"
                  value={form.justificativa}
                  onChange={e => updateForm('justificativa', e.target.value)}
                />
              </div>
            )}

            {/* CARD DE RESULTADOS: PISOTEIO */}
            {config.showPisoteio && (
              <div className="at-card-section mb-4 border-l-4" style={{ borderColor: hexColor(calcTotals.pisoteioPercent, form.pisoTipo === 'Simples' ? config.metaPisoSimples : config.metaPisoDuplo) }}>
                 <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <label className="font-black text-sm uppercase text-slate-600">Pisoteio</label>
                  <span className="font-black text-xl" style={{ color: hexColor(calcTotals.pisoteioPercent, form.pisoTipo === 'Simples' ? config.metaPisoSimples : config.metaPisoDuplo) }}>
                    {calcTotals.pisoteioPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select className="at-input bg-slate-50" value={form.pisoTipo} onChange={e => updateForm('pisoTipo', e.target.value)}>
                    <option value="Simples">Simples (6,66)</option>
                    <option value="Duplo">Duplo (9,08)</option>
                  </select>
                  <input type="number" inputMode="decimal" placeholder="Metros (m)" className="at-input" value={form.pisoMetros} onChange={e => updateForm('pisoMetros', e.target.value)} />
                </div>
              </div>
            )}

            {/* CARD DE RESULTADOS: ARRANQUIO E ABALO PADRONIZADO */}
            {(config.showArranquio || config.showAbalo) && (
              <div className="at-card-section mb-4 border-l-4" style={{ borderColor: hexColor(calcTotals.arranquioPercent, config.metaArranquio) }}>
                
                <div className="flex flex-col mb-3 border-b pb-2 gap-1">
                  {config.showArranquio && (
                    <div className="flex justify-between items-center">
                      <label className="font-black text-sm uppercase text-slate-600">Arranquio</label>
                      <span className="font-black text-xl" style={{ color: hexColor(calcTotals.arranquioPercent, config.metaArranquio) }}>
                        {calcTotals.arranquioPercent.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {config.showAbalo && (
                    <div className="flex justify-between items-center mt-1">
                      <label className="font-black text-sm uppercase text-slate-600">Abalo</label>
                      <span className="font-black text-xl text-slate-500">
                        {calcTotals.abaloPercent.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400">Fixos (Total)</span>
                    <input type="number" className="at-input h-10 text-center" value={form.tocosFixos} onChange={e => updateForm('tocosFixos', e.target.value)} />
                  </div>
                  {config.showArranquio && (
                    <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400">Arrancados</span>
                      <input type="number" className="at-input h-10 text-center" value={form.tocosArrancados} onChange={e => updateForm('tocosArrancados', e.target.value)} />
                    </div>
                  )}
                  {config.showAbalo && (
                    <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400">Abalados</span>
                      <input type="number" className="at-input h-10 text-center" value={form.tocosAbalados} onChange={e => updateForm('tocosAbalados', e.target.value)} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <button type="submit" className="at-btn at-btn--primary w-full h-[54px] text-[1rem]">SALVAR PONTO</button>
          </form>
        )}

        {/* ================= ABA: HISTÓRICO ================= */}
        {activeTab === 'historico' && (
          <div>
            <div className="at-card-section mb-4 p-3 bg-slate-50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Filtros</span>
                <button type="button" onClick={() => { if(window.confirm('Excluir histórico?')) setHistorico([]); }} className="text-xs font-bold text-red-500">Limpar Tudo</button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="date" className="at-input h-9 text-xs" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
                <select className="at-input h-9 text-xs" value={groupMode} onChange={e => setGroupMode(e.target.value)}>
                  <option value="colhedora">Agrupar Colhedora</option>
                  <option value="campo">Agrupar Campo</option>
                  <option value="data">Agrupar Data</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Campo..." className="at-input h-9 text-xs uppercase" value={filtroCampo} onChange={e => setFiltroCampo(e.target.value)} />
                <input type="text" placeholder="Colhedora..." className="at-input h-9 text-xs uppercase" value={filtroColhedora} onChange={e => setFiltroColhedora(e.target.value)} />
              </div>
            </div>

            {Object.keys(groupedHistory).length === 0 ? <div className="at-empty-state">Nenhum ponto encontrado.</div> : (
              Object.entries(groupedHistory).map(([groupName, items]) => {
                const isOpen = expandedGroups[groupName]; 
                return (
                  <div key={groupName} className="mb-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div 
                      className="bg-slate-100 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-slate-200 transition-colors"
                      onClick={() => toggleGroup(groupName)}
                    >
                      <span className="font-black text-slate-700">{groupName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-full border">{items.length} pts</span>
                        <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="p-2 flex flex-col gap-2">
                        {items.map(item => (
                          <div key={item.id} className="flex flex-col p-3 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer shadow-sm transition-transform active:scale-[0.98]" onClick={() => setModalItem(item)}>
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex flex-col gap-1 overflow-hidden pr-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded w-fit">
                                  {item.horaStr} • {item.turno}º Turno
                                </span>
                                <span className="text-sm font-black text-slate-700 truncate">
                                  {groupMode === 'colhedora' ? (item.campo || 'Sem Campo') : item.colhedora}
                                </span>
                              </div>
                              <div className="font-black text-lg bg-white px-2 py-1 rounded-lg border shadow-sm flex-shrink-0" style={{ borderColor: hexColor(item.results.perdasPercent, config.metaPerda), color: hexColor(item.results.perdasPercent, config.metaPerda) }}>
                                {item.results.perdasPercent.toFixed(2)}%
                              </div>
                            </div>
                            {/* Altura fixa para justificar, garantindo que os cards mantenham o mesmo tamanho */}
                            <span className="text-[10px] text-slate-400 italic truncate block h-3 leading-3 mt-1">
                              {item.justificativa ? `Just: ${item.justificativa}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ================= ABA: CONFIGURAÇÕES ================= */}
        {activeTab === 'config' && (
          <div className="flex flex-col gap-4">
            <div className="at-card-section">
              <h3 className="font-black text-sm text-slate-600 border-b pb-2 mb-3">Visibilidade do Formulário</h3>
              {[
                { id: 'showCampo', label: 'Campo' }, { id: 'showLote', label: 'Lote' },
                { id: 'showCat', label: 'Categorias de Perda' }, { id: 'showPisoteio', label: 'Pisoteio' },
                { id: 'showArranquio', label: 'Arranquio' }, { id: 'showAbalo', label: 'Abalo' }
              ].map(toggle => (
                <label key={toggle.id} className="flex justify-between items-center py-2 cursor-pointer">
                  <span className="text-sm font-bold text-slate-600">{toggle.label}</span>
                  <input type="checkbox" checked={config[toggle.id]} onChange={e => setConfig({ ...config, [toggle.id]: e.target.checked })} className="w-5 h-5 accent-green-600" />
                </label>
              ))}
            </div>

            <div className="at-card-section">
              <h3 className="font-black text-sm text-slate-600 border-b pb-2 mb-3">Metas de Qualidade (%)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="at-input-group"><label>Perdas MEC</label><input type="number" step="0.1" className="at-input h-10" value={config.metaPerda} onChange={e => setConfig({ ...config, metaPerda: Number(e.target.value) })} /></div>
                <div className="at-input-group"><label>Piso Simples</label><input type="number" step="0.1" className="at-input h-10" value={config.metaPisoSimples} onChange={e => setConfig({ ...config, metaPisoSimples: Number(e.target.value) })} /></div>
                <div className="at-input-group"><label>Piso Duplo</label><input type="number" step="0.1" className="at-input h-10" value={config.metaPisoDuplo} onChange={e => setConfig({ ...config, metaPisoDuplo: Number(e.target.value) })} /></div>
                <div className="at-input-group"><label>Arranquio</label><input type="number" step="0.1" className="at-input h-10" value={config.metaArranquio} onChange={e => setConfig({ ...config, metaArranquio: Number(e.target.value) })} /></div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ================= NAVEGAÇÃO INFERIOR FIXA ================= */}
      <div className="at-bottom-nav">
        <button onClick={() => setActiveTab('historico')} className={`at-nav-btn ${activeTab === 'historico' ? 'active' : ''}`}>
          <span className="text-xl leading-none">📋</span>
          <span className="text-[10px] font-bold uppercase mt-1">Histórico</span>
        </button>
        <button onClick={() => setActiveTab('novo')} className={`at-nav-btn ${activeTab === 'novo' ? 'active' : ''}`}>
          <span className="text-xl leading-none">➕</span>
          <span className="text-[10px] font-bold uppercase mt-1">Novo</span>
        </button>
        <button onClick={() => setActiveTab('config')} className={`at-nav-btn ${activeTab === 'config' ? 'active' : ''}`}>
          <span className="text-xl leading-none">⚙️</span>
          <span className="text-[10px] font-bold uppercase mt-1">Ajustes</span>
        </button>
      </div>

      {/* ================= MODAL DE RESUMO ================= */}
      {modalItem && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[85vw] md:max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] m-auto">
            <div className="bg-slate-100 p-4 border-b flex justify-between items-center">
              <h3 className="font-black text-slate-700 uppercase text-sm">Resumo do Ponto</h3>
              <button onClick={() => setModalItem(null)} className="text-slate-400 font-bold text-2xl leading-none hover:text-red-500">&times;</button>
            </div>
            
            <div className="p-5 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 flex-1">
              {getResumoText(modalItem)}
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex gap-3">
               <button onClick={() => {
                 setHistorico(historico.filter(h => h.id !== modalItem.id));
                 setModalItem(null);
               }} className="flex-1 bg-white border border-red-200 text-red-500 font-bold uppercase text-xs rounded-lg py-3 hover:bg-red-50">Excluir</button>
               
               <button onClick={() => copyToClipboard(modalItem)} className="flex-[1.5] at-btn--primary font-bold uppercase text-xs rounded-lg py-3">COPIAR</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PerdasColheitaTools;