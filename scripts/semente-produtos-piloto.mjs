#!/usr/bin/env node
/**
 * Semente de 20 produtos FICTÍCIOS para o piloto 0.1 — só roda a pedido da loja.
 *
 * Entra como o usuário da loja (nunca com a service_role), lê a base, acrescenta
 * os produtos com o saldo inicial registrado como entrada (o histórico explica o
 * saldo, como no cadastro pela tela) e grava pela mesma função do app, que
 * confere a revisão.
 *
 * Conferência do alvo (regra 8 do CLAUDE.md), em duas partes independentes:
 *   1. o ref do projeto, digitado de propósito em --projeto, tem que bater com a URL;
 *   2. o CONTEÚDO: a base não pode ter produtos. Semente por cima de cadastro real
 *      duplicaria tudo — nesse caso o script para.
 *
 * Uso (com o APP FECHADO na loja — se ele estiver aberto, a próxima gravação dele
 * dá conflito, que é a proteção funcionando):
 *
 *   PAPELARIA_URL=https://<ref>.supabase.co PAPELARIA_CHAVE=<chave anon> \
 *   PAPELARIA_EMAIL=<usuário da loja> PAPELARIA_SENHA=<senha> \
 *   node scripts/semente-produtos-piloto.mjs --projeto=<ref>            # só mostra
 *   node scripts/semente-produtos-piloto.mjs --projeto=<ref> --gravar   # grava
 *
 * Credenciais só no ambiente do terminal: nunca em arquivo do repositório.
 */
import { createClient } from '@supabase/supabase-js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const { PAPELARIA_URL: url, PAPELARIA_CHAVE: chave, PAPELARIA_EMAIL: email, PAPELARIA_SENHA: senha } = process.env
const parar = (texto) => { console.error(`\n✗ ${texto}\n`); process.exit(1) }

if (!url || !chave || !email || !senha) parar('Defina PAPELARIA_URL, PAPELARIA_CHAVE, PAPELARIA_EMAIL e PAPELARIA_SENHA no ambiente.')
const host = new URL(url).hostname
const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : host
if (!args.projeto) parar(`Informe --projeto=<ref> de propósito. Este ambiente aponta para: ${ref}`)
if (args.projeto !== ref) parar(`--projeto=${args.projeto} não bate com a URL (${ref}). Nada foi feito.`)

/** EAN-13 fictício com dígito verificador certo (prefixo 789 = Brasil). */
function ean(numero) {
  const corpo = `78900${String(numero).padStart(7, '0')}`
  const soma = [...corpo].reverse().reduce((t, n, i) => t + Number(n) * (i % 2 === 0 ? 3 : 1), 0)
  return corpo + ((10 - (soma % 10)) % 10)
}

// [descrição, categoria, grupo, unidade, preço, custo, saldo, mínimo]
const PRODUTOS = [
  ['Caderno universitário 10 matérias 200 folhas', 'Cadernos', 'cadernos', 'un', 2490, 1550, 30, 10],
  ['Caderno brochura 96 folhas', 'Cadernos', 'cadernos', 'un', 890, 520, 40, 15],
  ['Caderno de desenho 48 folhas', 'Cadernos', 'cadernos', 'un', 1290, 760, 20, 8],
  ['Agenda permanente capa dura', 'Cadernos', 'cadernos', 'un', 3290, 1980, 10, 4],
  ['Caneta esferográfica azul', 'Escrita', 'escrita', 'un', 250, 110, 120, 40],
  ['Caneta esferográfica preta', 'Escrita', 'escrita', 'un', 250, 110, 100, 40],
  ['Caneta gel 0.7 mm azul', 'Escrita', 'escrita', 'un', 690, 380, 35, 15],
  ['Lápis grafite nº 2', 'Escrita', 'escrita', 'un', 150, 60, 150, 50],
  ['Marca-texto amarelo', 'Escrita', 'escrita', 'un', 450, 220, 45, 15],
  ['Borracha branca escolar', 'Escolar', 'artes', 'un', 200, 80, 80, 30],
  ['Apontador com depósito', 'Escolar', 'artes', 'un', 350, 150, 50, 20],
  ['Cola branca 90 g', 'Escolar', 'artes', 'un', 590, 300, 40, 15],
  ['Tesoura escolar sem ponta', 'Escolar', 'artes', 'un', 690, 340, 25, 10],
  ['Régua 30 cm', 'Escolar', 'artes', 'un', 290, 120, 40, 15],
  ['Lápis de cor 12 cores', 'Escolar', 'artes', 'cx', 1490, 850, 20, 8],
  ['Papel sulfite A4 500 folhas', 'Papéis', 'papeis', 'pct', 2890, 1900, 25, 10],
  ['Cartolina branca', 'Artes e papéis', 'artes', 'un', 150, 60, 60, 20],
  ['Bloco adesivo 76x76 mm', 'Escritório', 'escritorio', 'un', 790, 420, 30, 10],
  ['Clipes nº 2/0 caixa com 100', 'Escritório', 'escritorio', 'cx', 450, 210, 25, 10],
  ['Fita adesiva transparente 12 mm', 'Escritório', 'escritorio', 'un', 350, 160, 40, 15],
]

const supabase = createClient(url, chave, { auth: { persistSession: false } })
const login = await supabase.auth.signInWithPassword({ email, password: senha })
if (login.error) parar(`Não entrou como ${email}: ${login.error.message}`)

const { data: linha, error } = await supabase.from('base_loja').select('conteudo, revisao').maybeSingle()
if (error) parar(`Não leu a base: ${error.message}`)
if (!linha) parar('A loja ainda não abriu o app nenhuma vez (não há base gravada). Abra o app uma vez e cadastre algo antes, ou rode depois.')
const base = linha.conteudo
if (base?.versao !== 1 || !Array.isArray(base.produtos)) parar('A base gravada não está no formato esperado. Nada foi feito.')

console.log(`\nProjeto: ${ref}`)
console.log(`Revisão atual: ${linha.revisao}`)
console.log(`Produtos já cadastrados: ${base.produtos.length}`)
console.log(`Clientes: ${base.clientes.length} · Fichas: ${base.fichas.length}`)
if (base.produtos.length > 0) parar('A loja já tem produtos. A semente é só para loja sem cadastro; nada foi feito.')

const agora = new Date().toISOString()
const maior = 0
const produtos = PRODUTOS.map(([descricao, categoria, grupo, unidade, preco, custo, saldo, minimo], i) => ({
  codigo: `EST-${String(maior + i + 1).padStart(4, '0')}`,
  codigoBarras: ean(i + 1),
  descricao, categoria, grupo, unidade, preco, custo, saldo, minimo,
  fiscal: { tributacao: 'simples', origem: '0', cfopEstadual: '5102', cfopInterestadual: '6102' },
}))
const movimentos = produtos.map((p) => ({
  id: `${agora}-${p.codigo}-Entrada`, data: agora, produto: p.codigo, descricao: p.descricao,
  tipo: 'Entrada', antes: 0, depois: p.saldo, motivo: 'Saldo inicial do cadastro', operador: base.operador ?? 'Loja',
}))

console.log(`\nVai acrescentar ${produtos.length} produtos fictícios (EST-0001 a EST-${String(produtos.length).padStart(4, '0')}).`)
if (!args.gravar) {
  console.log('Só conferência. Para gravar, rode de novo com --gravar.\n')
  process.exit(0)
}

const nova = { ...base, produtos, movimentosEstoque: [...movimentos, ...base.movimentosEstoque] }
const gravado = await supabase.rpc('salvar_base', { p_conteudo: nova, p_revisao_esperada: linha.revisao }).single()
if (gravado.error) parar(`Não gravou: ${gravado.error.message} (${gravado.error.code})`)
console.log(`\n✓ Gravado. Revisão ${gravado.data.revisao}. Peça para a loja abrir o app.\n`)
