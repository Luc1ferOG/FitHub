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
import { useRegisterMutation } from '../hooks/use-auth-mutations';
import { getAuthErrorMessage } from '../services/auth-service';
import { registerSchema, type RegisterFormValues } from '../validation/auth-schema';

const defaultValues: RegisterFormValues = {
  username: '',
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export function RegisterScreen() {
  const theme = useAppTheme();
  const register = useRegisterMutation();
  const { control, handleSubmit, formState } = useForm<RegisterFormValues>({
    defaultValues,
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
  });

  const submit = handleSubmit(async (values) => {
    register.reset();
    await register.mutateAsync(values).catch(() => undefined);
  });

  const needsEmailConfirmation = register.data && register.data.session === null;

  return (
    <AuthScreenLayout
      title="Join FitHub"
      subtitle="Create an account and start building better habits."
      footer={
        <View style={{ gap: theme.spacing.sm, alignSelf: 'stretch' }}>
          <Text style={[theme.typography.body, { color: theme.colors.textMuted, textAlign: 'center' }]}>Already have an account?</Text>
          <Link href="/(auth)/login" asChild><Button label="Log in" variant="ghost" /></Link>
        </View>
      }
    >
      {register.error ? <FormMessage message={getAuthErrorMessage(register.error)} /> : null}
      {needsEmailConfirmation ? (
        <FormMessage
          tone="success"
          message="Account created. Check your email to confirm your address, then log in."
        />
      ) : null}
      <Controller
        control={control}
        name="username"
        render={({ field: { onBlur, onChange, value, ref }, fieldState: { error } }) => (
          <Input
            ref={ref}
            label="Username"
            accessibilityHint="Use 3 to 30 lowercase letters, numbers, or underscores"
            autoCapitalize="none"
            autoComplete="username-new"
            error={error?.message}
            helperText="Lowercase letters, numbers, and underscores"
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="fitness_friend"
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="displayName"
        render={({ field: { onBlur, onChange, value, ref }, fieldState: { error } }) => (
          <Input
            ref={ref}
            label="Display name"
            autoCapitalize="words"
            error={error?.message}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="Alex Morgan"
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field: { onBlur, onChange, value, ref }, fieldState: { error } }) => (
          <Input
            ref={ref}
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            error={error?.message}
            keyboardType="email-address"
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="you@example.com"
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
            autoComplete="new-password"
            error={error?.message}
            helperText="At least 8 characters"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onBlur, onChange, value, ref }, fieldState: { error } }) => (
          <PasswordInput
            ref={ref}
            label="Confirm password"
            autoComplete="new-password"
            error={error?.message}
            onBlur={onBlur}
            onChangeText={onChange}
            onSubmitEditing={() => void submit()}
            returnKeyType="done"
            value={value}
          />
        )}
      />
      <Button
        fullWidth
        label="Create account"
        loading={register.isPending || formState.isSubmitting}
        onPress={() => void submit()}
      />
    </AuthScreenLayout>
  );
}
