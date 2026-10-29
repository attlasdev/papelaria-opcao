# Registro de bugs

Todo defeito encontrado ganha um número e uma entrada aqui. O teste de
regressão cita o número (`[A1]`, `[B-003]`), e a suíte confere que cada número
tem teste ou está nos pendentes de [`testes.md`](testes.md), com o motivo.

- **A1–A6, M1–M11:** os achados da checagem de `2026-10-21`
  ([auditoria](auditorias/2026-10-21-checagem-1.0.md)), com o número dela. Nem
  todos são defeito que pode voltar: os estruturais estão marcados assim e
  saem com a 1.0.
- **B-NNN:** bugs encontrados depois, em ordem. O registro começa em
  `2026-10-27`; os de antes estão em `docs/historico/`, sem número.

**Regra de trabalho:** bug corrigido entra com um teste que **falhava antes da
correção** (rodar sem a correção, ver falhar, corrigir). Defeito que só a tela
mostra fica pendente até existir teste de tela (Fase 3 do plano da 1.0).

Cada entrada: o que quebrou, a causa, a situação e onde está o teste.

---

### A1 · Entrada de mercadorias descartava item em silêncio
Quantidade fracionada na Registrar entrada fazia a gravação daquele item falhar
sem aviso. **Corrigido** na v0.1.8 (só inteiro; item recusado fica na tela com
aviso), sem teste automático. **Na 1.0, corrigido de vez** (`2026-10-29`, tela
2.4): a entrega inteira é uma operação, `registrarEntrada`, numa transação; o
back recusa quantidade que não é inteira e, se um item não serve, nada entra.
Teste: `testes/contrato/entradas.contrato.test.ts` (`[A1]`, mock e SQLite),
conferido falhando com a checagem do item desligada.

### A2 · Reset da base de produção travaria as gravações
Apagar a linha de `base_loja` reinicia a revisão e colide com
`base_loja_anteriores`. **Só da 0.1** (o documento sai na 1.0); não foi
executado.

### A3 · Comprovante: o papel não sai igual à prévia
`limpar()` junta os espaços que alinham as colunas. **Aberto**; corrigir antes
da fase 3 do comprovante.

### A4 · Cobrança na maquininha integrada não aguenta falha
Cobrança só na memória: queda no meio perde ou duplica a venda. **Na 1.0**:
tabela `cobranca` registrada antes; só aprovada vira pagamento, uma vez
(testado no banco). Falta a reconciliação ao abrir (tela 4.1).

### A5 · Limites do documento único da 0.1 · estrutural
Medidos na checagem. Saem com o SQLite da 1.0.

### A6 · Peças de produção ausentes
Log, instância única, quedas, CSP. **Feito na fundação da 1.0 (`2026-10-28`):**
log em arquivo com rotação e sem credencial (`electron/log.ts`, com teste),
instância única, queda da tela com aviso e "Recarregar", erro solto do processo
principal no log. Instância única e queda só se conferem com o app aberto (sem
teste automático). **Falta:** CSP e ferramentas de desenvolvedor fora do
instalador (Fase 4).

### M1 · Cadastro de produto: "Fornecedor" descartava o que se digitava
O produto não guarda fornecedor. **Corrigido** na v0.1.8: o campo saiu.

### M2 · Janelas: o foco depende da identidade de `aoFechar`
O foco pula a cada renderização da janela. **Aberto.**

### M3 · Sincronia: qualquer falha vira "Sem conexão"
**Só da 0.1** (a sincronia do documento sai na 1.0).

### M4 · Regras de negócio só na tela e no store · estrutural
Sai com as regras no back e os testes de contrato da 1.0.

### M5 · Notinha perde a separação entre serviço e produto no Financeiro
**Aberto**; depende da resposta do contador.

### M6 · Dados que a ficha não guarda (troco, cartão do misto)
**Na 1.0**: colunas no `pagamento`; o teste entra com a tela 4.1.

### M7 · Recebimento com data passada entra no caixa de hoje
**Aberto**; decide-se no percurso da tela 5.1 (P5 do schema).

### M8 · Custo cresce com o volume · estrutural
Sai com a consulta paginada no banco da 1.0.

### M9 · Exportar clientes para a Emitte depende do bloco fiscal oculto
**Aberto**; religar o bloco antes de ligar a exportação.

### M10 · Impressora no Windows: nome com espaço é recusado
**Aberto**; fase 3 do comprovante.

### M11 · A tradução dos erros do Supabase não tem teste
**Aberto**; vale enquanto o piloto usa o Supabase como banco.

### B-001 · Clientes mostrava um cliente por página em 1280x720
`2026-10-23`. A paginação calculava as linhas pela altura que sobrava. **Corrigido**
(mínimo de 8 linhas, a página rola). Só a tela mostra.

### B-002 · Início: "Pagamento" passava por cima de "Valor total"
`2026-10-23`, em 1280x720. Colunas largas demais para a tabela. **Corrigido**
(colunas menores, texto com reticências). Só a tela mostra.

### B-003 · Semente: recebimento de notinha no cartão sem maquininha
`2026-10-27`. A semente da 1.0 gravava 16 recebimentos no cartão sem
maquininha, o que não existe na loja. **Corrigido** (passam na Sicoob); o teste
falhava antes.
