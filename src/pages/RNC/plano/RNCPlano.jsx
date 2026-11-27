import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useRNCAuth } from '../../../lib/RNCAuthContext';
import RNCHeader from '../../../components/RNC/RNCHeader';
import RNCSideBar from '../../../components/RNC/RNCSideBar';
import './RNCPlano.css';

const initialForm = {
  desc_causa: '',
  desc_acao: '',
  dt_prazo: '',
  responsavel: '',
};

const RNCPlano = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useRNCAuth();
  const rncId = Number(searchParams.get('rnc'));

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [rnc, setRnc] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [zoomImage, setZoomImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const today = useMemo(() => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()), []);

  const imageUrl = (path) => supabase.storage
    .from('rnc-imagens')
    .getPublicUrl(path).data.publicUrl;

  useEffect(() => {
    if (!user) {
      navigate('/rnc/login', { replace: true });
      return;
    }

    if (!Number.isInteger(rncId) || rncId <= 0) {
      setError('A RNC informada na rota é inválida.');
      setBlocked(true);
      setLoading(false);
      return;
    }

    const loadRNC = async () => {
      setLoading(true);
      setError('');
      setBlocked(false);

      const [recordsResult, planResult] = await Promise.all([
        supabase.rpc('rnc_listar_registros_publico'),
        supabase.rpc('rnc_verificar_plano_acao', {
          p_usuario_id: Number(user.id),
          p_rnc_id: rncId,
        }),
      ]);

      if (recordsResult.error) {
        console.error('[RNC PLANO] Erro ao carregar RNC:', recordsResult.error);
        setError('Não foi possível carregar os dados da RNC.');
        setBlocked(true);
        setLoading(false);
        return;
      }

      const selectedRnc = (recordsResult.data || [])
        .find((item) => Number(item.id) === rncId);

      if (!selectedRnc) {
        setError(`A RNC #${rncId} não foi encontrada.`);
        setBlocked(true);
        setLoading(false);
        return;
      }

      if (planResult.error) {
        console.error('[RNC PLANO] Erro ao verificar plano existente:', planResult.error);
      } else if (planResult.data?.[0]?.possui_plano) {
        setError(`A RNC #${rncId} já possui um plano de ação cadastrado.`);
        setBlocked(true);
      }

      setRnc(selectedRnc);
      setForm((current) => ({
        ...current,
        responsavel: selectedRnc.responsavel || '',
      }));
      setLoading(false);
    };

    loadRNC();
  }, [navigate, rncId, user]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && zoomImage) setZoomImage(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [zoomImage]);

  const formatDate = (value) => {
    if (!value) return 'Não informada';
    const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setError('');
  };

  const validate = () => {
    const errors = {};

    if (form.desc_causa.trim().length < 5) {
      errors.desc_causa = 'Informe uma causa com pelo menos 5 caracteres.';
    }

    if (form.desc_acao.trim().length < 5) {
      errors.desc_acao = 'Informe uma ação com pelo menos 5 caracteres.';
    }

    if (!form.dt_prazo) {
      errors.dt_prazo = 'Selecione o prazo do plano.';
    } else if (form.dt_prazo < today) {
      errors.dt_prazo = 'O prazo não pode ser anterior à data atual.';
    }

    if (form.responsavel.trim().length < 2) {
      errors.responsavel = 'Informe o responsável pelo plano.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate() || saving || blocked || !rnc || !user) return;

    setSaving(true);
    setError('');
    setSuccess('');

    const { data: planoId, error: insertError } = await supabase.rpc('rnc_criar_plano_acao', {
      p_usuario_id: Number(user.id),
      p_rnc_id: rncId,
      p_desc_causa: form.desc_causa.trim(),
      p_desc_acao: form.desc_acao.trim(),
      p_dt_prazo: form.dt_prazo,
      p_responsavel: form.responsavel.trim(),
    });

    if (insertError) {
      console.error('[RNC PLANO] Erro ao salvar plano:', insertError);
      setError(insertError.message || 'Não foi possível salvar o plano de ação.');
      setSaving(false);
      return;
    }

    setSuccess(`Plano de ação #${planoId} registrado com sucesso.`);
    setSaving(false);

    window.setTimeout(() => {
      navigate('/rnc', { replace: true });
    }, 1400);
  };

  return (
    <div className="rnc-plan">
      <RNCHeader onMenuOpen={() => setSidebarOpen(true)} />
      <RNCSideBar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="rnc-plan__main">
        <section className="rnc-plan__heading">
          <div>
            <span>RNC · Plano de ação</span>
            <h1>Novo plano de ação</h1>
            <p>Analise a ocorrência e registre a tratativa definida.</p>
          </div>

          <button type="button" className="rnc-plan__back" onClick={() => navigate('/rnc')}>
            Voltar
          </button>
        </section>

        {loading ? (
          <section className="rnc-plan__state">Carregando dados da RNC...</section>
        ) : (
          <div className="rnc-plan__content">
            {error && <div className="rnc-plan__message is-error" role="alert">{error}</div>}
            {success && <div className="rnc-plan__message is-success" role="status">{success}</div>}

            {rnc && (
              <section className="rnc-plan__card rnc-plan__occurrence">
                <div className="rnc-plan__card-head">
                  <div>
                    <span>Ocorrência selecionada</span>
                    <h2>{rnc.campo || 'Campo não informado'}</h2>
                  </div>
                  <strong>#{rnc.id}</strong>
                </div>

                <div className="rnc-plan__info-grid">
                  <div><small>Código do campo</small><strong>{rnc.cod_campo || 'Não informado'}</strong></div>
                  <div><small>Área</small><strong>{rnc.area || 'Não informada'}</strong></div>
                  <div><small>Data da ocorrência</small><strong>{formatDate(rnc.data_ocorrencia)}</strong></div>
                  <div><small>Responsável RNC</small><strong>{rnc.responsavel || 'Não informado'}</strong></div>
                  <div><small>Registrado por</small><strong>{rnc.usuario_criacao || 'Não informado'}</strong></div>
                </div>

                <div className="rnc-plan__description">
                  <small>Descrição da não conformidade</small>
                  <p>{rnc.desc_rnc}</p>
                </div>
              </section>
            )}

            {rnc && (
              <section className="rnc-plan__card rnc-plan__photos">
                <div className="rnc-plan__section-title">
                  <div><span>Evidências</span><h2>Imagens da ocorrência</h2></div>
                  <small>{rnc.imagens?.length || 0}/3</small>
                </div>

                {rnc.imagens?.length ? (
                  <div className="rnc-plan__photo-grid">
                    {rnc.imagens.map((path, index) => {
                      const url = imageUrl(path);
                      return (
                        <button type="button" key={path} onClick={() => setZoomImage(url)}>
                          <img src={url} alt={`RNC ${rnc.id}, imagem ${index + 1}`} loading="lazy" />
                          <span>Ampliar imagem</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rnc-plan__no-photo">Nenhuma imagem anexada à ocorrência.</div>
                )}
              </section>
            )}

            <section className="rnc-plan__card rnc-plan__form-card">
              <div className="rnc-plan__section-title rnc-plan__section-title--form">
                <div><span>Tratativa</span><h2>Dados do plano de ação</h2></div>
                <span className="rnc-plan__status">Andamento</span>
              </div>

              <form className="rnc-plan__form" onSubmit={handleSubmit} noValidate>
                <label className="rnc-plan__field rnc-plan__field--full">
                  <span>Causa identificada <b>*</b></span>
                  <textarea
                    value={form.desc_causa}
                    onChange={(event) => updateField('desc_causa', event.target.value)}
                    placeholder="Descreva a causa que originou a não conformidade..."
                    maxLength={1200}
                    rows={5}
                    disabled={saving || blocked || Boolean(success)}
                  />
                  <small className={fieldErrors.desc_causa ? 'is-error' : ''}>
                    {fieldErrors.desc_causa || `${form.desc_causa.length}/1200 caracteres`}
                  </small>
                </label>

                <label className="rnc-plan__field rnc-plan__field--full">
                  <span>Ação definida <b>*</b></span>
                  <textarea
                    value={form.desc_acao}
                    onChange={(event) => updateField('desc_acao', event.target.value)}
                    placeholder="Descreva a ação que será realizada para tratar a ocorrência..."
                    maxLength={1600}
                    rows={6}
                    disabled={saving || blocked || Boolean(success)}
                  />
                  <small className={fieldErrors.desc_acao ? 'is-error' : ''}>
                    {fieldErrors.desc_acao || `${form.desc_acao.length}/1600 caracteres`}
                  </small>
                </label>

                <label className="rnc-plan__field">
                  <span>Prazo <b>*</b></span>
                  <div className="rnc-plan__date-wrap">
                    <input
                      type="date"
                      value={form.dt_prazo}
                      min={today}
                      onChange={(event) => updateField('dt_prazo', event.target.value)}
                      disabled={saving || blocked || Boolean(success)}
                    />
                  </div>
                  <small className={fieldErrors.dt_prazo ? 'is-error' : ''}>
                    {fieldErrors.dt_prazo || 'Data limite para conclusão da ação.'}
                  </small>
                </label>

                <label className="rnc-plan__field">
                  <span>Responsável pelo plano <b>*</b></span>
                  <input
                    type="text"
                    value={form.responsavel}
                    onChange={(event) => updateField('responsavel', event.target.value)}
                    placeholder="Nome do responsável"
                    maxLength={120}
                    disabled={saving || blocked || Boolean(success)}
                  />
                  <small className={fieldErrors.responsavel ? 'is-error' : ''}>
                    {fieldErrors.responsavel || 'Pessoa responsável por executar e acompanhar a ação.'}
                  </small>
                </label>

                <div className="rnc-plan__audit">
                  <div><small>Registrado no sistema por</small><strong>{user?.nick || 'Usuário não identificado'}</strong></div>
                  <div><small>Status inicial</small><strong>ANDAMENTO</strong></div>
                </div>

                <div className="rnc-plan__actions">
                  <button type="button" className="rnc-plan__cancel" onClick={() => navigate('/rnc')} disabled={saving}>
                    Cancelar
                  </button>
                  <button type="submit" className="rnc-plan__submit" disabled={saving || blocked || Boolean(success) || !rnc}>
                    {saving ? 'Salvando...' : success ? 'Plano salvo' : 'Salvar plano de ação'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>

      {zoomImage && (
        <div className="rnc-plan__lightbox" onClick={() => setZoomImage(null)}>
          <button type="button" onClick={() => setZoomImage(null)} aria-label="Fechar imagem">×</button>
          <img src={zoomImage} alt="Imagem ampliada da RNC" />
        </div>
      )}
    </div>
  );
};

export default RNCPlano;
