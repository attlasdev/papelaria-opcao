-- 0007: conferencia do estorno de lancamento manual pela dona (decisao de
-- 2026-11-02; regra R-FINANCEIRO-07 do Memoria.md).
--
-- O estorno de lancamento (outro lancamento, de sinal contrario, com
-- `estorno_de`) grava na hora, assinado so por quem estornou. A dona confere
-- depois: um registro a parte, porque o lancamento e fato e nao se edita.
-- Estorno sem linha aqui esta "aguardando a dona". Os de antes desta
-- migration ficam aguardando tambem: ninguem os conferiu.

create table conferencia_lancamento (
  estorno_id text primary key references lancamento (id),
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

-- So o estorno se confere, nao o lancamento comum.
create trigger conferencia_lancamento_so_estorno before insert on conferencia_lancamento
when (select estorno_de from lancamento where id = new.estorno_id) is null
begin
  select raise(abort, 'so estorno de lancamento se confere');
end;

-- Quem confere e a administradora.
create trigger conferencia_lancamento_pela_dona before insert on conferencia_lancamento
when (select admin from operador where id = new.operador_id) is not 1
begin
  select raise(abort, 'so a administradora confere');
end;

-- Fato: nao se altera nem se apaga.
create trigger conferencia_lancamento_sem_update before update on conferencia_lancamento
begin
  select raise(abort, 'fato nao se altera: conferencia_lancamento');
end;

create trigger conferencia_lancamento_sem_delete before delete on conferencia_lancamento
begin
  select raise(abort, 'fato nao se apaga: conferencia_lancamento');
end;
