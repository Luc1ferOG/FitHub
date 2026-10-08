import { Stack, useRouter } from 'expo-router';
import { Screen } from '@/components/layout/screen';
import { getErrorMessage } from '@/utils/errors';
import { useCreateChallenge } from '../hooks/use-challenges';
import { ChallengeForm } from '../components/challenge-form';
export function CreateFitnessChallengeScreen() {
  const mutation = useCreateChallenge(); const router = useRouter();
  return <Screen scroll><Stack.Screen options={{ title:'Create challenge' }} /><ChallengeForm busy={mutation.isPending} error={mutation.error ? getErrorMessage(mutation.error):null} onSave={async (input) => {
    try { const id = await mutation.mutateAsync(input); router.replace({ pathname:'/challenges/[challengeId]',params:{ challengeId:id } }); } catch { /* Keep entered values and render actionable errors. */ }
  }} /></Screen>;
}
