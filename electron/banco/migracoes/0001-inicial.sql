-- 0001: schema inicial da 1.0. O desenho e o porque de cada tabela estao em
-- docs/contrato/schema-1.0.md; aqui so o que nao da para ler da propria coluna.
--
-- Cadastro se edita; fato so se insere. Os gatilhos "*_sem_update" e
-- "*_sem_delete" recusam a correcao por edicao: corrigir um fato e inserir
-- outro (cancelamento, estorno, ajuste, evento).
--
-- Formatos: instante = ISO 8601 UTC ('2026-10-27T14:03:00.000Z');
-- dia = 'AAAA-MM-DD' no fuso de Sao Paulo. Dinheiro em centavos.

-- Operador e maquina ---------------------------------------------------------

create table operador (
  id text primary key,
  nome text not null collate nocase unique check (length(trim(nome)) > 0),
  ativo integer not null default 1 check (ativo in (0, 1)),
  pin_hash text,
  criado_em text not null check (criado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

-- Estado de tela, em JSON de proposito: nao ha consulta sobre ele.
create table preferencia (
  chave text primary key check (chave in ('operador_atual', 'rascunho_ficha', 'avisos_lidos')),
  valor text not null check (json_valid(valor))
) strict;

create table sequencia (
  serie text primary key check (serie in ('ficha', 'cliente', 'produto', 'boleto')),
  ultimo integer not null default 0 check (ultimo >= 0)
) strict;

insert into sequencia (serie) values ('ficha'), ('cliente'), ('produto'), ('boleto');

-- Estoque --------------------------------------------------------------------

create table produto (
  id text primary key,
  numero integer not null unique check (numero > 0),
  codigo_barras text unique check (codigo_barras is null or length(codigo_barras) > 0),
  descricao text not null check (length(trim(descricao)) > 0),
  categoria text not null,
  unidade text not null check (unidade in ('un', 'pct', 'cx')),
  preco integer not null check (preco >= 0),
  custo integer check (custo is null or custo >= 0),
  saldo integer not null default 0 check (saldo >= 0),
  minimo integer not null default 0 check (minimo >= 0),
  marca text,
  caracteristicas text,
  descricao_adicional text,
  localizacao text,
  embalagem text check (embalagem is null or embalagem in ('cx', 'pct')),
  pacotes_por_caixa integer check (pacotes_por_caixa is null or pacotes_por_caixa > 0),
  unidades_por_pacote integer check (unidades_por_pacote is null or unidades_por_pacote > 0),
  ncm text check (ncm is null or (length(ncm) = 8 and ncm not glob '*[^0-9]*')),
  cest text check (cest is null or (length(cest) = 7 and cest not glob '*[^0-9]*')),
  ativo integer not null default 1 check (ativo in (0, 1)),
  emitte_enviado_em text check (emitte_enviado_em is null or emitte_enviado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  criado_em text not null check (criado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

create table entrada_mercadoria (
  id text primary key,
  recebida_em text not null check (recebida_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  fornecedor text,
  referencia text,
  observacoes text,
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

create table movimento_estoque (
  id text primary key,
  produto_id text not null references produto (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'ajuste', 'venda', 'cancelamento')),
  quantidade integer not null check (quantidade <> 0),
  saldo_antes integer not null check (saldo_antes >= 0),
  saldo_depois integer not null check (saldo_depois >= 0),
  motivo text,
  custo_unitario integer check (custo_unitario is null or custo_unitario >= 0),
  entrada_id text references entrada_mercadoria (id),
  ficha_id text references ficha (id),
  operador_id text not null references operador (id),
  autorizado_por_id text references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  check (saldo_depois = saldo_antes + quantidade),
  check (case tipo when 'venda' then quantidade < 0 when 'ajuste' then 1 else quantidade > 0 end),
  check (tipo <> 'ajuste' or length(trim(coalesce(motivo, ''))) > 0),
  check ((tipo in ('venda', 'cancelamento')) = (ficha_id is not null)),
  check (tipo = 'entrada' or (entrada_id is null and custo_unitario is null))
) strict;

create index movimento_estoque_produto on movimento_estoque (produto_id);
create index movimento_estoque_ficha on movimento_estoque (ficha_id);

-- O saldo do produto e mantido pelo banco (P4): o codigo so insere movimentos.
-- O ultimo movimento de um produto e o de maior rowid.

create trigger produto_nasce_sem_saldo before insert on produto
when new.saldo <> 0
begin
  select raise(abort, 'produto nasce com saldo 0; o saldo inicial e um movimento');
end;

create trigger movimento_estoque_saldo_antes before insert on movimento_estoque
when new.saldo_antes is not (select saldo from produto where id = new.produto_id)
begin
  select raise(abort, 'saldo_antes difere do saldo atual do produto');
end;

create trigger movimento_estoque_atualiza_saldo after insert on movimento_estoque
begin
  update produto set saldo = new.saldo_depois where id = new.produto_id;
end;

create trigger produto_saldo_so_por_movimento before update of saldo on produto
when new.saldo is not old.saldo
  and new.saldo is not (select saldo_depois from movimento_estoque
                        where produto_id = new.id order by rowid desc limit 1)
begin
  select raise(abort, 'saldo do produto so muda por movimento_estoque');
end;

create trigger movimento_estoque_sem_update before update on movimento_estoque
begin
  select raise(abort, 'fato nao se altera: movimento_estoque');
end;

-- Produto sem historico (so o saldo inicial) sai de verdade, levando o
-- movimento pelo "on delete cascade". Qualquer outro delete e recusado.
create trigger movimento_estoque_sem_delete before delete on movimento_estoque
when exists (select 1 from produto where id = old.produto_id)
  or old.tipo <> 'entrada'
  or old.entrada_id is not null
  or (select count(*) from movimento_estoque where produto_id = old.produto_id) > 1
begin
  select raise(abort, 'fato nao se apaga: movimento_estoque (produto com historico)');
end;

-- Clientes -------------------------------------------------------------------

create table cliente (
  id text primary key,
  numero integer not null unique check (numero > 0),
  nome text not null check (length(trim(nome)) > 0),
  documento text unique check (documento is null or (length(documento) in (11, 14) and documento not glob '*[^0-9]*')),
  telefone text check (telefone is null or (length(telefone) > 0 and telefone not glob '*[^0-9]*')),
  logradouro text,
  numero_endereco text,
  complemento text,
  bairro text,
  cidade text,
  uf text check (uf is null or (length(uf) = 2 and uf = upper(uf))),
  cep text check (cep is null or (length(cep) = 8 and cep not glob '*[^0-9]*')),
  tipo_contribuinte text check (tipo_contribuinte is null or tipo_contribuinte in ('nao-contribuinte', 'contribuinte', 'isento')),
  tipo_cliente text check (tipo_cliente is null or tipo_cliente in ('consumidor', 'revenda')),
  inscricao_estadual text,
  emitte_enviado_em text check (emitte_enviado_em is null or emitte_enviado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  criado_em text not null check (criado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

-- Venda ----------------------------------------------------------------------

create table ficha (
  id text primary key,
  numero integer not null unique check (numero > 0),
  cliente_id text references cliente (id),
  forma text not null check (forma in ('dinheiro', 'pix', 'cartao', 'misto', 'notinha')),
  subtotal integer not null check (subtotal >= 0),
  desconto integer not null default 0 check (desconto >= 0 and desconto <= subtotal),
  total integer not null,
  vencimento text check (vencimento is null or vencimento glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  dia text not null check (dia glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  check (total = subtotal - desconto),
  check ((forma = 'notinha') = (vencimento is not null)),
  check (vencimento is null or vencimento >= dia),
  check (forma <> 'notinha' or cliente_id is not null)
) strict;

create index ficha_cliente on ficha (cliente_id);
create index ficha_dia on ficha (dia);

create table ficha_item (
  id text primary key,
  ficha_id text not null references ficha (id),
  produto_id text not null references produto (id),
  descricao text not null,
  quantidade integer not null check (quantidade >= 1),
  preco integer not null check (preco >= 0),
  unique (ficha_id, produto_id)
) strict;

create index ficha_item_produto on ficha_item (produto_id);

create table ficha_servico (
  id text primary key,
  ficha_id text not null references ficha (id),
  nome text not null check (length(trim(nome)) > 0),
  valor integer not null check (valor >= 0),
  perdas integer check (perdas is null or perdas >= 1),
  observacao text
) strict;

create index ficha_servico_ficha on ficha_servico (ficha_id);

create table ficha_anotacao (
  id text primary key,
  ficha_id text not null references ficha (id),
  texto text not null check (length(trim(texto)) > 0),
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

create index ficha_anotacao_ficha on ficha_anotacao (ficha_id);

-- Caixa (a gaveta); antes do dinheiro, que aponta para ele -------------------

create table caixa (
  id text primary key,
  dinheiro_abertura integer not null check (dinheiro_abertura >= 0),
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

create table caixa_fechamento (
  id text primary key,
  caixa_id text not null unique references caixa (id),
  esperado integer not null,
  contado integer not null check (contado >= 0),
  justificativa text,
  operador_id text not null references operador (id),
  autorizado_por_id text references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  check (contado = esperado or length(trim(coalesce(justificativa, ''))) > 0)
) strict;

create trigger caixa_um_aberto before insert on caixa
when exists (select 1 from caixa c
             where not exists (select 1 from caixa_fechamento f where f.caixa_id = c.id))
begin
  select raise(abort, 'ja existe um caixa aberto');
end;

create table movimento_gaveta (
  id text primary key,
  caixa_id text not null references caixa (id),
  tipo text not null check (tipo in ('adicao', 'retirada')),
  valor integer not null check (valor > 0),
  motivo text not null check (length(trim(motivo)) > 0),
  estorno_de text unique references movimento_gaveta (id),
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

create index movimento_gaveta_caixa on movimento_gaveta (caixa_id);

create trigger movimento_gaveta_estorno before insert on movimento_gaveta
when new.estorno_de is not null
  and not exists (select 1 from movimento_gaveta o
                  where o.id = new.estorno_de and o.estorno_de is null
                    and o.tipo <> new.tipo and o.valor = new.valor)
begin
  select raise(abort, 'estorno da gaveta tem que inverter o movimento original');
end;

-- Cancelamento da ficha ------------------------------------------------------

-- Cancelar insere esta linha e um movimento_estoque de cancelamento por item.
create table ficha_cancelamento (
  id text primary key,
  ficha_id text not null unique references ficha (id),
  motivo text not null check (length(trim(motivo)) > 0),
  dia text not null check (dia glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  caixa_id text references caixa (id),
  operador_id text not null references operador (id),
  autorizado_por_id text references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

-- Dinheiro que entra pela ficha ----------------------------------------------

create table recebimento (
  id text primary key,
  cliente_id text not null references cliente (id),
  dia text not null check (dia glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

-- Estado espelhado do Mercado Pago, registrado antes de cobrar (A4). Unica
-- tabela de fato que recebe update; delete, nunca.
create table cobranca (
  id text primary key,
  externo_id text unique,
  meio text not null check (meio in ('credito', 'debito', 'pix')),
  valor integer not null check (valor > 0),
  situacao text not null check (situacao in ('enviando', 'na-maquininha', 'aprovada', 'recusada', 'cancelada', 'expirada')),
  bandeira text,
  motivo text,
  demonstracao integer not null default 0 check (demonstracao in (0, 1)),
  criada_em text not null check (criada_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  atualizada_em text not null check (atualizada_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

-- Muda so a situacao (e o que vem com ela); aprovada nao volta atras.
create trigger cobranca_update before update on cobranca
when new.id is not old.id or new.meio is not old.meio or new.valor is not old.valor
  or new.demonstracao is not old.demonstracao or new.criada_em is not old.criada_em
  or (old.situacao = 'aprovada' and new.situacao <> 'aprovada')
begin
  select raise(abort, 'cobranca so muda de situacao, e aprovada nao volta');
end;

create table pagamento (
  id text primary key,
  ficha_id text not null references ficha (id),
  recebimento_id text references recebimento (id),
  tipo text not null check (tipo in ('venda', 'entrada', 'recebimento')),
  meio text not null check (meio in ('dinheiro', 'pix', 'cartao')),
  valor integer not null check (valor > 0),
  recebido integer,
  troco integer,
  maquininha text check (maquininha is null or maquininha in ('mercado-pago', 'sicoob')),
  cartao text check (cartao is null or cartao in ('credito', 'debito')),
  rotulo text,
  cobranca_id text unique references cobranca (id),
  dia text not null check (dia glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  caixa_id text references caixa (id),
  operador_id text not null references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  check ((tipo = 'recebimento') = (recebimento_id is not null)),
  check ((recebido is null) = (troco is null)),
  check (recebido is null or (meio = 'dinheiro' and troco >= 0 and recebido = valor + troco)),
  check (meio <> 'dinheiro' or (maquininha is null and cobranca_id is null)),
  check (meio = 'cartao' or cartao is null)
) strict;

create index pagamento_ficha on pagamento (ficha_id);
create index pagamento_dia on pagamento (dia);
create index pagamento_caixa on pagamento (caixa_id);

-- A mesma cobranca aprovada vira no maximo uma venda (unique acima), e so
-- cobranca aprovada vira pagamento.
create trigger pagamento_cobranca_aprovada before insert on pagamento
when new.cobranca_id is not null
  and (select situacao from cobranca where id = new.cobranca_id) is not 'aprovada'
begin
  select raise(abort, 'pagamento pela maquininha exige cobranca aprovada');
end;

-- Recebimento de notinha lancado por engano; a notinha volta a dever.
create table pagamento_estorno (
  id text primary key,
  pagamento_id text not null unique references pagamento (id),
  motivo text not null check (length(trim(motivo)) > 0),
  dia text not null check (dia glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  caixa_id text references caixa (id),
  operador_id text not null references operador (id),
  autorizado_por_id text references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

create trigger pagamento_estorno_so_recebimento before insert on pagamento_estorno
when (select tipo from pagamento where id = new.pagamento_id) is not 'recebimento'
begin
  select raise(abort, 'so recebimento de notinha se estorna');
end;

-- Financeiro -----------------------------------------------------------------

-- Valor com sinal: + entrada, - despesa; o estorno tem o sinal oposto.
create table lancamento (
  id text primary key,
  tipo text not null check (tipo in ('entrada', 'despesa')),
  descricao text not null check (length(trim(descricao)) > 0),
  origem text not null,
  meio text not null check (meio in ('dinheiro', 'pix', 'cartao')),
  valor integer not null check (valor <> 0),
  estorno_de text unique references lancamento (id),
  motivo text,
  dia text not null check (dia glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  caixa_id text references caixa (id),
  operador_id text not null references operador (id),
  autorizado_por_id text references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  check ((valor > 0) = ((tipo = 'entrada') = (estorno_de is null))),
  check (estorno_de is null or length(trim(coalesce(motivo, ''))) > 0)
) strict;

create index lancamento_dia on lancamento (dia);
create index lancamento_caixa on lancamento (caixa_id);

create trigger lancamento_estorno before insert on lancamento
when new.estorno_de is not null
  and not exists (select 1 from lancamento o
                  where o.id = new.estorno_de and o.estorno_de is null
                    and o.tipo = new.tipo and o.meio = new.meio and o.valor = -new.valor)
begin
  select raise(abort, 'estorno tem que inverter o lancamento original');
end;

-- Dinheiro so entra num caixa aberto. O "esperado" do fechamento depende disso.

create trigger movimento_gaveta_caixa_aberto before insert on movimento_gaveta
when exists (select 1 from caixa_fechamento where caixa_id = new.caixa_id)
begin
  select raise(abort, 'caixa fechado');
end;

create trigger pagamento_caixa_aberto before insert on pagamento
when exists (select 1 from caixa_fechamento where caixa_id = new.caixa_id)
begin
  select raise(abort, 'caixa fechado');
end;

create trigger pagamento_estorno_caixa_aberto before insert on pagamento_estorno
when exists (select 1 from caixa_fechamento where caixa_id = new.caixa_id)
begin
  select raise(abort, 'caixa fechado');
end;

create trigger ficha_cancelamento_caixa_aberto before insert on ficha_cancelamento
when exists (select 1 from caixa_fechamento where caixa_id = new.caixa_id)
begin
  select raise(abort, 'caixa fechado');
end;

create trigger lancamento_caixa_aberto before insert on lancamento
when exists (select 1 from caixa_fechamento where caixa_id = new.caixa_id)
begin
  select raise(abort, 'caixa fechado');
end;

-- Boletos --------------------------------------------------------------------

create table boleto (
  id text primary key,
  numero_exibicao integer not null unique check (numero_exibicao > 0),
  descricao text not null check (length(trim(descricao)) > 0),
  valor integer not null check (valor > 0),
  numero text not null,
  vencimento text not null check (vencimento glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  criado_em text not null check (criado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z')
) strict;

-- A situacao do boleto e o ultimo evento (maior rowid).
create table boleto_evento (
  id text primary key,
  boleto_id text not null references boleto (id),
  tipo text not null check (tipo in ('pago', 'pagamento-desfeito', 'excluido')),
  dia text check (dia is null or dia glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  motivo text,
  operador_id text not null references operador (id),
  autorizado_por_id text references operador (id),
  registrado_em text not null check (registrado_em glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  check ((tipo = 'pago') = (dia is not null)),
  check (tipo = 'pago' or length(trim(coalesce(motivo, ''))) > 0)
) strict;

create index boleto_evento_boleto on boleto_evento (boleto_id);

create trigger boleto_evento_sequencia before insert on boleto_evento
when (select tipo from boleto_evento where boleto_id = new.boleto_id order by rowid desc limit 1) is 'excluido'
  or (new.tipo = 'pago'
      and (select tipo from boleto_evento where boleto_id = new.boleto_id order by rowid desc limit 1) is 'pago')
  or (new.tipo = 'pagamento-desfeito'
      and (select tipo from boleto_evento where boleto_id = new.boleto_id order by rowid desc limit 1) is not 'pago')
begin
  select raise(abort, 'evento fora de ordem para a situacao do boleto');
end;

-- Excluir boleto e um evento com motivo (D7), nunca delete.
create trigger boleto_sem_delete before delete on boleto
begin
  select raise(abort, 'boleto nao se apaga: excluir e um evento');
end;

create trigger cobranca_sem_delete before delete on cobranca
begin
  select raise(abort, 'fato nao se apaga: cobranca');
end;

-- Fato so se insere ----------------------------------------------------------

create trigger entrada_mercadoria_sem_update before update on entrada_mercadoria begin select raise(abort, 'fato nao se altera: entrada_mercadoria'); end;
create trigger entrada_mercadoria_sem_delete before delete on entrada_mercadoria begin select raise(abort, 'fato nao se apaga: entrada_mercadoria'); end;
create trigger ficha_sem_update before update on ficha begin select raise(abort, 'fato nao se altera: ficha'); end;
create trigger ficha_sem_delete before delete on ficha begin select raise(abort, 'fato nao se apaga: ficha'); end;
create trigger ficha_item_sem_update before update on ficha_item begin select raise(abort, 'fato nao se altera: ficha_item'); end;
create trigger ficha_item_sem_delete before delete on ficha_item begin select raise(abort, 'fato nao se apaga: ficha_item'); end;
create trigger ficha_servico_sem_update before update on ficha_servico begin select raise(abort, 'fato nao se altera: ficha_servico'); end;
create trigger ficha_servico_sem_delete before delete on ficha_servico begin select raise(abort, 'fato nao se apaga: ficha_servico'); end;
create trigger ficha_anotacao_sem_update before update on ficha_anotacao begin select raise(abort, 'fato nao se altera: ficha_anotacao'); end;
create trigger ficha_anotacao_sem_delete before delete on ficha_anotacao begin select raise(abort, 'fato nao se apaga: ficha_anotacao'); end;
create trigger ficha_cancelamento_sem_update before update on ficha_cancelamento begin select raise(abort, 'fato nao se altera: ficha_cancelamento'); end;
create trigger ficha_cancelamento_sem_delete before delete on ficha_cancelamento begin select raise(abort, 'fato nao se apaga: ficha_cancelamento'); end;
create trigger recebimento_sem_update before update on recebimento begin select raise(abort, 'fato nao se altera: recebimento'); end;
create trigger recebimento_sem_delete before delete on recebimento begin select raise(abort, 'fato nao se apaga: recebimento'); end;
create trigger pagamento_sem_update before update on pagamento begin select raise(abort, 'fato nao se altera: pagamento'); end;
create trigger pagamento_sem_delete before delete on pagamento begin select raise(abort, 'fato nao se apaga: pagamento'); end;
create trigger pagamento_estorno_sem_update before update on pagamento_estorno begin select raise(abort, 'fato nao se altera: pagamento_estorno'); end;
create trigger pagamento_estorno_sem_delete before delete on pagamento_estorno begin select raise(abort, 'fato nao se apaga: pagamento_estorno'); end;
create trigger caixa_sem_update before update on caixa begin select raise(abort, 'fato nao se altera: caixa'); end;
create trigger caixa_sem_delete before delete on caixa begin select raise(abort, 'fato nao se apaga: caixa'); end;
create trigger caixa_fechamento_sem_update before update on caixa_fechamento begin select raise(abort, 'fato nao se altera: caixa_fechamento'); end;
create trigger caixa_fechamento_sem_delete before delete on caixa_fechamento begin select raise(abort, 'fato nao se apaga: caixa_fechamento'); end;
create trigger movimento_gaveta_sem_update before update on movimento_gaveta begin select raise(abort, 'fato nao se altera: movimento_gaveta'); end;
create trigger movimento_gaveta_sem_delete before delete on movimento_gaveta begin select raise(abort, 'fato nao se apaga: movimento_gaveta'); end;
create trigger lancamento_sem_update before update on lancamento begin select raise(abort, 'fato nao se altera: lancamento'); end;
create trigger lancamento_sem_delete before delete on lancamento begin select raise(abort, 'fato nao se apaga: lancamento'); end;
create trigger boleto_evento_sem_update before update on boleto_evento begin select raise(abort, 'fato nao se altera: boleto_evento'); end;
create trigger boleto_evento_sem_delete before delete on boleto_evento begin select raise(abort, 'fato nao se apaga: boleto_evento'); end;
