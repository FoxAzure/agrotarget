import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useRNCAuth } from '../../../lib/RNCAuthContext';
import RNCHeader from '../../../components/RNC/RNCHeader';
import RNCSideBar from '../../../components/RNC/RNCSideBar';
import './RNCEditar.css';

const MAX_IMAGES = 3;
const MAX_SOURCE_SIZE = 12 * 1024 * 1024;

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
  const scale = Math.min(1, 1600 / image.width, 1200 / image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.72));
  if (!blob) throw new Error('Não foi possível compactar a imagem.');
  return blob;
};

const RNCEditar = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, canCreateRNC } = useRNCAuth();
  const searchTimer = useRef(null);
  const previewRef = useRef([]);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState(null);
  const [originalPaths, setOriginalPaths] = useState([]);
  const [keptPaths, setKeptPaths] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [fieldSearch, setFieldSearch] = useState('');
  const [selectedField, setSelectedField] = useState(null);
  const [fieldOptions, setFieldOptions] = useState([]);
  const [searchingFields, setSearchingFields] = useState(false);
  const [showFieldOptions, setShowFieldOptions] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !canCreateRNC)) navigate('/rnc', { replace: true });
  }, [authLoading, user, canCreateRNC, navigate]);

  useEffect(() => {
    if (!user?.id || !canCreateRNC) return;

    const loadPage = async () => {
      setLoading(true);
      setError('');

      const [recordResult, areasResult] = await Promise.all([
        supabase.rpc('rnc_obter_registro_edicao', {
          p_usuario_id: user.id,
          p_registro_id: Number(id),
        }),
        supabase.rpc('rnc_listar_areas_ativas', {
          p_usuario_id: user.id,
        }),
      ]);

      if (recordResult.error || !recordResult.data?.length) {
        console.error(recordResult.error);
        setError('RNC não encontrada ou acesso não permitido.');
        setLoading(false);
        return;
      }

      if (areasResult.error) console.error(areasResult.error);

      const record = recordResult.data[0];
      const paths = record.imagens || [];
      setForm({
        data_ocorrencia: record.data_ocorrencia || '',
        id_area: record.id_area ? String(record.id_area) : '',
        responsavel: record.responsavel || '',
        desc_rnc: record.desc_rnc || '',
      });
      setSelectedField(record.cod_campo ? { cod_campo: record.cod_campo, campo: record.campo } : null);
      setFieldSearch(record.cod_campo ? `${record.cod_campo} - ${record.campo}` : '');
      setOriginalPaths(paths);
      setKeptPaths(paths);
      setAreas(areasResult.data || []);
      setLoading(false);
    };

    loadPage();
  }, [id, user?.id, canCreateRNC]);

  useEffect(() => () => {
    window.clearTimeout(searchTimer.current);
    previewRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
  }, []);

  useEffect(() => {
    previewRef.current = newImages;
  }, [newImages]);

  const selectedArea = useMemo(
    () => areas.find((item) => String(item.id) === String(form?.id_area)) || null,
    [areas, form?.id_area]
  );

  const totalImages = keptPaths.length + newImages.length;
  const imageUrl = (path) => supabase.storage.from('rnc-imagens').getPublicUrl(path).data.publicUrl;

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
      const { data, error: searchError } = await supabase.rpc('rnc_buscar_campos', {
        p_usuario_id: user.id,
        p_busca: value.trim(),
      });
      if (searchError) console.error(searchError);
      setFieldOptions(searchError ? [] : data || []);
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

    if (totalImages + files.length > MAX_IMAGES) {
      setError('A RNC pode possuir no máximo 3 imagens.');
      return;
    }

    const invalid = files.find((file) => !file.type.startsWith('image/') || file.size > MAX_SOURCE_SIZE);
    if (invalid) {
      setError('Use imagens JPG, PNG ou WebP com até 12 MB cada.');
      return;
    }

    setNewImages((current) => [
      ...current,
      ...files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  };

  const removeNewImage = (index) => {
    setNewImages((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const uploadNewImages = async () => {
    const paths = [];

    for (let index = 0; index < newImages.length; index += 1) {
      const compressed = await compressImage(newImages[index].file);
      if (compressed.size > 1024 * 1024) {
        throw new Error(`A imagem ${index + 1} permaneceu acima de 1 MB após a compactação.`);
      }

      const random = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`;
      const path = `rnc/${id}/${random}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('rnc-imagens')
        .upload(path, compressed, {
          contentType: 'image/webp',
          cacheControl: '31536000',
          upsert: false,
        });

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
      const uploadedPaths = await uploadNewImages();
      const finalPaths = [...keptPaths, ...uploadedPaths];

      const { error: updateError } = await supabase.rpc('rnc_atualizar_registro', {
        p_usuario_id: user.id,
        p_registro_id: Number(id),
        p_cod_campo: selectedField?.cod_campo || null,
        p_campo: selectedField?.campo || null,
        p_data_ocorrencia: form.data_ocorrencia || null,
        p_id_area: form.id_area ? Number(form.id_area) : null,
        p_area: selectedArea?.area || null,
        p_desc_rnc: form.desc_rnc.trim(),
        p_responsavel: form.responsavel.trim() || null,
        p_imagens: finalPaths,
      });

      if (updateError) throw updateError;

      const removedPaths = originalPaths.filter((path) => !keptPaths.includes(path));
      if (removedPaths.length) {
        const { error: removeError } = await supabase.storage.from('rnc-imagens').remove(removedPaths);
        if (removeError) console.error('RNC salva, mas houve erro ao excluir imagens antigas:', removeError);
      }

      navigate('/rnc', { replace: true, state: { message: `RNC #${id} atualizada com sucesso.` } });
    } catch (submitError) {
      console.error(submitError);
      setError(submitError.message || 'Não foi possível atualizar a RNC.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user || !canCreateRNC || loading) {
    return <div className="rnc-editar-loading">Carregando RNC...</div>;
  }

  if (!form) {
    return (
      <div className="rnc-editar-page">
        <RNCHeader onMenuOpen={() => setSidebarOpen(true)} />
        <main className="rnc-editar-error-page">
          <p>{error || 'RNC não encontrada.'}</p>
          <button type="button" onClick={() => navigate('/rnc')}>Voltar</button>
        </main>
      </div>
    );
  }

  return (
    <div className="rnc-editar-page">
      <RNCHeader onMenuOpen={() => setSidebarOpen(true)} />
      <RNCSideBar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="rnc-editar-main">
        <section className="rnc-editar-heading">
          <div>
            <span>Edição</span>
            <h1>Editar RNC #{id}</h1>
            <p>Atualize os dados e gerencie os anexos da ocorrência.</p>
          </div>
          <button type="button" onClick={() => navigate('/rnc')}>Voltar</button>
        </section>

        {error && <div className="rnc-editar-error" role="alert">{error}</div>}

        <form className="rnc-editar-form" onSubmit={handleSubmit}>
          <section className="rnc-editar-panel">
            <div className="rnc-editar-panel__head">
              <strong>Dados da ocorrência</strong>
              <span>RNC #{id}</span>
            </div>

            <div className="rnc-editar-grid">
              <label>
                <span>Data da ocorrência</span>
                <input type="date" name="data_ocorrencia" value={form.data_ocorrencia} onChange={handleChange} />
              </label>

              <label>
                <span>Área</span>
                <select name="id_area" value={form.id_area} onChange={handleChange}>
                  <option value="">Selecione, se aplicável</option>
                  {areas.map((item) => <option key={item.id} value={item.id}>{item.area}</option>)}
                </select>
              </label>

              <label className="rnc-editar-field-search">
                <span>Campo</span>
                <div className="rnc-editar-field-input">
                  <input value={fieldSearch} onChange={(event) => handleFieldSearch(event.target.value)} onFocus={() => setShowFieldOptions(true)} placeholder="Código ou nome do campo" autoComplete="off" />
                  {fieldSearch && <button type="button" onClick={clearField}>×</button>}
                </div>

                {showFieldOptions && fieldSearch.trim() && !selectedField && (
                  <div className="rnc-editar-field-options">
                    {searchingFields ? (
                      <div>Pesquisando...</div>
                    ) : fieldOptions.length ? (
                      fieldOptions.map((item) => (
                        <button type="button" key={item.cod_campo} onClick={() => selectField(item)}>
                          <strong>{item.cod_campo}</strong><span>{item.campo}</span><small>{item.setor}</small>
                        </button>
                      ))
                    ) : <div>Nenhum campo encontrado.</div>}
                  </div>
                )}
              </label>

              <label>
                <span>Responsável</span>
                <input name="responsavel" value={form.responsavel} onChange={handleChange} maxLength={150} />
              </label>
            </div>
          </section>

          <section className="rnc-editar-panel">
            <div className="rnc-editar-panel__head">
              <strong>Descrição</strong>
              <span>Obrigatório</span>
            </div>
            <label className="rnc-editar-description">
              <textarea name="desc_rnc" value={form.desc_rnc} onChange={handleChange} minLength={5} maxLength={2000} required />
              <small>{form.desc_rnc.length}/2000</small>
            </label>
          </section>

          <section className="rnc-editar-panel">
            <div className="rnc-editar-panel__head">
              <strong>Imagens anexadas</strong>
              <span>{totalImages}/3</span>
            </div>

            <div className="rnc-editar-images">
              {totalImages < MAX_IMAGES && (
                <label className="rnc-editar-upload">
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImages} disabled={saving} />
                  <strong>Adicionar imagens</strong>
                  <small>As fotos serão compactadas em WebP.</small>
                </label>
              )}

              {totalImages === 0 ? (
                <div className="rnc-editar-no-images">Nenhuma imagem anexada.</div>
              ) : (
                <div className="rnc-editar-image-grid">
                  {keptPaths.map((path) => (
                    <div className="rnc-editar-image" key={path}>
                      <img src={imageUrl(path)} alt="Imagem atual da RNC" />
                      <button type="button" onClick={() => setKeptPaths((current) => current.filter((item) => item !== path))}>Remover</button>
                    </div>
                  ))}

                  {newImages.map((item, index) => (
                    <div className="rnc-editar-image is-new" key={item.preview}>
                      <img src={item.preview} alt={`Nova imagem ${index + 1}`} />
                      <span>Nova</span>
                      <button type="button" onClick={() => removeNewImage(index)}>Remover</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rnc-editar-actions">
            <button type="button" onClick={() => navigate('/rnc')} disabled={saving}>Cancelar</button>
            <button type="submit" className="is-primary" disabled={saving}>
              {saving ? 'Compactando e salvando...' : 'Salvar alterações'}
            </button>
          </section>
        </form>
      </main>
    </div>
  );
};

export default RNCEditar;
