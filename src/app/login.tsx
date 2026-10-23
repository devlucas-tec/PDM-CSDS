import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { AuthLayout } from '@/components/auth-layout';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Radius } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { hasErrors, validateLogin, type FieldErrors } from '@/lib/validation';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInputInstance>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'email' | 'senha'>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const found = validateLogin(email, senha);
    setErrors(found);
    setFormError(null);
    if (hasErrors(found)) return;

    setLoading(true);
    try {
      const ok = await signIn(email, senha);
      // Ao entrar, o Stack.Protected leva automaticamente para a tela principal.
      if (!ok) setFormError('Email ou senha inválidos.');
    } catch {
      setFormError('Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Entrar" subtitle="Acesse o sistema de gestão de alunos da Casa São Domingos Sávio.">
      {formError && (
        <View style={[styles.alert, { backgroundColor: theme.dangerSoft }]} accessibilityRole="alert">
          <Icon name="error" size={18} color={theme.danger} />
          <AppText variant="bodyStrong" color="danger">
            {formError}
          </AppText>
        </View>
      )}
      <TextField
        label="Email"
        icon="mail"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="voce@exemplo.com"
      />
      <TextField
        ref={passwordRef}
        label="Senha"
        icon="lock"
        value={senha}
        onChangeText={setSenha}
        error={errors.senha}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button title="Entrar" onPress={submit} loading={loading} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  alert: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md },
});
