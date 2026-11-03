# Roteiro do Windows (validação da 1.0)

Para a conversa que roda **no Windows**. A validação da 1.0 no Windows é feita
na máquina do próprio Agostinho (dual boot), numa conversa separada da do
Linux: ela não vê a memória nem o histórico de lá. Tudo o que ela precisa está
aqui e nos arquivos que este roteiro aponta. Decisão de `2026-11-03`
(`Memoria.md`).

O trabalho de código é feito no Linux. Aqui se **confere**: o que funciona,
o que quebra, com o que aparece na tela e no log. Corrigir no Windows só o que
for do Windows (caminho, spooler, instalador) e combinado com o Agostinho na
hora.

## Antes de começar

1. Ler o `CLAUDE.md` da raiz e o `~/.claude/CLAUDE.md` do Windows, se existir
   (o método de trabalho: plano curto e OK antes de mudar qualquer coisa fora
   do editor; conferir o alvo antes de escrever em banco).
2. Ler a Fase 3 no plano da 1.0
   (`docs/superpowers/plans/2026-10-23-versao-1.0.md`): ela diz quais passos já
   estão prontos (`[x]`). Este roteiro só vale até o último passo marcado.
3. Ler o "Último retorno" no fim deste arquivo: o que a rodada anterior achou.

## Preparar a máquina (uma vez)

- **Node 24** (o mesmo do Linux: `node -v` dá `v24.x`) e **git** com acesso ao
  `attlasdev/papelaria-opcao` (repositório privado).
- Clonar fora do OneDrive (caminho curto, sem acento), ex.: `C:\dev\papelaria-opcao`.
- `npm ci` na pasta.
- **Conexão com o banco de teste** (`papelaria-dev`): o `conexao.json` em
  `%APPDATA%\papelaria-opcao\`, como em `docs/piloto.md`, seção 2, passo 4.
  **Quem cria é o Agostinho**, com a URL e a chave pública do dev; a conversa
  só diz onde e em que formato. Nunca a chave secreta, nunca no chat, nunca em
  arquivo do repositório.
- Atualizar antes de cada rodada: `git pull` no `main`.

## O que conferir

Cada item diz a partir de que passo da Fase 3 ele vale.

| Desde | O quê | Como | Passa quando |
| --- | --- | --- | --- |
| 3.0 | Suíte | `npm test` | tudo verde, igual ao Linux |
| 3.0 | Build | `npm run build` | sem erro |
| 3.3 | Banco de desenvolvimento | `npm run banco:semear "%APPDATA%\papelaria-opcao\loja.sqlite"` (recusa se já existir) | o arquivo nasce, com a semente de patologias |
| 3.3 | App de desenvolvimento | `npm run dev` | abre a janela com os dados da semente |
| 3.5 | Login na primeira abertura | apagar a sessão (`sessao.json`) e abrir | pede o login; entra com o usuário de teste |
| 3.5 | Backup | usar o app 10 minutos com mudanças | `copias/` na pasta de dados e a `atual` no `papelaria-dev` |
| 3.5 | Restaurar | o comando do suporte (detalhe no passo 3.5) | o banco volta igual à cópia |
| 3.5 | Aviso de cópia parada | sair do login (ou tirar a internet por mais de 1 hora) | o sino avisa e leva a entrar |
| 3.6 | Testes de tela | `npx playwright install chromium` uma vez; `npm run test:tela` | tudo verde |
| 3.7 | Rodada | o roteiro da rodada (escrito no passo 3.7), em 1280x720 e 1920x1080 | sem defeito novo |
| 3.8 | Instalador | `npm run dist:win`; instalar; SmartScreen → "Executar assim mesmo" | instala e abre |
| 3.8 | Instância única | clicar no atalho com o app aberto | traz a mesma janela, não abre outra |
| 3.8 | Log | `%APPDATA%\papelaria-opcao\logs\app.log` | registra a abertura, sem chave nem senha |
| — | Impressora (se estiver à mão) | M10 e A3 da checagem (`docs/auditorias/2026-10-21-checagem-1.0.md`) | nome com espaço aceito; papel igual à prévia |

## Devolver o resultado

No fim da rodada, escrever o "Último retorno" abaixo (substituindo o
anterior): data, passo da Fase 3, o que passou, o que falhou (com a mensagem
da tela e o trecho do log) e o que não deu para conferir. Commit só deste
arquivo, com OK do Agostinho, e push. A conversa do Linux continua dali.

## Último retorno

Nenhuma rodada no Windows ainda.
