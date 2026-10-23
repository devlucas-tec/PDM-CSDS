import { createContext, use, useCallback, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ToastType = 'success' | 'error' | 'info';
type Toast = { id: number; type: ToastType; message: string };

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Mensagens rápidas de sucesso/erro exibidas na parte de baixo da tela. */
export function ToastProvider({ children }: PropsWithChildren) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), type, message });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const colors = {
    success: { bg: theme.successSoft, fg: theme.success, icon: 'checkCircle' as const },
    error: { bg: theme.dangerSoft, fg: theme.danger, icon: 'error' as const },
    info: { bg: theme.accentSoft, fg: theme.text, icon: 'info' as const },
  };

  return (
    <ToastContext value={value}>
      {children}
      <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 96 }]}>
        {toast && (
          <Animated.View
            key={toast.id}
            entering={FadeInDown.duration(220)}
            exiting={FadeOutDown.duration(180)}
            accessibilityLiveRegion="assertive"
            accessibilityRole="alert"
            style={[styles.toast, { backgroundColor: colors[toast.type].bg, borderColor: colors[toast.type].fg }]}>
            <Icon name={colors[toast.type].icon} size={20} color={colors[toast.type].fg} />
            <AppText variant="bodyStrong" style={[styles.text, { color: colors[toast.type].fg }]}>
              {toast.message}
            </AppText>
          </Animated.View>
        )}
      </View>
    </ToastContext>
  );
}

export function useToast() {
  const context = use(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de <ToastProvider>.');
  return context;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    maxWidth: 520,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
  },
  text: { flex: 1 },
});
