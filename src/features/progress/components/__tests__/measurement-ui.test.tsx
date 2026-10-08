import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import { MeasurementForm } from '../measurement-form';
import { ProgressChart } from '../progress-chart';
it('changes display units without changing the physical measurement or percentage', async () => {
  const save = jest.fn();
  render(<AppThemeProvider><MeasurementForm preferredUnits="metric" saving={false} error={null} onSave={save} /></AppThemeProvider>);
  fireEvent.changeText(screen.getByLabelText('Body weight (kg)'), '80');
  fireEvent.changeText(screen.getByLabelText('Body fat (%)'), '20');
  fireEvent.press(screen.getByText('Imperial · lb / in'));
  expect(screen.getByLabelText('Body weight (lb)').props['value']).toBe('176.37');
  expect(screen.getByLabelText('Body fat (%)').props['value']).toBe('20');
  fireEvent.press(screen.getByText('Save measurement'));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 80, bodyFatPercentage: 20 })));
});
it('accepts an imperial measurement and sends canonical values, not display units', async () => {
  const save = jest.fn();
  render(<AppThemeProvider><MeasurementForm preferredUnits="imperial" saving={false} error={null} onSave={save} /></AppThemeProvider>);
  fireEvent.changeText(screen.getByLabelText('Body weight (lb)'), '176.37');
  fireEvent.press(screen.getByText('Save measurement'));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 80, waistCm: null })));
});
it('shows field validation errors and disables submit during saves', async () => {
  const save = jest.fn();
  const rendered = render(<AppThemeProvider><MeasurementForm preferredUnits="metric" saving={false} error={null} onSave={save} /></AppThemeProvider>);
  fireEvent.changeText(screen.getByLabelText('Body weight (kg)'), '-2');
  fireEvent.press(screen.getByText('Save measurement'));
  await waitFor(() => expect(screen.getByText(/Body weight must be/)).toBeTruthy()); expect(save).not.toHaveBeenCalled();
  rendered.rerender(<AppThemeProvider><MeasurementForm preferredUnits="metric" saving error={null} onSave={save} /></AppThemeProvider>);
  expect(screen.getByLabelText('Saving measurement…')).toBeDisabled();
});
it('makes chart values available as accessible text and handles a single point', () => {
  render(<AppThemeProvider><ProgressChart field="weightKg" units="metric" points={[{ date: '2020-01-01T00:00:00Z', weightKg: 80, waistCm: null, bodyFatPercentage: null }]} /></AppThemeProvider>);
  expect(screen.getByLabelText(/Body weight chart. 1 time buckets/)).toBeTruthy();
  fireEvent.press(screen.getByText('Show chart values'));
  expect(screen.getByText('2020-01-01: 80.0 kg')).toBeTruthy();
});
