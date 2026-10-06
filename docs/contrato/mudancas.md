# Mudanças que afetam a interface

Para o Victor. Cada linha diz o que mudou, onde e por quê. Mudança só interna
(nome de tipo, banco, camada de dados) não entra aqui, a menos que mude como se
escreve uma tela. O detalhe do contrato está em `comum/contrato.ts` e o mapa
tela a tela em `docs/contrato/inventario.md`.

Regra combinada em `2026-10-01`: na tela, mudar o mínimo possível, só o que
acrescenta ou se torna obrigatório, sempre no padrão visual existente (tokens,
componentes, CSS por componente).

---

## Previstas (ainda não feitas)

- **Estados de carregando e de falha em toda tela que lê ou grava.** Com banco, a
  resposta demora e pode falhar; hoje a base local responde na hora e nunca
  falha. Plano: botão desabilitado enquanto espera e mensagem com o componente
  `Aviso`, sem desenho novo.
- **Número da ficha na nova ficha.** Hoje o subtítulo mostra `Ficha #1131` antes de
  concluir. Com duas máquinas, o número só é garantido quando a venda é gravada.
  A tela deixa de mostrar o número durante a venda e ele aparece ao concluir.
- **Código do produto no cadastro.** Mesmo caso: o próximo `EST-` deixa de aparecer
  antes de salvar e é mostrado depois de gravar.
- **Botão "Restaurar dados de exemplo"** (barra lateral) sai quando a base local
  sair: com banco, isso é seed do ambiente de teste, não ação no app.

## Feitas

_Nenhuma ainda._
