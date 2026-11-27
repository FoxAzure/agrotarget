  -- =====================================================================================
  -- RNC | SEGURANCA E FUNCOES DO PLANO DE ACAO
  --
  -- O login atual do RNC e proprio e nao gera JWT do Supabase Auth.
  -- Por isso, o React nao deve inserir diretamente em tb_r_plano_acao.
  -- A inclusao e a consulta serao feitas por funcoes SECURITY DEFINER.
  -- =====================================================================================

  -- Impede mais de um plano de acao para a mesma RNC.
  create unique index if not exists uq_tb_r_plano_acao_id_rnc
  on public.tb_r_plano_acao (id_rnc);


  -- =====================================================================================
  -- VERIFICA SE A RNC JA POSSUI PLANO
  -- =====================================================================================

  create or replace function public.rnc_verificar_plano_acao(
    p_usuario_id bigint,
    p_rnc_id bigint
  )
  returns table (
    possui_plano boolean,
    plano_id bigint
  )
  language plpgsql
  stable
  security definer
  set search_path = public
  as $$
  begin
    if not public.rnc_usuario_ativo(p_usuario_id) then
      raise exception 'Usuario inativo ou nao autorizado.';
    end if;

    if not exists (
      select 1
      from public.tb_r_registros r
      where r.id = p_rnc_id
    ) then
      raise exception 'RNC informada nao foi encontrada.';
    end if;

    return query
    select
      exists (
        select 1
        from public.tb_r_plano_acao p
        where p.id_rnc = p_rnc_id
      ) as possui_plano,
      (
        select p.id
        from public.tb_r_plano_acao p
        where p.id_rnc = p_rnc_id
        order by p.id desc
        limit 1
      ) as plano_id;
  end;
  $$;


  -- =====================================================================================
  -- CRIA UM NOVO PLANO DE ACAO
  -- Permitido para usuario normal, gerente ou administrador ativo.
  -- O status inicial e definido pelo banco como ANDAMENTO.
  -- =====================================================================================

  create or replace function public.rnc_criar_plano_acao(
    p_usuario_id bigint,
    p_rnc_id bigint,
    p_desc_causa text,
    p_desc_acao text,
    p_dt_prazo date,
    p_responsavel text
  )
  returns bigint
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_id bigint;
    v_hoje_brasilia date;
  begin
    if not public.rnc_usuario_ativo(p_usuario_id) then
      raise exception 'Usuario inativo ou nao autorizado.';
    end if;

    if not exists (
      select 1
      from public.tb_r_registros r
      where r.id = p_rnc_id
    ) then
      raise exception 'RNC informada nao foi encontrada.';
    end if;

    if exists (
      select 1
      from public.tb_r_plano_acao p
      where p.id_rnc = p_rnc_id
    ) then
      raise exception 'Esta RNC ja possui um plano de acao.';
    end if;

    if length(trim(coalesce(p_desc_causa, ''))) < 5 then
      raise exception 'A causa deve ter pelo menos 5 caracteres.';
    end if;

    if length(trim(coalesce(p_desc_acao, ''))) < 5 then
      raise exception 'A acao deve ter pelo menos 5 caracteres.';
    end if;

    if length(trim(coalesce(p_responsavel, ''))) < 2 then
      raise exception 'O responsavel deve ter pelo menos 2 caracteres.';
    end if;

    if p_dt_prazo is null then
      raise exception 'O prazo deve ser informado.';
    end if;

    v_hoje_brasilia := (now() at time zone 'America/Sao_Paulo')::date;

    if p_dt_prazo < v_hoje_brasilia then
      raise exception 'O prazo nao pode ser anterior a data atual.';
    end if;

    insert into public.tb_r_plano_acao (
      id_rnc,
      desc_causa,
      desc_acao,
      dt_prazo,
      responsavel,
      id_user,
      status
    )
    values (
      p_rnc_id,
      trim(p_desc_causa),
      trim(p_desc_acao),
      p_dt_prazo,
      trim(p_responsavel),
      p_usuario_id,
      'ANDAMENTO'
    )
    returning id into v_id;

    return v_id;

  exception
    when unique_violation then
      raise exception 'Esta RNC ja possui um plano de acao.';
  end;
  $$;


  -- =====================================================================================
  -- LISTAGEM DOS PLANOS PARA A HOME
  -- Substitui leitura direta da tabela, evitando bloqueio por RLS.
  -- =====================================================================================

  create or replace function public.rnc_listar_planos_publico()
  returns table (
    id bigint,
    id_rnc bigint,
    desc_causa text,
    desc_acao text,
    dt_prazo date,
    responsavel text,
    dt_criacao timestamptz,
    id_user bigint,
    dt_atualizacao timestamptz,
    dt_conclusao timestamptz,
    status text
  )
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select
      p.id,
      p.id_rnc,
      p.desc_causa,
      p.desc_acao,
      p.dt_prazo,
      p.responsavel,
      p.dt_criacao,
      p.id_user,
      p.dt_atualizacao,
      p.dt_conclusao,
      p.status
    from public.tb_r_plano_acao p
    order by p.dt_criacao desc, p.id desc;
  $$;


  -- =====================================================================================
  -- PERMISSOES
  -- =====================================================================================

  revoke all on function public.rnc_verificar_plano_acao(bigint, bigint) from public;
  revoke all on function public.rnc_criar_plano_acao(bigint, bigint, text, text, date, text) from public;
  revoke all on function public.rnc_listar_planos_publico() from public;

  grant execute on function public.rnc_verificar_plano_acao(bigint, bigint) to anon, authenticated;
  grant execute on function public.rnc_criar_plano_acao(bigint, bigint, text, text, date, text) to anon, authenticated;
  grant execute on function public.rnc_listar_planos_publico() to anon, authenticated;


  -- =====================================================================================
  -- RLS
  -- Mantem a tabela fechada para operacoes diretas do React.
  -- As funcoes SECURITY DEFINER fazem somente as operacoes validadas acima.
  -- =====================================================================================

  alter table public.tb_r_plano_acao enable row level security;

  revoke all on table public.tb_r_plano_acao from anon, authenticated;


  -- =====================================================================================
  -- TESTES
  -- Troque os IDs e dados conforme necessario.
  -- =====================================================================================

  -- Verificar se a RNC 1 possui plano:
  -- select * from public.rnc_verificar_plano_acao(1, 1);

  -- Criar plano para a RNC 1:
  -- select public.rnc_criar_plano_acao(
  --   1,
  --   1,
  --   'Causa identificada durante a analise da ocorrencia.',
  --   'Acao corretiva definida para eliminar a causa identificada.',
  --   '2026-12-10',
  --   'Luan'
  -- );

  -- Listar planos:
  -- select * from public.rnc_listar_planos_publico();
