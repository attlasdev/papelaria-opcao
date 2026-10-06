import { useState } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { Modal } from '../../componentes/modal/Modal'
import { cidadesDoModelo, gerarPlanilhaClientes, type ClienteDeFora } from '../../dados/emitte'
import { modeloClientes } from '../../dados/modelos-emitte'
import { funcoes } from '../../funcoes'
import { hojeISO, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import './exportar-clientes-emitte.css'

type Resultado =
  | { tipo: 'salvo'; nome: string; incluidos: number; deFora: ClienteDeFora[] }
  | { tipo: 'nenhum'; deFora: ClienteDeFora[] }
  | { tipo: 'erro'; texto: string }

/**
 * Gera a planilha de clientes no modelo da Emitte (Cadastros → Clientes →
 * Importar via XLS). Só vão os clientes completos; a janela de resultado diz
 * quem ficou de fora e o que falta. Desligado em `src/funcoes.ts` até o teste
 * de importação na Emitte passar.
 */
export function ExportarClientesEmitte() {
  const { clientes } = useEstadoDemonstracao()
  const [gerando, setGerando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const liberado = funcoes.exportarClientesEmitte

  async function exportar() {
    if (gerando || !liberado) return
    setGerando(true)
    try {
      const modelo = await modeloClientes()
      const { bytes, incluidos, deFora } = gerarPlanilhaClientes(clientes, modelo, cidadesDoModelo(modelo))
      if (incluidos === 0) return setResultado({ tipo: 'nenhum', deFora })
      const r = await window.api.salvarArquivo(`clientes-emitte-${hojeISO()}.xlsx`, bytes)
      if (!r.ok) return setResultado({ tipo: 'erro', texto: r.erro })
      if (r.dado.salvo) setResultado({ tipo: 'salvo', nome: r.dado.nome ?? '', incluidos, deFora })
    } finally {
      setGerando(false)
    }
  }

  const listaDeFora = (deFora: ClienteDeFora[]) => deFora.length > 0 && (
    <>
      <p>Ficaram de fora, por falta de dados (complete no cadastro do cliente):</p>
      <ul className="exportar-clientes-emitte__lista">
        {deFora.map((c) => <li key={c.nome}><strong>{c.nome}</strong>: {c.falta.join(', ')}</li>)}
      </ul>
    </>
  )

  return (
    <>
      <Botao
        icone="baixar"
        onClick={() => void exportar()}
        disabled={!liberado || gerando || clientes.length === 0}
        title={!liberado ? 'Indisponível no período de teste' : clientes.length === 0 ? 'Nenhum cliente cadastrado' : undefined}
      >
        {gerando ? 'Gerando…' : 'Exportar clientes para a Emitte'}
      </Botao>
      {resultado && (
        <Modal
          estreito
          titulo={resultado.tipo === 'salvo' ? 'Planilha de clientes salva' : resultado.tipo === 'nenhum' ? 'Nenhum cliente completo' : 'Não foi possível salvar'}
          aoFechar={() => setResultado(null)}
          rodape={<Botao variante="primario" onClick={() => setResultado(null)}>Entendi</Botao>}
        >
          {resultado.tipo === 'salvo' && (
            <>
              <p><strong>{resultado.nome}</strong> com {resultado.incluidos} {resultado.incluidos === 1 ? 'cliente' : 'clientes'}.</p>
              <p>Na Emitte: Cadastros → Clientes → Importar via XLS.</p>
              {listaDeFora(resultado.deFora)}
            </>
          )}
          {resultado.tipo === 'nenhum' && (
            <>
              <p>A Emitte exige CPF ou CNPJ, CEP, rua, bairro e cidade/UF. Nenhum cliente tem tudo isso ainda.</p>
              {listaDeFora(resultado.deFora)}
            </>
          )}
          {resultado.tipo === 'erro' && <p>{resultado.texto}</p>}
        </Modal>
      )}
    </>
  )
}
