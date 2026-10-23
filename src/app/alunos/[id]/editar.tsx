import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { StudentForm } from '@/components/student-form';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { getStudent, updateStudent } from '@/database/student-repository';
import { formToStudentInput, studentToForm } from '@/lib/student-mapper';
import type { StudentFormValues } from '@/lib/validation';

export default function EditStudentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = Number(id);
  const db = useSQLiteContext();
  const user = useCurrentUser();
  const { showToast } = useToast();
  const [initialValues, setInitialValues] = useState<StudentFormValues | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Carrega os dados atuais do aluno ao abrir a tela de edição.
  useEffect(() => {
    getStudent(db, studentId)
      .then((aluno) => {
        if (aluno) setInitialValues(studentToForm(aluno));
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [db, studentId]);

  if (notFound) return <EmptyState icon="warning" title="Aluno não encontrado" message="Ele pode ter sido excluído." />;
  if (!initialValues) return <LoadingState message="Carregando ficha..." />;

  return (
    <StudentForm
      initialValues={initialValues}
      submitLabel="Salvar alterações"
      onSubmit={async (values) => {
        await updateStudent(db, studentId, formToStudentInput(values), user.id);
        showToast('Alterações salvas com sucesso.');
        router.back();
      }}
    />
  );
}
