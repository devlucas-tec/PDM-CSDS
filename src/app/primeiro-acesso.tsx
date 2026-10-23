import { AuthLayout } from '@/components/auth-layout';
import { UserForm } from '@/components/user-form';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';

/** Exibida só quando o banco ainda não tem nenhum usuário: cria o primeiro administrador. */
export default function FirstAccessScreen() {
  const { registerFirstAdmin } = useAuth();
  const { showToast } = useToast();

  return (
    <AuthLayout
      title="Primeiro acesso"
      subtitle="Cadastre o administrador do sistema. Depois, ele poderá criar as contas da equipe.">
      <UserForm
        submitLabel="Criar administrador"
        onSubmit={async ({ nome, email, senha }) => {
          await registerFirstAdmin({ nome, email, senha });
          showToast('Administrador criado. Bem-vindo(a)!');
        }}
        onError={(message) => showToast(message, 'error')}
      />
    </AuthLayout>
  );
}
