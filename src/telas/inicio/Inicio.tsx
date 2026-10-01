import { useState } from 'react'
import { Link } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao, BotaoIcone } from '../../componentes/botao/Botao'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Etiqueta, SeloCompacto } from '../../componentes/selo/Selo'
import { SeletorData } from '../../componentes/campo/SeletorData'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { useLinhasPorPagina } from '../../componentes/paginacao/useLinhasPorPagina'
import { useSemDestino } from '../../componentes/aviso/Aviso'
import type { NomeIcone } from '../../componentes/icone/Icone'
import { dataCurta, reais, reaisOcultos } from '../../formatar'
import {
  agoraHorario,
  dataPorExtenso,
  hojeISO,
  nomeCliente,
  porDataDecrescente,
  resumoDoDia,
  resumoItens,
  rotuloForma,
  useEstadoDemonstracao,
  type FormaVenda,
} from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'
import './inicio.css'

type Filtro = 'todos' | Exclude<FormaVenda, 'misto'>

const iconePagamento: Record<FormaVenda, NomeIcone> = {
  pix: 'pix',
  cartao: 'cartao',
  dinheiro: 'dinheiro',
  misto: 'financeiro',
  notinha: 'calendario',
}

export function Inicio() {
  // Valores começam ocultos: a tela fica virada para o cliente no balcão.
  const [mostrarValores, setMostrarValores] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [dataSelecionada, setDataSelecionada] = useState('')
  const [pagina, setPagina] = useState(1)
  const abrirFicha = useAbrirFicha()
  const { referencia: painelHistorico, linhasPorPagina: fichasPorPagina } = useLinhasPorPagina()
  const semDestino = useSemDestino()
  const base = useEstadoDemonstracao()
  const hoje = hojeISO()
  const dia = resumoDoDia(base, hoje, agoraHorario())

  const valor = (centavos: number) => (mostrarValores ? reais(centavos) : reaisOcultos)
  const todasFichas = [...base.fichas].sort(porDataDecrescente)
  const fichas = todasFichas
    .filter((ficha) => filtro === 'todos' || ficha.forma === filtro || (filtro !== 'notinha' && ficha.forma === 'misto' && ficha.pagamentos.some((pagamento) => pagamento.meio === filtro)))
    .filter((ficha) => !dataSelecionada || ficha.data === dataSelecionada)
  const totalPaginas = Math.max(1, Math.ceil(fichas.length / fichasPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaAtual - 1) * fichasPorPagina
  const fichasDaPagina = fichas.slice(inicioPagina, inicioPagina + fichasPorPagina)
  const resumoPagina = fichas.length === 0
    ? 'Nenhuma ficha encontrada com esses filtros'
    : `Mostrando ${inicioPagina + 1}–${inicioPagina + fichasDaPagina.length} de ${fichas.length} fichas`

  return (
    <Tela
      titulo="Visão geral do balcão"
      subtitulo={`${dataPorExtenso(hoje)} · movimentação de vendas`}
      acoesTitulo={
        <Botao icone={mostrarValores ? 'olho-fechado' : 'olho'} onClick={() => setMostrarValores(!mostrarValores)}>
          {mostrarValores ? 'Ocultar valores' : 'Mostrar valores'}
        </Botao>
      }
    >
      {base.rascunhoFicha && (
        <div className="inicio__rascunho">
          <span>Há uma venda em andamento, guardada.</span>
          <Link className="botao botao--secundario botao--pequeno" to={rotas.criarFicha}>Retomar ficha</Link>
        </div>
      )}
      <div className="grade-resumo">
        <CartaoResumo
          rotulo="Recebimentos do dia"
          icone="dinheiro"
          tom="ok"
          valor={valor(dia.recebimentos)}
        />
        <CartaoResumo
          rotulo="Vendas concluídas"
          icone="recibo"
          valor={`${dia.vendas} ${dia.vendas === 1 ? 'ficha' : 'fichas'}`}
          nota={`Média ${valor(dia.ticketMedio)}`}
        />
        <CartaoResumo
          rotulo="Despesas e outras saídas"
          icone="enviar"
          tom="critico"
          valor={valor(dia.saidas)}
          sinal="saida"
          nota={`${dia.quantidadeSaidas} ${dia.quantidadeSaidas === 1 ? 'saída registrada' : 'saídas registradas'} · retiradas à parte`}
        />
      </div>

      <div ref={painelHistorico}>
      <Painel
        colado
        titulo="Histórico de fichas"
        acoes={
          <div className="inicio__filtros">
            <div className="inicio__filtro-data">
              <span>Data</span>
              <SeletorData valor={dataSelecionada} dataInicial={hoje} max={hoje} aoMudar={(data) => { setDataSelecionada(data); setPagina(1) }} />
            </div>
            <Filtros
              rotulo="Filtrar por pagamento"
              valor={filtro}
              aoMudar={(proximoFiltro) => { setFiltro(proximoFiltro); setPagina(1) }}
              opcoes={[
                { valor: 'todos', rotulo: 'Todos' },
                { valor: 'pix', rotulo: 'Pix' },
                { valor: 'cartao', rotulo: 'Cartão' },
                { valor: 'dinheiro', rotulo: 'Dinheiro' },
                { valor: 'notinha', rotulo: 'Notinha' },
              ]}
            />
          </div>
        }
      >
        <Tabela larguraMinima={1120} className="inicio__tabela">
          <colgroup>
            <col className="inicio__coluna--ficha" />
            <col className="inicio__coluna--cliente" />
            <col className="inicio__coluna--data" />
            <col className="inicio__coluna--horario" />
            <col />
            <col className="inicio__coluna--pagamento" />
            <col className="inicio__coluna--valor" />
            <col className="inicio__coluna--acoes" />
          </colgroup>
          <thead>
            <tr>
              <th>Ficha</th>
              <th>Cliente</th>
              <th>Data</th>
              <th>Horário</th>
              <th>Itens principais</th>
              <th>Pagamento</th>
              <th className="celula--numero">Valor total</th>
              <th className="celula--acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {fichasDaPagina.map((ficha) => (
              <tr
                key={ficha.id}
                className="inicio__linha"
                // A linha inteira abre a ficha; link do cliente e botões seguem com a própria ação.
                onClick={(evento) => { if (!(evento.target as HTMLElement).closest('a, button')) abrirFicha(ficha.id) }}
              >
                <td className="codigo">#{ficha.id}</td>
                <td>
                  <Link
                    className={ficha.clienteId ? 'inicio__cliente' : 'inicio__cliente inicio__cliente--sem-identificacao'}
                    to={ficha.clienteId ? rotas.cliente(ficha.clienteId) : rotas.vendasSemIdentificacao}
                    title={nomeCliente(base, ficha.clienteId)}
                  >
                    {nomeCliente(base, ficha.clienteId)}
                  </Link>
                </td>
                <td className="numero">{dataCurta(ficha.data)}</td>
                <td className="numero">{ficha.horario}</td>
                <td className="inicio__itens">
                  <span className="inicio__resumo-itens" title={resumoItens(ficha)}>{resumoItens(ficha)}</span>
                </td>
                <td>
                  <Etiqueta icone={iconePagamento[ficha.forma]}>{rotuloForma(ficha)}</Etiqueta>
                </td>
                <td className="celula--numero inicio__valor">
                  {ficha.cancelamento ? <SeloCompacto tom="neutro">Cancelada</SeloCompacto> : valor(ficha.total)}
                </td>
                <td className="celula--acoes">
                  <BotaoIcone icone="abrir-externo" rotulo={`Abrir ficha #${ficha.id}`} onClick={() => abrirFicha(ficha.id)} />
                  <BotaoIcone icone="imprimir" rotulo="Imprimir 2ª via" onClick={semDestino('imprimir 2ª via')} />
                </td>
              </tr>
            ))}
            {fichas.length === 0 && <tr><td colSpan={8} className="inicio__vazio">Nenhuma ficha encontrada para a data ou pagamento selecionado.</td></tr>}
          </tbody>
        </Tabela>
        <Paginacao
          resumo={resumoPagina}
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          aoMudar={setPagina}
        />
      </Painel>
      </div>
    </Tela>
  )
}
