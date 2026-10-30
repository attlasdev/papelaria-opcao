import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { Assinatura, MovimentoEstoque, Produto } from '../../../comum/contrato'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
import { Modal } from '../../componentes/modal/Modal'
import { Botao } from '../../componentes/botao/Botao'
import { Filtros } from '../../componentes/filtros/Filtros'
import { SeloCompacto, type Tom } from '../../componentes/selo/Selo'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { dataCurta, reais } from '../../formatar'
import { useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './movimentacoes-estoque.css'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'

/** O histórico tem milhares de movimentos: vem do back, de 50 em 50. */
const POR_VEZ = 50

type Aba = 'todas' | 'entrada' | 'ajuste' | 'venda' | 'aguardando'

const rotuloTipo: Record<MovimentoEstoque['tipo'], { rotulo: string; tom: Tom }> = {
  entrada: { rotulo: 'Entrada', tom: 'ok' },
  cancelamento: { rotulo: 'Cancelamento', tom: 'ok' },
  venda: { rotulo: 'Venda', tom: 'neutro' },
  ajuste: { rotulo: 'Ajuste', tom: 'atencao' },
}

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** O que a dona vai conferir: um ajuste, ou os mostrados no filtro dos aguardando. */
type Conferindo = { ids: string[]; gesto: string }

/**
 * O histórico do estoque (1.0, tela 2.6): entradas, vendas, ajustes e
 * cancelamentos, do mais novo ao mais velho. O ajuste de funcionário aparece
 * "aguardando conferência" até a dona dar o visto (`R-ESTOQUE-11`).
 */
export function MovimentacoesEstoque() {
  const abrirFicha = useAbrirFicha()
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const fechar = useCallback(() => navegar(rotas.estoque), [navegar])
  const produtoId = parametros.get('produto')
  // O sino abre direto no filtro dos aguardando.
  const [aba, setAba] = useState<Aba>(parametros.get('aguardando') ? 'aguardando' : 'todas')
  const [produto, setProduto] = useState<Produto | null>(null)
  const [itens, setItens] = useState<MovimentoEstoque[]>([])
  const [total, setTotal] = useState(0)
  const [aguardando, setAguardando] = useState(0)
  const [carregadas, setCarregadas] = useState(1)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [conferindo, setConferindo] = useState<Conferindo | null>(null)
  // Fase 2: Entrada, Ajuste e a venda ainda gravam na base da demonstração; a lista relê quando ela muda.
  const base = useEstadoDemonstracao()

  useEffect(() => {
    if (!produtoId) { setProduto(null); return }
    let vivo = true
    void api().obterProduto(produtoId).then((r) => { if (vivo && r.ok) setProduto(r.dado) })
    return () => { vivo = false }
  }, [produtoId])

  // Troca de filtro volta para a primeira leva.
  useEffect(() => { setCarregadas(1) }, [aba, produtoId])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    const filtro = { produtoId, tipo: aba === 'aguardando' ? 'todas' as const : aba, aguardando: aba === 'aguardando' }
    // Relê as levas que já estavam na tela, para a lista não encolher depois de conferir.
    const levas = Array.from({ length: carregadas }, (_, i) => api().listarMovimentosEstoque(filtro, i + 1, POR_VEZ))
    void Promise.all(levas).then((respostas) => {
      if (!vivo) return
      setCarregando(false)
      const falhou = respostas.find((r) => !r.ok)
      if (falhou && !falhou.ok) return setErro(falhou.causa === 'validacao' ? falhou.erro : `${tituloFalha(falhou.causa)} ${falhou.erro}`)
      const paginas = respostas.flatMap((r) => (r.ok ? [r.dado] : []))
      setErro(null)
      setItens(paginas.flatMap((p) => p.movimentos))
      setTotal(paginas[0]?.total ?? 0)
      setAguardando(paginas[0]?.aguardando ?? 0)
    })
    return () => { vivo = false }
  }, [aba, produtoId, carregadas, base, tentativa])

  // Conferiu o último que aguardava: o filtro some e a lista volta para Todas.
  useEffect(() => { if (aba === 'aguardando' && !carregando && !erro && aguardando === 0) setAba('todas') }, [aba, carregando, erro, aguardando])

  const conferir = (ids: string[]) => (dona: Assinatura) => api().conferirAjustes(ids, dona)

  return (
    <>
    <Modal
      variante="lateral"
      titulo={produto ? `Movimentações de ${produto.codigo}` : 'Movimentações do estoque'}
      subtitulo={produto?.descricao ?? 'Entradas, vendas e correções de contagem.'}
      aoFechar={fechar}
    >
      <div className="movimentacoes-estoque__controles">
        <Filtros
          rotulo="Tipo de movimentação"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: 'todas', rotulo: 'Todas' }, { valor: 'entrada', rotulo: 'Entradas' }, { valor: 'ajuste', rotulo: 'Ajustes' }, { valor: 'venda', rotulo: 'Vendas' },
            ...(aguardando > 0 || aba === 'aguardando' ? [{ valor: 'aguardando' as const, rotulo: 'Aguardando conferência', contagem: aguardando }] : []),
          ]}
        />
        {produtoId && <Botao tamanho="pequeno" onClick={() => navegar(rotas.movimentacoesEstoque(), { replace: true })}>Ver todos</Botao>}
      </div>
      <div className="movimentacoes-estoque__total">
        <span>
          {carregando && itens.length === 0 ? 'Carregando…' : `${total} ${total === 1 ? 'movimentação' : 'movimentações'}`}
          {itens.length > 0 && itens.length < total && ` · mostrando as ${itens.length} mais recentes`}
        </span>
        {aba === 'aguardando' && itens.length > 0 && (
          <Botao tamanho="pequeno" variante="primario" icone="check" onClick={() => setConferindo({
            ids: itens.map((m) => m.id),
            gesto: `Conferir ${itens.length === 1 ? 'o ajuste mostrado' : `os ${itens.length} ajustes mostrados`}`,
          })}>
            Conferir {itens.length === 1 ? 'o mostrado' : `os ${itens.length} mostrados`}
          </Botao>
        )}
      </div>
      {erro && (
        <div className="movimentacoes-estoque__falha" role="alert">
          <span>{erro}</span>
          <Botao tamanho="pequeno" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Botao>
        </div>
      )}
      <div className="movimentacoes-estoque__lista">
        {itens.map((item) => (
          <article className="movimentacoes-estoque__item" key={item.id}>
            <div className="movimentacoes-estoque__item-topo">
              <span className="movimentacoes-estoque__data numero">{dataHora.format(new Date(item.registradoEm))}{item.operador && ` · ${item.operador}`}</span>
              <SeloCompacto tom={rotuloTipo[item.tipo].tom}>{rotuloTipo[item.tipo].rotulo}</SeloCompacto>
            </div>
            <strong className="movimentacoes-estoque__produto" title={item.produto.descricao}>{item.produto.descricao}</strong>
            <span className="movimentacoes-estoque__codigo codigo">{item.produto.codigo}</span>
            <div className="movimentacoes-estoque__item-rodape">
              <span className="movimentacoes-estoque__motivo">
                {item.ficha ? (
                  <button type="button" className="movimentacoes-estoque__ficha" onClick={() => abrirFicha(item.ficha!.id)}>
                    Ficha #{item.ficha.numero}{item.tipo === 'cancelamento' ? ' cancelada' : ''}
                  </button>
                ) : null}
                {item.ficha && item.motivo ? ` · ${item.motivo}` : item.motivo}
              </span>
              <span className="movimentacoes-estoque__saldos numero">{item.saldoAntes} <span aria-label="para">→</span> <strong>{item.saldoDepois}</strong></span>
            </div>
            {item.aguardandoConferencia && (
              <div className="movimentacoes-estoque__conferencia movimentacoes-estoque__conferencia--aguardando">
                <SeloCompacto tom="atencao">Aguardando conferência</SeloCompacto>
                <Botao tamanho="pequeno" onClick={() => setConferindo({ ids: [item.id], gesto: `Conferir o ajuste de ${item.produto.descricao}: ${item.saldoAntes} → ${item.saldoDepois}` })}>
                  Conferir
                </Botao>
              </div>
            )}
            {item.conferencia && item.operador !== item.conferencia.por && (
              <p className="movimentacoes-estoque__conferencia">Conferido por {item.conferencia.por} · {dataHora.format(new Date(item.conferencia.em))}</p>
            )}
            {item.entrada && (
              <dl className="movimentacoes-estoque__entrada">
                <div><dt>Recebido em</dt><dd>{dataCurta(item.entrada.recebidaEm)}</dd></div>
                {item.entrada.fornecedor && <div><dt>Fornecedor</dt><dd>{item.entrada.fornecedor}</dd></div>}
                {item.entrada.referencia && <div><dt>Referência</dt><dd>{item.entrada.referencia}</dd></div>}
                {item.entrada.custoUnitario !== null && <div><dt>Custo unitário</dt><dd>{reais(item.entrada.custoUnitario)}</dd></div>}
                {item.entrada.observacoes && <div className="movimentacoes-estoque__entrada-observacoes"><dt>Observações</dt><dd>{item.entrada.observacoes}</dd></div>}
              </dl>
            )}
          </article>
        ))}
        {!carregando && !erro && itens.length === 0 && <p className="movimentacoes-estoque__vazio">Nenhuma movimentação encontrada para este filtro.</p>}
        {itens.length < total && (
          <Botao className="movimentacoes-estoque__mais" disabled={carregando} onClick={() => setCarregadas((n) => n + 1)}>
            {carregando ? 'Carregando…' : 'Mostrar mais'}
          </Botao>
        )}
      </div>
    </Modal>
    {/* Fora da gaveta: dentro dela, o CSS da lateral esticaria a janela. */}
    {conferindo && (
      <JanelaAssinatura
        soDona
        gesto={conferindo.gesto}
        rotuloConfirmar="Conferir"
        fazer={conferir(conferindo.ids)}
        aoConcluir={() => { setConferindo(null); setTentativa((n) => n + 1) }}
        aoFechar={() => setConferindo(null)}
      />
    )}
    </>
  )
}
