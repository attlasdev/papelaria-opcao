---
name: agent-memory-engineering
description: Use when projetar, revisar ou explicar como agentes de IA devem gerenciar memória/contexto de longo prazo — arquivos de contexto tipo CLAUDE.md, memory tools autônomas, skills, sistemas de memória baseados em arquivos, versionamento/concorrência/permissionamento de memória, ou consolidação assíncrona (dreaming) em produção com múltiplos agentes.
---

# Engenharia de Memória para Agentes de IA

## Visão geral

Inteligência do modelo sozinha não escala em produção: o modelo mais novo não sabe,
por si só, como sua organização funciona, o que você prefere, ou onde os agentes já
erraram antes. Esse conhecimento específico é o que a **engenharia de contexto/memória**
fornece, e ele funciona como um multiplicador da inteligência do modelo ao longo do tempo.

Fonte: síntese de uma palestra técnica da Anthropic (equipe de AI aplicado) sobre a
evolução prática desse campo no último ano, incluindo os princípios usados para levar
sistemas de memória autônomos para produção.

## Quando usar

- Decidir onde/como guardar preferências, convenções e histórico de erros para um agente.
- Projetar um sistema de memória que múltiplos agentes vão ler/escrever ao mesmo tempo.
- Diagnosticar por que um agente "esquece" ou repete o mesmo erro entre sessões.
- Avaliar se algo deveria virar uma skill, uma memória autônoma, ou lógica determinística do harness.
- Projetar um processo de consolidação/limpeza de memória (o padrão "dreaming" abaixo).

## A evolução: do arquivo único ao sistema de arquivos de memória

Princípio geral da Anthropic: **faça a coisa simples que funciona** — e evolua só
quando ela realmente quebrar em produção.

| Estágio | Como funciona | Ponto forte | Limitação que forçou o próximo estágio |
|---|---|---|---|
| **Arquivo único (tipo `CLAUDE.md`)** | Um arquivo Markdown com instruções/preferências, injetado inteiro no início da sessão. | Fonte única de verdade; humano e agente leem e escrevem o mesmo arquivo. | Cresce sem limite → estoura o contexto; vira um "muro de texto" difícil de manter. |
| **Memory tools autônomas** | O agente decide, durante a própria sessão, o que vale a pena ler/escrever na memória. | Autonomia funciona muito bem — o agente julga relevância melhor do que uma regra fixa. | É tudo **in-band** (dentro da sessão): compete por atenção/recursos com a tarefa em si; sem visibilidade entre sessões. |
| **Skills** | O agente só olha um resumo curto (front matter) antes de decidir carregar o corpo completo do arquivo. | Resolve o estouro de contexto via **disclosure progressiva**: pode ter muito detalhe sem poluir o contexto padrão. Ideal para processos com fluxo de trabalho opinativo e ponta a ponta. | Ainda depende de humano+agente decidirem, com antecedência, "isso merece virar uma skill". |
| **Memória como sistema de arquivos** (estado da arte atual) | A memória é só uma pasta de arquivos Markdown. O agente usa ferramentas normais de arquivo (bash, grep) para buscar/ler/escrever, em vez de uma API de memória sob medida. | Combina os aprendizados anteriores: deixa a memória crescer grande, mas indexada e pesquisável; agente busca só o que precisa (disclosure progressiva "de graça"); agente continua autônomo para escrever. | Escala tecnicamente — os problemas que sobram são de **produção** (próxima seção). |

**Analogia da estante de livros (skills):** é como ter uma estante no quarto — a cada
conversa você escaneia os títulos (as descrições curtas das skills) e só tira da
estante o livro (corpo da skill) que for relevante. Se alguém te aborda falando
francês, você não precisa ter 7 anos de aula de francês pré-carregados na cabeça —
basta ter um dicionário de francês na estante e puxá-lo quando precisar.

## Por que isso quebra em produção

Com muitos agentes colaborando ao mesmo tempo, agentes rodando por períodos longos, ou
bases de código/domínios muito complexos, problemas aparecem:

- **Escrita concorrente**: dois agentes tentando atualizar o mesmo arquivo de memória ao mesmo tempo.
- **Contaminação em cascata**: um agente decide "corrigir" o contexto organizacional
  compartilhado que todos os outros agentes leem — se a mudança estiver errada, o erro
  se propaga para toda a frota.
- **Rastreabilidade**: quando humano e agente colaboram na mesma memória, fica difícil
  saber o que mudou, quando, e por quê.
- **Memória fica velha (stale)**: algo que era relevante no passado pode não ser mais
  hoje; ou pode ter sido escrito errado desde o início; ou pode até ter sido injetado
  maliciosamente (prompt injection) para fazer o agente gravar informação ruim na
  memória compartilhada.

## Os 4 princípios de produção para memória de agentes

| Princípio | O que garantir | Por quê |
|---|---|---|
| **Versionamento** | Guardar versões da memória (permitir rollback), registrar **qual sessão/transcrição** motivou a mudança, e registrar **quem** fez a mudança (qual agente/humano). | Se uma atualização for ruim, você precisa conseguir reverter e auditar a origem. |
| **Concorrência** (padrão de hashing) | Antes de escrever: (1) tira um hash do estado atual da memória, (2) rascunha a edição, (3) tira outro hash logo antes de gravar. Se os hashes não baterem, outra escrita aconteceu no meio do caminho → descarta, busca a memória de novo, refaz o rascunho e tenta de novo. | É um controle de concorrência otimista (compare-and-swap) aplicado a escritas de agentes — evita que duas escritas simultâneas se sobrescrevam silenciosamente. |
| **Permissionamento** | Modelar a memória em camadas: do conhecimento organizacional (topo, geralmente **somente leitura** para a maioria dos agentes) até o *scratchpad* individual de um agente (escrita liberada só pra ele), com níveis de time/projeto no meio. | Nenhum agente isolado deveria poder reescrever livremente o contexto compartilhado por todos; mas cada agente precisa de espaço próprio de escrita livre. |
| **Portabilidade** | Desenhar a memória curada com uma API limpa, acessível por múltiplos produtos/superfícies/sistemas — não presa a uma única ferramenta. | O esforço de curadoria da memória é valioso demais para ficar isolado em um só lugar. |

**Resultados observados em produção** ao aplicar esses princípios: melhor acurácia
(o agente acerta mais na segunda tentativa da mesma tarefa, porque lembra o que deu
errado antes); menor custo/latência (menos tokens gastos, porque o agente "acerta de
primeira" com mais frequência); e mais capacidade livre para os times de produto, já
que o loop de autoaprendizagem roda sozinho em segundo plano.

**Não é exclusivo de código**: essas práticas funcionam também fora de tarefas de
programação — por exemplo, manter memória de preferências de como montar apresentações
e slides, que evolui com o tempo.

## O limite da memória "in-band" e o padrão "dreaming"

Memória **in-band** = o agente lê/escreve memória dentro da própria sessão em que está
executando a tarefa. Isso tem dois limites estruturais:

1. **Disputa de foco/recursos**: o agente precisa dividir esforço entre concluir a
   tarefa e curar memória para sua versão futura — um trade-off difícil de otimizar, que
   ainda adiciona latência.
2. **Visibilidade limitada**: cada sessão só enxerga sua própria janela de contexto. O
   agente não percebe padrões que se repetem entre sessões, nem entre múltiplos agentes
   rodando em ambientes diferentes ao mesmo tempo.

**Dreaming** é a resposta a isso: um processo de **segunda ordem, assíncrono e em
lote (batch)**, rodando **fora de qualquer sessão de agente**, com recursos (orçamento
de tokens) dedicados só para manter a memória correta, atualizada e eficaz ao longo do
tempo.

**Analogia**: uma escola com muitos alunos entregando trabalhos, professores que
corrigem, e um coordenador pedagógico que revisa tudo. Ter alguém com capacidade
dedicada e visão do conjunto inteiro é o que permite identificar padrões e ajustar o
currículo — é exatamente esse papel que o "dreaming" cumpre para a memória dos agentes.

### Como funciona, passo a passo

1. Pega o **memory store** atual (a coleção de memórias existente).
2. Pega um lote de **transcrições/sessões** de agentes de um período — incluindo não só
   as trocas de mensagem entre agente e usuário, mas também **metadados**: quais
   ferramentas foram chamadas, quais skills foram usadas, etc. (Auditar as chamadas de
   ferramenta é tão importante quanto auditar as respostas.)
3. Um agente **orquestrador** despacha uma frota de **subagentes** para analisar essas
   transcrições em paralelo, cruzando com a memória atual, em busca de padrões (onde a
   memória está causando erro repetido, o que está faltando, etc.).
4. Esses agentes de dreaming/escrita podem ser **orientados (steered)**: você diz
   explicitamente o que conta como relevante ou irrelevante para a sua organização
   especificamente.
5. O orquestrador revisa as respostas de todos os subagentes e decide quais padrões são
   **prevalentes o suficiente** para justificar uma mudança na memória.
6. Propõe mudanças individuais ao memory store — cada proposta vem com: exemplos
   concretos de transcrições onde o padrão apareceu, estatísticas de quão prevalente é
   o problema, e a justificativa da mudança.
7. Um humano (ou processo) revisa e decide aceitar ou rejeitar cada mudança proposta —
   fechando o loop com supervisão.

### Tipos de padrão que o dreaming captura (exemplos)

- **Lacuna sistemática de conhecimento**: um tópico inteiro ausente do contexto (ex.:
  todos os agentes erram a mesma pergunta porque falta aquela informação na memória).
- **Erro de configuração de ferramenta repetido**: todos os agentes cometem o mesmo
  erro sistemático (ex.: usar a unidade errada) — aponta para um ajuste de configuração,
  não para "o modelo ser burro".
- **Falha recorrente em tool call**: algo nas chamadas de ferramenta quebra com
  frequência — só aparece se você auditar os metadados da transcrição, não só o texto.
- **Padrão de estilo/organização "fleet-wide"**: um hábito indesejado se repetindo em
  todos os agentes → vira uma instrução organizacional nova.

Mesmo gastando tokens dedicados no processo de dreaming, o ganho em tarefas
resolvidas "de primeira" no futuro (menos exploração, menos erro repetido) tende a
compensar o custo — o custo líquido tende a **cair**, não subir.

### Permissionamento do dreaming em ambiente multiusuário

O permissionamento de memória e o processo de dreaming compõem bem entre si: ao
configurar um job de dreaming, você escolhe exatamente **quais transcrições** entram
como insumo. Não é obrigatório (nem recomendado) que um job de dreaming puxe "tudo que
aconteceu num período" — configure para que ele só busque transcrições com o **mesmo
conjunto de permissões** do memory store que está sendo atualizado, espelhando o
permissionamento que já existe entre os agentes.

## Autonomia do agente vs. determinismo do harness

Pergunta central ao projetar qualquer um desses sistemas: **onde traçar a fronteira**
entre deixar os agentes agirem autonomamente e o que deveria ser só lógica
programática, embutida (baked in) no harness?

Trajetória observada na prática: começa-se deixando os agentes escreverem e
commitarem arquivos de Markdown livremente. Conforme certos "primitivos" (ex.:
hashing, versionamento) se provam consistentemente úteis, eles são codificados como
mecanismo **determinístico** no harness — reaproveitando princípios de engenharia de
software já consolidados, mas adaptados para que agentes autônomos consigam operar em
cima deles. Não é reinventar a roda por reinventar: é aplicar prática já comprovada
(versionamento, controle de concorrência) assim que houver sinal suficiente de que
aquele primitivo específico deveria ser determinístico, e não deixado ao critério do
agente.

## Erros comuns

| Erro | Consequência | Correção |
|---|---|---|
| Deixar um único arquivo de contexto crescer sem limite | Estoura a janela de contexto; fica difícil de manter e de navegar | Migrar conteúdo procedural para skills; mover memória de fato variável para arquivos indexáveis/pesquisáveis |
| Permitir que qualquer agente escreva no contexto organizacional compartilhado | Um erro se propaga para toda a frota de agentes | Contexto compartilhado = leitura para a maioria; escrita restrita e auditada; scratchpad individual = escrita livre |
| Escrever na memória sem checar se ela mudou desde a leitura | Corridas de escrita corrompem silenciosamente o estado da memória | Padrão de hashing: hash antes de ler, hash antes de escrever, comparar, repetir se divergir |
| Rodar dreaming sobre "tudo" sem filtrar por permissão | Vaza contexto entre times/usuários que não deveriam se misturar | Escopar as transcrições de entrada do dreaming pelo mesmo permissionamento do memory store alvo |
| Nunca versionar mudanças de memória | Impossível reverter uma atualização ruim ou auditar sua origem | Guardar versão + sessão de origem + autor a cada mudança |
| Tratar toda decisão de memória como autonomia do agente | Reinventa em prosa solta problemas que engenharia de software já resolve | Uma vez validado que um primitivo (ex.: versionamento) deve ser determinístico, embuti-lo no harness em vez de depender do agente lembrar de fazer isso |

## Referência rápida

- **Simples primeiro**: arquivo de contexto + skills + memória autônoma resolve a
  maior parte dos casos.
- **Escalando para múltiplos agentes / sessões longas / domínios complexos**: adicionar
  os 4 princípios de produção (versionamento, concorrência, permissionamento,
  portabilidade).
- **Fechando o loop de aprendizado contínuo**: adicionar um processo assíncrono
  fora da sessão (dreaming) para consolidar, podar o que não é mais relevante,
  preencher lacunas e organizar a memória.
