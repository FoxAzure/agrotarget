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
  const [selected, setSelected] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadRecords = async () => {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('rnc_listar_registros_publico');
    if (loadError) {
      console.error(loadError);
      setError('Não foi possível carregar as ocorrências.');
      setRecords([]);
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        if (zoomImage) setZoomImage(null);
        else setSelected(null);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [zoomImage]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((item) => [item.id, item.cod_campo, item.campo, item.area, item.desc_rnc]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [records, search]);

  const imageUrl = (path) => supabase.storage.from('rnc-imagens').getPublicUrl(path).data.publicUrl;

  const formatDate = (value) => {
    if (!value) return 'Não informada';
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  };

  const handleRespond = () => {
    if (!user) {
      navigate('/rnc/login');
      return;
    }
    navigate(`/rnc/responder/${selected.id}`);
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
            <div><h2>Ocorrências</h2><span>{records.length} registros</span></div>
            <div className="rnc-home__records-tools"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar campo, área ou descrição..." /><button type="button" onClick={loadRecords} disabled={loading}>Atualizar</button></div>
          </div>

          {error && <div className="rnc-home__error">{error}</div>}
          {loading ? <div className="rnc-home__empty">Carregando ocorrências...</div> : filtered.length === 0 ? <div className="rnc-home__empty">Nenhuma ocorrência encontrada.</div> : (
            <div className="rnc-home__record-list">
              {filtered.map((item) => (
                <button type="button" className="rnc-home__record" key={item.id} onClick={() => setSelected(item)}>
                  <div className="rnc-home__record-top"><strong>{item.cod_campo ? `${item.cod_campo} - ${item.campo}` : 'Sem campo informado'}</strong><span>RNC #{item.id}</span></div>
                  <span className="rnc-home__record-area">{item.area || 'Área não informada'}</span>
                  <p>{item.desc_rnc}</p>
                  <small>Ver detalhes →</small>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {selected && (
        <div className="rnc-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="rnc-modal" role="dialog" aria-modal="true" aria-label={`Detalhes da RNC ${selected.id}`}>
            <div className="rnc-modal__head"><div><span>RNC #{selected.id}</span><h2>{selected.cod_campo ? `${selected.cod_campo} - ${selected.campo}` : 'Não conformidade'}</h2></div><button type="button" onClick={() => setSelected(null)}>×</button></div>

            <div className="rnc-modal__body">
              <div className="rnc-modal__info">
                <span><b>Área</b>{selected.area || 'Não informada'}</span>
                <span><b>Data da ocorrência</b>{formatDate(selected.data_ocorrencia)}</span>
                <span><b>Responsável</b>{selected.responsavel || 'Não informado'}</span>
                <span><b>Registrado por</b>{selected.usuario_criacao}</span>
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
