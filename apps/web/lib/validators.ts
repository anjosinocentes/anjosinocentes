// Validações compartilhadas entre frontend e backend. Limites de tamanho pensados pelo
// significado de cada campo (nome de pessoa não é o mesmo que uma mensagem de aviso), não
// um valor único genérico para tudo - ver auditoria QA.

export function isValidCPF(raw: string): boolean {
  const cpf = (raw || "").replace(/\D/g, "")
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false // todos os dígitos iguais (000..., 111..., etc.)

  const calcCheckDigit = (base: string, factorStart: number) => {
    let sum = 0
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * (factorStart - i)
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  const digit1 = calcCheckDigit(cpf.slice(0, 9), 10)
  const digit2 = calcCheckDigit(cpf.slice(0, 10), 11)
  return digit1 === parseInt(cpf[9], 10) && digit2 === parseInt(cpf[10], 10)
}

export function isValidEmailFormat(email: string): boolean {
  // Checagem pragmática (não uma regex exaustiva de RFC 5322) - consistente com o padrão
  // já usado no restante do sistema (ex.: tela de login).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim()) && email.length <= 254
}
