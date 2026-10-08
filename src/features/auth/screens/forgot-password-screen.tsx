import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { Button, Input } from '@/components/ui';
import { useAppTheme } from '@/theme';

import { AuthScreenLayout } from '../components/auth-screen-layout';
import { FormMessage } from '../components/form-message';
import { usePasswordResetRequestMutation } from '../hooks/use-auth-mutations';
import { getAuthErrorMessage } from '../services/auth-service';
import {
  passwordResetRequestSchema,
  type PasswordResetRequestValues,
} from '../validation/auth-schema';

const defaultValues: PasswordResetRequestValues = { email: '' };

export function ForgotPasswordScreen() {
  const theme = useAppTheme();
  const resetRequest = usePasswordResetRequestMutation();
  const { control, handleSubmit, formState } = useForm<PasswordResetRequestValues>({
    defaultValues,
    resolver: zodResolver(passwordResetRequestSchema),
    mode: 'onTouched',
  });

  const submit = handleSubmit(async (values) => {
    resetRequest.reset();
    await resetRequest.mutateAsync(values).catch(() => undefined);
  });

  return (
    <AuthScreenLayout
      title="Reset password"
      subtitle="Enter your email and we’ll send you a secure recovery link."
      footer={
        <View style={{ gap: theme.spacing.sm, alignSelf: 'stretch' }}>
          <Text style={[theme.typography.body, { color: theme.colors.textMuted, textAlign: 'center' }]}>Remembered it?</Text>
          <Link href="/(auth)/login" asChild><Button label="Back to login" variant="ghost" /></Link>
        </View>
      }
    >
      {resetRequest.error ? <FormMessage message={getAuthErrorMessage(resetRequest.error)} /> : null}
      {resetRequest.isSuccess ? (
        <FormMessage
          tone="success"
          message="If an account exists for that email, a recovery link has been sent."
        />
      ) : null}
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
            onSubmitEditing={() => void submit()}
            returnKeyType="send"
            value={value}
          />
        )}
      />
      <Button
        fullWidth
        label="Send recovery link"
        loading={resetRequest.isPending || formState.isSubmitting}
        onPress={() => void submit()}
      />
    </AuthScreenLayout>
  );
}
