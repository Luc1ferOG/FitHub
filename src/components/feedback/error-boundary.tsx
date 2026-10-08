import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { errorReporter } from '@/services/error-reporting/error-reporter';
import { useAppTheme } from '@/theme';
import { toAppError } from '@/utils/errors';

import { Button } from '../ui/button';

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    errorReporter.capture(
      toAppError(error, 'The application encountered an unexpected error.'),
    );

    if (__DEV__) {
      console.error(info.componentStack);
    }
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return <ErrorFallback onReset={this.reset} />;
  }
}

function ErrorFallback({ onReset }: { onReset: () => void }) {
  const theme = useAppTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background, padding: theme.spacing.xl }]}
      accessibilityRole="alert"
    >
      <Text style={[theme.typography.heading, styles.centered, { color: theme.colors.text }]}>
        Something went wrong
      </Text>
      <Text style={[theme.typography.body, styles.centered, { color: theme.colors.textMuted }]}>
        Please try again. If the problem persists, restart the app.
      </Text>
      <Button label="Try again" onPress={onReset} accessibilityHint="Reloads this screen" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  centered: {
    textAlign: 'center',
  },
});
