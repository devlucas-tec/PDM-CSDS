import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { StudentForm } from '@/components/student-form';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { createStudent } from '@/database/student-repository';
import { EMPTY_STUDENT_FORM, formToStudentInput } from '@/lib/student-mapper';

export default function NewStudentScreen() {
  const db = useSQLiteContext();
  const user = useCurrentUser();
  const { showToast } = useToast();

  return (
    <StudentForm
      initialValues={EMPTY_STUDENT_FORM}
      submitLabel="Cadastrar aluno"
      onSubmit={async (values) => {
        const id = await createStudent(db, formToStudentInput(values), user.id);
        showToast('Aluno cadastrado com sucesso.');
        router.replace({ pathname: '/alunos/[id]', params: { id: String(id) } });
      }}
    />
  );
}
