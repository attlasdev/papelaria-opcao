import type { Contrato } from '../../comum/contrato'
import { mockInstalado } from '../mock/instalado'
import { comAviso } from './mudancas'
import { operadoresDaBase } from '../mock/operacoes/operadores'
import { produtosDaBase } from '../mock/operacoes/produtos'
import { entradasDaBase } from '../mock/operacoes/entradas'
import { ajustesDaBase } from '../mock/operacoes/ajustes'
import { movimentosDaBase } from '../mock/operacoes/movimentos'
import { clientesDaBase } from '../mock/operacoes/clientes'
import { vendasDaBase } from '../mock/operacoes/vendas'
import { fichasDaBase } from '../mock/operacoes/fichas'
import { recebimentosDaBase } from '../mock/operacoes/recebimentos'
import { vendasSemIdentificacaoDaBase } from '../mock/operacoes/vendas-sem-identificacao'
import { boletosDaBase } from '../mock/operacoes/boletos'
import { servicosDaBase } from '../mock/operacoes/servicos'
import { caixaDaBase } from '../mock/operacoes/caixa'
import { financeiroDaBase } from '../mock/operacoes/financeiro'
import { inicioDaBase } from '../mock/operacoes/inicio'
import { avisosDaBase } from '../mock/operacoes/avisos'
import { buscaDaBase } from '../mock/operacoes/busca'

/**
 * Por onde as telas migradas para a 1.0 chamam o contrato, durante a Fase 2.
 *
 * Até a Fase 3 a fonte da verdade é a base da demonstração (o documento que a
 * sincronia leva ao banco): as operações já migradas respondem por ela, aqui no
 * renderer, para o app continuar com uma base só (plano da 1.0, "Como a 1.0 é
 * feita"). O lado SQLite das mesmas operações já existe em `electron/` e passa
 * nos mesmos testes de contrato.
 *
 * No navegador, `window.api` já é o mock, que responde por estas mesmas
 * operações com o atraso e a falha forçada por cima (`src/mock/simular.ts`).
 *
 * Na Fase 3 isto vira `window.api` puro, e o arquivo some.
 *
 * Função, não constante: no navegador o mock só preenche `window.api` depois
 * que os módulos das telas já foram carregados. Toda chamada passa pelo aviso
 * às telas (`./mudancas`).
 */
let daBase: Contrato | null = null
const fonte = (): Contrato => (mockInstalado() ? window.api : (daBase ??= { ...window.api, ...operadoresDaBase, ...produtosDaBase, ...entradasDaBase, ...ajustesDaBase, ...movimentosDaBase, ...clientesDaBase, ...vendasDaBase, ...fichasDaBase, ...recebimentosDaBase, ...vendasSemIdentificacaoDaBase, ...boletosDaBase, ...servicosDaBase, ...caixaDaBase, ...financeiroDaBase, ...inicioDaBase, ...avisosDaBase, ...buscaDaBase }))
const comOAviso = comAviso(fonte)
export const api = (): Contrato => comOAviso
