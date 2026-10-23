import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { WorkshopForm } from '@/components/workshop-form';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { errorMessage } from '@/database/errors';
import { deleteWorkshop, getWorkshop, saveWorkshop, type WorkshopInput } from '@/database/workshop-repository';
import { confirmAsync } from '@/lib/confirm';

export default function EditWorkshopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const oficinaId = Number(id);
  const db = useSQLiteContext();
  const user = useCurrentUser();
  const { showToast } = useToast();
  const [initial, setInitial] = useState<WorkshopInput | null | undefined>(undefined);

  useEffect(() => {
    getWorkshop(db, oficinaId).then((found) =>
      setInitial(
        found
          ? { nome: found.oficina.nome, descricao: found.oficina.descricao, local: found.oficina.local, professorIds: found.professorIds, alunoIds: found.alunoIds }
          : null,
      ),
    );
  }, [db, oficinaId]);

  if (initial === undefined) return <LoadingState />;
  if (initial === null) return <EmptyState icon="warning" title="Oficina não encontrada" />;

  const handleDelete = async () => {
    const confirmed = await confirmAsync({
      title: `Excluir ${initial.nome}?`,
      message: 'Todas as aulas do calendário, as chamadas e as matrículas desta oficina serão apagadas. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteWorkshop(db, oficinaId, user.id);
      showToast('Oficina excluída.');
      router.back();
    } catch (error) {
      showToast(errorMessage(error, 'Não foi possível excluir a oficina.'), 'error');
    }
  };

  return (
    <WorkshopForm
      initial={initial}
      submitLabel="Salvar oficina"
      onSubmit={async (input) => {
        await saveWorkshop(db, oficinaId, input, user.id);
        showToast('Oficina atualizada.');
        router.back();
      }}
      extra={
        <View style={{ gap: 10 }}>
          <Button
            title="Adicionar aulas ao calendário"
            icon="plan"
            variant="secondary"
            onPress={() => router.push({ pathname: '/calendario/planejar', params: { oficinaId: String(oficinaId) } })}
          />
          <Button title="Excluir oficina" icon="delete" variant="danger" onPress={handleDelete} />
        </View>
      }
    />
  );
}
