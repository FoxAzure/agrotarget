import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import html2PDF from 'jspdf-html2canvas';
import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabaseClient';
import RNCHeader from '../../../components/RNC/RNCHeader';
import RNCSideBar from '../../../components/RNC/RNCSideBar';
import agrovaleLogo from '../../../gallery/logo/agrovale.png';
import './RNCRelatorio.css';

const STATUS = {
  PENDENTE: 'PENDENTE',
  ANDAMENTO: 'ANDAMENTO',
  CONCLUIDO: 'CONCLUIDO',
  CONCLUIDO_ATRASO: 'CONCLUIDO_ATRASO',
  ATRASADO: 'ATRASADO',
};

const STATUS_LABELS = {
  PENDENTE: 'PENDENTE',
  ANDAMENTO: 'ANDAMENTO',
  CONCLUIDO: 'CONCLUÍDO',
  CONCLUIDO_ATRASO: 'CONCLUÍDO COM ATRASO',
  ATRASADO: 'ATRASADO',
};

const EMPTY_FILTERS = { id: '', campo: '', area: '', tag: '', descricao: '' };
const upper = (value, fallback = 'NÃO INFORMADO') => String(value || fallback).toLocaleUpperCase('pt-BR');

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '' || value === '[]' || value === '{}') return [];
  if (typeof value === 'number') return [value];
  if (typeof value !== 'string') return [];
  const text = value.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    if (text.startsWith('{') && text.endsWith('}')) {
      return text.slice(1, -1).split(',').map((item) => item.replace(/^"|"$/g, '').trim()).filter(Boolean);
    }
    return [text];
  }
};

const brasiliaIso = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(value);

const getPlanStatus = (plan) => {
  if (!plan) return STATUS.PENDENTE;
  if ([STATUS.CONCLUIDO, STATUS.CONCLUIDO_ATRASO].includes(plan.status)) {
    if (plan.dt_conclusao && plan.dt_prazo) {
      return brasiliaIso(new Date(plan.dt_conclusao)) > plan.dt_prazo
        ? STATUS.CONCLUIDO_ATRASO
        : STATUS.CONCLUIDO;
    }
    return plan.status;
  }
  return plan.dt_prazo && plan.dt_prazo < brasiliaIso() ? STATUS.ATRASADO : STATUS.ANDAMENTO;
};

const getDeadlineText = (plan) => {
  if (!plan?.dt_prazo) return 'PRAZO NÃO INFORMADO';
  if ([STATUS.CONCLUIDO, STATUS.CONCLUIDO_ATRASO].includes(plan.status)) {
    return plan.status === STATUS.CONCLUIDO_ATRASO
      ? 'CONCLUÍDO APÓS O PRAZO'
      : 'CONCLUÍDO DENTRO DO PRAZO';
  }
  const today = new Date(`${brasiliaIso()}T12:00:00`);
  const deadline = new Date(`${plan.dt_prazo}T12:00:00`);
  const days = Math.round((deadline - today) / 86400000);
  if (days < 0) {
    const amount = Math.abs(days);
    return `${amount} DIA${amount === 1 ? '' : 'S'} EM ATRASO`;
  }
  if (days === 0) return 'PRAZO VENCE HOJE';
  return `${days} DIA${days === 1 ? '' : 'S'} RESTANTE${days === 1 ? '' : 'S'}`;
};

const safeFilePart = (value, fallback = 'SEM_CAMPO') => {
  const normalized = String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return normalized || fallback;
};

const setCell = (sheet, address, value, style = {}) => {
  sheet[address] = { t: typeof value === 'number' ? 'n' : 's', v: value, s: style };
};

const RNCRelatorio = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const reportRef = useRef(null);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [records, setRecords] = useState([]);
  const [tagCatalog, setTagCatalog] = useState([]);
  const [areaCatalog, setAreaCatalog] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingXls, setExportingXls] = useState(false);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const loadData = async () => {
    setLoading(true);
    setError('');

    const [recordsResult, plansResult, tagsResult, areasResult] = await Promise.all([
      supabase.rpc('rnc_listar_registros_publico'),
      supabase.rpc('rnc_listar_planos_publico'),
      supabase.from('tb_r_tag').select('id, nome, cor, status').eq('status', 'ativo').order('nome'),
      supabase.from('tb_r_areas').select('id, area, status').eq('status', 'ativo').order('area'),
    ]);

    if (recordsResult.error) {
      setError('NÃO FOI POSSÍVEL CARREGAR AS RNCS.');
      setRecords([]);
      setLoading(false);
      return;
    }

    const plansByRnc = new Map();
    (plansResult.data || []).forEach((plan) => {
      const rncId = Number(plan.id_rnc);
      if (!plansByRnc.has(rncId)) plansByRnc.set(rncId, plan);
    });

    const normalized = (recordsResult.data || [])
      .map((item) => {
        const plano = plansByRnc.get(Number(item.id)) || null;
        return {
          ...item,
          tags: toArray(item.tags_detalhes).length ? toArray(item.tags_detalhes) : toArray(item.tags),
          plano,
          status_rnc: getPlanStatus(plano),
        };
      })
      .sort((a, b) => {
        const dateA = new Date(a.data_criacao || a.data_ocorrencia || 0).getTime();
        const dateB = new Date(b.data_criacao || b.data_ocorrencia || 0).getTime();
        return dateB - dateA || Number(b.id) - Number(a.id);
      });

    setRecords(normalized);
    setTagCatalog(tagsResult.data || []);
    setAreaCatalog(areasResult.data || []);

    const routeId = Number(searchParams.get('rnc'));
    const routeRecord = normalized.find((item) => Number(item.id) === routeId);
    setSelectedId(routeRecord?.id || normalized[0]?.id || null);

    if (plansResult.error) {
      setError('AS RNCS FORAM CARREGADAS, MAS OS PLANOS DE AÇÃO NÃO PUDERAM SER CONSULTADOS.');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const normalizeTags = (item) => {
    const value = toArray(item?.tags_detalhes).length ? toArray(item.tags_detalhes) : toArray(item?.tags);
    return value
      .map((tag) => {
        const isObject = tag && typeof tag === 'object' && !Array.isArray(tag);
        const id = Number(isObject ? (tag.id ?? tag.tag_id ?? tag.tag) : tag);
        if (!Number.isFinite(id)) return null;
        const catalogTag = tagCatalog.find((entry) => Number(entry.id) === id);
        return {
          id,
          nome: upper((isObject && (tag.nome || tag.tag_nome)) || catalogTag?.nome || `TAG #${id}`),
          cor: (isObject && tag.cor) || catalogTag?.cor || '#64748B',
        };
      })
      .filter(Boolean)
      .filter((tag, index, list) => list.findIndex((entry) => entry.id === tag.id) === index)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  };

  const filtered = useMemo(() => records.filter((item) => {
    const tags = normalizeTags(item);
    return (
      (!filters.id || String(item.id).includes(filters.id.trim().replace('#', ''))) &&
      (!filters.campo || String(item.campo || '').toLocaleLowerCase('pt-BR').includes(filters.campo.trim().toLocaleLowerCase('pt-BR'))) &&
      (!filters.area || String(item.id_area) === filters.area) &&
      (!filters.tag || tags.some((tag) => String(tag.id) === filters.tag)) &&
      (!filters.descricao || String(item.desc_rnc || '').toLocaleLowerCase('pt-BR').includes(filters.descricao.trim().toLocaleLowerCase('pt-BR')))
    );
  }), [records, filters, tagCatalog]);

  const selected = useMemo(
    () => records.find((item) => Number(item.id) === Number(selectedId)) || filtered[0] || records[0] || null,
    [records, filtered, selectedId]
  );

  const formatDate = (value, includeTime = false) => {
    if (!value) return 'NÃO INFORMADA';
    const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
    if (Number.isNaN(date.getTime())) return upper(value);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
  };

  const imageUrl = (path) => supabase.storage.from('rnc-imagens').getPublicUrl(path).data.publicUrl;

  const selectRecord = (record) => {
    setSelectedId(record.id);
    setSearchParams({ rnc: String(record.id) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getFileBase = () => {
    if (!selected) return 'RNC';
    const year = String(selected.data_ocorrencia || selected.data_criacao || '').slice(0, 4) || new Date().getFullYear();
    return `RNC-${selected.id}_${safeFilePart(selected.campo)}_${year}`;
  };

  const downloadPdf = async () => {
    if (!selected || !reportRef.current || exportingPdf) return;
    setExportingPdf(true);
    setError('');

    try {
      await document.fonts?.ready;
      await Promise.all(Array.from(reportRef.current.querySelectorAll('img')).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          image.onload = resolve;
          image.onerror = resolve;
        });
      }));

      await html2PDF(reportRef.current, {
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        html2canvas: {
          scale: 3,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: -window.scrollY,
          logging: false,
          imageTimeout: 20000,
        },
        imageType: 'image/png',
        output: `${getFileBase()}.pdf`,
      });
    } catch (exportError) {
      setError(upper(exportError.message, 'NÃO FOI POSSÍVEL GERAR O PDF.'));
    } finally {
      setExportingPdf(false);
    }
  };

  const downloadXls = () => {
    if (!selected || exportingXls) return;
    setExportingXls(true);
    setError('');

    try {
      const tags = normalizeTags(selected).map((tag) => tag.nome).join('; ');
      const status = STATUS_LABELS[selected.status_rnc] || selected.status_rnc;
      const plan = selected.plano;

      const dados = [{
        NUMERO_RNC: selected.id,
        CODIGO_CAMPO: upper(selected.cod_campo, ''),
        CAMPO: upper(selected.campo, ''),
        DATA_OCORRENCIA: formatDate(selected.data_ocorrencia),
        AREA: upper(selected.area, ''),
        DESCRICAO_RNC: upper(selected.desc_rnc, ''),
        RESPONSAVEL_RNC: upper(selected.responsavel, ''),
        REGISTRADO_POR: upper(selected.usuario_criacao, ''),
        DATA_CRIACAO_RNC: formatDate(selected.data_criacao, true),
        STATUS_RNC: upper(status),
        TAGS: upper(tags, ''),
        ID_PLANO: plan?.id || '',
        CAUSA: upper(plan?.desc_causa, ''),
        ACAO: upper(plan?.desc_acao, ''),
        PRAZO: plan ? formatDate(plan.dt_prazo) : '',
        RESPONSAVEL_PLANO: upper(plan?.responsavel, ''),
        SITUACAO_PRAZO: plan ? getDeadlineText(plan) : 'PLANO DE AÇÃO PENDENTE',
        DATA_CRIACAO_PLANO: plan ? formatDate(plan.dt_criacao, true) : '',
        ULTIMA_ATUALIZACAO: plan ? formatDate(plan.dt_atualizacao, true) : '',
        DATA_CONCLUSAO: plan?.dt_conclusao ? formatDate(plan.dt_conclusao, true) : '',
      }];

      const workbook = XLSX.utils.book_new();
      const dataSheet = XLSX.utils.json_to_sheet(dados);
      dataSheet['!cols'] = [
        { wch: 12 }, { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 24 }, { wch: 70 },
        { wch: 24 }, { wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 35 }, { wch: 12 },
        { wch: 60 }, { wch: 70 }, { wch: 16 }, { wch: 28 }, { wch: 28 }, { wch: 22 },
        { wch: 22 }, { wch: 22 },
      ];
      dataSheet['!autofilter'] = { ref: dataSheet['!ref'] };
      dataSheet['!freeze'] = { xSplit: 0, ySplit: 1 };

      const reportSheet = XLSX.utils.aoa_to_sheet([]);
      reportSheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },
        { s: { r: 8, c: 0 }, e: { r: 8, c: 5 } },
        { s: { r: 9, c: 0 }, e: { r: 11, c: 5 } },
        { s: { r: 13, c: 0 }, e: { r: 13, c: 5 } },
        { s: { r: 14, c: 0 }, e: { r: 16, c: 5 } },
        { s: { r: 18, c: 0 }, e: { r: 18, c: 5 } },
        { s: { r: 19, c: 0 }, e: { r: 21, c: 5 } },
        { s: { r: 23, c: 0 }, e: { r: 23, c: 5 } },
      ];

      setCell(reportSheet, 'A1', 'GESTÃO DA QUALIDADE AGRÍCOLA');
      setCell(reportSheet, 'A2', 'RELATÓRIO DE NÃO CONFORMIDADE');
      setCell(reportSheet, 'A4', 'IDENTIFICAÇÃO DA OCORRÊNCIA');
      setCell(reportSheet, 'A5', 'NÚMERO DA RNC'); setCell(reportSheet, 'B5', selected.id);
      setCell(reportSheet, 'C5', 'STATUS'); setCell(reportSheet, 'D5', upper(status));
      setCell(reportSheet, 'E5', 'DATA DA OCORRÊNCIA'); setCell(reportSheet, 'F5', formatDate(selected.data_ocorrencia));
      setCell(reportSheet, 'A6', 'CÓDIGO DO CAMPO'); setCell(reportSheet, 'B6', upper(selected.cod_campo));
      setCell(reportSheet, 'C6', 'CAMPO'); setCell(reportSheet, 'D6', upper(selected.campo));
      setCell(reportSheet, 'E6', 'ÁREA'); setCell(reportSheet, 'F6', upper(selected.area));
      setCell(reportSheet, 'A7', 'RESPONSÁVEL RNC'); setCell(reportSheet, 'B7', upper(selected.responsavel));
      setCell(reportSheet, 'C7', 'REGISTRADO POR'); setCell(reportSheet, 'D7', upper(selected.usuario_criacao));
      setCell(reportSheet, 'E7', 'TAGS'); setCell(reportSheet, 'F7', upper(tags, 'SEM TAGS'));
      setCell(reportSheet, 'A9', 'DESCRIÇÃO DA NÃO CONFORMIDADE');
      setCell(reportSheet, 'A10', upper(selected.desc_rnc));
      setCell(reportSheet, 'A14', 'PLANO DE AÇÃO');

      if (plan) {
        setCell(reportSheet, 'A15', `CAUSA IDENTIFICADA\n${upper(plan.desc_causa)}`);
        setCell(reportSheet, 'A19', `AÇÃO DEFINIDA\n${upper(plan.desc_acao)}`);
        setCell(reportSheet, 'A24', 'RESPONSÁVEL PELA AÇÃO'); setCell(reportSheet, 'B24', upper(plan.responsavel));
        setCell(reportSheet, 'C24', 'PRAZO'); setCell(reportSheet, 'D24', formatDate(plan.dt_prazo));
        setCell(reportSheet, 'E24', 'SITUAÇÃO'); setCell(reportSheet, 'F24', getDeadlineText(plan));
      } else {
        setCell(reportSheet, 'A15', 'RNC PENDENTE DE CRIAÇÃO DO PLANO DE AÇÃO.');
        setCell(reportSheet, 'A19', 'AINDA NÃO FORAM DEFINIDAS A CAUSA, A AÇÃO CORRETIVA, O RESPONSÁVEL E O PRAZO.');
      }

      reportSheet['!ref'] = 'A1:F24';
      reportSheet['!cols'] = [
        { wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 25 }, { wch: 24 }, { wch: 30 },
      ];
      reportSheet['!rows'] = [
        { hpt: 28 }, { hpt: 24 }, { hpt: 8 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 },
        { hpt: 8 }, { hpt: 22 }, { hpt: 28 }, { hpt: 28 }, { hpt: 28 }, { hpt: 8 }, { hpt: 22 },
        { hpt: 28 }, { hpt: 28 }, { hpt: 28 }, { hpt: 8 }, { hpt: 28 }, { hpt: 28 }, { hpt: 28 },
        { hpt: 8 }, { hpt: 8 }, { hpt: 24 },
      ];

      XLSX.utils.book_append_sheet(workbook, dataSheet, 'DADOS');
      XLSX.utils.book_append_sheet(workbook, reportSheet, 'RELATORIO');
      XLSX.writeFile(workbook, `${getFileBase()}.xlsx`, { compression: true, cellStyles: true });
    } catch (exportError) {
      setError(upper(exportError.message, 'NÃO FOI POSSÍVEL GERAR A PLANILHA.'));
    } finally {
      setExportingXls(false);
    }
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  return (
    <div className="rnc-report-page">
      <RNCHeader onMenuOpen={() => setSidebarOpen(true)} />
      <RNCSideBar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="rnc-report-main">
        <section className="rnc-report-heading">
          <div>
            <span>Relatórios RNC</span>
            <h1>Visualização e exportação</h1>
            <p>Selecione uma ocorrência, confira o relatório e baixe em PDF ou Excel.</p>
          </div>
          <button type="button" onClick={() => navigate('/rnc')}>Voltar</button>
        </section>

        {error && <div className="rnc-report-error" role="alert">{error}</div>}

        <section className="rnc-report-toolbar">
          <button type="button" className="rnc-report-filter-toggle" onClick={() => setFiltersOpen((current) => !current)} aria-expanded={filtersOpen}>
            <span><strong>Localizar RNC</strong><small>{filtered.length} de {records.length} registros</small></span>
            <b>{filtersOpen ? '−' : '+'}</b>
          </button>

          {filtersOpen && (
            <div className="rnc-report-filters">
              <label><span>Número</span><input value={filters.id} onChange={(event) => setFilters({ ...filters, id: event.target.value })} placeholder="Ex.: 1" /></label>
              <label><span>Campo</span><input value={filters.campo} onChange={(event) => setFilters({ ...filters, campo: event.target.value })} placeholder="Nome do campo" /></label>
              <label><span>Área</span><select value={filters.area} onChange={(event) => setFilters({ ...filters, area: event.target.value })}><option value="">Todas</option>{areaCatalog.map((area) => <option key={area.id} value={area.id}>{area.area}</option>)}</select></label>
              <label><span>Tag</span><select value={filters.tag} onChange={(event) => setFilters({ ...filters, tag: event.target.value })}><option value="">Todas</option>{tagCatalog.map((tag) => <option key={tag.id} value={tag.id}>{tag.nome}</option>)}</select></label>
              <label className="rnc-report-filter-description"><span>Descrição</span><input value={filters.descricao} onChange={(event) => setFilters({ ...filters, descricao: event.target.value })} placeholder="Trecho da descrição" /></label>
              <button type="button" onClick={clearFilters}>Limpar</button>
            </div>
          )}
        </section>

        <div className="rnc-report-layout">
          <aside className="rnc-report-list-panel">
            <div className="rnc-report-list-head">
              <div><strong>RNCs disponíveis</strong><small>Mais recentes primeiro</small></div>
              <button type="button" onClick={loadData} disabled={loading}>Atualizar</button>
            </div>

            <div className="rnc-report-list">
              {loading ? (
                <div className="rnc-report-list-empty">Carregando...</div>
              ) : filtered.length ? filtered.map((item) => (
                <button type="button" key={item.id} className={Number(selected?.id) === Number(item.id) ? 'is-selected' : ''} onClick={() => selectRecord(item)}>
                  <span className="rnc-report-list-number">#{item.id}</span>
                  <span className="rnc-report-list-content"><strong>{upper(item.campo, 'CAMPO NÃO INFORMADO')}</strong><small>{upper(item.area, 'ÁREA NÃO INFORMADA')} · {formatDate(item.data_ocorrencia)}</small></span>
                  <span className={`rnc-report-list-status is-${item.status_rnc.toLowerCase()}`}>{STATUS_LABELS[item.status_rnc]}</span>
                </button>
              )) : <div className="rnc-report-list-empty">Nenhuma RNC encontrada.</div>}
            </div>
          </aside>

          <section className="rnc-report-viewer">
            <div className="rnc-report-actions">
              <div><strong>{selected ? `RNC #${selected.id}` : 'Nenhuma RNC selecionada'}</strong><small>{upper(selected?.campo, 'SELECIONE UMA OCORRÊNCIA')}</small></div>
              <div>
                <button type="button" className="is-xls" onClick={downloadXls} disabled={!selected || exportingXls}>{exportingXls ? 'Gerando...' : 'Baixar dados XLS'}</button>
                <button type="button" className="is-pdf" onClick={downloadPdf} disabled={!selected || exportingPdf}>{exportingPdf ? 'Gerando PDF...' : 'Salvar PDF'}</button>
              </div>
            </div>

            {selected ? (
              <div className="rnc-report-paper-wrap">
                <article className="rnc-report-paper" ref={reportRef}>
                  <header className="rnc-report-paper-header">
                    <div className="rnc-report-paper-title">
                      <strong>GESTÃO DA QUALIDADE AGRÍCOLA</strong>
                      <h2>Relatório de Não Conformidade</h2>
                    </div>
                    <img src={agrovaleLogo} alt="Agrovale" />
                  </header>

                  <div className="rnc-report-meta">
                    <div><span>NÚMERO DA RNC</span><strong>#{selected.id}</strong></div>
                    <div><span>STATUS</span><strong className={`is-${selected.status_rnc.toLowerCase()}`}>{STATUS_LABELS[selected.status_rnc]}</strong></div>
                    <div><span>DATA DA OCORRÊNCIA</span><strong>{formatDate(selected.data_ocorrencia)}</strong></div>
                  </div>

                  <section className="rnc-report-section">
                    <div className="rnc-report-section-head"><span>01</span><h3>IDENTIFICAÇÃO DA OCORRÊNCIA</h3></div>
                    <div className="rnc-report-data-grid">
                      <div><span>CÓDIGO DO CAMPO</span><strong>{upper(selected.cod_campo)}</strong></div>
                      <div><span>CAMPO</span><strong>{upper(selected.campo)}</strong></div>
                      <div><span>ÁREA</span><strong>{upper(selected.area, 'NÃO INFORMADA')}</strong></div>
                      <div><span>RESPONSÁVEL RNC</span><strong>{upper(selected.responsavel)}</strong></div>
                      <div><span>REGISTRADO POR</span><strong>{upper(selected.usuario_criacao)}</strong></div>
                      <div><span>DATA DE REGISTRO</span><strong>{formatDate(selected.data_criacao, true)}</strong></div>
                    </div>
                    {normalizeTags(selected).length > 0 && (
                      <div className="rnc-report-tags"><span>TAGS</span><div>{normalizeTags(selected).map((tag) => <b key={tag.id} style={{ '--report-tag': tag.cor }}>{tag.nome}</b>)}</div></div>
                    )}
                  </section>

                  <section className="rnc-report-section">
                    <div className="rnc-report-section-head"><span>02</span><h3>DESCRIÇÃO DA NÃO CONFORMIDADE</h3></div>
                    <div className="rnc-report-text">{upper(selected.desc_rnc, 'NÃO INFORMADA')}</div>
                  </section>

                  {selected.imagens?.length > 0 && (
                    <section className="rnc-report-section rnc-report-section-images">
                      <div className="rnc-report-section-head"><span>03</span><h3>EVIDÊNCIAS FOTOGRÁFICAS</h3></div>
                      <div className={`rnc-report-images count-${Math.min(selected.imagens.length, 3)}`}>
                        {selected.imagens.slice(0, 3).map((path, index) => (
                          <figure key={path}>
                            <img src={imageUrl(path)} alt={`Evidência ${index + 1} da RNC ${selected.id}`} crossOrigin="anonymous" />
                            <figcaption>IMAGEM {index + 1}</figcaption>
                          </figure>
                        ))}
                      </div>
                    </section>
                  )}

                  {selected.plano ? (
                    <section className="rnc-report-section rnc-report-plan">
                      <div className="rnc-report-section-head"><span>{selected.imagens?.length ? '04' : '03'}</span><h3>PLANO DE AÇÃO</h3></div>
                      <div className="rnc-report-plan-text"><span>CAUSA IDENTIFICADA</span><p>{upper(selected.plano.desc_causa)}</p></div>
                      <div className="rnc-report-plan-text"><span>AÇÃO DEFINIDA</span><p>{upper(selected.plano.desc_acao)}</p></div>
                      <div className="rnc-report-plan-grid">
                        <div><span>RESPONSÁVEL PELA AÇÃO</span><strong>{upper(selected.plano.responsavel)}</strong></div>
                        <div><span>PRAZO</span><strong>{formatDate(selected.plano.dt_prazo)}</strong></div>
                        <div><span>SITUAÇÃO DO PRAZO</span><strong>{getDeadlineText(selected.plano)}</strong></div>
                        <div><span>ÚLTIMA ATUALIZAÇÃO</span><strong>{formatDate(selected.plano.dt_atualizacao, true)}</strong></div>
                      </div>
                    </section>
                  ) : (
                    <section className="rnc-report-section rnc-report-plan-pending">
                      <div className="rnc-report-section-head"><span>{selected.imagens?.length ? '04' : '03'}</span><h3>PLANO DE AÇÃO</h3></div>
                      <div className="rnc-report-pending-box">
                        <strong>PLANO DE AÇÃO PENDENTE</strong>
                        <p>ESTA RNC AINDA NÃO FOI RESPONDIDA. A CAUSA, A AÇÃO CORRETIVA, O RESPONSÁVEL E O PRAZO AINDA NÃO FORAM DEFINIDOS.</p>
                      </div>
                    </section>
                  )}

                  <footer className="rnc-report-paper-footer">
                    <span>GESTÃO DA QUALIDADE AGRÍCOLA · AGROVALE</span>
                    <span>RNC #{selected.id} · GERADO EM {formatDate(new Date().toISOString(), true)}</span>
                  </footer>
                </article>
              </div>
            ) : (
              <div className="rnc-report-no-selection">Selecione uma RNC para visualizar o relatório.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default RNCRelatorio;
