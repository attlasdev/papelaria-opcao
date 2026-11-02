-- 0006: conferencia do fechamento de caixa com diferenca pela dona (decisao de
-- 2026-11-02; regra R-CAIXA-10 do Memoria.md).
--
-- O fechamento grava na hora, assinado so por quem fechou, com o motivo da
-- diferenca. Com diferenca, a dona confere depois: um registro a parte, porque
-- o fechamento e fato e nao se edita. Fechamento com diferenca sem linha aqui
-- esta "aguardando a dona"; sem diferenca, nao precisa de visto. Os de antes
-- desta migration ficam aguardando tambem: ninguem os conferiu.

create table conferencia_fechamento (
  fechamento_id text primary key references caixa_fechamento (id),
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

-- So fechamento com diferenca se confere.
create trigger conferencia_fechamento_com_diferenca before insert on conferencia_fechamento
when (select contado = esperado from caixa_fechamento where id = new.fechamento_id) is not 0
begin
  select raise(abort, 'so fechamento com diferenca se confere');
end;

-- Quem confere e a administradora.
create trigger conferencia_fechamento_pela_dona before insert on conferencia_fechamento
when (select admin from operador where id = new.operador_id) is not 1
begin
  select raise(abort, 'so a administradora confere');
end;

-- Fato: nao se altera nem se apaga.
create trigger conferencia_fechamento_sem_update before update on conferencia_fechamento
begin
  select raise(abort, 'fato nao se altera: conferencia_fechamento');
end;

create trigger conferencia_fechamento_sem_delete before delete on conferencia_fechamento
begin
  select raise(abort, 'fato nao se apaga: conferencia_fechamento');
end;
