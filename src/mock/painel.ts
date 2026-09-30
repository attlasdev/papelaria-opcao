import { controles } from './simular'

/**
 * Painel do mock: um canto da tela para forcar falha e atraso sem editar URL.
 *
 * DOM puro de proposito, sem React e sem Tailwind: assim ele nunca se mistura com
 * os componentes de verdade e nao ha risco de sobrar no app empacotado. Este
 * arquivo so carrega junto com o mock, e o mock so carrega quando nao ha Electron.
 */
export function montarPainel() {
  const { CAUSAS, causaForcada, atrasoMs, params } = controles

  const caixa = document.createElement('div')
  caixa.style.cssText = [
    'position:fixed',
    'right:12px',
    'bottom:12px',
    'z-index:99999',
    'font:12px/1.4 ui-monospace,monospace',
    'background:#111827',
    'color:#e5e7eb',
    'border:1px solid #374151',
    'border-radius:8px',
    'padding:8px 10px',
    'display:flex',
    'gap:8px',
    'align-items:center',
    'box-shadow:0 4px 16px rgba(0,0,0,.4)',
  ].join(';')

  const marca = document.createElement('strong')
  marca.textContent = 'MOCK'
  marca.style.color = '#fbbf24'

  const seletor = document.createElement('select')
  seletor.style.cssText = 'background:#1f2937;color:inherit;border:1px solid #374151;border-radius:4px;padding:2px'
  for (const [valor, rotulo] of [['', 'sem falha'], ...CAUSAS.map((c) => [c, c])]) {
    const opcao = document.createElement('option')
    opcao.value = valor
    opcao.textContent = rotulo
    seletor.appendChild(opcao)
  }
  seletor.value = causaForcada() ?? ''

  const atraso = document.createElement('input')
  atraso.type = 'number'
  atraso.min = '0'
  atraso.step = '100'
  atraso.value = String(atrasoMs())
  atraso.title = 'atraso de cada resposta, em ms'
  atraso.style.cssText = 'width:64px;background:#1f2937;color:inherit;border:1px solid #374151;border-radius:4px;padding:2px'

  function aplicar() {
    const novos = new URLSearchParams(params)
    seletor.value ? novos.set('falhar', seletor.value) : novos.delete('falhar')
    novos.set('lento', atraso.value)
    location.search = novos.toString()
  }

  seletor.onchange = aplicar
  atraso.onchange = aplicar

  caixa.append(marca, seletor, atraso, Object.assign(document.createElement('span'), { textContent: 'ms' }))
  document.body.appendChild(caixa)
}
