import { useState } from 'react'
import type { LinhaFinanceira } from '../../../comum/contrato'
import { Botao } from '../../componentes/botao/Botao'
import { Modal } from '../../componentes/modal/Modal'
import { api } from '../../dados/api'
import { planilhaFinanceiro } from '../../dados/exportar-financeiro'
import { tituloFalha } from '../../falhas'
import { dataCurta, NOME_MEIO } from '../../formatar'
import type { LinhaFinanceiro } from '../../mock/base/derivados'

/** A linha do contrato no formato que a planilha lê (o mesmo da 0.1). */
function paraPlanilha(l: LinhaFinanceira): LinhaFinanceiro {
  return {
    id: l.id, data: l.dia,
    horario: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(l.registradoEm)),
    descricao: l.descricao, origem: l.origem, categoria: l.categoria, meio: l.meio, meioRotulo: l.rotulo ?? NOME_MEIO[l.meio], valor: l.valor,
    operador: l.operador, ...(l.ficha ? { ficha: l.ficha.numero } : {}), ...(l.cliente ? { cliente: l.cliente } : {}),
    ...(l.estornoDe ? { estornoDe: l.estornoDe } : {}),
  }
}

type Resultado =
  | { tipo: 'salvo'; nome: string; quantidade: number }
  | { tipo: 'erro'; texto: string }

/**
 * Planilha do período consultado, para guardar ou mandar ao contador. Vai o
 * período inteiro, em todos os meios, mesmo com a tabela filtrada.
 */
export function ExportarPeriodo({ de, ate, periodoValido, vazio }: { de: string; ate: string; periodoValido: boolean; vazio: boolean }) {
  const [gerando, setGerando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  async function exportar() {
    if (gerando || !periodoValido || vazio) return
    setGerando(true)
    try {
      // Todas as linhas do período, do back: o arquivo e os cartões leem as mesmas (`R-FINANCEIRO-06`).
      const linhas = await api().listarFinanceiroDoPeriodo({ de, ate })
      if (!linhas.ok) return setResultado({ tipo: 'erro', texto: `${tituloFalha(linhas.causa)} ${linhas.erro}` })
      const { bytes, quantidade, nome } = planilhaFinanceiro(linhas.dado.map(paraPlanilha), de, ate)
      const r = await window.api.salvarArquivo(nome, bytes)
      if (!r.ok) return setResultado({ tipo: 'erro', texto: r.erro })
      if (r.dado.salvo) setResultado({ tipo: 'salvo', nome: r.dado.nome ?? nome, quantidade })
    } finally {
      setGerando(false)
    }
  }

  return (
    <>
      <Botao
        icone="baixar"
        onClick={() => void exportar()}
        disabled={!periodoValido || vazio || gerando}
        title={!periodoValido ? 'Escolha um período válido para exportar' : vazio ? 'Nenhuma movimentação no período' : undefined}
      >
        {gerando ? 'Gerando…' : 'Exportar período'}
      </Botao>
      {resultado && (
        <Modal
          estreito
          titulo={resultado.tipo === 'salvo' ? 'Planilha do período salva' : 'Não foi possível salvar'}
          aoFechar={() => setResultado(null)}
          rodape={<Botao variante="primario" onClick={() => setResultado(null)}>Entendi</Botao>}
        >
          {resultado.tipo === 'salvo' ? (
            <>
              <p><strong>{resultado.nome}</strong> com {resultado.quantidade} {resultado.quantidade === 1 ? 'movimentação' : 'movimentações'} de {dataCurta(de)} a {dataCurta(ate)}.</p>
              <p>A aba Resumo traz os totais por meio e por categoria; a aba Movimentos, uma linha por registro, em todos os meios. Adições e retiradas da gaveta ficam no Caixa.</p>
            </>
          ) : <p>{resultado.texto}</p>}
        </Modal>
      )}
    </>
  )
}
