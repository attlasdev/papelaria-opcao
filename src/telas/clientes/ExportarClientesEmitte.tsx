// DESLIGADO EM 2026-10-29 (Agostinho, com a loja de acordo): a exportação
// para a Emitte não é usada. Ao importar um produto que já existe, a Emitte o
// cria de novo com outro id e duplica, e não há como evitar. O código fica
// comentado para voltar se isso mudar; o gerador das planilhas
// (src/dados/emitte.ts) continua ativo e com testes. Ver Memoria.md, `2026-10-29`.
//
// import { useState } from 'react'
// import { Botao } from '../../componentes/botao/Botao'
// import { Modal } from '../../componentes/modal/Modal'
// import { cidadesDoModelo, gerarPlanilhaClientes, pendentesEmitte, type ClienteDeFora } from '../../dados/emitte'
// import { modeloClientes } from '../../dados/modelos-emitte'
// import { funcoes } from '../../funcoes'
// import { hojeISO, marcarEnviadosEmitte, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
// import './exportar-clientes-emitte.css'
//
// type Resultado =
//   | { tipo: 'salvo'; nome: string; ids: string[]; deFora: ClienteDeFora[] }
//   | { tipo: 'nenhum'; deFora: ClienteDeFora[] }
//   | { tipo: 'erro'; texto: string }
//
// /**
//  * Gera a planilha de clientes no modelo da Emitte (Cadastros → Clientes →
//  * Importar via XLS). Só vão os clientes completos e que ainda não foram (a
//  * Emitte só cria, nunca atualiza); a janela de resultado diz quem ficou de fora
//  * e o que falta, e só marca como enviados depois que a dona confirma.
//  */
// export function ExportarClientesEmitte() {
//   const { clientes } = useEstadoDemonstracao()
//   const [gerando, setGerando] = useState(false)
//   const [resultado, setResultado] = useState<Resultado | null>(null)
//   const liberado = funcoes.exportarClientesEmitte
//   const pendentes = pendentesEmitte(clientes)
//
//   async function exportar() {
//     if (gerando || !liberado || pendentes.length === 0) return
//     setGerando(true)
//     try {
//       const modelo = await modeloClientes()
//       const { bytes, ids, deFora } = gerarPlanilhaClientes(pendentes, modelo, cidadesDoModelo(modelo))
//       if (ids.length === 0) return setResultado({ tipo: 'nenhum', deFora })
//       const r = await window.api.salvarArquivo(`clientes-emitte-${hojeISO()}.xlsx`, bytes)
//       if (!r.ok) return setResultado({ tipo: 'erro', texto: r.erro })
//       if (r.dado.salvo) setResultado({ tipo: 'salvo', nome: r.dado.nome ?? '', ids, deFora })
//     } finally {
//       setGerando(false)
//     }
//   }
//
//   function confirmar() {
//     if (resultado?.tipo === 'salvo') marcarEnviadosEmitte('clientes', resultado.ids)
//     setResultado(null)
//   }
//
//   const n = pendentes.length
//   const listaDeFora = (deFora: ClienteDeFora[]) => deFora.length > 0 && (
//     <>
//       <p>Ficaram de fora, por falta de dados (complete no cadastro do cliente):</p>
//       <ul className="exportar-clientes-emitte__lista">
//         {deFora.map((c) => <li key={c.nome}><strong>{c.nome}</strong>: {c.falta.join(', ')}</li>)}
//       </ul>
//     </>
//   )
//
//   return (
//     <>
//       <Botao
//         icone="baixar"
//         onClick={() => void exportar()}
//         disabled={!liberado || gerando || n === 0}
//         title={!liberado ? 'Indisponível no período de teste' : n === 0 ? 'Nenhum cliente novo para a Emitte' : undefined}
//       >
//         {gerando ? 'Gerando…' : n > 0 ? `Exportar ${n} ${n === 1 ? 'cliente novo' : 'clientes novos'} para a Emitte` : 'Exportar clientes para a Emitte'}
//       </Botao>
//       {resultado && (
//         <Modal
//           estreito
//           titulo={resultado.tipo === 'salvo' ? 'Planilha de clientes salva' : resultado.tipo === 'nenhum' ? 'Nenhum cliente completo' : 'Não foi possível salvar'}
//           aoFechar={() => setResultado(null)}
//           rodape={resultado.tipo === 'salvo' ? (
//             <>
//               <Botao variante="fantasma" onClick={() => setResultado(null)}>Ainda não importei</Botao>
//               <Botao variante="primario" icone="check" onClick={confirmar}>Já importei na Emitte</Botao>
//             </>
//           ) : <Botao variante="primario" onClick={() => setResultado(null)}>Entendi</Botao>}
//         >
//           {resultado.tipo === 'salvo' && (
//             <>
//               <p><strong>{resultado.nome}</strong> com {resultado.ids.length} {resultado.ids.length === 1 ? 'cliente' : 'clientes'}.</p>
//               <p>Na Emitte: Cadastros → Clientes → Importar via XLS.</p>
//               {listaDeFora(resultado.deFora)}
//               <p>Confirme só depois de importar: os clientes confirmados não vão de novo, porque a Emitte os duplicaria.</p>
//             </>
//           )}
//           {resultado.tipo === 'nenhum' && (
//             <>
//               <p>A Emitte exige CPF ou CNPJ, CEP, rua com tipo (Rua, Avenida…), bairro e cidade/UF. Nenhum cliente novo tem tudo isso ainda.</p>
//               {listaDeFora(resultado.deFora)}
//             </>
//           )}
//           {resultado.tipo === 'erro' && <p>{resultado.texto}</p>}
//         </Modal>
//       )}
//     </>
//   )
// }
