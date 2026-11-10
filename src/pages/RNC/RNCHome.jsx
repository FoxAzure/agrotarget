import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useRNCAuth } from '../../lib/RNCAuthContext';
import RNCHeader from '../../components/RNC/RNCHeader';
import RNCSideBar from '../../components/RNC/RNCSideBar';
import './RNCHome.css';

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

    const [recordsResult, recordTagsResult, tagsResult] = await Promise.all([
      supabase.rpc('rnc_listar_registros_publico'),
      supabase.from('tb_r_registros').select('id, tags'),
      supabase.from('tb_r_tag').select('id, nome, cor, status').order('nome'),
    ]);

    if (recordsResult.error) {
      console.error(recordsResult.error);
      setError('Não foi possível carregar as ocorrências.');
      setRecords([]);
    } else {
      const tagsByRecord = new Map(
        (recordTagsResult.data || []).map((item) => [Number(item.id), item.tags || []])
      );

      setRecords((recordsResult.data || []).map((item) => {
        let rpcTags = item.tags;
        
        // Se a RPC não trouxe tags válidas (ou veio string vazia), buscamos da tabela base
        if (!rpcTags || (Array.isArray(rpcTags) && rpcTags.length === 0) || rpcTags === '[]' || rpcTags === '{}') {
          rpcTags = tagsByRecord.get(Number(item.id)) || [];
        }

        return {
          ...item,
          tags: rpcTags,
        };
      }));
    }

    if (recordTagsResult.error) {
      console.warn('Não foi possível complementar os IDs das tags:', recordTagsResult.error);
    }

    if (tagsResult.error) {
      console.warn('Não foi possível carregar o catálogo de tags:', tagsResult.error);
      setTagCatalog([]);
    } else {
      setTagCatalog(tagsResult.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, []);

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
    let value = item?.tags_detalhes ?? item?.tags_info ?? item?.tags;
    
    // Tratamento de blindagem caso o banco mande os arrays em formato de string
    if (typeof value === 'string') {
      if (value.startsWith('{') && value.endsWith('}')) {
        // Trata o formato de array bruto do PostgreSQL ex: "{1,2}"
        value = value.slice(1, -1).split(',').map(s => s.trim());
      } else {
        // Trata string JSON ex: '["2"]'
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = !isNaN(Number(value)) ? [value] : [];
        }
      }
    }

    // Se no fim das contas não for array, transforma num array se tiver algum dado válido
    if (!Array.isArray(value)) {
      if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) {
        value = [value];
      } else {
        return [];
      }
    }

    return value
      .map((tag) => {
        let id, nome, cor;

        // Extrai os dados se vier como objeto da RPC
        if (tag && typeof tag === 'object') {
          id = Number(tag.id || tag.tag);
          nome = tag.nome || tag.tag;
          cor = tag.cor;
        } else {
          // Ou extrai apenas o ID se vier solto
          id = Number(tag);
        }

        if (Number.isNaN(id)) return null;

        // Encontra a tag no catálogo oficial para garantir que o nome e cor venham perfeitos
        const catalogTag = tagCatalog.find((itemTag) => Number(itemTag.id) === id);

        return {
          id,
          nome: nome || catalogTag?.nome || `Tag #${id}`,
          cor: cor || catalogTag?.cor || '#64748B',
        };
      })
      .filter(Boolean) // Tira as sujeiras/nulos
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return records;

    return records.filter((item) => {
      const tagNames = normalizeTags(item).map((tag) => tag.nome).join(' ');
      return [
        item.id,
        item.campo,
        item.area,
        item.desc_rnc,
        item.responsavel,
        item.data_ocorrencia,
        tagNames,
      ].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term));
    });
  }, [records, search, tagCatalog]);

  const imageUrl = (path) =>
    supabase.storage.from('rnc-imagens').getPublicUrl(path).data.publicUrl;

  const formatDate = (value) => {
    if (!value) return 'Não informada';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  };

  const handleRespond = () => {
    if (!user) {
      navigate('/rnc/login');
      return;
    }
    navigate(`/rnc/responder/${selected.id}`);
  };

  const renderTags = (item, compact = false) => {
    const tags = normalizeTags(item);
    const visible = compact ? tags.slice(0, 3) : tags;
    const remaining = tags.length - visible.length;

    if (!tags.length) {
      return compact ? <span className="rnc-home__no-tags">Sem tags</span> : null;
    }

    return (
      <div className={`rnc-home__tags${compact ? ' is-compact' : ''}`}>
        {visible.map((tag) => (
          <span key={tag.id} style={{ '--tag-color': tag.cor }}>
            <i />
            {tag.nome}
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
          <div>
            <span>Qualidade Agrícola</span>
            <h1>Relatórios de Não Conformidade</h1>
            <p>Consulte as ocorrências registradas e acompanhe cada situação.</p>
          </div>

          {canCreateRNC && (
            <button type="button" className="rnc-home__new" onClick={() => navigate('/rnc/nova')}>
              + Nova RNC
            </button>
          )}
        </section>

        <section className="rnc-home__records">
          <div className="rnc-home__records-head">
            <div>
              <h2>Ocorrências</h2>
              <span>{filtered.length} de {records.length} registros</span>
            </div>

            <div className="rnc-home__records-tools">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar RNC, campo, área, descrição ou tag..."
              />
              <button type="button" onClick={loadRecords} disabled={loading}>Atualizar</button>
            </div>
          </div>

          {error && <div className="rnc-home__error">{error}</div>}

          {loading ? (
            <div className="rnc-home__empty">Carregando ocorrências...</div>
          ) : filtered.length === 0 ? (
            <div className="rnc-home__empty">Nenhuma ocorrência encontrada.</div>
          ) : (
            <div className="rnc-home__record-list">
              {filtered.map((item) => {
                const firstImage = item.imagens?.[0];
                return (
                  <button
                    type="button"
                    className="rnc-home__record"
                    key={item.id}
                    onClick={() => setSelected(item)}
                  >
                    <div className="rnc-home__record-number">
                      <strong>#{item.id}</strong>
                    </div>

                    <div className="rnc-home__record-thumb">
                      {firstImage ? (
                        <img src={imageUrl(firstImage)} alt="" loading="lazy" />
                      ) : (
                        <span>Sem foto</span>
                      )}
                    </div>

                    <div className="rnc-home__record-content">
                      <div className="rnc-home__record-title">
                        <strong>{item.campo || 'Campo não informado'}</strong>
                        <time dateTime={item.data_ocorrencia || undefined}>
                          {formatDate(item.data_ocorrencia)}
                        </time>
                      </div>

                      <div className="rnc-home__record-subtitle">
                        <span>{item.area || 'Área não informada'}</span>
                        {item.responsavel && <span>Responsável: {item.responsavel}</span>}
                      </div>

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
        <div
          className="rnc-modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}
        >
          <section className="rnc-modal" role="dialog" aria-modal="true" aria-label={`Detalhes da RNC ${selected.id}`}>
            <div className="rnc-modal__head">
              <div className="rnc-modal__head-number"><strong>#{selected.id}</strong></div>
              <div className="rnc-modal__head-title">
                <span>Detalhes da ocorrência</span>
                <h2>{selected.campo || 'Não conformidade'}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
            </div>

            <div className="rnc-modal__body">
              {normalizeTags(selected).length > 0 && (
                <section className="rnc-modal__tags-section">
                  <b>Tags da ocorrência</b>
                  {renderTags(selected)}
                </section>
              )}

              <div className="rnc-modal__info">
                <span><b>Área</b>{selected.area || 'Não informada'}</span>
                <span><b>Data da ocorrência</b>{formatDate(selected.data_ocorrencia)}</span>
                <span><b>Responsável</b>{selected.responsavel || 'Não informado'}</span>
                <span><b>Registrado por</b>{selected.usuario_criacao || 'Não informado'}</span>
              </div>

              <div className="rnc-modal__description">
                <b>Descrição</b>
                <p>{selected.desc_rnc}</p>
              </div>

              <div className="rnc-modal__photos">
                <div className="rnc-modal__section-title">
                  <b>Imagens</b>
                  <span>{selected.imagens?.length || 0}/3</span>
                </div>

                {selected.imagens?.length ? (
                  <div className="rnc-modal__photo-grid">
                    {selected.imagens.map((path, index) => {
                      const url = imageUrl(path);
                      return (
                        <button type="button" key={path} onClick={() => setZoomImage(url)}>
                          <img src={url} alt={`RNC ${selected.id}, imagem ${index + 1}`} loading="lazy" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rnc-modal__no-photo">Nenhuma imagem anexada.</div>
                )}
              </div>
            </div>

            <div className="rnc-modal__actions">
              {user && <button type="button" onClick={handleRespond}>Responder</button>}
              {canCreateRNC && (
                <button type="button" className="is-primary" onClick={() => navigate(`/rnc/editar/${selected.id}`)}>
                  Editar RNC
                </button>
              )}
              <button type="button" onClick={() => setSelected(null)}>Fechar</button>
            </div>
          </section>
        </div>
      )}

      {zoomImage && (
        <div className="rnc-lightbox" onClick={() => setZoomImage(null)}>
          <button type="button" onClick={() => setZoomImage(null)}>×</button>
          <img src={zoomImage} alt="Imagem ampliada da RNC" />
        </div>
      )}
    </div>
  );
};

export default RNCHome;