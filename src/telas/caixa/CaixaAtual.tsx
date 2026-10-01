import { useState } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { Painel } from '../../componentes/painel/Painel'
import { Icone } from '../../componentes/icone/Icone'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { dataHora, reais } from '../../formatar'
import { resumoTurnoCaixa, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { ConferenciaCaixa } from './ConferenciaCaixa'
import { HistoricoCaixa } from './HistoricoCaixa'
import { MovimentarDinheiro } from './MovimentarDinheiro'
import { FechamentosRecentes } from './FechamentosRecentes'
import './caixa-atual.css'

type Janela = 'abrir' | 'fechar' | 'adicionar' | 'retirar' | 'historico'

export function CaixaAtual() {
  const base = useEstadoDemonstracao()
  const aberto = (base.turnosCaixa ?? []).find((turno) => !turno.fechadoEm)
  const [janela, setJanela] = useState<Janela | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [turnoSelecionado, setTurnoSelecionado] = useState<string | null>(null)
  const fechar = () => setJanela(null)
  const abrir = (proxima: Janela) => { setMensagem(''); setJanela(proxima) }
  const concluir = (texto: string) => { setMensagem(texto); fechar() }

  return <>
    <Painel titulo="Caixa atual" className="caixa-atual">
      <div className="caixa-atual__conteudo">
        <div className="caixa-atual__situacao">
          <Icone nome="dinheiro" tamanho={32} className="caixa-atual__icone" />
          <div className="caixa-atual__identificacao">
            <SeloCompacto tom={aberto ? 'ok' : 'neutro'}>{aberto ? 'Caixa aberto' : 'Caixa fechado'}</SeloCompacto>
            {aberto ? <><span>Aberto em <strong className="numero">{dataHora(aberto.abertoEm)}</strong></span><span>Por {aberto.operadorAbertura}</span></> : <span>Conte o dinheiro da gaveta para começar.</span>}
          </div>
        </div>
        {aberto && <div className="caixa-atual__valor"><span>Esperado na gaveta</span><strong>{reais(resumoTurnoCaixa(base, aberto).esperado)}</strong></div>}
        <div className="caixa-atual__acoes">
          {aberto ? <><Botao onClick={() => abrir('adicionar')}>Adicionar dinheiro</Botao><Botao onClick={() => abrir('retirar')}>Retirar dinheiro</Botao><Botao variante="primario" onClick={() => abrir('fechar')}>Fechar caixa</Botao></> : <Botao variante="primario" onClick={() => abrir('abrir')}>Abrir caixa</Botao>}
        </div>
      </div>
      {mensagem && <p className="caixa-atual__mensagem" role="status">{mensagem}</p>}
      <FechamentosRecentes aoVer={(id) => { setTurnoSelecionado(id); abrir('historico') }} aoConsultar={() => { setTurnoSelecionado(null); abrir('historico') }} />
    </Painel>
    {(janela === 'abrir' || janela === 'fechar') && <ConferenciaCaixa acao={janela} aoFechar={fechar} aoConcluir={concluir} />}
    {(janela === 'retirar' || janela === 'adicionar') && <MovimentarDinheiro acao={janela} aoFechar={fechar} aoConcluir={concluir} />}
    {janela === 'historico' && <HistoricoCaixa turnoInicial={turnoSelecionado} aoFechar={fechar} />}
  </>
}
