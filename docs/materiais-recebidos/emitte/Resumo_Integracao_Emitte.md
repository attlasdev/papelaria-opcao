# Integração Software da Papelaria × Emitte – Resumo

_Levantamento feito numa conta de teste do Emitte (out/2026). Nenhuma nota foi emitida._

## 1. Cenário

- A papelaria **não tem sistema de gestão** (estoque, financeiro, caixa). Hoje ela só usa o **Emitte** para emitir notas.
- Ela tem **impressora térmica** e **leitor de código de barras**, ainda sem uso.
- O nosso software vai cuidar de **produtos, estoque, financeiro e caixa**.
- **O Emitte não tem API.** Os dois sistemas vão conviver, e a comunicação entre eles é feita **por arquivos** (importação e exportação).

## 2. Quem faz o quê

| Quem                     | Responsabilidade                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contador + papelaria** | Decisões fiscais: NCM, CSOSN, CFOP, CEST, se impressão, encadernação e plastificação são serviço, regras da prefeitura. Configuração fiscal do Emitte. O que preencher em cada nota e quando emitir. |
| **Desenvolvedor (nós)**  | Criar os campos no software, gerar os arquivos no formato do Emitte, validar os dados, ler os XMLs e ensinar o fluxo do dia a dia à dona.                                                            |
| **Ponto de contato**     | O contador passa à papelaria as regras. A papelaria ou o contador passa a nós só os **valores** que entram no software (ex.: NCM e tributação de cada produto).                                      |

**Regra prática:** "o que a lei exige?" é com o contador. "Onde o dado fica e como chega ao Emitte?" é com o desenvolvedor.

## 3. O que entra e sai do Emitte por arquivo

| O quê                      | Por arquivo?                                            | Onde no Emitte                                |
| -------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| Produtos                   | ✅ XML (formato NF-e) ou XLS                            | Cadastros → Produtos → Importar via XML / XLS |
| Clientes                   | ✅ XLS                                                  | Cadastros → Clientes → Importar via XLS       |
| Serviços                   | ❌ cadastro manual                                      | Cadastros → Serviços                          |
| Notas (NF-e, NFC-e, NFS-e) | ❌ **sempre montadas e emitidas manualmente no Emitte** | Nota de produto / do consumidor / de serviço  |
| Notas emitidas → software  | ✅ XML (exportação)                                     | Contábil → Solicitar (período + modelo)       |

O arquivo **só cadastra** produtos ou clientes. **Ele não cria a nota.**

## 4. Fluxo do dia a dia

**Venda (saída)**

1. O pedido é criado no software, com cliente e produtos.
2. O software exporta **dois arquivos**: produtos (XML) e cliente (XLS).
3. Os dois arquivos são importados no Emitte, e o cliente e os produtos ficam cadastrados.
4. Na nota (Emitte → Nova Nota), basta escolher o cliente, os produtos, as quantidades e a forma de pagamento. O resto vem preenchido.
5. A nota é emitida no Emitte.
6. O XML das notas emitidas (menu Contábil) é importado de volta no software, para conferir a venda, o estoque e o caixa.

**Compra (entrada)**

- O fornecedor envia o XML da nota. Ele entra no software (estoque e conta a pagar) e pode ser importado no Emitte para cadastrar produtos novos.
- Na compra normal de fornecedor, a papelaria **não emite** nota de entrada.

## 5. Tipos de nota

| Nota                           | Quando usar                                                                             | Observações                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **NF-e – Nota de produto**     | Venda para empresa ou prefeitura (vários produtos); devoluções; venda para outro estado | Exige cadastro completo do cliente. Prefeitura pode exigir Nota de Empenho, Pedido e Contrato (Avançado → Informações de Compras). |
| **NFC-e – Nota do consumidor** | Venda de balcão (o "cupom")                                                             | Cliente opcional (ou só o CPF). É impressa na **impressora térmica**.                                                              |
| **NFS-e – Nota de serviço**    | Impressão, encadernação, plastificação                                                  | Regras definidas pela **prefeitura** (uma nota por serviço, só quando pedida, ou consolidada). **O contador define.**              |

- **Entrada × saída na NF-e:** é o mesmo lugar. O que muda é a **Natureza** escolhida: Venda (5102/6102) e Devolução de compra (5202/6202) são saída; Devolução de venda (1202/2202) é entrada.
- **Forma de pagamento:** no Emitte é **só um registro**. O pagamento é recebido por fora (maquininha, PIX, dinheiro). A exceção é o botão "Gerar boleto?". No cartão, os campos Bandeira e Nº de autorização são opcionais.
- **Leitor de código de barras no Emitte:** ele encontra o produto, mas é preciso **clicar** para adicionar.

## 6. Campos de produto no software (base: planilha-modelo do Emitte)

| Campo                                             | Regra                                                 | Quem define         |
| ------------------------------------------------- | ----------------------------------------------------- | ------------------- |
| Código de barras                                  | Máx. 14, **dígito verificador válido**, ou "SEM GTIN" | Papelaria (leitor)  |
| Código na nota                                    | Máx. 10                                               | Papelaria           |
| Nome\*                                            | Máx. 120                                              | Papelaria           |
| Unidade\*                                         | Lista do Emitte (UN, CX, PCT…)                        | Papelaria           |
| Preço                                             | Sem separador de milhar                               | Papelaria           |
| Peso                                              | Até 3 casas decimais                                  | Papelaria           |
| Origem\*                                          | 0 a 8 (0 = nacional)                                  | Contador            |
| NCM\*                                             | 8 dígitos, da lista do Emitte                         | Contador            |
| CEST                                              | 7 dígitos (só com ST)                                 | Contador            |
| CFOP estadual* / interestadual*                   | Ex.: 5102 / 6102                                      | Contador            |
| **Grupo de tributação** (não está na planilha)    | Ex.: Simples (CSOSN 102) ou ST (500)                  | Contador            |
| Escala relevante, CNPJ do fabricante, observações | Opcionais                                             | Conforme o contador |

- **Importante:** no XML, a tributação e os CFOPs são **escolhidos na tela de importação** e valem para o arquivo todo. Por isso, o software deve **gerar um arquivo XML para cada grupo de tributação**.
- O que o Emitte não puxar do arquivo, a dona completa manualmente.

## 7. Campos de cliente no software (planilha-modelo do Emitte)

Os campos marcados com \* são obrigatórios:

- Tipo de contribuinte\* (`C` = tem IE, `N` = não contribuinte, `I` = isento)
- Tipo de cliente\* (`C` = consumidor, `R` = revenda)
- CNPJ/CPF\* (só números)
- Razão social\* (máx. 60)
- CEP\* (8 números)
- Logradouro\*
- Bairro\*
- Cidade\* (nome igual ao da lista do Emitte)
- Estado\* (sigla)
- Opcionais: IE, IM, nome fantasia, telefones, e-mail, tipo de logradouro, número, complemento, observação

**Atenção:** a **observação do cliente aparece automaticamente na nota**, nas informações complementares. O software pode enviar dados só com números, que o Emitte formata.

## 8. Lições técnicas dos testes

1. **XML de produtos gerado por nós foi aceito** pelo Emitte (3 produtos, 0 erros), e há uma tela de revisão antes de salvar.
2. **Código de barras com dígito verificador errado é recusado.** O software deve validar esse dígito.
3. **A importação XML de produtos não cadastra o cliente.** O cliente vai sempre em arquivo separado (XLS).
4. **O XLSX tem que estar no formato padrão do Excel.** O primeiro arquivo, gravado com "inline strings", travou a importação sem mostrar erro. Testem a biblioteca de geração.
5. Montar NF-e e NFC-e com os cadastros importados funcionou: só foi preciso escolher o cliente, os produtos e as quantidades.
6. A quantidade na nota tem 2 casas decimais (digitar 200 vira 2,00).

## 9. Pendências

**Perguntas ao contador**

- NCM, origem, CEST, CSOSN e CFOP de cada produto (ou a regra para definir).
- Impressão, encadernação e plastificação entram como serviço (NFS-e) ou como produto?
- Como a prefeitura exige a NFS-e (por serviço, sob pedido ou consolidada)? E qual o código de serviço de cada um?

**Testes a fazer**

- Importar um produto ou cliente **já cadastrado**: o Emitte duplica, atualiza ou ignora?
- **Impressão do cupom NFC-e na térmica**, na conta real da papelaria.
- Exportação de XML pelo menu Contábil, na conta real.

**Próximo passo:** cruzar os campos do projeto do software com as seções 6 e 7.

## 10. Arquivos validados (anexos)

- **VALIDADO_produtos.xml:** importado com sucesso em Produtos → Importar via XML (Tributação Simples, CFOP 5102/6102).
- **VALIDADO_clientes.xlsx:** importado com sucesso em Clientes → Importar via XLS.
