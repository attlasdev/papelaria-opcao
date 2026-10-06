import { useState } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { Modal } from '../../componentes/modal/Modal'
import { gerarPlanilhaProdutos, pendentesEmitte } from '../../dados/emitte'
import { modeloProdutos } from '../../dados/modelos-emitte'
import { funcoes } from '../../funcoes'
import { hojeISO, marcarEnviadosEmitte, useEstadoDemonstracao } from '../../mock/estado-demonstracao'

type Resultado =
  | { tipo: 'salvo'; nome: string; codigos: string[]; semGtin: number }
  | { tipo: 'erro'; texto: string }

/**
 * Leva à Emitte os produtos que ainda não foram (planilha do modelo dela:
 * Cadastros → Produtos → Importar via XLS). A Emitte só cria, nunca atualiza:
 * por isso cada produto vai uma vez, e só fica marcado depois que a dona
 * confirma que importou. NCM, tributação e o resto fiscal ela completa lá.
 */
export function ExportarProdutosEmitte() {
  const { produtos } = useEstadoDemonstracao()
  const [gerando, setGerando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const pendentes = pendentesEmitte(produtos)
  const liberado = funcoes.exportarEmitte

  async function exportar() {
    if (gerando || !liberado || pendentes.length === 0) return
    setGerando(true)
    try {
      const { bytes, codigos, semGtin } = gerarPlanilhaProdutos(pendentes, await modeloProdutos())
      const r = await window.api.salvarArquivo(`produtos-emitte-${hojeISO()}.xlsx`, bytes)
      if (!r.ok) return setResultado({ tipo: 'erro', texto: r.erro })
      if (r.dado.salvo) setResultado({ tipo: 'salvo', nome: r.dado.nome ?? '', codigos, semGtin: semGtin.length })
    } finally {
      setGerando(false)
    }
  }

  function confirmar() {
    if (resultado?.tipo === 'salvo') marcarEnviadosEmitte('produtos', resultado.codigos)
    setResultado(null)
  }

  const n = pendentes.length
  return (
    <>
      <Botao
        icone="baixar"
        onClick={() => void exportar()}
        disabled={!liberado || gerando || n === 0}
        title={!liberado ? 'Indisponível no período de teste' : n === 0 ? 'Todos os produtos já foram para a Emitte' : undefined}
      >
        {gerando ? 'Gerando…' : n > 0 ? `Exportar ${n} ${n === 1 ? 'produto novo' : 'produtos novos'} para a Emitte` : 'Exportar produtos para a Emitte'}
      </Botao>
      {resultado && (
        <Modal
          estreito
          titulo={resultado.tipo === 'salvo' ? 'Planilha de produtos salva' : 'Não foi possível salvar'}
          aoFechar={() => setResultado(null)}
          rodape={resultado.tipo === 'salvo' ? (
            <>
              <Botao variante="fantasma" onClick={() => setResultado(null)}>Ainda não importei</Botao>
              <Botao variante="primario" icone="check" onClick={confirmar}>Já importei na Emitte</Botao>
            </>
          ) : <Botao variante="primario" onClick={() => setResultado(null)}>Entendi</Botao>}
        >
          {resultado.tipo === 'salvo' ? (
            <>
              <p><strong>{resultado.nome}</strong> com {resultado.codigos.length} {resultado.codigos.length === 1 ? 'produto' : 'produtos'}.</p>
              <p>Na Emitte: Cadastros → Produtos → Importar via XLS. Depois, complete o NCM de cada produto novo.</p>
              {resultado.semGtin > 0 && <p>{resultado.semGtin} {resultado.semGtin === 1 ? 'produto foi' : 'produtos foram'} sem código de barras válido, como “SEM GTIN”.</p>}
              <p>Confirme só depois de importar: os produtos confirmados não vão de novo, porque a Emitte os duplicaria. Mudou preço ou nome de um produto já enviado? Altere também na Emitte.</p>
            </>
          ) : <p>{resultado.texto}</p>}
        </Modal>
      )}
    </>
  )
}
