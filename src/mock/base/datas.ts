/** Datas da base: sempre YYYY-MM-DD no fuso local, sem hora. */

function partes(iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return { ano, mes, dia }
}

function paraISO(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function paraData(iso: string) {
  const { ano, mes, dia } = partes(iso)
  return new Date(ano, mes - 1, dia)
}

export function hojeISO() {
  return paraISO(new Date())
}

/** Dia comercial do registro em UTC, inclusive ao atravessar a meia-noite. */
export function diaDoInstante(instante: string) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instante))
}

export function dataCalendarioValida(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const { ano, mes, dia } = partes(iso)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return ano >= 1900 && data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
}

export function agoraHorario() {
  const agora = new Date()
  return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
}

export function minutoDoDia() {
  const agora = new Date()
  return agora.getHours() * 60 + agora.getMinutes()
}

export function somarDias(iso: string, dias: number) {
  const data = paraData(iso)
  data.setDate(data.getDate() + dias)
  return paraISO(data)
}

export function diasEntre(de: string, ate: string) {
  const a = partes(de)
  const b = partes(ate)
  return Math.round((Date.UTC(b.ano, b.mes - 1, b.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)) / 86_400_000)
}

export type Periodo = 'dia' | 'semana' | 'mes' | 'ano'

function inicioDaSemana(iso: string) {
  return somarDias(iso, -paraData(iso).getDay())
}

/** Atalhos do Financeiro terminam hoje; a consulta livre pode escolher outras datas. */
export function intervaloAtual(periodo: Periodo, hoje: string) {
  const de = periodo === 'dia' ? hoje
    : periodo === 'semana' ? inicioDaSemana(hoje)
    : periodo === 'mes' ? `${hoje.slice(0, 7)}-01`
    : `${hoje.slice(0, 4)}-01-01`
  return { de, ate: hoje }
}

export function noPeriodo(data: string, periodo: Periodo, referencia: string) {
  if (periodo === 'dia') return data === referencia
  if (periodo === 'mes') return data.slice(0, 7) === referencia.slice(0, 7)
  if (periodo === 'ano') return data.slice(0, 4) === referencia.slice(0, 4)
  const inicio = inicioDaSemana(referencia)
  return data >= inicio && data <= somarDias(inicio, 6)
}

/** Uma data dentro do período imediatamente anterior, para comparar ("vs ontem"). */
export function periodoAnterior(periodo: Periodo, referencia: string) {
  if (periodo === 'dia') return somarDias(referencia, -1)
  if (periodo === 'semana') return somarDias(referencia, -7)
  const { ano, mes, dia } = partes(referencia)
  if (periodo === 'ano') return paraISO(new Date(ano - 1, mes - 1, Math.min(dia, 28)))
  const ultimoDiaAnterior = new Date(ano, mes - 1, 0).getDate()
  return paraISO(new Date(ano, mes - 2, Math.min(dia, ultimoDiaAnterior)))
}

const extenso = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

export function dataPorExtenso(iso: string) {
  const texto = extenso.format(paraData(iso))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
