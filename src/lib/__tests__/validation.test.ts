import { brToIso, calculateAge, maskCpf, maskDate, maskPhone } from '@/lib/format';
import { EMPTY_STUDENT_FORM } from '@/lib/student-mapper';
import { isValidCpf, validateHistory, validateLogin, validateStudent, validateUser } from '@/lib/validation';

const today = new Date(2026, 9, 20);

describe('máscaras e datas', () => {
  it('formata enquanto o usuário digita', () => {
    expect(maskDate('10032016')).toBe('10/03/2016');
    expect(maskCpf('52998224725')).toBe('529.982.247-25');
    expect(maskPhone('83999990000')).toBe('(83) 99999-0000');
  });

  it('rejeita datas que não existem', () => {
    expect(brToIso('31/02/2016')).toBeNull();
    expect(brToIso('29/02/2016')).toBe('2016-02-29');
  });

  it('calcula a idade considerando o aniversário', () => {
    expect(calculateAge('2016-10-21', today)).toBe(9);
    expect(calculateAge('2016-10-20', today)).toBe(10);
  });
});

describe('validação de usuário', () => {
  it('exige senha de 8 caracteres e confirmação igual', () => {
    const errors = validateUser({ nome: 'Ramona', email: 'ramona@casa.org', senha: '123', confirmarSenha: '456' });
    expect(errors.senha).toMatch(/8 caracteres/);
    expect(errors.confirmarSenha).toMatch(/não são iguais/);
  });

  it('valida formato do email no login', () => {
    expect(validateLogin('ramona', 'x').email).toMatch(/inválido/);
    expect(validateLogin('ramona@casa.org', '')).toEqual({ senha: 'Informe a senha.' });
  });
});

describe('validação de aluno', () => {
  it('exige nome, data de nascimento, nome da mãe, bairro e cidade', () => {
    const errors = validateStudent(EMPTY_STUDENT_FORM, today);
    expect(Object.keys(errors).sort()).toEqual(['bairro', 'cidade', 'data_nascimento', 'nome', 'nome_mae']);
  });

  it('aceita um cadastro mínimo válido', () => {
    const values = { ...EMPTY_STUDENT_FORM, nome: 'Ana Clara', data_nascimento: '10/03/2016', nome_mae: 'Maria', bairro: 'Malvinas', cidade: 'Campina Grande' };
    expect(validateStudent(values, today)).toEqual({});
  });

  it('valida CPF, CEP, nascimento no futuro e descrição de deficiência', () => {
    const values = {
      ...EMPTY_STUDENT_FORM,
      nome: 'Ana Clara',
      data_nascimento: '10/03/2030',
      nome_mae: 'Maria',
      bairro: 'Malvinas',
      cidade: 'Campina Grande',
      cpf: '111.111.111-11',
      cep: '584',
      possui_deficiencia: true,
    };
    const errors = validateStudent(values, today);
    expect(errors.cpf).toBe('CPF inválido.');
    expect(errors.cep).toMatch(/8 dígitos/);
    expect(errors.data_nascimento).toMatch(/futuro/);
    expect(errors.descricao_deficiencia).toBeDefined();
  });

  it('reconhece CPF válido', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('529.982.247-26')).toBe(false);
  });
});

describe('validação de histórico', () => {
  it('exige tipo, descrição e data não futura', () => {
    const errors = validateHistory({ tipo: '', descricao: 'oi', data_evento: '01/01/2030' }, today);
    expect(Object.keys(errors).sort()).toEqual(['data_evento', 'descricao', 'tipo']);
  });
});
