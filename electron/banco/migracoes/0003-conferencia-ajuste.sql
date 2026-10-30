-- 0003: conferencia do ajuste de estoque pela dona (decisao de 2026-10-30;
-- regra R-ESTOQUE-11 do Memoria.md).
--
-- O ajuste grava na hora, assinado so por quem fez. A dona confere depois: a
-- conferencia e um registro a parte, porque o movimento e fato e nao se edita.
-- Ajuste sem linha aqui esta "aguardando conferencia". Os ajustes de antes
-- desta migration ficam aguardando tambem: ninguem os conferiu.

create table conferencia_ajuste (
  movimento_id text primary key references movimento_estoque (id),
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

-- So ajuste se confere.
create trigger conferencia_so_de_ajuste before insert on conferencia_ajuste
when (select tipo from movimento_estoque where id = new.movimento_id) is not 'ajuste'
begin
  select raise(abort, 'so ajuste se confere');
end;

-- Quem confere e a administradora.
create trigger conferencia_pela_dona before insert on conferencia_ajuste
when (select admin from operador where id = new.operador_id) is not 1
begin
  select raise(abort, 'so a administradora confere');
end;

-- Fato: nao se altera nem se apaga.
create trigger conferencia_ajuste_sem_update before update on conferencia_ajuste
begin
  select raise(abort, 'fato nao se altera: conferencia_ajuste');
end;

create trigger conferencia_ajuste_sem_delete before delete on conferencia_ajuste
begin
  select raise(abort, 'fato nao se apaga: conferencia_ajuste');
end;
