import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Painel } from '../../componentes/painel/Painel'
import { Campo, Selecao } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Botao } from '../../componentes/botao/Botao'
import { agoraHorario, hojeISO, registrarMovimentoCaixa, type Meio } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './registrar-movimento.css'

const meios: Record<Meio, string> = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão' }

export function RegistrarMovimento() {
  const navegar = useNavigate()
  const [fluxo, setFluxo] = useState<'entrada' | 'saida'>('saida')
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
      requestAnimationFrame(() => {
        const alvo = formulario.querySelector<HTMLInputElement>(`[name="${primeiro}"]`)
        alvo?.scrollIntoView({ block: 'center' })
        alvo?.focus({ preventScroll: true })
      })
      return
    }
    registrarMovimentoCaixa({
      horario: agoraHorario(),
      data: hojeISO(),
      descricao: descricao.trim(),
      origem: 'Lançamento manual',
      categoria: fluxo === 'entrada' ? 'Recebimento avulso' : 'Despesa / retirada',
      meio,
      valor: fluxo === 'entrada' ? centavos : -centavos,
    })
    navegar(rotas.financeiro)
  }

  return (
    <Tela
      voltar={{ para: rotas.financeiro, rotulo: 'Voltar para financeiro' }}
      trilha={<Link className="registrar-movimento__link" to={rotas.financeiro}>Financeiro</Link>}
      titulo="Registrar movimento"
      subtitulo="Lançamento manual de uma entrada avulsa ou saída de caixa."
      busca="Buscar no sistema..."
    >
      <form className="registrar-movimento" onSubmit={salvar} noValidate>
        <Painel titulo="Dados do movimento">
          <div className="registrar-movimento__campos">
            <Selecao rotulo="Fluxo" valor={fluxo} aoMudar={(valor) => setFluxo(valor as typeof fluxo)} opcoes={[{ valor: 'entrada', rotulo: 'Entrada' }, { valor: 'saida', rotulo: 'Saída' }]} />
            <Selecao rotulo="Meio" valor={meio} aoMudar={(valor) => setMeio(valor as Meio)} opcoes={Object.entries(meios).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            <Campo rotulo="Descrição" name="descricao" required value={descricao} onChange={(e) => { setDescricao(e.target.value); setErros((atual) => ({ ...atual, descricao: undefined })) }} placeholder="Ex.: material de limpeza" className="registrar-movimento__largo" erro={Boolean(erros.descricao)} ajuda={erros.descricao} />
            <CampoMoeda rotulo="Valor (R$)" name="valor" required valorCentavos={valor} aoMudar={(proximo) => { setValor(proximo); setErros((atual) => ({ ...atual, valor: undefined })) }} erro={Boolean(erros.valor)} ajuda={erros.valor} />
          </div>
          <p className="registrar-movimento__nota">Para vendas, use a ficha. Este lançamento avulso não receberá cliente nem produtos por suposição. Dados válidos apenas nesta sessão.</p>
        </Painel>
        <div className="registrar-movimento__acoes">
          <Link className="botao botao--secundario" to={rotas.financeiro}>Cancelar</Link>
          <Botao variante="primario" type="submit" icone="check">Registrar movimento</Botao>
        </div>
      </form>
    </Tela>
  )
}
