/**
 * O PIN do operador no banco (`R-OPERADOR-08`): só o hash, com sal, em
 * `scrypt$<sal>$<hash>`. O hash não protege um PIN de 4 dígitos de quem tem o
 * arquivo (são 10 mil tentativas); serve para o PIN não ficar legível no banco
 * nem nas cópias. A proteção no balcão é a espera depois de 5 erros.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const TAMANHO = 32

/** `sal`: só a semente passa, para sair a mesma base a cada vez. */
export function hashDoPin(pin: string, sal = randomBytes(16).toString('hex')) {
  return `scrypt$${sal}$${scryptSync(pin, sal, TAMANHO).toString('hex')}`
}

export function pinConfere(pin: string, hash: string | null) {
  const [tipo, sal, guardado] = hash?.split('$') ?? []
  if (tipo !== 'scrypt' || !sal || !guardado) return false
  return timingSafeEqual(scryptSync(pin, sal, TAMANHO), Buffer.from(guardado, 'hex'))
}
