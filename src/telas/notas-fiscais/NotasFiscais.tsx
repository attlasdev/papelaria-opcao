import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao } from '../../componentes/botao/Botao'
import { Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { useLinhasPorPagina } from '../../componentes/paginacao/useLinhasPorPagina'
import { Etiqueta, SeloCompacto } from '../../componentes/selo/Selo'
import { Icone } from '../../componentes/icone/Icone'
import { dataCurta, reais } from '../../formatar'
import { hojeISO, nomeCliente, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import { documentoFornecedor, type Direcao, type Documento } from './dados-exemplo'
import './notas-fiscais.css'

export function NotasFiscais() {
  const [direcao, setDirecao] = useState<Direcao>('saida')
  const [pagina, setPagina] = useState(1)
  const { referencia: painelDocumentos, linhasPorPagina } = useLinhasPorPagina()
  const navegar = useNavigate()
  const base = useEstadoDemonstracao()
  const rascunhos = base.rascunhosNota
    .map((id) => base.fichas.find((f) => f.id === id))
    .filter((f) => f !== undefined)
  const destaque = rascunhos[0]
  const documentos: Documento[] = [
    ...rascunhos.map((f) => ({
      referencia: `Rascunho da ficha #${f.id}`,
      origem: `Venda · ${nomeCliente(base, f.clienteId)}`,
      data: dataCurta(f.data),
      situacao: 'Em revisão',
      direcao: 'saida' as const,
      acao: 'Ver rascunho',
      destino: rotas.rascunhoNota(f.id),
    })),
    { ...documentoFornecedor, data: dataCurta(hojeISO()), direcao: 'entrada', acao: 'Ver detalhes', destino: rotas.documentoEntrada },
  ]
  const lista = documentos.filter((d) => d.direcao === direcao)
  const totalPaginas = Math.max(1, Math.ceil(lista.length / linhasPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaAtual - 1) * linhasPorPagina
  const documentosDaPagina = lista.slice(inicioPagina, inicioPagina + linhasPorPagina)
  const resumoPagina = lista.length === 0
    ? 'Nenhum documento neste filtro'
    : `Mostrando ${inicioPagina + 1}–${inicioPagina + documentosDaPagina.length} de ${lista.length} documentos`

  return (
    <Tela
      titulo="Notas fiscais"
      subtitulo="Rascunhos preparados a partir de fichas de venda e documentos de entrada."
      busca="Buscar por referência ou cliente..."
      acaoCabecalho={
        <Botao icone="recibo" onClick={() => navegar(rotas.rascunhosNotas)}>
          Rascunhos
        </Botao>
      }
    >
      <Painel className="notas-fiscais__destaque">
        <div className="notas-fiscais__rascunho">
          <span className="notas-fiscais__icone" aria-hidden>
            <Icone nome="notas" tamanho={22} />
          </span>
          {destaque ? (
            <>
              <div className="notas-fiscais__texto">
                <div className="notas-fiscais__linha">
                  <h2>Rascunho de nota de saída</h2>
                  <SeloCompacto tom="neutro">Rascunho</SeloCompacto>
                </div>
                <p className="notas-fiscais__dados">
                  Ficha #{destaque.id} · {nomeCliente(base, destaque.clienteId)} · {reais(destaque.total)}
                </p>
                <p className="notas-fiscais__explica">
                  Itens e valores conhecidos foram preenchidos para revisão. Este rascunho não tem número fiscal nem
                  autorização.
                </p>
              </div>
              <Botao variante="primario" onClick={() => navegar(rotas.rascunhoNota(destaque.id))}>
                Revisar rascunho
              </Botao>
            </>
          ) : (
            <div className="notas-fiscais__texto">
              <h2>Nenhum rascunho em revisão</h2>
              <p className="notas-fiscais__explica">
                Ao concluir uma venda, marque “Preparar rascunho de nota fiscal” para ele aparecer aqui.
              </p>
            </div>
          )}
        </div>
      </Painel>

      <div ref={painelDocumentos}>
      <Painel
        colado
        titulo="Documentos"
        acoes={
          <Filtros
            rotulo="Tipo de documento"
            valor={direcao}
            aoMudar={(proximaDirecao) => { setDirecao(proximaDirecao); setPagina(1) }}
            opcoes={[
              { valor: 'saida', rotulo: 'Saídas' },
              { valor: 'entrada', rotulo: 'Entradas' },
            ]}
          />
        }
      >
        <Tabela larguraMinima={720}>
          <thead>
            <tr>
              <th>Referência</th>
              <th>Origem</th>
              <th>Data</th>
              <th>Situação</th>
              <th className="celula--acoes">Ação</th>
            </tr>
          </thead>
          <tbody>
            {documentosDaPagina.map((doc) => (
              <tr key={doc.referencia}>
                <td className="notas-fiscais__referencia">{doc.referencia}</td>
                <td>{doc.origem}</td>
                <td className="numero">{doc.data}</td>
                <td>
                  <Etiqueta>{doc.situacao}</Etiqueta>
                </td>
                <td className="celula--acoes">
                  <Botao tamanho="pequeno" onClick={() => navegar(doc.destino)}>
                    {doc.acao}
                  </Botao>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="notas-fiscais__vazio">
                  Nenhum documento de {direcao === 'saida' ? 'saída' : 'entrada'}.
                </td>
              </tr>
            )}
          </tbody>
        </Tabela>
        <Paginacao resumo={resumoPagina} pagina={paginaAtual} totalPaginas={totalPaginas} aoMudar={setPagina} />
      </Painel>
      </div>

      <p className="notas-fiscais__nota">
        A emissão, o tipo de nota e os dados fiscais necessários serão definidos com a contabilidade.
      </p>
    </Tela>
  )
}
