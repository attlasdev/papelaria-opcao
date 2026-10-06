# papelaria-opcao

Aplicacao de mesa (Electron) que fala com um banco online. **Dois donos:** o
Victor cuida do que o usuario ve (telas, textos, visual); eu (Agostinho) cuido do
processo principal, do banco (`electron/`, `supabase/`), do contrato e de toda a
parte interna, inclusive a camada de dados dentro de `src/`. A fronteira tecnica
e um arquivo: `comum/contrato.ts`.

Desde `2026-10-01` eu escrevo o contrato e mudo o que for preciso sem revisao do
Victor, tambem na tela: o minimo possivel, so o que acrescenta ou se torna
obrigatorio, sempre no padrao visual existente. O que afeta o trabalho dele vai
anotado em `docs/contrato/mudancas.md`.

Este arquivo e o roteador do projeto. Ele nao repete o metodo de trabalho global
(`~/.claude/CLAUDE.md`).

Organizacao adaptada da Stack inicial: `docs/organizacao.md`. Orientacao local
para o Codex e catalogo de habilidades: `AGENTS.md` e `.agents/skills/`.

**O dominio nao fica neste arquivo.** As regras de negocio que valem hoje estao em
`Memoria.md` ("Regras de produto"); o vocabulario em codigo esta em
`src/mock/base/tipos.ts`, ponto de partida do contrato (o mapa tela a tela esta em
`docs/contrato/inventario.md`).

## Onde esta o que

| Preciso de... | Leia |
| --- | --- |
| a fronteira: operacoes, tipos, formato de erro | `comum/contrato.ts` |
| o que o front precisa saber (documento dele) | `front-side.md` |
| o que cada tela le e grava, e a operacao que vira | `docs/contrato/inventario.md` |
| mudancas que afetam o Victor | `docs/contrato/mudancas.md` |
| checklist para conferir cada operacao do contrato | `revisao-de-contrato.md` |
| estado atual, PENDENTES, regras de produto, decisoes | `Memoria.md` |
| o passado sessao a sessao (ideias descartadas, porques antigos) | `docs/historico/` |
| como a interface esta montada (tokens, CSS por componente, telas) | `AGENTS.md`, "Interface: como esta montada" |
| o molde de onde este esqueleto saiu | `/home/agostinho/Desktop/projetos/upload-sys` |

## Stack

Electron + electron-builder, Vite + React + TypeScript, Tailwind. Cliente de banco
**so no processo principal**. Duas fases (`Memoria.md`, `2026-10-06`):

- **0.1, piloto (agora):** tudo online, Supabase free com o schema de negocio;
  notas e cupons pela Emitte; login unico da loja.
- **1.0, producao:** banco local SQLite (`node:sqlite`) como fonte da verdade e
  Supabase so com a copia do arquivo (`Memoria.md`, `2026-10-05`).

O contrato e o mesmo nas duas: muda so `electron/operacoes.ts`.

Sem modulo nativo. Dependencia nativa obriga `electron-rebuild` e recompilacao por
plataforma — nao adicionar sem discutir.

## Regras duras deste projeto

1. **`comum/contrato.ts` e a unica fronteira.** O tipo `Contrato` existe uma vez e e
   implementado tres: a ponte (`electron/preload.ts`), o real (`electron/operacoes.ts`)
   e o falso (`src/mock/api.ts`). As tres se declaram `: Contrato`, entao o compilador
   exige completude e assinatura igual.

   Isto corrige um defeito do `upload-sys`, onde a superficie estava escrita quatro
   vezes e o `src/tipos/api.d.ts` era espelho mantido a mao. Funcionou com um dono so.
   Com dois, seria por onde vazaria.

2. **Nenhum canal de IPC generico.** O conjunto de canais e exatamente as chaves de
   `Contrato`, e `ipcRenderer` nunca chega ao renderer. O laco em
   `electron/main.ts:registrar` nao e um canal generico: ele percorre as chaves de um
   objeto tipado, fixo em tempo de build.

3. **Credencial de banco so no processo principal.** Nunca no renderer, nunca em
   bundle, nunca em log, nunca devolvida pela IPC. A chave e lida do disco no momento
   de usar, fora do repo (`app.getPath('userData')`).

4. **O front nunca manda caminho de arquivo.** Manda id, ou bytes. O nome e o lugar
   nascem no processo principal — senao um `../outro` vindo da tela escreve fora.

5. **Nenhuma operacao lanca excecao para o front.** Toda operacao devolve
   `Resultado<T>`. `registrar` embrulha as chamadas e converte excecao em
   `Falha('desconhecida')`, com o texto cru so no log: mensagem de erro crua pode
   carregar URL de conexao ou pedaco de credencial.

6. **O mock falha e demora.** `src/mock/simular.ts` poe atraso em toda resposta e
   permite forcar cada causa de falha. Mock que so acerta da confianca falsa e esconde
   dois tercos da tela — o mesmo erro do seed limpo, um andar acima.

7. **Mudanca de contrato vem em commit proprio**, sem tela junto, com uma linha em
   `docs/contrato/mudancas.md` quando afetar o Victor. Misturada com 400 linhas de
   JSX, a mudanca passa batida e o contrato volta a ser acordo verbal. (Antes de
   `2026-10-01` era PR negociado entre os dois; ver `Memoria.md`.)

8. **Migration nao estreia na maquina da loja.** Toda migration do SQLite roda
   antes numa copia com dados no formato antigo (e com as patologias da base
   local). No Supabase, a dupla checagem da regra global (`project-ref` +
   discriminador de conteudo) antes de qualquer escrita; o link da CLI fica
   apontando para o teste.

## Nomes

Codigo, arquivos e identificadores em portugues, sem acento (`listarProdutos`,
`criarPedido`, `Resultado`, `CausaFalha`). Tabelas e colunas tambem. Texto de tela
leva acento — e portugues de verdade para o usuario.

Dinheiro: inteiro em centavos. Data: string ISO 8601 em UTC no contrato, formatada na
tela. Id: string, sempre.
