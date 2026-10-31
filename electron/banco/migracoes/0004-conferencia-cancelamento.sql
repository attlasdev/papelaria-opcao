-- 0004: conferencia do cancelamento de ficha pela dona (decisao de 2026-10-31;
-- regra R-FICHA-02 do Memoria.md).
--
-- O cancelamento grava na hora, assinado so por quem cancelou. A dona confere
-- depois: a conferencia e um registro a parte, porque o cancelamento e fato e
-- nao se edita. Cancelamento sem linha aqui esta "aguardando a dona". Os de
-- antes desta migration ficam aguardando tambem: ninguem os conferiu.

create table conferencia_cancelamento (
  cancelamento_id text primary key references ficha_cancelamento (id),
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

-- Quem confere e a administradora.
create trigger conferencia_cancelamento_pela_dona before insert on conferencia_cancelamento
when (select admin from operador where id = new.operador_id) is not 1
begin
  select raise(abort, 'so a administradora confere');
end;

-- Fato: nao se altera nem se apaga.
create trigger conferencia_cancelamento_sem_update before update on conferencia_cancelamento
begin
  select raise(abort, 'fato nao se altera: conferencia_cancelamento');
end;

create trigger conferencia_cancelamento_sem_delete before delete on conferencia_cancelamento
begin
  select raise(abort, 'fato nao se apaga: conferencia_cancelamento');
end;
