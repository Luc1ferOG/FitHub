import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { Button, Input } from '@/components/ui';
import { useAppTheme } from '@/theme';

import { AuthScreenLayout } from '../components/auth-screen-layout';
import { FormMessage } from '../components/form-message';
import { PasswordInput } from '../components/password-input';
import { useLoginMutation } from '../hooks/use-auth-mutations';
import { getAuthErrorMessage } from '../services/auth-service';
import { loginSchema, type LoginFormValues } from '../validation/auth-schema';

const defaultValues: LoginFormValues = { email: '', password: '' };

export function LoginScreen() {
  const theme = useAppTheme();
  const login = useLoginMutation();
  const { control, handleSubmit, formState } = useForm<LoginFormValues>({
    defaultValues,
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  });

  const submit = handleSubmit(async (values) => {
    login.reset();
    await login.mutateAsync(values).catch(() => undefined);
  });

  return (
    <AuthScreenLayout
      title="Welcome back"
      subtitle="Log in to continue your fitness journey."
      footer={
        <View style={{ gap: theme.spacing.sm, alignSelf: 'stretch' }}>
          <Text style={[theme.typography.body, { color: theme.colors.textMuted, textAlign: 'center' }]}>New to FitHub?</Text>
          <Link href="/(auth)/register" asChild><Button label="Create an account" variant="ghost" /></Link>
        </View>
      }
    >
      {login.error ? <FormMessage message={getAuthErrorMessage(login.error)} /> : null}
      <Controller
        control={control}
        name="email"
        render={({ field: { onBlur, onChange, value, ref }, fieldState: { error } }) => (
          <Input
            ref={ref}
            label="Email"
            accessibilityHint="Enter the email associated with your FitHub account"
            autoCapitalize="none"
            autoComplete="email"
            error={error?.message}
            keyboardType="email-address"
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="you@example.com"
            returnKeyType="next"
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onBlur, onChange, value, ref }, fieldState: { error } }) => (
          <PasswordInput
            ref={ref}
            label="Password"
            autoComplete="current-password"
            error={error?.message}
            onBlur={onBlur}
            onChangeText={onChange}
            onSubmitEditing={() => void submit()}
            returnKeyType="done"
            value={value}
          />
        )}
      />
      <Link href="/(auth)/forgot-password" asChild><Button label="Forgot password?" variant="ghost" /></Link>
      <Button
        fullWidth
        label="Log in"
        loading={login.isPending || formState.isSubmitting}
        onPress={() => void submit()}
      />
    </AuthScreenLayout>
  );
}
