import { useState } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { Modal } from '../../componentes/modal/Modal'
import { useSemDestino } from '../../componentes/aviso/Aviso'
import { reais } from '../../formatar'
import { ReceberNotinhas } from '../detalhe-cliente/receber/ReceberNotinhas'
import { ComIcone } from '../../componentes/icone/Icone'
import {
  AnotacoesFicha, AvisoOutrasNotinhas, BotaoCancelarFicha, contagemItens, DadosFicha, FaixaCancelada, PagamentosFicha, subtituloFicha,
  TabelaItensFicha, TotaisFicha, useFicha,
} from './ConteudoFicha'
import './janela-ficha.css'

type Props = { id: string; aoFechar: () => void }

/** Consulta rápida de uma ficha sem sair da tela. Aberta por useAbrirFicha, de qualquer lugar. */
export function JanelaFicha({ id, aoFechar }: Props) {
  const semDestino = useSemDestino()
  const { carga, atualizar, tentarDeNovo } = useFicha(id)
  // Uma janela por vez: receber troca a ficha pela janela de recebimento e volta.
  const [recebendo, setRecebendo] = useState<'esta' | 'todas' | null>(null)

  if (carga.fase !== 'pronto') {
    return (
      <Modal titulo="Ficha" aoFechar={aoFechar} rodape={<Botao variante="primario" onClick={aoFechar}>Fechar</Botao>}>
        {carga.fase === 'carregando'
          ? <p className="detalhe-ficha__resumo" role="status">Carregando a ficha…</p>
          : (
            <div className="detalhe-ficha__falha" role="alert">
              <span>{carga.mensagem}</span>
              {!carga.naoEncontrada && <Botao tamanho="pequeno" onClick={tentarDeNovo}>Tentar de novo</Botao>}
            </div>
          )}
      </Modal>
    )
  }
  const ficha = carga.ficha
  const notinhaAberta = ficha.forma === 'notinha' && ficha.emAberto > 0

  if (recebendo && ficha.cliente) {
    return <ReceberNotinhas clienteId={ficha.cliente.id} marcadas={recebendo === 'esta' ? [ficha.id] : undefined} aoFechar={() => setRecebendo(null)} />
  }

  return (
    <Modal
      titulo={`Ficha #${ficha.numero}`}
      subtitulo={subtituloFicha(ficha)}
      aoFechar={aoFechar}
      rodape={
        <>
          <BotaoCancelarFicha ficha={ficha} aoMudar={atualizar} />
          <Botao icone="imprimir" onClick={semDestino('imprimir 2ª via')}>
            Imprimir 2ª via
          </Botao>
          {notinhaAberta ? (
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
        <FaixaCancelada ficha={ficha} aoMudar={atualizar} />
        <AvisoOutrasNotinhas ficha={ficha} aoReceberTodas={() => setRecebendo('todas')} />
        <DadosFicha ficha={ficha} colunas={4} />

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
            <h3><ComIcone icone="dinheiro">{ficha.forma === 'notinha' ? 'Pagamentos da notinha' : 'Pagamento'}</ComIcone></h3>
            <PagamentosFicha ficha={ficha} />
            {ficha.forma === 'notinha' && (
              <>
                <h3 className="janela-ficha__subtitulo"><ComIcone icone="editar">Anotações</ComIcone></h3>
                <AnotacoesFicha ficha={ficha} aoMudar={atualizar} />
              </>
            )}
          </section>
          <section className="janela-ficha__total">
            <h3><ComIcone icone="recibo">Total da ficha</ComIcone></h3>
            <strong className="numero">{reais(ficha.total)}</strong>
            <TotaisFicha ficha={ficha} />
          </section>
        </div>
      </div>
    </Modal>
  )
}
