import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import { makeSession } from '../../testing/session-fixtures';
import { ActiveSetRow } from '../active-set-row';
import { completedSetFeedback } from '@/services/device/haptics';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/services/device/haptics', () => ({ completedSetFeedback: jest.fn().mockResolvedValue(undefined) }));
describe('active set row', () => {
  beforeEach(() => jest.clearAllMocks());
  it('gives feedback only for a new completion, not restoration or unrelated rerenders', () => {
    const exercise = makeSession().exercises[0], set = exercise?.sets[0]; if (!exercise || !set) throw new Error('Missing fixture');
    const props = { set, index: 0, exerciseId: exercise.id, exerciseName: exercise.name, previous: undefined, record: false, disabled: false, onAction: jest.fn() };
    const view = render(<AppThemeProvider><ActiveSetRow {...props} /></AppThemeProvider>);
    expect(completedSetFeedback).not.toHaveBeenCalled();
    view.rerender(<AppThemeProvider><ActiveSetRow {...props} set={{ ...set, completedAt: 123 }} /></AppThemeProvider>);
    expect(completedSetFeedback).toHaveBeenCalledTimes(1);
    view.rerender(<AppThemeProvider><ActiveSetRow {...props} set={{ ...set, completedAt: 123 }} record /></AppThemeProvider>);
    expect(completedSetFeedback).toHaveBeenCalledTimes(1);
  });
  it('shows previous performance and emits completion and value actions', () => {
    const exercise = makeSession().exercises[0], set = exercise?.sets[0]; if (!exercise || !set) throw new Error('Missing fixture');
    const onAction = jest.fn();
    render(<AppThemeProvider><ActiveSetRow set={set} index={0} exerciseId={exercise.id} exerciseName={exercise.name} previous={{ weight: 15, reps: 10 }} record={false} disabled={false} onAction={onAction} /></AppThemeProvider>);
    expect(screen.getByText('Previous: 15 kg × 10')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Back Squat, set 1, weight in kilograms'), '25');
    expect(onAction).toHaveBeenCalledWith({ type: 'set-value', exerciseId: exercise.id, setId: set.id, field: 'weight', value: '25' });
    fireEvent.press(screen.getByRole('checkbox', { name: 'Back Squat, set 1, completed' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'toggle-set', exerciseId: exercise.id, setId: set.id }));
  });
  it('locks completed inputs and exposes the checked state and PR candidate', () => {
    const exercise = makeSession().exercises[0], set = exercise?.sets[0]; if (!exercise || !set) throw new Error('Missing fixture');
    render(<AppThemeProvider><ActiveSetRow set={{ ...set, completedAt: Date.now() }} index={0} exerciseId={exercise.id} exerciseName={exercise.name} previous={undefined} record disabled={false} onAction={jest.fn()} /></AppThemeProvider>);
    expect(screen.getByRole('checkbox', { checked: true })).toBeTruthy();
    expect(screen.getByText('PR candidate')).toBeTruthy();
    expect(screen.getByLabelText('Back Squat, set 1, reps').props['editable']).toBe(false);
    expect(completedSetFeedback).not.toHaveBeenCalled();
  });
});
