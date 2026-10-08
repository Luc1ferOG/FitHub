import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import { Button } from '../button';
import { Input } from '../input';
import { AppText } from '../app-text';
it('keeps a loading button named, disabled and semantically checked', () => {
  render(<AppThemeProvider><Button label="Save workout" loading accessibilityRole="radio" accessibilityState={{ checked: true, disabled: false }} /></AppThemeProvider>);
  expect(screen.getByText('Save workout')).toBeTruthy();
  expect(screen.getByRole('radio').props['accessibilityState']).toEqual({ checked: true, disabled: true, busy: true });
});
it('combines field guidance and error feedback instead of overriding either', () => {
  const blur = jest.fn();
  render(<AppThemeProvider><Input label="Weight" accessibilityHint="Enter kilograms" error="Enter a positive number" onBlur={blur} /></AppThemeProvider>);
  expect(screen.getByLabelText('Weight').props['accessibilityHint']).toBe('Enter kilograms. Enter a positive number');
  fireEvent(screen.getByLabelText('Weight'), 'blur', {}); expect(blur).toHaveBeenCalled();
});
it('leaves dynamic type enabled and preserves a caller description', () => {
  render(<AppThemeProvider><AppText accessibilityLabel="Workout completed">Great session</AppText></AppThemeProvider>);
  expect(screen.getByLabelText('Workout completed').props['allowFontScaling']).not.toBe(false);
});
it('preserves descriptive input names instead of replacing them with generic visual labels', () => {
  render(<AppThemeProvider><Input label="Reps" accessibilityLabel="Back Squat, set 1, reps" /></AppThemeProvider>);
  expect(screen.getByLabelText('Back Squat, set 1, reps')).toBeTruthy();
});
