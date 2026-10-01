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

/** Gaveta sobre o Financeiro: lançamento avulso, fora de venda. */
export function RegistrarMovimento() {
  const navegar = useNavigate()
  const fechar = useCallback(() => navegar(rotas.financeiro), [navegar])
  const [fluxo, setFluxo] = useState<'entrada' | 'saida'>('saida')
  const [meio, setMeio] = useState<Meio>('dinheiro')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState<number | null>(null)
  const [erros, setErros] = useState<Partial<Record<'descricao' | 'valor', string>>>({})
  const [erroRegistro, setErroRegistro] = useState('')

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
    const registrado = registrarMovimentoCaixa({
      horario: agoraHorario(),
      data: hojeISO(),
      descricao: descricao.trim(),
      origem: 'Lançamento manual',
      categoria: fluxo === 'entrada' ? 'Recebimento avulso' : 'Despesa',
      meio,
      valor: fluxo === 'entrada' ? centavos : -centavos,
    })
    if (!registrado) { setErroRegistro('Não foi possível registrar. Confira os dados do movimento.'); return }
    fechar()
  }

  return (
    <Modal
      estreito
      titulo="Registrar movimento"
      subtitulo="Entrada avulsa ou despesa da papelaria."
      aoFechar={fechar}
      rodape={<>
        <Botao onClick={fechar}>Cancelar</Botao>
        <Botao variante="primario" type="submit" form="registrar-movimento-formulario" icone="check">{fluxo === 'entrada' ? 'Registrar entrada' : 'Registrar despesa'}</Botao>
      </>}
    >
      <form id="registrar-movimento-formulario" className="registrar-movimento" onSubmit={salvar} noValidate>
        <div className="registrar-movimento__grupo">
          <span className="campo__rotulo">O que deseja registrar?</span>
          <Filtros rotulo="O que deseja registrar?" valor={fluxo} aoMudar={setFluxo} opcoes={[{ valor: 'entrada', rotulo: 'Entrada' }, { valor: 'saida', rotulo: 'Despesa' }]} />
        </div>
        <div className="registrar-movimento__grupo">
          <span className="campo__rotulo">Forma de pagamento</span>
          <Filtros rotulo="Forma de pagamento" valor={meio} aoMudar={setMeio} opcoes={meios} />
        </div>
        <Campo rotulo="Descrição" name="descricao" required autoFocus value={descricao} onChange={(e) => { setDescricao(e.target.value); setErros((atual) => ({ ...atual, descricao: undefined })); setErroRegistro('') }} placeholder={fluxo === 'entrada' ? 'Ex.: recebimento avulso' : 'Ex.: material de limpeza'} erro={Boolean(erros.descricao)} ajuda={erros.descricao} />
        <CampoMoeda rotulo="Valor (R$)" name="valor" required valorCentavos={valor} aoMudar={(proximo) => { setValor(proximo); setErros((atual) => ({ ...atual, valor: undefined })) }} erro={Boolean(erros.valor)} ajuda={erros.valor} />
        <p className="registrar-movimento__nota">Vendas e pagamentos de notinhas são registrados pelas fichas. Para adicionar ou retirar dinheiro da gaveta, acesse Caixa no menu lateral.</p>
        {erroRegistro && <p className="registrar-movimento__erro" role="alert">{erroRegistro}</p>}
      </form>
    </Modal>
  )
}
