import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormScreen } from '@/components/ui/form-screen';
import { MultiSelectField, type MultiOption } from '@/components/ui/multi-select-field';
import { LoadingState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/context/toast-context';
import { DomainError } from '@/database/errors';
import { listStudents } from '@/database/student-repository';
import { listTeachers } from '@/database/user-repository';
import type { WorkshopInput } from '@/database/workshop-repository';
import { emptyToNull } from '@/lib/format';

type WorkshopFormProps = {
  initial: WorkshopInput;
  submitLabel: string;
  onSubmit: (input: WorkshopInput) => Promise<void>;
  extra?: React.ReactNode;
};

/** Dados da oficina + professores vinculados + alunos matriculados. */
export function WorkshopForm({ initial, submitLabel, onSubmit, extra }: WorkshopFormProps) {
  const db = useSQLiteContext();
  const { showToast } = useToast();
  const [nome, setNome] = useState(initial.nome);
  const [descricao, setDescricao] = useState(initial.descricao ?? '');
  const [local, setLocal] = useState(initial.local ?? '');
  const [professorIds, setProfessorIds] = useState(initial.professorIds);
  const [alunoIds, setAlunoIds] = useState(initial.alunoIds);
  const [teachers, setTeachers] = useState<MultiOption[] | null>(null);
  const [students, setStudents] = useState<MultiOption[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listTeachers(db), listStudents(db)]).then(([t, s]) => {
      setTeachers(t.map((u) => ({ id: u.id, label: u.nome, detail: u.email })));
      setStudents(s.map((a) => ({ id: a.id, label: a.nome_social || a.nome, detail: [a.serie, a.bairro].filter(Boolean).join(' · ') })));
    });
  }, [db]);

  const submit = async () => {
    if (nome.trim().length < 2) {
      setError('Informe o nome da oficina.');
      showToast('Informe o nome da oficina.', 'error');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ nome, descricao: emptyToNull(descricao), local: emptyToNull(local), professorIds, alunoIds });
    } catch (e) {
      const message = e instanceof DomainError ? e.message : 'Não foi possível salvar a oficina.';
      if (e instanceof DomainError && e.field === 'nome') setError(message);
      showToast(message, 'error');
      setSaving(false);
    }
  };

  if (!teachers) return <LoadingState />;

  return (
    <FormScreen footer={<Button title={submitLabel} icon="check" onPress={submit} loading={saving} />}>
      <Card title="Oficina" icon="workshop">
        <TextField label="Nome" required value={nome} onChangeText={(v) => { setNome(v); setError(undefined); }} error={error} placeholder="Ex.: Judô" />
        <TextField label="Local" value={local} onChangeText={setLocal} placeholder="Ex.: Quadra" />
        <TextField label="Descrição" value={descricao} onChangeText={setDescricao} multiline />
      </Card>
      <Card title="Equipe e turma" icon="groups">
        <MultiSelectField
          label="Professores"
          options={teachers}
          value={professorIds}
          onChange={setProfessorIds}
          emptyText="Nenhum professor vinculado"
          hint={teachers.length === 0 ? 'Cadastre usuários com perfil Professor na aba Conta.' : 'Os professores veem os dias desta oficina na agenda deles.'}
        />
        <MultiSelectField
          label="Alunos matriculados"
          options={students}
          value={alunoIds}
          onChange={setAlunoIds}
          emptyText="Nenhum aluno matriculado"
          searchable
          hint="Os matriculados aparecem na lista de chamada."
        />
      </Card>
      {extra}
    </FormScreen>
  );
}
