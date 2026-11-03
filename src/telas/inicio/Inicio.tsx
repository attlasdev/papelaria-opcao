import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { AguardandoDona, Falha, FichaDaLista, PaginaFichas, ResumoDoDia } from '../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { POR_PAGINA_MAXIMO } from '../../../comum/regras/produto'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao, BotaoIcone } from '../../componentes/botao/Botao'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Modal } from '../../componentes/modal/Modal'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Etiqueta, SeloCompacto } from '../../componentes/selo/Selo'
import { SeletorData } from '../../componentes/campo/SeletorData'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { useLinhasPorPagina } from '../../componentes/paginacao/useLinhasPorPagina'
import { useSemDestino } from '../../componentes/aviso/Aviso'
import type { NomeIcone } from '../../componentes/icone/Icone'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { dataCurta, dataHora, NOME_MEIO, reais, reaisOcultos, ROTULO_SEM_IDENTIFICACAO } from '../../formatar'
import { useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { dataPorExtenso } from '../../datas'
import { rotas } from '../../rotas-caminhos'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'
import './inicio.css'

type Filtro = 'todos' | 'pix' | 'cartao' | 'dinheiro' | 'notinha'

const iconePagamento: Record<FichaDaLista['forma'], NomeIcone> = {
  pix: 'pix',
  cartao: 'cartao',
  dinheiro: 'dinheiro',
  misto: 'financeiro',
  notinha: 'calendario',
}

const rotuloPagamento = (f: FichaDaLista) => f.rotulo ?? (f.forma === 'misto' ? 'Misto' : f.forma === 'notinha' ? 'Notinha' : NOME_MEIO[f.forma])
const resumoItens = (f: FichaDaLista) => [...f.itens.map((i) => `${i.descricao} (${i.quantidade}x)`), ...f.servicos].join(', ')
const horario = (instante: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instante))
const mensagem = (r: Falha) => (r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

type Carga = { resumo: ResumoDoDia | null; pagina: PaginaFichas | null; aguardando: AguardandoDona[]; rascunho: boolean; erro: string | null }

export function Inicio() {
  // Valores começam ocultos: a tela fica virada para o cliente no balcão.
  const [mostrarValores, setMostrarValores] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [dataSelecionada, setDataSelecionada] = useState('')
  const [pagina, setPagina] = useState(1)
  const [vendoAguardando, setVendoAguardando] = useState(false)
  // O aviso do sino chega com `?aguardando=1`: abre a lista e limpa o endereço, para voltar a funcionar no próximo clique.
  const [parametros, setParametros] = useSearchParams()
  useEffect(() => {
    if (parametros.get('aguardando') !== '1') return
    setVendoAguardando(true)
    setParametros({}, { replace: true })
  }, [parametros, setParametros])
  const abrirFicha = useAbrirFicha()
  const navegar = useNavigate()
  const { referencia: painelHistorico, linhasPorPagina } = useLinhasPorPagina()
  const fichasPorPagina = Math.min(linhasPorPagina, POR_PAGINA_MAXIMO)
  const semDestino = useSemDestino()
  const hoje = hojeEmSaoPaulo()
  const [carga, setCarga] = useState<Carga>({ resumo: null, pagina: null, aguardando: [], rascunho: false, erro: null })
  const [tentativa, setTentativa] = useState(0)
  // Fase 2: a venda, o cancelamento e as conferências gravam na base da demonstração; o Início relê quando ela muda.
  const base = useEstadoDemonstracao()
  useEffect(() => {
    let vivo = true
    void Promise.all([
      api().obterResumoDoDia(),
      api().listarFichas({ dia: dataSelecionada || null, pagamento: filtro }, pagina, fichasPorPagina),
      api().listarAguardandoDona(),
      api().obterRascunhoFicha(),
    ]).then(([resumo, fichas, aguardando, rascunho]) => {
      if (!vivo) return
      const falha = [resumo, fichas, aguardando, rascunho].find((r) => !r.ok)
      if (falha && !falha.ok) return setCarga((atual) => ({ ...atual, erro: mensagem(falha) }))
      if (!resumo.ok || !fichas.ok || !aguardando.ok || !rascunho.ok) return
      setCarga({ resumo: resumo.dado, pagina: fichas.dado, aguardando: aguardando.dado, rascunho: rascunho.dado !== null, erro: null })
      if (fichas.dado.pagina !== pagina) setPagina(fichas.dado.pagina)
    })
    return () => { vivo = false }
  }, [dataSelecionada, filtro, pagina, fichasPorPagina, base, tentativa])

  const dia = carga.resumo
  const valor = (centavos: number | undefined) => (centavos === undefined ? '—' : mostrarValores ? reais(centavos) : reaisOcultos)
  const fichas = carga.pagina?.fichas ?? []
  const total = carga.pagina?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / fichasPorPagina))
  const paginaAtual = carga.pagina?.pagina ?? pagina
  const inicioPagina = (paginaAtual - 1) * fichasPorPagina
  const resumoPagina = !carga.pagina
    ? 'Carregando as fichas…'
    : total === 0
      ? 'Nenhuma ficha encontrada com esses filtros'
      : `Mostrando ${inicioPagina + 1}–${inicioPagina + fichas.length} de ${total} fichas`
  const aguardando = carga.aguardando

  function irPara(item: AguardandoDona) {
    setVendoAguardando(false)
    const onde = item.onde
    if (onde.tela === 'ficha') abrirFicha(onde.fichaId)
    else if (onde.tela === 'caixa') navegar(rotas.caixaTurno(onde.caixaId))
    else if (onde.tela === 'financeiro') navegar(rotas.financeiroDoDia(onde.dia))
    else navegar(rotas.movimentacoesAguardando)
  }

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
      {carga.erro && (
        <div className="inicio__falha" role="alert">
          <span>{carga.erro}</span>
          <Botao tamanho="pequeno" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Botao>
        </div>
      )}
      {carga.rascunho && (
        <div className="inicio__faixa">
          <span>Há uma venda em andamento, guardada.</span>
          <Link className="botao botao--secundario botao--pequeno" to={rotas.criarFicha}>Retomar ficha</Link>
        </div>
      )}
      {aguardando.length > 0 && (
        <div className="inicio__faixa">
          <span>{aguardando.length} {aguardando.length === 1 ? 'item aguardando' : 'itens aguardando'} a dona</span>
          <Botao tamanho="pequeno" onClick={() => setVendoAguardando(true)}>Ver</Botao>
        </div>
      )}
      <div className="grade-resumo">
        <CartaoResumo
          rotulo="Recebimentos do dia"
          icone="dinheiro"
          tom="ok"
          valor={valor(dia?.recebimentos)}
        />
        <CartaoResumo
          rotulo="Vendas concluídas"
          icone="recibo"
          valor={dia ? `${dia.vendas} ${dia.vendas === 1 ? 'ficha' : 'fichas'}` : '—'}
          nota={`Média ${valor(dia?.ticketMedio)}`}
        />
        <CartaoResumo
          rotulo="Despesas e outras saídas"
          icone="enviar"
          tom="critico"
          valor={valor(dia?.saidas)}
          sinal="saida"
          nota={dia ? `${dia.quantidadeSaidas} ${dia.quantidadeSaidas === 1 ? 'saída registrada' : 'saídas registradas'} · retiradas à parte` : 'retiradas à parte'}
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
        <Tabela larguraMinima={920} className="inicio__tabela">
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
            {fichas.map((ficha) => (
              <tr
                key={ficha.id}
                className="inicio__linha"
                // A linha inteira abre a ficha; link do cliente e botões seguem com a própria ação.
                onClick={(evento) => { if (!(evento.target as HTMLElement).closest('a, button')) abrirFicha(ficha.id) }}
              >
                <td className="codigo">#{ficha.numero}</td>
                <td>
                  <Link
                    className={ficha.cliente ? 'inicio__cliente' : 'inicio__cliente inicio__cliente--sem-identificacao'}
                    to={ficha.cliente ? rotas.cliente(ficha.cliente.id) : rotas.vendasSemIdentificacao}
                    title={ficha.cliente?.nome ?? ROTULO_SEM_IDENTIFICACAO}
                  >
                    {ficha.cliente?.nome ?? ROTULO_SEM_IDENTIFICACAO}
                  </Link>
                </td>
                <td className="numero">{dataCurta(ficha.dia)}</td>
                <td className="numero">{horario(ficha.registradoEm)}</td>
                <td className="inicio__itens">
                  <span className="inicio__resumo-itens" title={resumoItens(ficha)}>{resumoItens(ficha)}</span>
                </td>
                <td className="inicio__pagamento" title={rotuloPagamento(ficha)}>
                  <Etiqueta icone={iconePagamento[ficha.forma]}>
                    <span className="inicio__pagamento-texto">{rotuloPagamento(ficha)}</span>
                  </Etiqueta>
                </td>
                <td className="celula--numero inicio__valor">
                  {ficha.cancelada ? <SeloCompacto tom="neutro">Cancelada</SeloCompacto> : valor(ficha.total)}
                </td>
                <td className="celula--acoes">
                  <BotaoIcone icone="abrir-externo" rotulo={`Abrir ficha #${ficha.numero}`} onClick={() => abrirFicha(ficha.id)} />
                  <BotaoIcone icone="imprimir" rotulo="Imprimir 2ª via" onClick={semDestino('imprimir 2ª via')} />
                </td>
              </tr>
            ))}
            {carga.pagina && total === 0 && <tr><td colSpan={8} className="inicio__vazio">Nenhuma ficha encontrada para a data ou pagamento selecionado.</td></tr>}
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

      {vendoAguardando && (
        <Modal titulo="Aguardando a dona" subtitulo="Cada item se confere no lugar dele, com o PIN da dona." aoFechar={() => setVendoAguardando(false)}>
          <ul className="inicio__aguardando">
            {aguardando.map((item) => (
              <li key={`${item.tipo}-${item.id}`} className="inicio__aguardando-item">
                <div className="inicio__aguardando-texto">
                  <strong>{item.descricao}</strong>
                  <span>{item.operador} · <span className="numero">{dataHora(item.registradoEm)}</span></span>
                </div>
                <Botao tamanho="pequeno" icone="abrir-externo" onClick={() => irPara(item)}>Abrir</Botao>
              </li>
            ))}
            {aguardando.length === 0 && <li className="inicio__vazio">Nada aguardando a dona.</li>}
          </ul>
        </Modal>
      )}
    </Tela>
  )
}
