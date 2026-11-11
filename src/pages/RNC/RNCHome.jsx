import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useRNCAuth } from '../../lib/RNCAuthContext';
import RNCHeader from '../../components/RNC/RNCHeader';
import RNCSideBar from '../../components/RNC/RNCSideBar';
import './RNCHome.css';

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

const debugTags = (label, value) => {
  console.groupCollapsed(`[RNC HOME][TAGS] ${label}`);
  console.log('Valor recebido:', value);
  console.log('Tipo:', typeof value);
  console.log('É array:', Array.isArray(value));
  console.log('Normalizado:', toArray(value));
  console.groupEnd();
};

const RNCHome = () => {
  const navigate = useNavigate();
  const { user, canCreateRNC } = useRNCAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [records, setRecords] = useState([]);
  const [tagCatalog, setTagCatalog] = useState([]);
  const [selected, setSelected] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadRecords = async () => {
    setLoading(true);
    setError('');

    console.group('[RNC HOME] Carregamento da página');
    console.log('Usuário atual:', user);

    const [recordsResult, recordTagsResult, tagsResult] = await Promise.all([
      supabase.rpc('rnc_listar_registros_publico'),
      supabase.from('tb_r_registros').select('id, tags'),
      supabase.from('tb_r_tag').select('id, nome, cor, status').order('nome'),
    ]);

    console.log('1. Resultado da RPC rnc_listar_registros_publico:', recordsResult);
    console.log('2. Resultado direto de tb_r_registros (id, tags):', recordTagsResult);
    console.log('3. Catálogo tb_r_tag:', tagsResult);

    if (recordsResult.error) {
      console.error('[RNC HOME] Erro na RPC pública:', recordsResult.error);
      setError('Não foi possível carregar as ocorrências.');
      setRecords([]);
    } else {
      const tagsByRecord = new Map(
        (recordTagsResult.data || []).map((row) => {
          const normalized = toArray(row.tags);
          debugTags(`tb_r_registros | RNC #${row.id}`, row.tags);
          return [Number(row.id), normalized];
        })
      );

      const normalizedRecords = (recordsResult.data || []).map((item) => {
        console.groupCollapsed(`[RNC HOME][TAGS] Montando RNC #${item.id}`);
        console.log('Registro completo retornado pela RPC:', item);
        console.log('item.tags_detalhes:', item.tags_detalhes);
        console.log('item.tags_info:', item.tags_info);
        console.log('item.tags:', item.tags);

        const rpcCandidates = [item.tags_detalhes, item.tags_info, item.tags];
        const rpcTags = rpcCandidates.map(toArray).find((list) => list.length > 0) || [];
        const tableTags = tagsByRecord.get(Number(item.id)) || [];
        const finalTags = rpcTags.length ? rpcTags : tableTags;

        console.log('Tags normalizadas da RPC:', rpcTags);
        console.log('Tags recuperadas da tabela:', tableTags);
        console.log('Tags finais aplicadas:', finalTags);
        console.groupEnd();

        return { ...item, tags: finalTags };
      });

      console.log('4. Registros finais enviados ao estado:', normalizedRecords);
      setRecords(normalizedRecords);
    }

    if (recordTagsResult.error) {
      console.error(
        '[RNC HOME] A consulta direta às tags falhou. Provável bloqueio de RLS na tb_r_registros:',
        recordTagsResult.error
      );
    }

    if (tagsResult.error) {
      console.error('[RNC HOME] Erro ao carregar tb_r_tag:', tagsResult.error);
      setTagCatalog([]);
    } else {
      setTagCatalog(tagsResult.data || []);
    }

    console.groupEnd();
    setLoading(false);
  };

  useEffect(() => { loadRecords(); }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (zoomImage) setZoomImage(null);
      else setSelected(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [zoomImage]);

  const normalizeTags = (item) => {
    const sources = [item?.tags_detalhes, item?.tags_info, item?.tags];
    const value = sources.map(toArray).find((list) => list.length > 0) || [];

    const result = value
      .map((tag) => {
        const isObject = tag && typeof tag === 'object' && !Array.isArray(tag);
        const rawId = isObject ? (tag.id ?? tag.tag_id ?? tag.tag) : tag;
        const id = Number(rawId);
        if (!Number.isFinite(id)) {
          console.warn(`[RNC HOME][TAGS] ID inválido na RNC #${item?.id}:`, tag);
          return null;
        }

        const catalogTag = tagCatalog.find((catalogItem) => Number(catalogItem.id) === id);
        if (!catalogTag) {
          console.warn(`[RNC HOME][TAGS] Tag ID ${id} não encontrada no catálogo tb_r_tag.`, {
            registroId: item?.id,
            tagRecebida: tag,
            catalogo: tagCatalog,
          });
        }

        return {
          id,
          nome: (isObject && (tag.nome || tag.tag_nome)) || catalogTag?.nome || `Tag #${id}`,
          cor: (isObject && tag.cor) || catalogTag?.cor || '#64748B',
        };
      })
      .filter(Boolean)
      .filter((tag, index, list) => list.findIndex((itemTag) => itemTag.id === tag.id) === index)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

    console.log(`[RNC HOME][TAGS] Resultado visual da RNC #${item?.id}:`, result);
    return result;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return records;
    return records.filter((item) => {
      const tagNames = normalizeTags(item).map((tag) => tag.nome).join(' ');
      return [item.id, item.campo, item.area, item.desc_rnc, item.responsavel, item.data_ocorrencia, tagNames]
        .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term));
    });
  }, [records, search, tagCatalog]);

  const imageUrl = (path) => supabase.storage.from('rnc-imagens').getPublicUrl(path).data.publicUrl;

  const formatDate = (value) => {
    if (!value) return 'Não informada';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  };

  const handleRespond = () => {
    if (!user) { navigate('/rnc/login'); return; }
    navigate(`/rnc/responder/${selected.id}`);
  };

  const renderTags = (item, compact = false) => {
    const tags = normalizeTags(item);
    const visible = compact ? tags.slice(0, 3) : tags;
    const remaining = tags.length - visible.length;

    if (!tags.length) return compact ? <span className="rnc-home__no-tags">Sem tags</span> : null;

    return (
      <div className={`rnc-home__tags${compact ? ' is-compact' : ''}`}>
        {visible.map((tag) => (
          <span key={tag.id} style={{ '--tag-color': tag.cor }}>
            <i />{tag.nome}
          </span>
        ))}
        {remaining > 0 && <span className="rnc-home__tags-more">+{remaining}</span>}
      </div>
    );
  };

  return (
    <div className="rnc-home">
      <RNCHeader onMenuOpen={() => setSidebarOpen(true)} />
      <RNCSideBar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="rnc-home__main">
        <section className="rnc-home__welcome">
          <div><span>Qualidade Agrícola</span><h1>Relatórios de Não Conformidade</h1><p>Consulte as ocorrências registradas e acompanhe cada situação.</p></div>
          {canCreateRNC && <button type="button" className="rnc-home__new" onClick={() => navigate('/rnc/nova')}>+ Nova RNC</button>}
        </section>

        <section className="rnc-home__records">
          <div className="rnc-home__records-head">
            <div><h2>Ocorrências</h2><span>{filtered.length} de {records.length} registros</span></div>
            <div className="rnc-home__records-tools">
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar RNC, campo, área, descrição ou tag..." />
              <button type="button" onClick={loadRecords} disabled={loading}>Atualizar</button>
            </div>
          </div>

          {error && <div className="rnc-home__error">{error}</div>}
          {loading ? <div className="rnc-home__empty">Carregando ocorrências...</div> : filtered.length === 0 ? <div className="rnc-home__empty">Nenhuma ocorrência encontrada.</div> : (
            <div className="rnc-home__record-list">
              {filtered.map((item) => {
                const firstImage = item.imagens?.[0];
                return (
                  <button type="button" className="rnc-home__record" key={item.id} onClick={() => setSelected(item)}>
                    <div className="rnc-home__record-number"><strong>#{item.id}</strong></div>
                    <div className="rnc-home__record-thumb">{firstImage ? <img src={imageUrl(firstImage)} alt="" loading="lazy" /> : <span>Sem foto</span>}</div>
                    <div className="rnc-home__record-content">
                      <div className="rnc-home__record-title"><strong>{item.campo || 'Campo não informado'}</strong><time dateTime={item.data_ocorrencia || undefined}>{formatDate(item.data_ocorrencia)}</time></div>
                      <div className="rnc-home__record-subtitle"><span>{item.area || 'Área não informada'}</span>{item.responsavel && <span>Responsável: {item.responsavel}</span>}</div>
                      <p>{item.desc_rnc}</p>
                      {renderTags(item, true)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {selected && (
        <div className="rnc-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="rnc-modal" role="dialog" aria-modal="true" aria-label={`Detalhes da RNC ${selected.id}`}>
            <div className="rnc-modal__head">
              <div className="rnc-modal__head-number"><strong>#{selected.id}</strong></div>
              <div className="rnc-modal__head-title"><span>Detalhes da ocorrência</span><h2>{selected.campo || 'Não conformidade'}</h2></div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
            </div>
            <div className="rnc-modal__body">
              {normalizeTags(selected).length > 0 && <section className="rnc-modal__tags-section"><b>Tags da ocorrência</b>{renderTags(selected)}</section>}
              <div className="rnc-modal__info">
                <span><b>Área</b>{selected.area || 'Não informada'}</span><span><b>Data da ocorrência</b>{formatDate(selected.data_ocorrencia)}</span>
                <span><b>Responsável</b>{selected.responsavel || 'Não informado'}</span><span><b>Registrado por</b>{selected.usuario_criacao || 'Não informado'}</span>
              </div>
              <div className="rnc-modal__description"><b>Descrição</b><p>{selected.desc_rnc}</p></div>
              <div className="rnc-modal__photos">
                <div className="rnc-modal__section-title"><b>Imagens</b><span>{selected.imagens?.length || 0}/3</span></div>
                {selected.imagens?.length ? <div className="rnc-modal__photo-grid">{selected.imagens.map((path, index) => { const url = imageUrl(path); return <button type="button" key={path} onClick={() => setZoomImage(url)}><img src={url} alt={`RNC ${selected.id}, imagem ${index + 1}`} loading="lazy" /></button>; })}</div> : <div className="rnc-modal__no-photo">Nenhuma imagem anexada.</div>}
              </div>
            </div>
            <div className="rnc-modal__actions">
              {user && <button type="button" onClick={handleRespond}>Responder</button>}
              {canCreateRNC && <button type="button" className="is-primary" onClick={() => navigate(`/rnc/editar/${selected.id}`)}>Editar RNC</button>}
              <button type="button" onClick={() => setSelected(null)}>Fechar</button>
            </div>
          </section>
        </div>
      )}

      {zoomImage && <div className="rnc-lightbox" onClick={() => setZoomImage(null)}><button type="button" onClick={() => setZoomImage(null)}>×</button><img src={zoomImage} alt="Imagem ampliada da RNC" /></div>}
    </div>
  );
};

export default RNCHome;
