import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { DomainError } from '@/database/errors';
import type { Perfil } from '@/database/types';
import { emptyToNull, maskPhone } from '@/lib/format';
import { PERFIL_LABEL } from '@/lib/permissions';
import { hasErrors, validateUser, type FieldErrors, type UserFormValues } from '@/lib/validation';

type UserFormProps = {
  submitLabel: string;
  /** Exibe perfil e telefone. No primeiro acesso o perfil é sempre administrador. */
  allowProfile?: boolean;
  onSubmit: (values: UserFormValues & { perfil: Perfil; telefone: string | null }) => Promise<void>;
  onError: (message: string) => void;
};

const PERFIS = (Object.keys(PERFIL_LABEL) as Perfil[]).map((value) => ({ label: PERFIL_LABEL[value], value }));

export function UserForm({ submitLabel, allowProfile, onSubmit, onError }: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>({ nome: '', email: '', senha: '', confirmarSenha: '' });
  const [perfil, setPerfil] = useState<Perfil>(allowProfile ? 'professor' : 'admin');
  const [telefone, setTelefone] = useState('');
  const [errors, setErrors] = useState<FieldErrors<keyof UserFormValues>>({});
  const [loading, setLoading] = useState(false);

  const set = (field: keyof UserFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    const found = validateUser(values);
    setErrors(found);
    if (hasErrors(found)) {
      onError('Corrija os campos destacados.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ ...values, perfil, telefone: emptyToNull(telefone) });
    } catch (error) {
      if (error instanceof DomainError && error.field === 'email') {
        setErrors({ email: error.message });
        onError(error.message);
      } else {
        onError('Não foi possível salvar o usuário.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TextField label="Nome completo" required value={values.nome} onChangeText={set('nome')} error={errors.nome} autoComplete="name" />
      <TextField
        label="Email"
        required
        value={values.email}
        onChangeText={set('email')}
        error={errors.email}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextField
        label="Senha"
        required
        value={values.senha}
        onChangeText={set('senha')}
        error={errors.senha}
        hint="Mínimo de 8 caracteres."
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="Confirmar senha"
        required
        value={values.confirmarSenha}
        onChangeText={set('confirmarSenha')}
        error={errors.confirmarSenha}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {allowProfile && (
        <>
          <SelectField label="Perfil de acesso" required options={PERFIS} value={perfil} onChange={(v) => setPerfil(v as Perfil)} />
          <TextField label="Celular" value={telefone} onChangeText={setTelefone} mask={maskPhone} keyboardType="phone-pad" placeholder="(00) 00000-0000" maxLength={15} />
        </>
      )}
      <Button title={submitLabel} onPress={submit} loading={loading} icon="check" />
    </>
  );
}
