import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useRNCAuth } from '../../../lib/RNCAuthContext';
import RNCHeader from '../../../components/RNC/RNCHeader';
import RNCSideBar from '../../../components/RNC/RNCSideBar';
import './RNCNova.css';

const MAX_IMAGES = 3;
const MAX_SOURCE_SIZE = 12 * 1024 * 1024;

const todayIso = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const EMPTY_FORM = {
  data_ocorrencia: todayIso(),
  id_area: '',
  responsavel: '',
  desc_rnc: '',
};

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('Imagem inválida.'));
  };
  image.src = url;
});

const compressImage = async (file) => {
  const image = await loadImage(file);
  const maxWidth = 1600;
  const maxHeight = 1200;
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.72));
  if (!blob) throw new Error('Não foi possível compactar a imagem.');
  return blob;
};

const RNCNova = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, canCreateRNC } = useRNCAuth();
  const searchTimer = useRef(null);
  const previewsRef = useRef([]);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldOptions, setFieldOptions] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [searchingFields, setSearchingFields] = useState(false);
  const [showFieldOptions, setShowFieldOptions] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !canCreateRNC)) navigate('/rnc', { replace: true });
  }, [authLoading, user, canCreateRNC, navigate]);

  useEffect(() => {
    if (!user?.id || !canCreateRNC) return;
    const loadAreas = async () => {
      setLoadingAreas(true);
      const { data, error: areasError } = await supabase.rpc('rnc_listar_areas_ativas', { p_usuario_id: user.id });
      if (areasError) {
        console.error(areasError);
        setError('Não foi possível carregar as áreas.');
      } else {
        setAreas(data || []);
      }
      setLoadingAreas(false);
    };
    loadAreas();
  }, [user?.id, canCreateRNC]);

  useEffect(() => () => {
    window.clearTimeout(searchTimer.current);
    previewsRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
  }, []);

  useEffect(() => {
    previewsRef.current = images;
  }, [images]);

  const selectedArea = useMemo(
    () => areas.find((item) => String(item.id) === String(form.id_area)) || null,
    [areas, form.id_area]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleFieldSearch = (value) => {
    setFieldSearch(value);
    setSelectedField(null);
    setShowFieldOptions(true);
    window.clearTimeout(searchTimer.current);

    if (!value.trim()) {
      setFieldOptions([]);
      return;
    }

    searchTimer.current = window.setTimeout(async () => {
      setSearchingFields(true);
      const { data, error: fieldError } = await supabase.rpc('rnc_buscar_campos', {
        p_usuario_id: user.id,
        p_busca: value.trim(),
      });
      setFieldOptions(fieldError ? [] : data || []);
      setSearchingFields(false);
    }, 280);
  };

  const selectField = (item) => {
    setSelectedField(item);
    setFieldSearch(`${item.cod_campo} - ${item.campo}`);
    setFieldOptions([]);
    setShowFieldOptions(false);
  };

  const clearField = () => {
    setSelectedField(null);
    setFieldSearch('');
    setFieldOptions([]);
  };

  const handleImages = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    setError('');

    if (images.length + files.length > MAX_IMAGES) {
      setError('Você pode anexar no máximo 3 imagens por RNC.');
      return;
    }

    const invalid = files.find((file) => !file.type.startsWith('image/') || file.size > MAX_SOURCE_SIZE);
    if (invalid) {
      setError('Use imagens JPG, PNG ou WebP com até 12 MB cada.');
      return;
    }

    const next = files.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setImages((current) => [...current, ...next]);
  };

  const removeImage = (index) => {
    setImages((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const uploadImages = async (registroId) => {
    const paths = [];

    for (let index = 0; index < images.length; index += 1) {
      const compressed = await compressImage(images[index].file);
      if (compressed.size > 1024 * 1024) {
        throw new Error(`A imagem ${index + 1} permaneceu acima de 1 MB após a compactação.`);
      }

      const random = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`;
      const path = `rnc/${registroId}/${random}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('rnc-imagens')
        .upload(path, compressed, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });

      if (uploadError) throw uploadError;
      paths.push(path);
    }

    return paths;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.desc_rnc.trim().length < 5) {
      setError('A descrição deve ter pelo menos 5 caracteres.');
      return;
    }

    setSaving(true);

    try {
      const { data: registroId, error: createError } = await supabase.rpc('rnc_criar_registro', {
        p_usuario_id: user.id,
        p_cod_campo: selectedField?.cod_campo || null,
        p_campo: selectedField?.campo || null,
        p_data_ocorrencia: form.data_ocorrencia || null,
        p_id_area: form.id_area ? Number(form.id_area) : null,
        p_area: selectedArea?.area || null,
        p_desc_rnc: form.desc_rnc.trim(),
        p_responsavel: form.responsavel.trim() || null,
      });

      if (createError) throw createError;

      if (images.length) {
        const paths = await uploadImages(registroId);
        const { error: linkError } = await supabase.rpc('rnc_salvar_imagens', {
          p_usuario_id: user.id,
          p_registro_id: registroId,
          p_imagens: paths,
        });
        if (linkError) throw linkError;
      }

      navigate('/rnc', { replace: true, state: { message: `RNC #${registroId} criada com sucesso.` } });
    } catch (submitError) {
      console.error(submitError);
      setError(submitError.message || 'Não foi possível registrar a RNC.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user || !canCreateRNC) return <div className="rnc-nova-loading">Validando acesso...</div>;

  return (
    <div className="rnc-nova-page">
      <RNCHeader onMenuOpen={() => setSidebarOpen(true)} />
      <RNCSideBar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="rnc-nova-main">
        <section className="rnc-nova-heading">
          <div><span>Nova ocorrência</span><h1>Registrar RNC</h1><p>Preencha os dados conhecidos. Apenas a descrição é obrigatória.</p></div>
          <button type="button" onClick={() => navigate('/rnc')}>Voltar</button>
        </section>

        {error && <div className="rnc-nova-error" role="alert">{error}</div>}

        <form className="rnc-nova-form" onSubmit={handleSubmit}>
          <section className="rnc-nova-panel">
            <div className="rnc-nova-panel__head"><strong>Identificação da ocorrência</strong><span>Dados gerais</span></div>
            <div className="rnc-nova-grid">
              <label><span>Data da ocorrência</span><input type="date" name="data_ocorrencia" value={form.data_ocorrencia} max={todayIso()} onChange={handleChange} /></label>
              <label><span>Área</span><select name="id_area" value={form.id_area} onChange={handleChange} disabled={loadingAreas}><option value="">Selecione, se aplicável</option>{areas.map((item) => <option key={item.id} value={item.id}>{item.area}</option>)}</select></label>

              <label className="rnc-nova-field-search">
                <span>Campo</span>
                <div className="rnc-nova-field-input"><input value={fieldSearch} onChange={(event) => handleFieldSearch(event.target.value)} onFocus={() => setShowFieldOptions(true)} placeholder="Digite o código ou nome do campo" autoComplete="off" />{fieldSearch && <button type="button" onClick={clearField}>×</button>}</div>
                {showFieldOptions && fieldSearch.trim() && <div className="rnc-nova-field-options">{searchingFields ? <div className="rnc-nova-field-empty">Pesquisando...</div> : fieldOptions.length ? fieldOptions.map((item) => <button type="button" key={item.cod_campo} onClick={() => selectField(item)}><strong>{item.cod_campo}</strong><span>{item.campo}</span>{item.setor && <small>{item.setor}</small>}</button>) : <div className="rnc-nova-field-empty">Nenhum campo encontrado.</div>}</div>}
              </label>

              <label><span>Responsável</span><input name="responsavel" value={form.responsavel} onChange={handleChange} maxLength={150} placeholder="Pessoa, equipe ou área responsável" /></label>
            </div>
          </section>

          <section className="rnc-nova-panel">
            <div className="rnc-nova-panel__head"><strong>Descrição da RNC</strong><span>Obrigatório</span></div>
            <label className="rnc-nova-description"><span>Descreva a não conformidade encontrada</span><textarea name="desc_rnc" value={form.desc_rnc} onChange={handleChange} minLength={5} maxLength={2000} required /><small>{form.desc_rnc.length}/2000</small></label>
          </section>

          <section className="rnc-nova-panel">
            <div className="rnc-nova-panel__head"><strong>Imagens</strong><span>Até 3 fotos</span></div>
            <div className="rnc-nova-images">
              <label className="rnc-nova-upload">
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImages} disabled={images.length >= MAX_IMAGES || saving} />
                <strong>Selecionar imagens</strong>
                <small>JPG, PNG ou WebP. O sistema compactará para WebP.</small>
              </label>

              {images.length > 0 && <div className="rnc-nova-image-grid">{images.map((item, index) => <div className="rnc-nova-image" key={item.preview}><img src={item.preview} alt={`Prévia ${index + 1}`} /><button type="button" onClick={() => removeImage(index)}>Remover</button></div>)}</div>}
            </div>
          </section>

          <section className="rnc-nova-review">
            <div><strong>Registro realizado por</strong><span>{user.nick}</span><small>Nível: {user.nivel}</small></div>
            <div className="rnc-nova-actions"><button type="button" onClick={() => navigate('/rnc')} disabled={saving}>Cancelar</button><button type="submit" className="is-primary" disabled={saving}>{saving ? 'Compactando e enviando...' : 'Registrar RNC'}</button></div>
          </section>
        </form>
      </main>
    </div>
  );
};

export default RNCNova;
