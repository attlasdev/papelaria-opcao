-- Piloto 0.1: a base inteira da loja como UM documento.
--
-- Atalho consciente e descartavel (Memoria.md, 2026-10-06): as regras continuam
-- no app, que ja as tem testadas; aqui so se guarda e se protege o documento.
-- A 1.0 troca isto por tabelas de verdade.

create table public.base_loja (
  -- Uma linha so: a loja e uma, e a maquina e uma.
  id text primary key default 'loja' check (id = 'loja'),
  conteudo jsonb not null,
  -- Cada gravacao precisa dizer qual revisao viu por ultimo. Se outra gravacao
  -- entrou no meio, a dela e recusada em vez de apagar a outra em silencio.
  revisao integer not null check (revisao > 0),
  salvo_em timestamptz not null default now()
);

-- Rede de seguranca: o documento e sobrescrito inteiro a cada gravacao, entao um
-- defeito no app (por exemplo, gravar uma base vazia por cima da cheia) apagaria
-- tudo. Cada versao anterior fica guardada aqui; as 200 mais recentes bastam.
create table public.base_loja_anteriores (
  revisao integer primary key,
  conteudo jsonb not null,
  salvo_em timestamptz not null,
  substituido_em timestamptz not null default now()
);

alter table public.base_loja enable row level security;
alter table public.base_loja_anteriores enable row level security;

-- So a loja logada. O cadastro publico fica DESLIGADO no projeto (painel do
-- Supabase): com ele ligado, qualquer um com a chave anon criaria uma conta.
revoke all on public.base_loja, public.base_loja_anteriores from anon;
create policy "loja logada le" on public.base_loja
  for select to authenticated using (true);
create policy "loja logada le anteriores" on public.base_loja_anteriores
  for select to authenticated using (true);
-- Escrita so pela funcao abaixo, que confere a revisao.
revoke insert, update, delete on public.base_loja, public.base_loja_anteriores from authenticated;

create function public.salvar_base(p_conteudo jsonb, p_revisao_esperada integer)
returns table (revisao integer, salvo_em timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual public.base_loja%rowtype;
begin
  if auth.uid() is null then
    raise exception 'sem sessao' using errcode = '42501';
  end if;
  if p_conteudo is null or jsonb_typeof(p_conteudo) <> 'object' then
    raise exception 'conteudo invalido' using errcode = '22023';
  end if;

  select * into v_atual from public.base_loja where id = 'loja' for update;

  if not found then
    if p_revisao_esperada <> 0 then
      raise exception 'conflito de revisao' using errcode = 'P0409';
    end if;
    insert into public.base_loja (conteudo, revisao) values (p_conteudo, 1);
    return query select 1, now();
    return;
  end if;

  if v_atual.revisao <> p_revisao_esperada then
    raise exception 'conflito de revisao' using errcode = 'P0409';
  end if;

  insert into public.base_loja_anteriores (revisao, conteudo, salvo_em)
    values (v_atual.revisao, v_atual.conteudo, v_atual.salvo_em);
  delete from public.base_loja_anteriores
    where base_loja_anteriores.revisao <= v_atual.revisao - 200;

  update public.base_loja
    set conteudo = p_conteudo, revisao = v_atual.revisao + 1, salvo_em = now()
    where id = 'loja';
  return query select v_atual.revisao + 1, now();
end;
$$;

revoke all on function public.salvar_base(jsonb, integer) from public, anon;
grant execute on function public.salvar_base(jsonb, integer) to authenticated;
