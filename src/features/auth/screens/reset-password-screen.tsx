import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { LoadingIndicator } from '@/components/feedback';
import { Button } from '@/components/ui';

import { AuthScreenLayout } from '../components/auth-screen-layout';
import { FormMessage } from '../components/form-message';
import { PasswordInput } from '../components/password-input';
import { useAuth } from '../context/auth-context';
import {
  usePasswordRecoveryCodeMutation,
  useUpdatePasswordMutation,
} from '../hooks/use-auth-mutations';
import { getAuthErrorMessage } from '../services/auth-service';
import { newPasswordSchema, type NewPasswordFormValues } from '../validation/auth-schema';

const defaultValues: NewPasswordFormValues = { password: '', confirmPassword: '' };

export function ResetPasswordScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { session } = useAuth();
  const recovery = usePasswordRecoveryCodeMutation();
  const updatePassword = useUpdatePasswordMutation();
  const attemptedCode = useRef<string | null>(null);
  const { control, handleSubmit, formState } = useForm<NewPasswordFormValues>({
    defaultValues,
    resolver: zodResolver(newPasswordSchema),
    mode: 'onTouched',
  });

  useEffect(() => {
    if (!session && code && attemptedCode.current !== code) {
      attemptedCode.current = code;
      recovery.mutate(code);
    }
  }, [code, recovery, session]);

  const submit = handleSubmit(async (values) => {
    updatePassword.reset();
    try {
      await updatePassword.mutateAsync(values);
      router.replace('/(tabs)/home');
    } catch {
      // The mutation exposes the normalized error below.
    }
  });

  if (!session && recovery.isPending) {
    return <LoadingIndicator fullScreen label="Verifying recovery link" />;
  }

  const recoveryError = recovery.error ?? (!session && !code ? new Error('Missing recovery code') : null);

  return (
    <AuthScreenLayout
      title="Choose a new password"
      subtitle="Use at least eight characters and keep it unique to FitHub."
    >
      {recoveryError ? (
        <FormMessage
          message={
            recovery.error
              ? getAuthErrorMessage(recovery.error)
              : 'This recovery link is invalid or incomplete. Request a new one.'
          }
        />
      ) : null}
      {updatePassword.error ? (
        <FormMessage message={getAuthErrorMessage(updatePassword.error)} />
      ) : null}
      <Controller
        control={control}
        name="password"
        render={({ field: { onBlur, onChange, value, ref }, fieldState: { error } }) => (
          <PasswordInput
            ref={ref}
            label="New password"
            autoComplete="new-password"
            editable={session !== null}
            error={error?.message}
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
            label="Confirm new password"
            autoComplete="new-password"
            editable={session !== null}
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
        disabled={session === null}
        fullWidth
        label="Update password"
        loading={updatePassword.isPending || formState.isSubmitting}
        onPress={() => void submit()}
      />
    </AuthScreenLayout>
  );
}
