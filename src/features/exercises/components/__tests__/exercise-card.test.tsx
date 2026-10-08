import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme';

import { ExerciseCard } from '../exercise-card';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

describe('ExerciseCard', () => {
  it('renders accessible exercise metadata and selects its ID', () => {
    const onSelect = jest.fn();
    render(<AppThemeProvider><ExerciseCard onSelect={onSelect} exercise={{
      id: 'squat-id', name: 'Back Squat', primaryMuscle: 'quadriceps',
      equipment: 'barbell', difficulty: 'intermediate', thumbnailUrl: null,
    }} /></AppThemeProvider>);

    const card = screen.getByRole('button', {
      name: 'Back Squat. Primary muscle: quadriceps. Equipment: barbell. Difficulty: intermediate.',
    });
    expect(screen.getByText('Back Squat')).toBeTruthy();
    fireEvent.press(card);
    expect(onSelect).toHaveBeenCalledWith('squat-id');
  });
});
