-- =====================================================================================
-- RNC | Consulta e edição de ocorrência, incluindo anexos
-- Execute no SQL Editor do Supabase.
-- =====================================================================================

-- Permite que gerente/admin remova arquivos do bucket durante a edição.
-- Como o login atual não usa Supabase Auth, a operação chega como anon.
drop policy if exists "RNC remover imagens" on storage.objects;
create policy "RNC remover imagens"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'rnc-imagens');

create or replace function public.rnc_obter_registro_edicao(
  p_usuario_id bigint,
  p_registro_id bigint
)
returns table (
  id bigint,
  cod_campo text,
  campo text,
  data_ocorrencia date,
  id_area bigint,
  area text,
  desc_rnc text,
  responsavel text,
  data_criacao timestamptz,
  id_usuario_criacao bigint,
  usuario_criacao text,
  imagens text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rnc_usuario_gerente_ou_admin(p_usuario_id) then
    raise exception 'Acesso permitido somente para gerente ou administrador.';
  end if;

  return query
  select
    r.id,
    r.cod_campo,
    r.campo,
    r.data_ocorrencia,
    r.id_area,
    r.area,
    r.desc_rnc,
    r.responsavel,
    r.data_criacao,
    r.id_usuario_criacao,
    r.usuario_criacao,
    r.imagens
  from public.tb_r_registros r
  where r.id = p_registro_id
  limit 1;
end;
$$;

create or replace function public.rnc_atualizar_registro(
  p_usuario_id bigint,
  p_registro_id bigint,
  p_cod_campo text,
  p_campo text,
  p_data_ocorrencia date,
  p_id_area bigint,
  p_area text,
  p_desc_rnc text,
  p_responsavel text,
  p_imagens text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area text;
  v_campo text;
begin
  if not public.rnc_usuario_gerente_ou_admin(p_usuario_id) then
    raise exception 'Acesso permitido somente para gerente ou administrador.';
  end if;

  if length(trim(coalesce(p_desc_rnc, ''))) < 5 then
    raise exception 'A descricao deve ter pelo menos 5 caracteres.';
  end if;

  if coalesce(array_length(p_imagens, 1), 0) > 3 then
    raise exception 'Cada RNC pode possuir no maximo 3 imagens.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_imagens, '{}')) as caminho
    where caminho not like 'rnc/%'
       or caminho not like '%.webp'
  ) then
    raise exception 'Caminho de imagem invalido.';
  end if;

  if p_id_area is not null then
    select a.area into v_area
    from public.tb_r_areas a
    where a.id = p_id_area;

    if v_area is null then
      raise exception 'Area nao encontrada.';
    end if;
  end if;

  if nullif(trim(coalesce(p_cod_campo, '')), '') is not null then
    select c.descricao::text into v_campo
    from public.tb_q_campos c
    where c.cod_campo::text = trim(p_cod_campo)
    limit 1;

    if v_campo is null then
      raise exception 'Campo informado nao foi encontrado.';
    end if;
  end if;

  update public.tb_r_registros
  set
    cod_campo = nullif(trim(coalesce(p_cod_campo, '')), ''),
    campo = coalesce(v_campo, nullif(trim(coalesce(p_campo, '')), '')),
    data_ocorrencia = p_data_ocorrencia,
    id_area = p_id_area,
    area = v_area,
    desc_rnc = trim(p_desc_rnc),
    responsavel = nullif(trim(coalesce(p_responsavel, '')), ''),
    imagens = coalesce(p_imagens, '{}')
  where id = p_registro_id;

  return found;
end;
$$;

revoke all on function public.rnc_obter_registro_edicao(bigint, bigint) from public;
revoke all on function public.rnc_atualizar_registro(bigint, bigint, text, text, date, bigint, text, text, text, text[]) from public;

grant execute on function public.rnc_obter_registro_edicao(bigint, bigint) to anon, authenticated;
grant execute on function public.rnc_atualizar_registro(bigint, bigint, text, text, date, bigint, text, text, text, text[]) to anon, authenticated;
