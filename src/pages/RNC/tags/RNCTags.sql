-- =====================================================================================
-- RNC | Funcoes administrativas para gerenciamento de tags
-- Pre-requisito: tb_r_tag(id, nome, cor, status) e funcao rnc_admin_valido(bigint)
-- =====================================================================================

create or replace function public.rnc_listar_tags(p_admin_id bigint)
returns table (
  id bigint,
  nome text,
  cor text,
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
    t.id,
    t.nome,
    t.cor,
    t.status
  from public.tb_r_tag t
  order by
    case when t.status = 'ativo' then 0 else 1 end,
    t.nome;
end;
$$;

create or replace function public.rnc_criar_tag(
  p_admin_id bigint,
  p_nome text,
  p_cor text default '#64748B',
  p_status text default 'ativo'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_cor text;
begin
  if not public.rnc_admin_valido(p_admin_id) then
    raise exception 'Acesso permitido somente para administrador.';
  end if;

  if length(trim(coalesce(p_nome, ''))) < 2 then
    raise exception 'A tag deve ter pelo menos 2 caracteres.';
  end if;

  if p_status not in ('ativo', 'inativo') then
    raise exception 'Status invalido.';
  end if;

  v_cor := upper(trim(coalesce(nullif(p_cor, ''), '#64748B')));

  if v_cor !~ '^#[0-9A-F]{6}$' then
    raise exception 'Cor invalida. Use o formato hexadecimal #RRGGBB.';
  end if;

  insert into public.tb_r_tag (nome, cor, status)
  values (trim(p_nome), v_cor, p_status)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.rnc_atualizar_tag(
  p_admin_id bigint,
  p_id bigint,
  p_nome text,
  p_cor text,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cor text;
begin
  if not public.rnc_admin_valido(p_admin_id) then
    raise exception 'Acesso permitido somente para administrador.';
  end if;

  if length(trim(coalesce(p_nome, ''))) < 2 then
    raise exception 'A tag deve ter pelo menos 2 caracteres.';
  end if;

  if p_status not in ('ativo', 'inativo') then
    raise exception 'Status invalido.';
  end if;

  v_cor := upper(trim(coalesce(nullif(p_cor, ''), '#64748B')));

  if v_cor !~ '^#[0-9A-F]{6}$' then
    raise exception 'Cor invalida. Use o formato hexadecimal #RRGGBB.';
  end if;

  update public.tb_r_tag
  set
    nome = trim(p_nome),
    cor = v_cor,
    status = p_status
  where id = p_id;

  return found;
end;
$$;

revoke all on function public.rnc_listar_tags(bigint) from public;
revoke all on function public.rnc_criar_tag(bigint, text, text, text) from public;
revoke all on function public.rnc_atualizar_tag(bigint, bigint, text, text, text) from public;

grant execute on function public.rnc_listar_tags(bigint) to anon, authenticated;
grant execute on function public.rnc_criar_tag(bigint, text, text, text) to anon, authenticated;
grant execute on function public.rnc_atualizar_tag(bigint, bigint, text, text, text) to anon, authenticated;
