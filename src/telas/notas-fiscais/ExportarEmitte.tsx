import { useState } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { Modal } from '../../componentes/modal/Modal'
import { gerarXmlProdutos } from '../../dados/emitte'
import { hojeISO, useEstadoDemonstracao } from '../../mock/estado-demonstracao'

/**
 * Bloqueada no piloto (`2026-10-06`): reimportar o XML na Emitte DUPLICA os
 * produtos, embora a Emitte diga que atualiza. Volta a `true` quando houver um
 * jeito de importar sem duplicar. Ver Memoria.md.
 */
const EXPORTACAO_LIBERADA = false

type Resultado =
  | { tipo: 'salvo'; nome: string; quantidade: number; semGtin: number }
  | { tipo: 'erro'; texto: string }

/**
 * Gera o arquivo de produtos para importar na Emitte e pede onde salvar.
 * A dona importa em Cadastros → Produtos → Importar via XML e completa lá os
 * dados fiscais (NCM, tributação, CFOP).
 */
export function ExportarProdutosEmitte() {
  const { produtos } = useEstadoDemonstracao()
  const [gerando, setGerando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const ativos = produtos.filter((p) => !p.inativo).length

  async function exportar() {
    if (gerando || !EXPORTACAO_LIBERADA) return
    setGerando(true)
    const { xml, quantidade, semGtin } = gerarXmlProdutos(produtos)
    const r = await window.api.salvarArquivo(`produtos-emitte-${hojeISO()}.xml`, xml)
    setGerando(false)
    if (!r.ok) return setResultado({ tipo: 'erro', texto: r.erro })
    if (r.dado.salvo) setResultado({ tipo: 'salvo', nome: r.dado.nome ?? '', quantidade, semGtin: semGtin.length })
  }

  return (
    <>
      <Botao
        icone="baixar"
        onClick={() => void exportar()}
        disabled={!EXPORTACAO_LIBERADA || gerando || ativos === 0}
        title={!EXPORTACAO_LIBERADA ? 'Indisponível no período de teste' : ativos === 0 ? 'Nenhum produto cadastrado' : undefined}
      >
        {gerando ? 'Gerando…' : 'Exportar produtos para a Emitte'}
      </Botao>
      {resultado && (
        <Modal
          estreito
          titulo={resultado.tipo === 'salvo' ? 'Arquivo de produtos salvo' : 'Não foi possível salvar'}
          aoFechar={() => setResultado(null)}
          rodape={<Botao variante="primario" onClick={() => setResultado(null)}>Entendi</Botao>}
        >
          {resultado.tipo === 'salvo' ? (
            <>
              <p><strong>{resultado.nome}</strong> com {resultado.quantidade} {resultado.quantidade === 1 ? 'produto' : 'produtos'}.</p>
              <p>Na Emitte: Cadastros → Produtos → Importar via XML. Na tela de importação, escolha a tributação e o CFOP; depois complete o NCM de cada produto.</p>
              {resultado.semGtin > 0 && <p>{resultado.semGtin} {resultado.semGtin === 1 ? 'produto foi' : 'produtos foram'} sem código de barras válido, como “SEM GTIN”.</p>}
            </>
          ) : <p>{resultado.texto}</p>}
        </Modal>
      )}
    </>
  )
}
