import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Card } from '@/components/ui/card';
import { FormScreen } from '@/components/ui/form-screen';
import { UserForm } from '@/components/user-form';
import { useToast } from '@/context/toast-context';
import { createStaffAccount } from '@/services/users';

/** Cadastro de usuário — disponível apenas para administradores (rota protegida no _layout). */
export default function NewUserScreen() {
  const db = useSQLiteContext();
  const { showToast } = useToast();

  return (
    <FormScreen>
      <Card title="Dados de acesso" subtitle="O novo usuário entra com este email e senha. O cadastro precisa de internet." icon="personAdd">
        <UserForm
          allowProfile
          submitLabel="Cadastrar usuário"
          onSubmit={async ({ nome, email, senha, perfil, telefone }) => {
            await createStaffAccount(db, { nome, email, senha, perfil, telefone });
            showToast('Usuário cadastrado com sucesso.');
            router.back();
          }}
          onError={(message) => showToast(message, 'error')}
        />
      </Card>
    </FormScreen>
  );
}
