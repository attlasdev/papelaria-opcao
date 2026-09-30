# O front de papelaria-opcao

Preparado em `2026-09-22`, para quem vai montar a interface.

Isto nao e um PWA, mas 90% do que voce sabe de PWA vale aqui sem tradutor. Este
documento e sobre os 10% que mudam, e sobre onde fica a fronteira entre o seu
trabalho e o meu.

---

## O resumo, em cinco linhas

1. E um aplicativo de mesa (Electron). Por dentro e React + Vite + Tailwind, igual
   ao que voce ja faz.
2. Em vez de `fetch('/api/coisa')`, voce chama `window.api.coisa()`. Async, tipada,
   com autocomplete.
3. Voce roda `npm run dev` e abre no navegador normal. **Sem Electron, sem banco,
   sem credencial nenhuma** — um mock responde por tudo.
4. Quando eu implementar o lado real, **nada em `src/` muda**. Nenhuma linha. A
   mesma chamada passa a falar com o banco.
5. Para isso funcionar, a lista de operacoes (`comum/contrato.ts`) precisa existir
   antes das telas. **Voce escreve o primeiro corte dela** — ver secao 5.

---

## 1. A traducao

| No PWA voce faria | Aqui |
| --- | --- |
| `fetch('/api/produtos')` | `window.api.listarProdutos()` |
| a lista de rotas / o OpenAPI | `comum/contrato.ts` |
| o servidor (Next API, Express) | `electron/` — o "processo principal" |
| `msw`, `json-server`, dado fake | `src/mock/api.ts` |
| `res.status(422).json(...)` | `{ ok: false, causa: 'validacao', erro: '...' }` |
| `try/catch` em volta do `fetch` | nada. O erro vem no retorno, tipado |
| `.env` com `NEXT_PUBLIC_...` | nada. Credencial nunca chega ao front |
| `react-router` / app router | `react-router` em modo hash (`src/rotas.tsx`). O usuario nao ve URL |
| deploy preview para revisao | `npm run dev` local (ou preview do modo mock) |
| service worker, cache offline | nao existe |
| media queries para celular | janela de desktop, minimo 900x600 |

O resto e igual: componentes, hooks, Tailwind, DevTools, hot reload, `console.log`.
Se voce quiser usar React Query, Zustand, react-hook-form, o que for — pode. O
`window.api` e so um punhado de funcoes async; qualquer biblioteca que embrulha
`fetch` embrulha isto tambem.

## 2. O que e diferente de verdade

**Nao existe URL para o usuario.** Sem barra de endereco, sem deep link, sem link
para mandar. (Atualizacao 2026-09-23: por dentro as telas usam `react-router` em
modo hash, `#/clientes/CLI-0104`, porque funciona em `file://`; ver `Memoria.md`.) Navegacao e estado no React. Isso simplifica algumas coisas e tira
uma ferramenta sua: nao da para mandar link de uma tela especifica.

**A janela e o viewport.** Ninguem abre isso no celular. O minimo esta em 900x600
(`electron/main.ts`), e o usuario pode maximizar. Layout tem que aguentar ficar
largo, nao tem que aguentar ficar estreito.

**Nao ha service worker, cache offline nem prompt de instalacao.** O aplicativo ja
esta instalado. Offline, o app abre e as operacoes falham com `causa: 'rede'` — e a
tela precisa dizer isso.

**Nao ha CORS, header de autorizacao nem token expirando no meio da sessao.** Isso
tudo vive do outro lado da fronteira, e voce nunca toca.

**O erro nao vem por excecao.** Toda operacao devolve `Resultado<T>`, que e
`{ ok: true, dado }` ou `{ ok: false, causa, erro }`. Depois de um `if (!r.ok)` o
TypeScript ja sabe que `r.dado` existe. Nao embrulhe em `try/catch` — nao vai cair
la, e voce perde o tipo.

## 3. Como rodar

```bash
npm install

npm run dev     # o seu dia a dia: abre no navegador, com o mock
npm start       # o aplicativo de verdade — so precisa quando for conferir a janela
npm run build   # typecheck + build. Isto tem que passar antes de PR
```

No `npm run dev` aparece um painel **MOCK** no canto inferior direito, com duas
coisas: a causa de falha a forcar, e o atraso de cada resposta em ms. Use os dois.
Ver secao 7.

## 4. De quem e cada pasta

| Pasta | Dono | |
| --- | --- | --- |
| `src/` | **voce** | React, Tailwind, telas, estados, o mock |
| `comum/contrato.ts` | **nos dois** | a fronteira. PR proprio, sempre |
| `electron/` | eu | janela, ponte, banco |
| `supabase/` | eu | schema, migrations (ainda nao existe) |

Voce nao precisa de permissao para nada dentro de `src/`. Crie subpastas, componha
como preferir, instale dependencia de front (avise no PR). O unico arquivo fora de
`src/` que voce mexe e o contrato.

## 5. O contrato — voce escreve o primeiro corte

`comum/contrato.ts` e uma lista de funcoes com assinatura. Hoje tem uma operacao de
exemplo (`ping`) que existe para voce ver a forma; apague quando as de verdade
nascerem.

**Por que voce e nao eu:** o contrato e o vocabulario do dominio. Que coisas existem,
como o cliente chama elas, o que o usuario faz com elas. Voce esteve na reuniao. Se
eu escrever isso sozinho, vou inventar nome que nao bate com o que o cliente falou e
voce vai traduzir para sempre.

E voce ja faz isso hoje, sem perceber: quando monta a tela com dado falso, o formato
daquele dado falso **e** uma proposta de contrato. A diferenca aqui e que ela ganha um
arquivo com nome, em vez de ficar implicita no meio do JSX.

Regras de forma:

1. Uma operacao por coisa que o usuario faz — nao por secao de tela.
2. Toda operacao e `async` e devolve `Resultado<...>`.
3. Argumentos sao dado simples: id, texto, numero, objeto de dado. **Nunca um
   caminho de arquivo.** Se a tela precisa mandar um arquivo, manda os bytes; o nome
   e o lugar nascem do meu lado.
4. Nome em portugues, verbo + substantivo: `listarProdutos`, `criarPedido`,
   `marcarPago`. O nome da funcao vira o nome do canal interno — entao ele precisa
   ser estavel, e renomear e mudanca de contrato.
5. **Um botao que precisa de tres escritas juntas e UMA operacao, nao tres.** Ver
   secao 6.
6. Nao invente detalhe de banco. Descreva o que a tela precisa; eu resolvo como isso
   sai do banco. Se o que a tela precisa for caro, eu falo.

Exemplo da forma (inventado — nao e o dominio de voces):

```ts
export type Produto = {
  id: string
  nome: string
  precoCentavos: number   // dinheiro em centavos, inteiro. Nunca float
  ativo: boolean
}

export type DadosProduto = Omit<Produto, 'id'>

export type Contrato = {
  listarProdutos(): Promise<Resultado<Produto[]>>
  criarProduto(dados: DadosProduto): Promise<Resultado<Produto>>
  arquivarProduto(id: string): Promise<Resultado<null>>
}
```

## 6. As tres coisas em que voce me chama

Nao e desconfianca do seu trabalho — e que essas tres nao sao visiveis de onde voce
esta olhando.

**1. Onde a operacao comeca e termina.** A tela tem um botao "Salvar"; o banco pode
ter tres escritas que tem que acontecer juntas ou nenhuma. Se o contrato disser
`criarX()`, `vincularY()`, `atualizarZ()` porque a tela tem tres secoes, vamos ter
estado meio-aplicado quando a segunda falhar. Isso nao conserta depois: a forma
errada ja vazou para o front.

**2. O catalogo de falhas.** A lista de `CausaFalha` que esta no contrato hoje e um
palpite meu. Voce me diz quais causas a tela precisa **distinguir** (porque oferece
acao diferente); eu confirmo quais o banco realmente produz.

**3. O que e irreversivel.** "Salvar" parece inofensivo e as vezes apaga dado de
cliente sem volta. Voce nao tem como saber quais gestos sao esses — eu tenho. Me
mostre a lista de botoes que escrevem, e eu marco os que precisam de confirmacao de
verdade.

**Quando chamar: depois da primeira ou segunda tela, antes da terceira.** Mais cedo
voce ainda nao sabe do que precisa; mais tarde ja tem tela montada em cima. Uma
conversa de uma hora, uma vez.

## 7. O mock tem que falhar e tem que demorar

Um mock que sempre acerta e responde na hora e um ambiente que so testa o caso feliz.
Ele da confianca falsa e **esconde dois tercos da tela**.

Por isso `src/mock/simular.ts` ja poe 220ms de atraso em toda resposta, mesmo sem
voce pedir: com resposta instantanea o estado de carregando nunca aparece na sua
frente, e ninguem desenha o que nao ve.

O que fazer, enquanto a tela esta na sua mao:

- **Force cada causa de falha** no painel MOCK e desenhe o estado. Repare que nem
  toda falha merece "tentar de novo" — em `permissao`, o botao e cruel.
- **Suba o atraso para 3000ms** e veja se o botao da para clicar duas vezes, se o
  esqueleto aparece, se a tela pula quando o dado chega.
- **Faca o dado falso feio.** Lista vazia (estado vazio e tela tambem). Um item so.
  Duzentos itens. Nome de 80 caracteres. Campo opcional ausente. Acento e emoji.
  Dado bonito e a segunda forma de confianca falsa.
- **De estado ao mock.** Se a tela cria um item, guarde um array em `src/mock/api.ts`
  e mexa nele. Lista que nao muda depois do "criar" esconde bug de atualizacao.

Cinco minutos cada, agora. Um dia cada, depois de dez telas prontas.

## 8. O que nunca entra em `src/`

O renderer e um navegador, e o que esta nele vai empacotado para a maquina do
usuario — legivel por quem abrir o aplicativo. Entao:

- **Nenhum cliente de banco.** Sem `@supabase/supabase-js`, sem driver, sem ORM.
- **Nenhum `fetch`/`axios` para o banco** ou para endpoint que carregue credencial.
- **Nenhuma chave, token, senha ou URL de conexao.** Nem em comentario, nem
  comentada "so para testar". Uma vez comitada, esta vazada.
- **Nenhum caminho de arquivo montado na tela.** Sem `fs`, `path`, `child_process`,
  `require` de modulo de Node.
- **Nenhum dado real de cliente** no mock. Dado falso e inventado.

Se voce sentir falta de algo dessa lista, e sinal de que falta uma operacao no
contrato. Me chame — a resposta e sempre operacao nova, nunca atalho no front.

## 9. Git e PR

- Repo unico, na Org. Branch `front/<assunto>`.
- **PR que toca so `src/`**: e seu. Eu leio por cima.
- **PR que toca `comum/contrato.ts`**: vem **sozinho**, sem tela junto, e eu aprovo.

  Por que separado: um PR de contrato e uma negociacao entre nos dois; um PR de tela
  e o seu trabalho. Misturados, a negociacao passa batida no meio de 400 linhas de
  JSX — e ai o contrato volta a ser acordo verbal.
- `npm run build` tem que passar antes de abrir PR (ele roda typecheck).
- Nao comite `node_modules/`, `dist/`, `dist-electron/`, `release/`, `.env`.

## 10. Por onde comecar

- [x] `npm install && npm run dev`. (A tela de exemplo do `ping` ja foi trocada
      pelas nove telas migradas do Stitch; ver `Memoria.md`.)
- [ ] Mexa no painel MOCK: force `rede`, suba o atraso. Veja os tres estados.
      (Hoje sem efeito visivel: as telas leem a base local de `src/mock/base/`
      via `useEstadoDemonstracao()` e ainda nao chamam `window.api`. Volta a
      valer quando essa base for para o mock do contrato; o formato de
      `src/mock/base/tipos.ts` e a proposta de vocabulario para o primeiro corte.)
- [x] Rode `npm start` uma vez. (Feito em 2026-09-23: o Electron abre as telas.
      A prova "mock -> real sem mexer em `src/`" volta quando houver operacao
      real no contrato.)
- [ ] Leia `comum/contrato.ts` de cima a baixo. Sao 100 linhas e e o arquivo mais
      importante do repo.
- [ ] Escreva o primeiro corte do contrato a partir da reuniao. Apague o `ping`.
- [ ] Monte a primeira tela contra o mock, com os tres estados.
- [ ] **Me chame** (secao 6) antes da terceira tela.
