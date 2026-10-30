/** As regras puras do cadastro de cliente (`comum/regras/cliente.ts`). */
import { describe, expect, it } from 'vitest'
import { documentoValido, mascaraDocumento, mascaraTelefone } from '../../comum/regras/cliente'

describe('cadastro de cliente', () => {
  it('[R-CLIENTE-09] dígitos verificadores do CPF e do CNPJ', () => {
    expect(['52998224725', '11144477735', '11222333000181'].map(documentoValido)).toEqual([true, true, true])
    expect(['52998224724', '11222333000180', '00000000000', '1234567890'].map(documentoValido)).toEqual([false, false, false, false])
  })

  it('máscara do CPF/CNPJ enquanto digita: CPF até 11 números, CNPJ de 12 a 14', () => {
    expect(['5', '5299', '5299822', '529982247', '52998224725'].map(mascaraDocumento))
      .toEqual(['5', '529.9', '529.982.2', '529.982.247', '529.982.247-25'])
    expect(['112223330001', '11222333000181', '11222333000181999'].map(mascaraDocumento))
      .toEqual(['11.222.333/0001', '11.222.333/0001-81', '11.222.333/0001-81'])
    expect(mascaraDocumento('cpf: 529.982.247-25')).toBe('529.982.247-25')
  })

  it('[R-CLIENTE-10] máscara do telefone: fixo com 10 números, celular com 11', () => {
    expect(['3', '33', '339', '339999', '3399991234', '33999991234', '339999912345'].map(mascaraTelefone))
      .toEqual(['(3', '(33', '(33) 9', '(33) 9999', '(33) 9999-1234', '(33) 99999-1234', '(33) 99999-1234'])
    expect(mascaraTelefone('')).toBe('')
  })
})
