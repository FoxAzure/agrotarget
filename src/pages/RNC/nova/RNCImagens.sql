-- =====================================================================================
-- RNC | Imagens, listagem publica e vinculacao ao registro
-- Execute no SQL Editor do Supabase.
-- =====================================================================================

alter table public.tb_r_registros
add column if not exists imagens text[] not null default '{}';

-- Bucket publico. Os arquivos ja chegam compactados em WebP pelo React.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'rnc-imagens',
  'rnc-imagens',
  true,
  1048576,
  array['image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- O login atual do RNC e proprio e nao gera JWT do Supabase Auth.
-- Por isso, nesta versao simples, o upload chega ao Storage como anon.
drop policy if exists "RNC upload de imagens" on storage.objects;
create policy "RNC upload de imagens"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'rnc-imagens'
  and lower(storage.extension(name)) = 'webp'
);

create or replace function public.rnc_salvar_imagens(
  p_usuario_id bigint,
  p_registro_id bigint,
  p_imagens text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rnc_usuario_gerente_ou_admin(p_usuario_id) then
    raise exception 'Acesso permitido somente para gerente ou administrador.';
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

  update public.tb_r_registros
  set imagens = coalesce(p_imagens, '{}')
  where id = p_registro_id;

  return found;
end;
$$;

-- Listagem publica. Nao devolve dados sensiveis de login.
create or replace function public.rnc_listar_registros_publico()
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
  usuario_criacao text,
  imagens text[]
)
language sql
stable
security definer
set search_path = public
as $$
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
    r.usuario_criacao,
    r.imagens
  from public.tb_r_registros r
  order by r.data_criacao desc
  limit 200;
$$;

revoke all on function public.rnc_salvar_imagens(bigint, bigint, text[]) from public;
revoke all on function public.rnc_listar_registros_publico() from public;

grant execute on function public.rnc_salvar_imagens(bigint, bigint, text[]) to anon, authenticated;
grant execute on function public.rnc_listar_registros_publico() to anon, authenticated;
