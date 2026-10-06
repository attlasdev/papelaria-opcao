# Piloto 0.1 — como montar e instalar

Para a Attlas (Agostinho). O desenho e os porquês estão em `Memoria.md`
(`2026-10-06`). Aqui é só o passo a passo.

Dois projetos Supabase free:

| Projeto | Conta | Para quê |
| --- | --- | --- |
| **dev** | pessoal do Agostinho | toda migration roda aqui primeiro |
| **piloto** | Attlas | o da loja; só recebe o que já passou no dev |

---

## 1. Preparar cada projeto Supabase (dev primeiro, depois piloto)

No painel do projeto:

1. **Desligar o cadastro público** — Authentication → Sign In / Providers →
   desligar **"Allow new users to sign up"**. Obrigatório: a chave pública vai
   dentro do app, e com o cadastro ligado qualquer um criaria uma conta e leria a
   base. (O login por e-mail continua ligado.)
2. **Criar o usuário da loja** — Authentication → Users → Add user → e-mail e
   senha, marcando **Auto Confirm User**. No dev, um usuário nosso de teste.
3. **Anotar a URL e a chave pública** — Project Settings → API: a URL
   (`https://<ref>.supabase.co`) e a chave **anon/publishable**. **Nunca** a
   `service_role`/secret.

Aplicar a migration (`supabase/migrations/`), com a dupla checagem da regra 8:

```bash
npx supabase link --project-ref <ref>      # aponta a CLI para o projeto
cat supabase/.temp/project-ref              # checagem 1: o arquivo diz qual é
npx supabase db push --dry-run              # mostra o que vai aplicar
npx supabase db push                        # aplica
```

Checagem 2 (conteúdo, independente do arquivo da CLI): no SQL Editor do
projeto, `select email from auth.users;`. O **dev** responde com o nosso usuário
de teste; o **piloto**, com o usuário da loja. Contar migrations ou tabelas não
serve: depois que os dois estão iguais, respondem igual. Depois de usar, **deixar
o link apontando para o dev** (`npx supabase link --project-ref <ref do dev>`).

---

## 2. Instalar na máquina Windows da loja

O instalador vem da **Release** do GitHub (`attlasdev/papelaria-opcao` →
Releases → `papelaria-opcao-<versão>-win-x64.exe`). Ele é gerado pelo GitHub
Actions num Windows real a cada tag `v*` — ver "Publicar uma versão" abaixo. O
repositório é privado: baixar exige estar logado no GitHub com acesso a ele.

1. Rodar o instalador e seguir as telas (dá para escolher a pasta). Ele cria o
   atalho "Papelaria Opção".
2. **Windows SmartScreen:** o instalador não é assinado, então o Windows pode
   avisar "aplicativo não reconhecido" → "Mais informações" → "Executar assim
   mesmo".
3. Abrir uma vez e fechar: isso cria a pasta de dados
   `%APPDATA%\papelaria-opcao\` (nome fixo, mesmo com o app se chamando "Papelaria Opção"). A tela vai dizer que o computador não foi
   configurado — é o esperado.
4. Nessa pasta, criar `conexao.json` com a URL e a chave **pública** do projeto
   **piloto**:

   ```json
   { "url": "https://<ref>.supabase.co", "chave": "<chave anon/publishable>" }
   ```

5. Abrir de novo e entrar com o usuário da loja. A sessão fica guardada; a loja
   não precisa entrar todo dia.

Testar antes na máquina Windows de vocês, com o projeto **dev**.

**Atualizar** para uma versão nova: rodar o instalador novo por cima. A pasta
de dados (`conexao.json`, sessão, cópia local) não é tocada.

---

## Publicar uma versão

1. Subir `version` no `package.json` (ex.: `0.1.0` → `0.1.1`) e commitar.
2. Criar e empurrar a tag igual: `git tag v0.1.1 && git push origin v0.1.1`.
3. O GitHub Actions (`release-win`) builda, testa e cria a Release com o `.exe`.
   Se a tag não bater com o `package.json`, ele para antes de gastar minutos.
   Versões `0.x` saem como **pré-release**.

Sem `wine` no Linux não se gera o `.exe` aqui; o `zip` sai com
`npx electron-builder --win zip --x64` se precisar de algo local.

---

## 3. No dia a dia do piloto

- **Indicador no rodapé da barra lateral:** "Salvo às …" está tudo no banco;
  "Sem conexão" os dados estão no computador e sobem quando a internet voltar
  (pode fechar o app, nada se perde); "Não salvo" é conflito — fechar e abrir.
- **Ver o que a loja fez:** no painel, Table Editor → `base_loja` (o documento
  inteiro) e `base_loja_anteriores` (as 200 versões anteriores, para recuperar
  algo apagado por engano).
- **Semente de 20 produtos fictícios**, só se a loja pedir e com a base sem
  produtos — `scripts/semente-produtos-piloto.mjs` (instruções no topo do
  arquivo). Com o app **fechado** na loja. Preferir o **modo SQL** (`--sql=`):
  roda pela CLI ligada ao projeto, sem a senha da loja passar por terminal ou
  chat, e faz as conferências dentro do banco. Usado no teste em `2026-10-06`.
- **Projeto free pausa** após ~7 dias sem uso. Se a loja ficar uma semana sem
  abrir, o app vai mostrar "Sem conexão": reativar no painel (Restore). URL e
  chave continuam as mesmas.
- **Lembrete para a loja:** só dados inventados; tudo do piloto se perde na 1.0.
