import { useState, type FormEvent } from 'react'
import type { Assinatura, Operador, Resultado } from '../../../comum/contrato'
import { CampoPin, pinCompleto } from '../../componentes/assinatura/CampoPin'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
import { Botao, BotaoIcone } from '../../componentes/botao/Botao'
import { Campo } from '../../componentes/campo/Campo'
import { Modal } from '../../componentes/modal/Modal'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { api } from '../../dados/api'
import { recarregarOperadores, useOperadores } from '../../dados/operadores'
import './pessoas.css'

/** O que está sendo feito: primeiro o formulário (se houver), depois o PIN da dona. */
type Acao =
  | { tipo: 'adicionar' }
  | { tipo: 'renomear'; pessoa: Operador }
  | { tipo: 'pin'; pessoa: Operador }
  | { tipo: 'ativar'; pessoa: Operador }

type Pedido = { gesto: string; rotulo: string; fazer: (dona: Assinatura) => Promise<Resultado<Operador>> }

/**
 * As pessoas da loja (`R-OPERADOR-03`): quem pode assinar os gestos. Toda
 * mudança pede o PIN da administradora.
 */
export function Pessoas({ aoFechar }: { aoFechar: () => void }) {
  const operadores = useOperadores()
  const [acao, setAcao] = useState<Acao | null>(null)
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [feito, setFeito] = useState<string | null>(null)

  function pedirDona(novo: Pedido) {
    setAcao(null)
    setPedido(novo)
  }

  function concluir() {
    setFeito(pedido ? `Feito: ${pedido.gesto}.` : null)
    setPedido(null)
    void recarregarOperadores()
  }

  function alternar(pessoa: Operador) {
    pedirDona({
      gesto: `${pessoa.ativo ? 'Desativar' : 'Reativar'} ${pessoa.nome}`,
      rotulo: pessoa.ativo ? 'Desativar' : 'Reativar',
      fazer: (dona) => api().ativarOperador(pessoa.id, !pessoa.ativo, dona),
    })
  }

  return (
    <Modal
      titulo="Pessoas da loja"
      subtitulo="Quem assina vendas, recebimentos e o caixa. Mudanças pedem o PIN da administradora."
      aoFechar={aoFechar}
      rodape={
        <>
          <span className="pessoas__feito" role="status">{feito}</span>
          <Botao variante="primario" icone="adicionar-pessoa" onClick={() => { setFeito(null); setAcao({ tipo: 'adicionar' }) }}>Adicionar pessoa</Botao>
        </>
      }
    >
      {operadores.fase === 'carregando' && <p className="pessoas__texto">Carregando…</p>}
      {operadores.fase === 'erro' && <p className="pessoas__erro">{operadores.mensagem}</p>}
      {operadores.fase === 'pronto' && (
        <ul className="pessoas__lista">
          {operadores.dado.pessoas.map((pessoa) => (
            <li key={pessoa.id} className={pessoa.ativo ? 'pessoas__item' : 'pessoas__item pessoas__item--inativa'}>
              <span className="pessoas__nome">{pessoa.nome}</span>
              <span className="pessoas__selos">
                {pessoa.admin && <SeloCompacto tom="ok">Administradora</SeloCompacto>}
                {!pessoa.ativo && <SeloCompacto tom="neutro">Desativada</SeloCompacto>}
                {pessoa.ativo && !pessoa.temPin && <SeloCompacto tom="atencao">Sem PIN</SeloCompacto>}
              </span>
              <span className="pessoas__acoes">
                <BotaoIcone icone="editar" rotulo={`Renomear ${pessoa.nome}`} title="Renomear" onClick={() => { setFeito(null); setAcao({ tipo: 'renomear', pessoa }) }} />
                <BotaoIcone icone="cadeado" rotulo={`Definir PIN de ${pessoa.nome}`} title="Definir PIN" onClick={() => { setFeito(null); setAcao({ tipo: 'pin', pessoa }) }} />
                {!pessoa.admin && (
                  <Botao variante="fantasma" tamanho="pequeno" onClick={() => { setFeito(null); alternar(pessoa) }}>
                    {pessoa.ativo ? 'Desativar' : 'Reativar'}
                  </Botao>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {acao?.tipo === 'adicionar' && (
        <FormularioPessoa
          titulo="Adicionar pessoa"
          pedeNome
          pedePin
          aoFechar={() => setAcao(null)}
          aoSeguir={({ nome, pin }) => pedirDona({ gesto: `Adicionar ${nome}`, rotulo: 'Adicionar', fazer: (dona) => api().cadastrarOperador(nome, pin, dona) })}
        />
      )}
      {acao?.tipo === 'renomear' && (
        <FormularioPessoa
          titulo={`Renomear ${acao.pessoa.nome}`}
          pedeNome
          nomeInicial={acao.pessoa.nome}
          aoFechar={() => setAcao(null)}
          aoSeguir={({ nome }) => pedirDona({ gesto: `Renomear para ${nome}`, rotulo: 'Renomear', fazer: (dona) => api().renomearOperador(acao.pessoa.id, nome, dona) })}
        />
      )}
      {acao?.tipo === 'pin' && (
        <FormularioPessoa
          titulo={`Novo PIN de ${acao.pessoa.nome}`}
          pedePin
          aoFechar={() => setAcao(null)}
          aoSeguir={({ pin }) => pedirDona({ gesto: `Definir o PIN de ${acao.pessoa.nome}`, rotulo: 'Definir PIN', fazer: (dona) => api().redefinirPin(acao.pessoa.id, pin, dona) })}
        />
      )}
      {pedido && (
        <JanelaAssinatura
          soDona
          gesto={pedido.gesto}
          rotuloConfirmar={pedido.rotulo}
          fazer={pedido.fazer}
          aoConcluir={concluir}
          aoFechar={() => setPedido(null)}
        />
      )}
    </Modal>
  )
}

type PropsFormulario = {
  titulo: string
  pedeNome?: boolean
  pedePin?: boolean
  nomeInicial?: string
  /** Texto do botão; padrão "Continuar" (depois vem o PIN da dona). */
  rotuloSeguir?: string
  /** Erro vindo de fora (a primeira abertura grava direto). */
  erro?: string | null
  enviando?: boolean
  aoSeguir: (dados: { nome: string; pin: string }) => void
  aoFechar?: () => void
}

/** Nome e/ou PIN digitado duas vezes. Fora de janela quando não há `aoFechar` (primeira abertura). */
export function FormularioPessoa({ titulo, pedeNome, pedePin, nomeInicial = '', rotuloSeguir = 'Continuar', erro, enviando, aoSeguir, aoFechar }: PropsFormulario) {
  const [nome, setNome] = useState(nomeInicial)
  const [pin, setPin] = useState('')
  const [repetido, setRepetido] = useState('')
  const naoBate = pinCompleto(repetido) && repetido !== pin
  const pronto = (!pedeNome || nome.trim() !== '') && (!pedePin || (pinCompleto(pin) && repetido === pin))

  function seguir(evento: FormEvent) {
    evento.preventDefault()
    if (pronto && !enviando) aoSeguir({ nome: nome.trim(), pin })
  }

  const campos = (
    <form id="formulario-pessoa" className="pessoas__formulario" onSubmit={seguir}>
      {pedeNome && <Campo rotulo="Nome" icone="pessoa" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} autoFocus required />}
      {pedePin && (
        <>
          <CampoPin rotulo="PIN (4 números)" valor={pin} aoMudar={setPin} autoFocus={!pedeNome} />
          <CampoPin rotulo="Repita o PIN" valor={repetido} aoMudar={setRepetido} erro={naoBate} ajuda={naoBate ? 'Os dois PINs não são iguais.' : undefined} />
        </>
      )}
      {erro && <p className="pessoas__erro">{erro}</p>}
    </form>
  )
  const botao = <Botao type="submit" form="formulario-pessoa" variante="primario" disabled={!pronto || enviando}>{enviando ? 'Gravando…' : rotuloSeguir}</Botao>

  if (!aoFechar) return <>{campos}{botao}</>
  return (
    <Modal estreito titulo={titulo} aoFechar={aoFechar} rodape={<><Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>{botao}</>}>
      {campos}
    </Modal>
  )
}
