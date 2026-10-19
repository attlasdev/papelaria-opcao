import { useState, type FormEvent } from 'react'
import { Botao } from '../../../componentes/botao/Botao'
import { Campo, Selecao } from '../../../componentes/campo/Campo'
import { CampoMoeda } from '../../../componentes/campo/CampoMoeda'
import { Modal } from '../../../componentes/modal/Modal'
import { reais } from '../../../formatar'
import { ROTULO_MOTIVO_PERDA, useEstadoDemonstracao, type MotivoPerda, type ServicoVenda } from '../../../mock/estado-demonstracao'
import './servicos-ficha.css'

type Props = {
  /** Editar um serviço já posto na ficha; sem isto, é um novo. */
  atual?: ServicoVenda
  aoSalvar: (servico: ServicoVenda) => void
  aoFechar: () => void
}

const MOTIVOS = (Object.keys(ROTULO_MOTIVO_PERDA) as MotivoPerda[]).map((m) => ({ valor: m, rotulo: ROTULO_MOTIVO_PERDA[m] }))

/**
 * Pôr um serviço na ficha: qual serviço, o valor cobrado (vem do cadastro e dá
 * para ajustar), e — se houve — quantas unidades se perderam e por quê, com uma
 * observação livre. Perdas são só conferência: não mexem no estoque.
 */
export function JanelaServicoFicha({ atual, aoSalvar, aoFechar }: Props) {
  const { servicos = [] } = useEstadoDemonstracao()
  const ativos = servicos.filter((s) => !s.inativo || s.codigo === atual?.codigo)
  const [codigo, setCodigo] = useState(atual?.codigo ?? ativos[0]?.codigo ?? '')
  const escolhido = servicos.find((s) => s.codigo === codigo)
  const [valor, setValor] = useState<number | null>(atual?.valor ?? escolhido?.preco ?? null)
  const [perdas, setPerdas] = useState(atual?.perdas ? String(atual.perdas.quantidade) : '')
  const [motivo, setMotivo] = useState<MotivoPerda>(atual?.perdas?.motivo ?? 'impressora')
  const [observacao, setObservacao] = useState(atual?.observacao ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const qtdPerdas = perdas.trim() ? Number(perdas) : 0

  function escolher(proximo: string) {
    setCodigo(proximo)
    // Trocar de serviço traz o valor dele; o ajuste feito antes era para o outro.
    setValor(servicos.find((s) => s.codigo === proximo)?.preco ?? null)
    setErro(null)
  }

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (!escolhido) return setErro('Escolha o serviço.')
    if (valor === null || valor < 0) return setErro('Informe o valor cobrado.')
    if (!Number.isInteger(qtdPerdas) || qtdPerdas < 0) return setErro('As perdas são um número inteiro.')
    aoSalvar({
      codigo: escolhido.codigo,
      nome: escolhido.nome,
      valor,
      ...(qtdPerdas > 0 ? { perdas: { quantidade: qtdPerdas, motivo } } : {}),
      ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
    })
  }

  return (
    <Modal
      estreito
      titulo={atual ? 'Editar serviço da ficha' : 'Inserir serviço'}
      subtitulo={escolhido?.descricao}
      aoFechar={aoFechar}
      rodape={
        <>
          {erro && <span className="servico-ficha__erro" role="alert">{erro}</span>}
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" icone="check" type="submit" form="servico-ficha" disabled={!ativos.length}>{atual ? 'Salvar' : 'Inserir serviço'}</Botao>
        </>
      }
    >
      {ativos.length === 0 ? (
        <p>Nenhum serviço cadastrado. Cadastre em Serviços, no menu.</p>
      ) : (
        <form id="servico-ficha" className="servico-ficha" onSubmit={salvar} noValidate>
          <Selecao rotulo="Serviço" opcoes={ativos.map((s) => ({ valor: s.codigo, rotulo: `${s.nome} · ${reais(s.preco)}` }))} valor={codigo} aoMudar={escolher} />
          <CampoMoeda rotulo="Valor cobrado (R$)" valorCentavos={valor} aoMudar={(v) => { setValor(v); setErro(null) }} ajuda="Vem do cadastro; ajuste se o serviço saiu diferente." />
          <fieldset className="servico-ficha__perdas">
            <legend>Perdas <span className="servico-ficha__opcional">(se houve)</span></legend>
            <Campo rotulo="Unidades perdidas" type="number" min={0} inputMode="numeric" value={perdas} onChange={(e) => { setPerdas(e.target.value); setErro(null) }} placeholder="0" />
            {qtdPerdas > 0 && <Selecao rotulo="Motivo" opcoes={MOTIVOS} valor={motivo} aoMudar={(m) => setMotivo(m as MotivoPerda)} />}
          </fieldset>
          <Campo rotulo="Observação" opcional value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={200} placeholder="Ex.: pediu 2 cópias; saíram 6, 4 manchadas pela impressora" />
        </form>
      )}
    </Modal>
  )
}
