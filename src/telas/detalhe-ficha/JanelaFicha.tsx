import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Botao } from '../../componentes/botao/Botao'
import { Modal } from '../../componentes/modal/Modal'
import { useSemDestino } from '../../componentes/aviso/Aviso'
import { dataCurta, reais } from '../../formatar'
import { contagemItens, hojeISO, nomeCliente, notinha as notinhaDa, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import { ReceberNotinhas } from '../detalhe-cliente/receber/ReceberNotinhas'
import { ComIcone } from '../../componentes/icone/Icone'
import { AvisoOutrasNotinhas, DadosFicha, PagamentosFicha, TabelaItensFicha, TotaisFicha } from './ConteudoFicha'
import './janela-ficha.css'

type Props = { id: string; aoFechar: () => void }

/**
 * Consulta rápida de uma ficha sem sair do Início. A página /fichas/:id continua
 * existindo para quem chega de Clientes, busca, Financeiro ou sino.
 */
export function JanelaFicha({ id, aoFechar }: Props) {
  const base = useEstadoDemonstracao()
  const navegar = useNavigate()
  const semDestino = useSemDestino()
  const hoje = hojeISO()
  // Uma janela por vez: receber troca a ficha pela janela de recebimento e volta.
  const [recebendo, setRecebendo] = useState<'esta' | 'todas' | null>(null)
  const ficha = base.fichas.find((item) => item.id === id)
  if (!ficha) return null
  const notinha = notinhaDa(ficha, hoje)

  if (recebendo && ficha.clienteId) {
    return <ReceberNotinhas clienteId={ficha.clienteId} marcadas={recebendo === 'esta' ? [ficha.id] : undefined} aoFechar={() => setRecebendo(null)} />
  }

  return (
    <Modal
      titulo={`Ficha #${ficha.id}`}
      subtitulo={`${nomeCliente(base, ficha.clienteId)} · ${dataCurta(ficha.data)} · ${ficha.horario} · operador ${ficha.operador}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao icone="imprimir" onClick={semDestino('imprimir 2ª via')}>
            Imprimir 2ª via
          </Botao>
          <Botao icone="abrir-externo" onClick={() => navegar(rotas.ficha(ficha.id))}>
            Abrir página da ficha
          </Botao>
          {notinha && notinha.emAberto > 0 ? (
            <Botao variante="primario" icone="dinheiro" onClick={() => setRecebendo('esta')}>
              Receber notinha
            </Botao>
          ) : (
            <Botao variante="primario" onClick={aoFechar}>
              Fechar
            </Botao>
          )}
        </>
      }
    >
      <div className="janela-ficha">
        <AvisoOutrasNotinhas base={base} ficha={ficha} hoje={hoje} aoReceberTodas={() => setRecebendo('todas')} />
        <DadosFicha base={base} ficha={ficha} hoje={hoje} colunas={4} />

        <section className="janela-ficha__itens">
          <header>
            <h3><ComIcone icone="pacote">Itens</ComIcone></h3>
            <span>{contagemItens(ficha)}</span>
          </header>
          <div className="janela-ficha__tabela">
            <TabelaItensFicha ficha={ficha} />
          </div>
        </section>

        <div className="janela-ficha__rodape">
          <section>
            <h3><ComIcone icone="dinheiro">{notinha ? 'Pagamentos da notinha' : 'Pagamento'}</ComIcone></h3>
            <PagamentosFicha ficha={ficha} />
          </section>
          <section className="janela-ficha__total">
            <h3><ComIcone icone="recibo">Total da ficha</ComIcone></h3>
            <strong className="numero">{reais(ficha.total)}</strong>
            <TotaisFicha ficha={ficha} hoje={hoje} />
          </section>
        </div>
      </div>
    </Modal>
  )
}
