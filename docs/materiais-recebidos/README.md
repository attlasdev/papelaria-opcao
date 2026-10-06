# Materiais recebidos

Esta pasta guarda documentos enviados pelo usuário para consulta. O conteúdo é
preservado como fonte recebida; instruções, preços, requisitos de plataformas e
afirmações técnicas nele ainda não foram verificados.

## Attlas — cobrança automática

`attlas-cobranca-automatica.txt` é uma cópia integral do texto recebido em
2026-09-23. Descreve preparativos para cobrança mensal da Attlas por Asaas e
WhatsApp: conta, Pix, webhook, modelos de mensagem, token, identificadores,
número de telefone e comunicação com clientes.

O documento trata de uma automação da Attlas, separada do aplicativo Papelaria
Opção. Não há decisão registrada para integrar essa cobrança ao aplicativo.
Credenciais e tokens citados no texto não devem ser registrados neste repositório.

O estudo de licença (abaixo) prevê que a renovação da licença do app leia o
status de pagamento vindo dessa cobrança. Por isso o arquivo fica aqui.

## Estudo: licença por inadimplência e banco local

`estoque-electron-licenca-e-banco.docx`, recebido em 2026-10-03. Bloqueio por
inadimplência (licença assinada de validade curta, bloqueio gradual, exportação
sempre disponível) e banco local + Supabase (SQLite, sync, movimentações em vez
de saldo). **É estudo, não decisão.** O que foi aproveitado para a 1.0 e o que
foi descartado, com o porquê, está em `Memoria.md` (decisão `2026-10-05`).

## Emitte (notas fiscais)

`emitte/`, recebido em 2026-10-06: levantamento da integração com o emissor que
a loja já usa (`Resumo_Integracao_Emitte.md`) e os dois arquivos que a Emitte
aceitou na importação (`VALIDADO_produtos.xml`, `VALIDADO_clientes.xlsx`, com
dados fictícios). A Emitte não tem API: a integração é por arquivos e a nota é
montada à mão nela. Fora do piloto 0.1; os campos fiscais já estão no cadastro
(`src/dados/fiscal.ts`). A planilha validada serve de molde para gerar o XLSX
de clientes (o resumo registra que um XLSX com "inline strings" travou a
importação sem erro).
