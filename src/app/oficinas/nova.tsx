import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { WorkshopForm } from '@/components/workshop-form';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { saveWorkshop } from '@/database/workshop-repository';

export default function NewWorkshopScreen() {
  const db = useSQLiteContext();
  const user = useCurrentUser();
  const { showToast } = useToast();

  return (
    <WorkshopForm
      initial={{ nome: '', descricao: null, local: null, professorIds: [], alunoIds: [] }}
      submitLabel="Cadastrar oficina"
      onSubmit={async (input) => {
        const id = await saveWorkshop(db, null, input, user.id);
        showToast('Oficina cadastrada. Agora monte o calendário dela.');
        router.replace({ pathname: '/calendario/planejar', params: { oficinaId: String(id) } });
      }}
    />
  );
}
