import { useState, type FormEvent } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { Campo } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Modal } from '../../componentes/modal/Modal'
import { cadastrarServico, editarServico, excluirServico, definirServicoAtivo, servicoTemHistorico, useEstadoDemonstracao, type Servico } from '../../mock/estado-demonstracao'
import './servicos.css'

type Props = { servico?: Servico; aoFechar: () => void }

/**
 * Cadastrar ou editar um serviço: nome, valor e descrição. Sem forma de
 * cobrança (`2026-10-19`): o valor é o sugerido na ficha, ajustável lá.
 * Serviço nunca usado se exclui; usado, desativa (as fichas continuam citando).
 */
export function JanelaServico({ servico, aoFechar }: Props) {
  const base = useEstadoDemonstracao()
  const [nome, setNome] = useState(servico?.nome ?? '')
  const [preco, setPreco] = useState<number | null>(servico?.preco ?? null)
  const [descricao, setDescricao] = useState(servico?.descricao ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const usado = servico ? servicoTemHistorico(base, servico.codigo) : false

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (!nome.trim()) return setErro('Informe o nome do serviço.')
    if (preco === null || preco < 0) return setErro('Informe o valor do serviço.')
    const dados = { nome, preco, descricao }
    const certo = servico ? editarServico(servico.codigo, dados) : Boolean(cadastrarServico(dados))
    if (!certo) return setErro('Não foi possível salvar. Confira os dados.')
    aoFechar()
  }

  function remover() {
    if (!servico) return
    if (usado) definirServicoAtivo(servico.codigo, false)
    else excluirServico(servico.codigo)
    aoFechar()
  }

  return (
    <Modal
      estreito
      titulo={servico ? 'Editar serviço' : 'Cadastrar serviço'}
      subtitulo={servico ? servico.codigo : 'O valor é o sugerido na ficha; dá para ajustar na hora.'}
      aoFechar={aoFechar}
      rodape={
        <>
          {servico && !servico.inativo && (
            <Botao variante="fantasma" className="janela-servico__remover" onClick={remover} title={usado ? 'Já usado em fichas: sai da venda, mas as fichas continuam citando' : 'Nunca usado: apaga de vez'}>
              {usado ? 'Desativar' : 'Excluir'}
            </Botao>
          )}
          {erro && <span className="janela-servico__erro" role="alert">{erro}</span>}
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" icone="check" type="submit" form="janela-servico">{servico ? 'Salvar alterações' : 'Salvar serviço'}</Botao>
        </>
      }
    >
      <form id="janela-servico" className="janela-servico" onSubmit={salvar} noValidate>
        <Campo rotulo="Nome do serviço" value={nome} onChange={(e) => { setNome(e.target.value); setErro(null) }} placeholder="Ex.: Cópia P&B" autoFocus required />
        <CampoMoeda rotulo="Valor (R$)" valorCentavos={preco} aoMudar={(v) => { setPreco(v); setErro(null) }} />
        <Campo rotulo="Descrição" opcional value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Por cópia, A4" maxLength={160} />
      </form>
    </Modal>
  )
}
