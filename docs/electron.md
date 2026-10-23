# Electron neste projeto

O repositório [electron/electron](https://github.com/electron/electron) contém o código-fonte do framework. Ele é uma referência para versões, mudanças e problemas do Electron, não um molde de aplicativo para copiar para esta pasta.

Para implementar recursos, consultar primeiro a [documentação oficial](https://www.electronjs.org/docs/latest/) e, em especial, a [lista de segurança](https://www.electronjs.org/docs/latest/tutorial/security). O exemplo precisa respeitar a fronteira local descrita em `CLAUDE.md` e `comum/contrato.ts`.

## Aplicado ao app

- A interface roda com `contextIsolation: true` e `nodeIntegration: false`.
- O preload expõe somente as operações tipadas do contrato; o renderer não recebe `ipcRenderer`.
- O processo principal aceita IPC somente da janela principal e de seu frame principal.
- Navegações para outra URL e novas janelas são bloqueadas. Nenhum domínio externo foi autorizado ainda.

## Ao adicionar recursos

- Para abrir links externos, definir antes quais destinos são confiáveis e validar o protocolo e a URL no processo principal. Não passar uma URL arbitrária para `shell.openExternal`.
- Para permissões de câmera, notificações ou recursos semelhantes, definir a política de permissão da sessão.
- Antes de distribuir, revisar CSP, empacotamento, versão do Electron e permissões segundo a documentação oficial. O app é distribuído desde a v0.1.0 sem essa revisão; o que falta está na checagem de `2026-10-21` (A6): CSP, ferramentas de desenvolvedor abertas no instalador, trava de instância única, log em arquivo, tratamento de queda do renderer, assinatura e atualização.
