-- =====================================================================================
-- RNC | Funções administrativas para gerenciamento de áreas
-- Pré-requisito: tb_r_areas(id, area, status) e função rnc_admin_valido(bigint)
-- =====================================================================================

create or replace function public.rnc_listar_areas(p_admin_id bigint)
returns table (
  id bigint,
  area text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rnc_admin_valido(p_admin_id) then
    raise exception 'Acesso permitido somente para administrador.';
  end if;

  return query
  select
    a.id,
    a.area,
    a.status
  from public.tb_r_areas a
  order by
    case when a.status = 'ativo' then 0 else 1 end,
    a.area;
end;
$$;

create or replace function public.rnc_criar_area(
  p_admin_id bigint,
  p_area text,
  p_status text default 'ativo'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if not public.rnc_admin_valido(p_admin_id) then
    raise exception 'Acesso permitido somente para administrador.';
  end if;

  if length(trim(p_area)) < 2 then
    raise exception 'A area deve ter pelo menos 2 caracteres.';
  end if;

  if p_status not in ('ativo', 'inativo') then
    raise exception 'Status invalido.';
  end if;

  insert into public.tb_r_areas (area, status)
  values (trim(p_area), p_status)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.rnc_atualizar_area(
  p_admin_id bigint,
  p_id bigint,
  p_area text,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rnc_admin_valido(p_admin_id) then
    raise exception 'Acesso permitido somente para administrador.';
  end if;

  if length(trim(p_area)) < 2 then
    raise exception 'A area deve ter pelo menos 2 caracteres.';
  end if;

  if p_status not in ('ativo', 'inativo') then
    raise exception 'Status invalido.';
  end if;

  update public.tb_r_areas
  set
    area = trim(p_area),
    status = p_status
  where id = p_id;

  return found;
end;
$$;

revoke all on function public.rnc_listar_areas(bigint) from public;
revoke all on function public.rnc_criar_area(bigint, text, text) from public;
revoke all on function public.rnc_atualizar_area(bigint, bigint, text, text) from public;

grant execute on function public.rnc_listar_areas(bigint) to anon, authenticated;
grant execute on function public.rnc_criar_area(bigint, text, text) to anon, authenticated;
grant execute on function public.rnc_atualizar_area(bigint, bigint, text, text) to anon, authenticated;
