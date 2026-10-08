import { render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme';

import { Button } from '../button';

describe('Button', () => {
  it('exposes an accessible button label', () => {
    render(
      <AppThemeProvider>
        <Button label="Start workout" onPress={jest.fn()} />
      </AppThemeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Start workout' })).toBeTruthy();
  });
});
