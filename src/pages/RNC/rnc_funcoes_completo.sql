-- =====================================================================================
-- RNC | Funcoes para campos, areas, criacao e listagem de ocorrencias
-- Corrigido para retornar IMAGENS (text[]) e TAGS (bigint[])
-- =====================================================================================

-- =====================================================================================
-- 1. AJUSTES DA TABELA
-- =====================================================================================

alter table public.tb_r_registros
  alter column data_ocorrencia drop not null;

alter table public.tb_r_registros
  alter column id_area drop not null;

alter table public.tb_r_registros
  alter column area drop not null;

alter table public.tb_r_registros
  alter column responsavel drop not null;


-- =====================================================================================
-- 2. VALIDACAO: USUARIO GERENTE OU ADMIN
-- =====================================================================================

create or replace function public.rnc_usuario_gerente_ou_admin(
  p_usuario_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tb_r_user u
    where u.id = p_usuario_id
      and u.ativo = true
      and u.nivel in ('gerente', 'admin')
  );
$$;


-- =====================================================================================
-- 3. VALIDACAO: USUARIO ATIVO
-- =====================================================================================

create or replace function public.rnc_usuario_ativo(
  p_usuario_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tb_r_user u
    where u.id = p_usuario_id
      and u.ativo = true
      and u.nivel in ('normal', 'gerente', 'admin')
  );
$$;


-- =====================================================================================
-- 4. LISTAR AREAS ATIVAS
-- =====================================================================================

create or replace function public.rnc_listar_areas_ativas(
  p_usuario_id bigint
)
returns table (
  id bigint,
  area text
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
    a.id,
    a.area::text
  from public.tb_r_areas a
  where a.status = 'ativo'
  order by a.area;
end;
$$;


-- =====================================================================================
-- 5. BUSCAR CAMPOS
-- =====================================================================================

create or replace function public.rnc_buscar_campos(
  p_usuario_id bigint,
  p_busca text
)
returns table (
  cod_campo text,
  campo text,
  setor text
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
    c.cod_campo::text,
    c.descricao::text,
    c.setor::text
  from public.tb_q_campos c
  where trim(coalesce(p_busca, '')) <> ''
    and (
      c.cod_campo::text ilike '%' || trim(p_busca) || '%'
      or c.descricao::text ilike '%' || trim(p_busca) || '%'
    )
  order by
    case
      when c.cod_campo::text = trim(p_busca) then 0
      else 1
    end,
    c.cod_campo::text
  limit 12;
end;
$$;


-- =====================================================================================
-- 6. CRIAR NOVA RNC
-- =====================================================================================

create or replace function public.rnc_criar_registro(
  p_usuario_id bigint,
  p_cod_campo text,
  p_campo text,
  p_data_ocorrencia date,
  p_id_area bigint,
  p_area text,
  p_desc_rnc text,
  p_responsavel text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_usuario text;
  v_area text;
  v_campo text;
begin
  if not public.rnc_usuario_gerente_ou_admin(p_usuario_id) then
    raise exception 'Acesso permitido somente para gerente ou administrador.';
  end if;

  if length(trim(coalesce(p_desc_rnc, ''))) < 5 then
    raise exception 'A descricao deve ter pelo menos 5 caracteres.';
  end if;

  select u.nick::text
    into v_usuario
  from public.tb_r_user u
  where u.id = p_usuario_id
    and u.ativo = true;

  if v_usuario is null then
    raise exception 'Usuario invalido ou inativo.';
  end if;

  if p_id_area is not null then
    select a.area::text
      into v_area
    from public.tb_r_areas a
    where a.id = p_id_area
      and a.status = 'ativo';

    if v_area is null then
      raise exception 'Area invalida ou inativa.';
    end if;
  end if;

  if nullif(trim(p_cod_campo), '') is not null then
    select c.descricao::text
      into v_campo
    from public.tb_q_campos c
    where c.cod_campo::text = trim(p_cod_campo)
    limit 1;

    if v_campo is null then
      raise exception 'Campo informado nao foi encontrado.';
    end if;
  end if;

  insert into public.tb_r_registros (
    cod_campo,
    campo,
    data_ocorrencia,
    id_area,
    area,
    desc_rnc,
    responsavel,
    id_usuario_criacao,
    usuario_criacao
  )
  values (
    nullif(trim(p_cod_campo), ''),
    coalesce(v_campo, nullif(trim(p_campo), '')),
    p_data_ocorrencia,
    p_id_area,
    v_area,
    trim(p_desc_rnc),
    nullif(trim(p_responsavel), ''),
    p_usuario_id,
    v_usuario
  )
  returning id into v_id;

  return v_id;
end;
$$;


-- =====================================================================================
-- 7. REMOVER AS FUNCOES DE LISTAGEM ANTIGAS
-- Necessario porque o tipo de retorno agora inclui imagens e tags.
-- =====================================================================================

drop function if exists public.rnc_listar_registros(bigint);
drop function if exists public.rnc_listar_registros_publico();


-- =====================================================================================
-- 8. LISTAGEM PARA USUARIOS LOGADOS
-- =====================================================================================

create function public.rnc_listar_registros(
  p_usuario_id bigint
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
  imagens text[],
  tags bigint[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rnc_usuario_ativo(p_usuario_id) then
    raise exception 'Usuario inativo ou nao autorizado.';
  end if;

  return query
  select
    r.id,
    r.cod_campo::text,
    r.campo::text,
    r.data_ocorrencia,
    r.id_area,
    r.area::text,
    r.desc_rnc::text,
    r.responsavel::text,
    r.data_criacao,
    r.id_usuario_criacao,
    r.usuario_criacao::text,
    coalesce(r.imagens, array[]::text[]) as imagens,
    coalesce(r.tags, array[]::bigint[]) as tags
  from public.tb_r_registros r
  order by
    r.data_criacao desc,
    r.id desc
  limit 100;
end;
$$;


-- =====================================================================================
-- 9. LISTAGEM PUBLICA USADA PELA RNCHome.jsx
-- Chamada no React: supabase.rpc('rnc_listar_registros_publico')
-- =====================================================================================

create function public.rnc_listar_registros_publico()
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
  imagens text[],
  tags bigint[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.cod_campo::text,
    r.campo::text,
    r.data_ocorrencia,
    r.id_area,
    r.area::text,
    r.desc_rnc::text,
    r.responsavel::text,
    r.data_criacao,
    r.id_usuario_criacao,
    r.usuario_criacao::text,
    coalesce(r.imagens, array[]::text[]) as imagens,
    coalesce(r.tags, array[]::bigint[]) as tags
  from public.tb_r_registros r
  order by
    r.data_criacao desc,
    r.id desc
  limit 100;
$$;


-- =====================================================================================
-- 10. PERMISSOES
-- =====================================================================================

revoke all on function public.rnc_usuario_gerente_ou_admin(bigint) from public;
revoke all on function public.rnc_usuario_ativo(bigint) from public;
revoke all on function public.rnc_listar_areas_ativas(bigint) from public;
revoke all on function public.rnc_buscar_campos(bigint, text) from public;
revoke all on function public.rnc_criar_registro(
  bigint,
  text,
  text,
  date,
  bigint,
  text,
  text,
  text
) from public;
revoke all on function public.rnc_listar_registros(bigint) from public;
revoke all on function public.rnc_listar_registros_publico() from public;

grant execute on function public.rnc_usuario_gerente_ou_admin(bigint)
  to anon, authenticated;

grant execute on function public.rnc_usuario_ativo(bigint)
  to anon, authenticated;

grant execute on function public.rnc_listar_areas_ativas(bigint)
  to anon, authenticated;

grant execute on function public.rnc_buscar_campos(bigint, text)
  to anon, authenticated;

grant execute on function public.rnc_criar_registro(
  bigint,
  text,
  text,
  date,
  bigint,
  text,
  text,
  text
) to anon, authenticated;

grant execute on function public.rnc_listar_registros(bigint)
  to anon, authenticated;

grant execute on function public.rnc_listar_registros_publico()
  to anon, authenticated;


-- =====================================================================================
-- 11. TESTES
-- =====================================================================================

select *
from public.rnc_listar_registros_publico();

select
  id,
  campo,
  imagens,
  tags
from public.rnc_listar_registros_publico()
where id = 1;
