import { useCallback, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Modal } from '../../componentes/modal/Modal'
import { Campo } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Botao } from '../../componentes/botao/Botao'
import { Filtros } from '../../componentes/filtros/Filtros'
import { agoraHorario, hojeISO, registrarMovimentoCaixa, type Meio } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './registrar-movimento.css'

const meios: { valor: Meio; rotulo: string }[] = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'cartao', rotulo: 'Cartão' },
]

/**
 * Saída que não é gasto: dinheiro levado ao cofre só muda de lugar. Separar da
 * despesa deixa a categoria dizer o que de fato aconteceu com o caixa.
 */
const tiposSaida = [
  { valor: 'despesa', rotulo: 'Despesa', categoria: 'Despesa' },
  { valor: 'retirada', rotulo: 'Retirada do caixa', categoria: 'Retirada de caixa' },
] as const

/** Gaveta sobre o Financeiro: lançamento avulso, fora de venda. */
export function RegistrarMovimento() {
  const navegar = useNavigate()
  const fechar = useCallback(() => navegar(rotas.financeiro), [navegar])
  const [fluxo, setFluxo] = useState<'entrada' | 'saida'>('saida')
  const [tipoSaida, setTipoSaida] = useState<(typeof tiposSaida)[number]['valor']>('despesa')
  const [meio, setMeio] = useState<Meio>('dinheiro')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState<number | null>(null)
  const [erros, setErros] = useState<Partial<Record<'descricao' | 'valor', string>>>({})

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    const formulario = evento.currentTarget as HTMLFormElement
    const centavos = valor ?? 0
    const falhas: typeof erros = {}
    if (!descricao.trim()) falhas.descricao = 'Informe a descrição do movimento.'
    if (!Number.isSafeInteger(centavos) || centavos <= 0) falhas.valor = 'Informe um valor maior que zero.'
    const primeiro = (['descricao', 'valor'] as const).find((campo) => falhas[campo])
    if (primeiro) {
      setErros(falhas)
      requestAnimationFrame(() => formulario.querySelector<HTMLInputElement>(`[name="${primeiro}"]`)?.focus())
      return
    }
    registrarMovimentoCaixa({
      horario: agoraHorario(),
      data: hojeISO(),
      descricao: descricao.trim(),
      origem: 'Lançamento manual',
      categoria: fluxo === 'entrada' ? 'Recebimento avulso' : tiposSaida.find((t) => t.valor === tipoSaida)!.categoria,
      meio,
      valor: fluxo === 'entrada' ? centavos : -centavos,
    })
    fechar()
  }

  return (
    <Modal
      variante="lateral"
      titulo="Registrar movimento"
      subtitulo="Entrada ou saída avulsa do caixa."
      aoFechar={fechar}
      rodape={<>
        <Botao onClick={fechar}>Cancelar</Botao>
        <Botao variante="primario" type="submit" form="registrar-movimento-formulario" icone="check">Registrar movimento</Botao>
      </>}
    >
      <form id="registrar-movimento-formulario" className="registrar-movimento" onSubmit={salvar} noValidate>
        <div className="registrar-movimento__grupo">
          <span className="campo__rotulo">Fluxo</span>
          <Filtros rotulo="Fluxo" valor={fluxo} aoMudar={setFluxo} opcoes={[{ valor: 'entrada', rotulo: 'Entrada' }, { valor: 'saida', rotulo: 'Saída' }]} />
        </div>
        {fluxo === 'saida' && (
          <div className="registrar-movimento__grupo">
            <span className="campo__rotulo">Tipo de saída</span>
            <Filtros rotulo="Tipo de saída" valor={tipoSaida} aoMudar={setTipoSaida} opcoes={tiposSaida.map(({ valor, rotulo }) => ({ valor, rotulo }))} />
          </div>
        )}
        <div className="registrar-movimento__grupo">
          <span className="campo__rotulo">Meio</span>
          <Filtros rotulo="Meio" valor={meio} aoMudar={setMeio} opcoes={meios} />
        </div>
        <Campo rotulo="Descrição" name="descricao" required autoFocus value={descricao} onChange={(e) => { setDescricao(e.target.value); setErros((atual) => ({ ...atual, descricao: undefined })) }} placeholder={fluxo === 'saida' && tipoSaida === 'retirada' ? 'Ex.: levado ao cofre' : 'Ex.: material de limpeza'} erro={Boolean(erros.descricao)} ajuda={erros.descricao} />
        <CampoMoeda rotulo="Valor (R$)" name="valor" required valorCentavos={valor} aoMudar={(proximo) => { setValor(proximo); setErros((atual) => ({ ...atual, valor: undefined })) }} erro={Boolean(erros.valor)} ajuda={erros.valor} />
        <p className="registrar-movimento__nota">Vendas entram pela ficha.</p>
      </form>
    </Modal>
  )
}
