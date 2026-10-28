-- 0002: operador com PIN e a administradora (decisao de 2026-10-28; regras
-- R-OPERADOR-01, 03 e 08 do Memoria.md).
--
-- O PIN de 4 digitos vira obrigatorio para quem for cadastrado daqui em
-- diante. Quem ja existia fica sem PIN ate a dona redefinir: a migration nao
-- tem como inventar um. Sem PIN, a pessoa nao assina (o back recusa).

alter table operador add column admin integer not null default 0 check (admin in (0, 1));

-- Uma administradora so: a dona.
create unique index operador_uma_admin on operador (admin) where admin = 1;

-- Formato do hash: scrypt$<sal em hex>$<hash em hex>. O PIN em si nunca entra.
create trigger operador_nasce_com_pin before insert on operador
when new.pin_hash is null or new.pin_hash not glob 'scrypt$*$*'
begin
  select raise(abort, 'operador sem PIN');
end;

create trigger operador_pin_so_se_troca before update of pin_hash on operador
when new.pin_hash is null or new.pin_hash not glob 'scrypt$*$*'
begin
  select raise(abort, 'operador sem PIN');
end;

create trigger operador_admin_sempre_ativa before update of ativo, admin on operador
when old.admin = 1 and (new.ativo = 0 or new.admin = 0)
begin
  select raise(abort, 'a administradora nao pode ser desativada');
end;

create trigger operador_admin_nasce_ativa before insert on operador
when new.admin = 1 and new.ativo = 0
begin
  select raise(abort, 'a administradora nao pode ser desativada');
end;
