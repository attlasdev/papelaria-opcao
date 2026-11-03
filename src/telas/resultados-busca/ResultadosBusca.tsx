import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { FichaDaLista, GrupoDaBusca, ResultadoBusca } from '../../../comum/contrato'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao } from '../../componentes/botao/Botao'
import { Painel } from '../../componentes/painel/Painel'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { dataCurta, NOME_MEIO, reais, ROTULO_SEM_IDENTIFICACAO } from '../../formatar'
import { useDadosMudaram } from '../../dados/mudancas'
import { rotas } from '../../rotas-caminhos'
import './resultados-busca.css'
import { documentoNaLista } from '../clientes/Clientes'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'

const rotuloForma = (f: FichaDaLista) => f.rotulo ?? (f.forma === 'misto' ? 'Misto' : f.forma === 'notinha' ? 'Notinha' : NOME_MEIO[f.forma])
const resumoItens = (f: FichaDaLista) => [...f.itens.map((i) => `${i.descricao} (${i.quantidade}x)`), ...f.servicos].join(', ')
const totalDe = (r: ResultadoBusca) => r.clientes.total + r.fichas.total + r.produtos.total

/** Até 20 por grupo (`R-INICIO-07`): o resto é contado, não mostrado. */
function Mais({ grupo }: { grupo: GrupoDaBusca<unknown> }) {
  const resto = grupo.total - grupo.itens.length
  return resto > 0 ? <p className="resultados-busca__mais">e mais {resto}: refine a busca</p> : null
}

type Carga = { termo: string; resultado: ResultadoBusca | null; erro: string | null }

export function ResultadosBusca() {
  const abrirFicha = useAbrirFicha()
  const [parametros] = useSearchParams()
  const termo = (parametros.get('q') ?? '').trim()
  const [carga, setCarga] = useState<Carga>({ termo: '', resultado: null, erro: null })
  const [tentativa, setTentativa] = useState(0)
  // Gravação que deu certo avisa (`src/dados/mudancas.ts`); a tela relê.
  const versaoDados = useDadosMudaram()
  useEffect(() => {
    let vivo = true
    void api().buscar(termo).then((r) => {
      if (!vivo) return
      setCarga(r.ok ? { termo, resultado: r.dado, erro: null } : { termo, resultado: null, erro: r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}` })
    })
    return () => { vivo = false }
  }, [termo, versaoDados, tentativa])

  // O resultado de outro termo não vale: enquanto o novo chega, é "buscando".
  const resultado = carga.termo === termo ? carga.resultado : null
  const erro = carga.termo === termo ? carga.erro : null
  const total = resultado ? totalDe(resultado) : 0
  const subtitulo = !termo
    ? 'Digite um termo na busca do cabeçalho.'
    : resultado ? `${total} resultado${total === 1 ? '' : 's'} para “${termo}”` : erro ? `Busca por “${termo}”` : `Buscando “${termo}”…`

  return (
    <Tela voltar={{ para: rotas.inicio, rotulo: 'Voltar para início' }} titulo="Resultados da busca" subtitulo={subtitulo}>
      {erro && (
        <div className="resultados-busca__falha" role="alert">
          <span>{erro}</span>
          <Botao tamanho="pequeno" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Botao>
        </div>
      )}
      {termo && resultado && total === 0 && <Painel titulo="Nenhum resultado"><p>Tente o nome, código ou outro termo dos dados disponíveis.</p></Painel>}
      {resultado && resultado.clientes.total > 0 && (
        <Painel titulo="Clientes">
          <ul className="resultados-busca__lista">
            {resultado.clientes.itens.map((c) => (
              <li key={c.id}><Link to={rotas.cliente(c.id)}><strong>{c.nome}</strong><span>{c.codigo} · {documentoNaLista(c.documento)}</span></Link></li>
            ))}
          </ul>
          <Mais grupo={resultado.clientes} />
        </Painel>
      )}
      {resultado && resultado.fichas.total > 0 && (
        <Painel titulo="Fichas de venda">
          <ul className="resultados-busca__lista">
            {resultado.fichas.itens.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => abrirFicha(f.id)}>
                  <span className="resultados-busca__titulo"><strong>Ficha #{f.numero} · {f.cliente?.nome ?? ROTULO_SEM_IDENTIFICACAO}</strong>{f.cancelada && <SeloCompacto tom="neutro">Cancelada</SeloCompacto>}</span>
                  <span>{dataCurta(f.dia)} · {reais(f.total)} · {rotuloForma(f)} · {resumoItens(f)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Mais grupo={resultado.fichas} />
        </Painel>
      )}
      {resultado && resultado.produtos.total > 0 && (
        <Painel titulo="Produtos">
          <ul className="resultados-busca__lista">
            {resultado.produtos.itens.map((p) => (
              <li key={p.id}>
                <Link to={rotas.movimentacoesEstoque(p.id)}>
                  <span className="resultados-busca__titulo"><strong>{p.descricao}</strong>{!p.ativo && <SeloCompacto tom="neutro">Desativado</SeloCompacto>}</span>
                  <span>{p.codigo} · saldo {p.saldo} {p.unidade}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Mais grupo={resultado.produtos} />
        </Painel>
      )}
    </Tela>
  )
}
