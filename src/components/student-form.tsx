import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormScreen } from '@/components/ui/form-screen';
import { Icon } from '@/components/ui/icon';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { YesNoField } from '@/components/ui/yes-no-field';
import {
  CORES_RACA,
  ESCOLARIDADES,
  PARENTESCOS,
  RESTRICOES_ALIMENTARES,
  SERIES,
  TIPOS_MORADIA,
  UFS,
} from '@/constants/options';
import { Radius } from '@/constants/theme';
import { useToast } from '@/context/toast-context';
import { DomainError } from '@/database/errors';
import { useTheme } from '@/hooks/use-theme';
import { maskCep, maskCpf, maskDate, maskPhone, onlyDigits } from '@/lib/format';
import { hasErrors, validateStudent, type FieldErrors, type StudentField, type StudentFormValues } from '@/lib/validation';

const SEXOS = [
  { label: 'Masculino', value: 'M' },
  { label: 'Feminino', value: 'F' },
];

type StudentFormProps = {
  initialValues: StudentFormValues;
  submitLabel: string;
  /** Deve lançar DomainError (com `field`) para erros de regra de negócio, como CPF duplicado. */
  onSubmit: (values: StudentFormValues) => Promise<void>;
};

export function StudentForm({ initialValues, submitLabel, onSubmit }: StudentFormProps) {
  const theme = useTheme();
  const { showToast } = useToast();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors<StudentField>>({});
  const [saving, setSaving] = useState(false);

  function set<K extends StudentField>(field: K) {
    return (value: StudentFormValues[K]) => {
      setValues((current) => ({ ...current, [field]: value }));
      if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  /** Props comuns de um campo de texto ligado ao estado do formulário. */
  const text = (field: StudentField & { [K in StudentField]: StudentFormValues[K] extends string ? K : never }[StudentField]) => ({
    value: values[field] as string,
    onChangeText: set(field) as (value: string) => void,
    error: errors[field],
  });

  const submit = async () => {
    const found = validateStudent(values);
    setErrors(found);
    const count = Object.keys(found).length;
    if (hasErrors(found)) {
      showToast(count === 1 ? 'Corrija o campo destacado.' : `Corrija os ${count} campos destacados.`, 'error');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof DomainError) {
        if (error.field) setErrors({ [error.field]: error.message });
        showToast(error.message, 'error');
      } else {
        showToast('Não foi possível salvar. Tente novamente.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <FormScreen footer={<Button title={submitLabel} onPress={submit} loading={saving} icon="check" />}>
      <AppText variant="caption">
        Campos marcados com <AppText variant="caption" color="terracotta">*</AppText> são obrigatórios.
      </AppText>

      {errorCount > 0 && (
        <View style={[styles.alert, { backgroundColor: theme.dangerSoft }]} accessibilityRole="alert">
          <Icon name="error" size={18} color={theme.danger} />
          <AppText variant="bodyStrong" color="danger" style={styles.flex}>
            {errorCount === 1 ? 'Há 1 campo com problema.' : `Há ${errorCount} campos com problema.`} Veja as mensagens em vermelho.
          </AppText>
        </View>
      )}

      <Card title="Dados pessoais" icon="child">
        <TextField label="Nome da criança" required {...text('nome')} autoCapitalize="words" />
        <TextField label="Nome social" {...text('nome_social')} autoCapitalize="words" />
        <TextField
          label="Data de nascimento"
          required
          {...text('data_nascimento')}
          mask={maskDate}
          placeholder="dd/mm/aaaa"
          keyboardType="number-pad"
          maxLength={10}
        />
        <SelectField label="Sexo" options={SEXOS} value={values.sexo} onChange={set('sexo')} />
        <SelectField label="Cor ou raça" options={CORES_RACA} value={values.cor_raca} onChange={set('cor_raca')} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="CPF" {...text('cpf')} mask={maskCpf} keyboardType="number-pad" placeholder="000.000.000-00" maxLength={14} />
          </View>
          <View style={styles.flex}>
            <TextField label="RG" {...text('rg')} keyboardType="number-pad" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Nacionalidade" {...text('nacionalidade')} />
          </View>
          <View style={styles.flex}>
            <TextField label="País de origem" {...text('pais_origem')} />
          </View>
        </View>
        <TextField label="Município de nascimento" {...text('municipio_nascimento')} />
        <SelectField
          label="UF de nascimento"
          options={UFS}
          value={values.uf_nascimento}
          onChange={set('uf_nascimento')}
          error={errors.uf_nascimento}
          chipLimit={0}
        />
      </Card>

      <Card title="Informações sociais" icon="groups">
        <YesNoField label="Recebe Bolsa Família?" value={values.bolsa_familia} onChange={set('bolsa_familia')} />
        <YesNoField label="Possui deficiência?" value={values.possui_deficiencia} onChange={set('possui_deficiencia')} />
        {values.possui_deficiencia && (
          <TextField label="Descrição da deficiência" required {...text('descricao_deficiencia')} multiline />
        )}
      </Card>

      <Card title="Informações familiares" icon="family">
        <TextField label="Nome da mãe" required {...text('nome_mae')} autoCapitalize="words" />
        <SelectField label="Escolaridade da mãe" options={ESCOLARIDADES} value={values.escolaridade_mae} onChange={set('escolaridade_mae')} chipLimit={0} />
        <TextField label="Profissão da mãe" {...text('profissao_mae')} />
        <TextField label="Nome do pai" {...text('nome_pai')} autoCapitalize="words" />
        <SelectField label="Escolaridade do pai" options={ESCOLARIDADES} value={values.escolaridade_pai} onChange={set('escolaridade_pai')} chipLimit={0} />
        <TextField label="Profissão do pai" {...text('profissao_pai')} />
        <TextField label="Responsável pela criança" {...text('responsavel')} autoCapitalize="words" />
        <SelectField
          label="Parentesco do responsável"
          options={PARENTESCOS}
          value={values.parentesco_responsavel}
          onChange={set('parentesco_responsavel')}
        />
        <TextField
          label="Total de pessoas na casa"
          {...text('total_pessoas_casa')}
          mask={onlyDigits}
          keyboardType="number-pad"
          maxLength={2}
        />
        <SelectField label="Tipo de moradia" options={TIPOS_MORADIA} value={values.tipo_moradia} onChange={set('tipo_moradia')} />
      </Card>

      <Card title="Endereço residencial" icon="location">
        <TextField label="Rua" {...text('rua')} />
        <TextField label="Bairro" required {...text('bairro')} autoCapitalize="words" />
        <View style={styles.row}>
          <View style={styles.flex2}>
            <TextField label="Cidade" required {...text('cidade')} autoCapitalize="words" />
          </View>
          <View style={styles.flex}>
            <SelectField label="UF" options={UFS} value={values.uf} onChange={set('uf')} error={errors.uf} chipLimit={0} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="CEP" {...text('cep')} mask={maskCep} keyboardType="number-pad" placeholder="00000-000" maxLength={9} />
          </View>
          <View style={styles.flex}>
            <TextField label="Celular" {...text('telefone')} mask={maskPhone} keyboardType="phone-pad" placeholder="(00) 00000-0000" maxLength={15} />
          </View>
        </View>
      </Card>

      <Card title="Informações educacionais" icon="school">
        <TextField label="Escola de origem" {...text('escola_origem')} />
        <TextField label="Cidade da escola" {...text('cidade_escola')} />
        <SelectField label="Série correspondente" options={SERIES} value={values.serie} onChange={set('serie')} chipLimit={0} />
        <TextField label="Ano de conclusão" {...text('ano_conclusao')} mask={onlyDigits} keyboardType="number-pad" maxLength={4} placeholder="aaaa" />
      </Card>

      <Card title="Informações adicionais" icon="info">
        <YesNoField label="Necessita de transporte escolar?" value={values.transporte_escolar} onChange={set('transporte_escolar')} />
        <TextField label="Pessoas autorizadas a buscar o aluno" {...text('pessoas_autorizadas')} multiline />
        <TextField label="Informações de irmãos ou gêmeos" {...text('irmaos_gemeos')} multiline />
      </Card>

      <Card title="Histórico médico" icon="health">
        <TextField label="Convênio médico" {...text('convenio_medico')} hint="Deixe em branco se não possuir." />
        <YesNoField label="Possui hipertensão?" value={values.hipertensao} onChange={set('hipertensao')} />
        <YesNoField label="Possui diabetes?" value={values.diabetes} onChange={set('diabetes')} />
        <YesNoField label="Possui asma?" value={values.asma} onChange={set('asma')} />
        <TextField label="Tratamento médico em andamento" {...text('tratamento_medico')} multiline />
        <TextField label="Restrição de medicamentos" {...text('restricao_medicamentos')} multiline />
        <TextField label="Uso de medicamentos controlados" {...text('medicamentos_controlados')} multiline />
        <SelectField
          label="Restrição alimentar"
          options={RESTRICOES_ALIMENTARES}
          value={values.restricao_alimentar}
          onChange={set('restricao_alimentar')}
        />
      </Card>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  row: { flexDirection: 'row', gap: 12 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md },
});
