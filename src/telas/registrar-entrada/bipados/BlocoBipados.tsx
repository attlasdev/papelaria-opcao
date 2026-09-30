import { Botao, BotaoIcone } from '../../../componentes/botao/Botao'
import { SeloCompacto } from '../../../componentes/selo/Selo'
import { Icone } from '../../../componentes/icone/Icone'
import type { Unidade } from '../../../mock/base/tipos'
import type { RascunhoProduto } from '../../cadastrar-produto/CadastrarProduto'
import './bipados.css'

const nomesUnidade: Record<Unidade, string> = { un: 'Unidade', pct: 'Pacote', cx: 'Caixa' }

/** Código lido pelo leitor, esperando quantidade antes de ir para a tabela da entrada. */
export type Bipado = {
  codigoBarras: string
  /** Código interno do produto já cadastrado. Ausente: produto novo. */
  produto?: string
  descricao?: string
  /** Unidade de venda do produto cadastrado: é nela que o saldo é contado. */
  unidade?: Unidade
  quantidade: string
  /**
   * Em que a quantidade é contada. Produto cadastrado: a unidade dele, fixa.
   * Produto novo: a escolha daqui vira a unidade do cadastro.
   */
  unidadeEntrada: Unidade
  /** Só produto novo: o nome digitado aqui. O resto vem de "Completar cadastro". */
  nome: string
  /** Produto novo com o cadastro preparado: gravado só ao confirmar a entrada. */
  rascunho?: RascunhoProduto
  /** Quantas vezes foi bipado; muda a chave da linha para ela piscar de novo. */
  vezes: number
}

/** Por que "Confirmar entrada" fica bloqueado enquanto houver bipados. */
export const AVISO_BIPADOS = 'Lance ou tire da lista antes de confirmar a entrada'

export function paraQuantidade(texto: string) {
  const valor = Number(texto)
  return Number.isInteger(valor) && valor > 0 ? valor : null
}

/** Unidade em que o saldo é contado: a do cadastro, ou a escolhida para o produto novo. */
export function unidadeBase(bipado: Bipado): Unidade {
  return bipado.unidade ?? bipado.unidadeEntrada
}

/** O que ainda falta na linha; vazio quando pode ir para a tabela. */
export function falta(bipado: Bipado) {
  if (!bipado.produto && !bipado.nome.trim()) return 'Falta o nome'
  if (paraQuantidade(bipado.quantidade) === null) return 'Falta quantidade'
  // Produto novo só vai para a tabela cadastrado de verdade: sem isso entraria sem preço.
  if (!bipado.produto && !bipado.rascunho) return 'Aguardando cadastro'
  return ''
}

type Props = {
  bipados: Bipado[]
  aoMudar: (codigoBarras: string, campos: Partial<Bipado>) => void
  aoRemover: (codigoBarras: string) => void
  aoLancar: () => void
  aoLimpar: () => void
  aoCompletar: (codigoBarras: string) => void
  mostrarAviso?: boolean
}

export function BlocoBipados({ bipados, aoMudar, aoRemover, aoLancar, aoLimpar, aoCompletar, mostrarAviso }: Props) {
  if (bipados.length === 0) return null
  const prontos = bipados.filter((b) => !falta(b)).length

  return (
    <section className="bipados" aria-label="Códigos bipados aguardando quantidade">
      <header className="bipados__topo">
        <div className="bipados__titulo">
          <strong>Bipados · {bipados.length}</strong>
          {mostrarAviso && <span className="bipados__aviso" role="alert">{AVISO_BIPADOS}</span>}
        </div>
        <div className="bipados__acoes">
          <Botao tamanho="pequeno" variante="fantasma" onClick={aoLimpar}>Limpar</Botao>
          <Botao tamanho="pequeno" variante="primario" icone="check" disabled={prontos === 0} onClick={aoLancar}>
            Lançar prontos ({prontos})
          </Botao>
        </div>
      </header>

      <div className="bipados__lista">
        {bipados.map((bipado) => {
          const pendencia = falta(bipado)
          const novo = !bipado.produto
          return (
            <div
              key={`${bipado.codigoBarras}-${bipado.vezes}`}
              data-bipado={bipado.codigoBarras}
              className={novo ? 'bipados__linha bipados__linha--novo' : 'bipados__linha'}
            >
              <div className="bipados__produto">
                {novo ? (
                  <>
                    <SeloCompacto tom="atencao">Novo</SeloCompacto>
                    <input
                      className="bipados__campo bipados__nome"
                      value={bipado.nome}
                      onChange={(e) => aoMudar(bipado.codigoBarras, { nome: e.target.value })}
                      placeholder="Nome do produto"
                      aria-label={`Nome do produto ${bipado.codigoBarras}`}
                    />
                  </>
                ) : (
                  <>
                    <SeloCompacto tom="ok">Cadastrado</SeloCompacto>
                    <span className="bipados__descricao" title={bipado.descricao}>{bipado.descricao}</span>
                  </>
                )}
                <small className="codigo">{bipado.codigoBarras}</small>
              </div>

              {/* Unidade e quantidade num campo só: "Caixa | 2" se lê "2 caixas". */}
              <div className="bipados__par">
                {!bipado.unidade ? (
                  <span className="bipados__unidade">
                    <select
                      value={bipado.unidadeEntrada}
                      onChange={(e) => aoMudar(bipado.codigoBarras, { unidadeEntrada: e.target.value as Unidade })}
                      aria-label="Unidade do produto"
                    >
                      {(['un', 'pct', 'cx'] as const).map((u) => (
                        <option key={u} value={u}>{nomesUnidade[u]}</option>
                      ))}
                    </select>
                    <Icone nome="chevron-baixo" tamanho={16} />
                  </span>
                ) : (
                  <span className="bipados__unidade bipados__unidade--fixa">{nomesUnidade[unidadeBase(bipado)]}</span>
                )}
                <input
                  name="quantidade"
                  className="bipados__numero"
                  value={bipado.quantidade}
                  onChange={(e) => aoMudar(bipado.codigoBarras, { quantidade: e.target.value.replace(/\D/g, '') })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && prontos > 0) { e.preventDefault(); aoLancar() } }}
                  placeholder="Qtd"
                  inputMode="numeric"
                  aria-label={`Quantas ${nomesUnidade[unidadeBase(bipado)].toLowerCase()}s chegaram de ${bipado.descricao ?? bipado.codigoBarras}`}
                />
              </div>

              {novo ? (
                <Botao tamanho="pequeno" icone="editar" onClick={() => aoCompletar(bipado.codigoBarras)}>
                  {bipado.rascunho ? 'Editar cadastro' : 'Completar cadastro'}
                </Botao>
              ) : <span />}

              <span className={!pendencia ? 'bipados__situacao bipados__situacao--pronto' : pendencia === 'Aguardando cadastro' ? 'bipados__situacao bipados__situacao--aguardando' : 'bipados__situacao'}>
                {pendencia || 'Pronto'}
              </span>

              <BotaoIcone icone="fechar" rotulo="Tirar da lista" onClick={() => aoRemover(bipado.codigoBarras)} />
            </div>
          )
        })}
      </div>
    </section>
  )
}
