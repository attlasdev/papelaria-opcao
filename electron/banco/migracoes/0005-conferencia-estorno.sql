-- 0005: conferencia do estorno de recebimento pela dona (decisao de 2026-11-02;
-- regra R-CORRECAO-03 do Memoria.md).
--
-- O estorno grava na hora, assinado so por quem estornou, e desfaz o
-- recebimento inteiro (uma linha de pagamento_estorno por pagamento). A dona
-- confere depois, uma linha aqui por estorno: o estorno e fato e nao se edita.
-- Estorno sem linha aqui esta "aguardando a dona". Os de antes desta
-- migration ficam aguardando tambem: ninguem os conferiu.

create table conferencia_estorno (
  estorno_id text primary key references pagamento_estorno (id),
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

-- Quem confere e a administradora.
create trigger conferencia_estorno_pela_dona before insert on conferencia_estorno
when (select admin from operador where id = new.operador_id) is not 1
begin
  select raise(abort, 'so a administradora confere');
end;

-- Fato: nao se altera nem se apaga.
create trigger conferencia_estorno_sem_update before update on conferencia_estorno
begin
  select raise(abort, 'fato nao se altera: conferencia_estorno');
end;

create trigger conferencia_estorno_sem_delete before delete on conferencia_estorno
begin
  select raise(abort, 'fato nao se apaga: conferencia_estorno');
end;
