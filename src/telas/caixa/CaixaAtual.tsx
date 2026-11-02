import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { CaixaDetalhe } from '../../../comum/contrato'
import { Botao } from '../../componentes/botao/Botao'
import { Painel } from '../../componentes/painel/Painel'
import { Icone } from '../../componentes/icone/Icone'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { api } from '../../dados/api'
import { dataHora, reais } from '../../formatar'
import { useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { mensagemDe } from './comum'
import { ConferenciaCaixa } from './ConferenciaCaixa'
import { HistoricoCaixa } from './HistoricoCaixa'
import { MovimentarDinheiro } from './MovimentarDinheiro'
import { FechamentosRecentes } from './FechamentosRecentes'
import './caixa-atual.css'

type Janela = 'abrir' | 'fechar' | 'adicionar' | 'retirar' | 'historico'

export function CaixaAtual() {
  const [carga, setCarga] = useState<{ fase: 'carregando' } | { fase: 'erro'; mensagem: string } | { fase: 'pronto'; caixa: CaixaDetalhe | null }>({ fase: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const recarregar = () => setTentativa((n) => n + 1)
  // Fase 2: a venda e o receber gravam na base da demonstração; o caixa relê quando ela muda.
  const base = useEstadoDemonstracao()
  useEffect(() => {
    let vivo = true
    void api().obterCaixaAtual().then((r) => {
      if (vivo) setCarga(r.ok ? { fase: 'pronto', caixa: r.dado } : { fase: 'erro', mensagem: mensagemDe(r) })
    })
    return () => { vivo = false }
  }, [base, tentativa])
  const aberto = carga.fase === 'pronto' ? carga.caixa : null
  // Vindo do "aguardando a dona" do Início, o histórico abre no turno.
  const [parametros] = useSearchParams()
  const [janela, setJanela] = useState<Janela | null>(parametros.get('turno') ? 'historico' : null)
  const [mensagem, setMensagem] = useState('')
  const [turnoSelecionado, setTurnoSelecionado] = useState<string | null>(parametros.get('turno'))
  const fechar = () => setJanela(null)
  const abrir = (proxima: Janela) => { setMensagem(''); setJanela(proxima) }
  const concluir = (texto: string) => { setMensagem(texto); fechar(); recarregar() }

  return <>
    <Painel titulo="Caixa atual" className="caixa-atual">
      {carga.fase === 'erro' && (
        <div className="caixa-atual__falha" role="alert">
          <span>{carga.mensagem}</span>
          <Botao tamanho="pequeno" onClick={recarregar}>Tentar de novo</Botao>
        </div>
      )}
      {carga.fase === 'carregando' && <p className="caixa-atual__mensagem" role="status">Carregando o caixa…</p>}
      {carga.fase === 'pronto' && <div className="caixa-atual__conteudo">
        <div className="caixa-atual__situacao">
          <Icone nome="dinheiro" tamanho={32} className="caixa-atual__icone" />
          <div className="caixa-atual__identificacao">
            <SeloCompacto tom={aberto ? 'ok' : 'neutro'}>{aberto ? 'Caixa aberto' : 'Caixa fechado'}</SeloCompacto>
            {aberto ? <><span>Aberto em <strong className="numero">{dataHora(aberto.abertoEm)}</strong></span><span>Por {aberto.operadorAbertura}</span></> : <span>Conte o dinheiro da gaveta para começar.</span>}
          </div>
        </div>
        {aberto && <div className="caixa-atual__valor"><span>Esperado na gaveta</span><strong>{reais(aberto.resumo.esperado)}</strong></div>}
        <div className="caixa-atual__acoes">
          {aberto ? <><Botao onClick={() => abrir('adicionar')}>Adicionar dinheiro</Botao><Botao onClick={() => abrir('retirar')}>Retirar dinheiro</Botao><Botao variante="primario" onClick={() => abrir('fechar')}>Fechar caixa</Botao></> : <Botao variante="primario" onClick={() => abrir('abrir')}>Abrir caixa</Botao>}
        </div>
      </div>}
      {mensagem && <p className="caixa-atual__mensagem" role="status">{mensagem}</p>}
      <FechamentosRecentes versao={tentativa} aoVer={(id) => { setTurnoSelecionado(id); abrir('historico') }} aoConsultar={() => { setTurnoSelecionado(null); abrir('historico') }} />
    </Painel>
    {(janela === 'abrir' || (janela === 'fechar' && aberto)) && <ConferenciaCaixa acao={janela} aberto={aberto} aoFechar={fechar} aoConcluir={concluir} />}
    {(janela === 'retirar' || janela === 'adicionar') && <MovimentarDinheiro acao={janela} aoFechar={fechar} aoConcluir={concluir} />}
    {janela === 'historico' && <HistoricoCaixa turnoInicial={turnoSelecionado} aoFechar={() => { fechar(); recarregar() }} />}
  </>
}
