import { useIsFocused } from 'expo-router';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { EmptyState, LoadingIndicator } from '@/components/feedback';
import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme';

type ExerciseVideoProps = { url: string | null; name: string };

export function ExerciseVideo({ url, name }: ExerciseVideoProps) {
  const isFocused = useIsFocused();
  const [attempt, setAttempt] = useState(0);
  if (!url) {
    return <EmptyState title="Tutorial coming soon" description="Follow the written instructions and form tips below." />;
  }
  if (!/^https?:\/\//i.test(url)) {
    return <EmptyState title="Video unavailable" description="The tutorial source could not be opened. Use the written guide below." />;
  }
  // Releasing the focused child disposes its native player on navigation blur,
  // including when a stack keeps the detail route mounted behind another route.
  if (!isFocused) return <View style={styles.video} />;
  return <FocusedVideo key={`${url}:${attempt}`} url={url} name={name} onRetry={() => setAttempt((value) => value + 1)} />;
}

function FocusedVideo({ url, name, onRetry }: { url: string; name: string; onRetry: () => void }) {
  const theme = useAppTheme();
  // useVideoPlayer owns automatic native-player cleanup. Never autoplay.
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.pause();
    });
    return () => subscription.remove();
  }, [player]);

  if (status === 'error') {
    return <EmptyState title="Video could not be loaded" description="Check your connection or try the tutorial again." actionLabel="Retry video" onAction={onRetry} />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.frame, { backgroundColor: theme.colors.media }]}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          fullscreenOptions={{ enable: true }}
          contentFit="contain"
          accessibilityLabel={`${name} form tutorial video`}
        />
        {status === 'loading' || status === 'idle' ? (
          <View pointerEvents="none" style={[styles.loading, { backgroundColor: theme.colors.surface }]}><LoadingIndicator label="Loading tutorial" /></View>
        ) : null}
      </View>
      <Button
        label={isPlaying ? 'Pause tutorial' : 'Play tutorial'}
        disabled={status !== 'readyToPlay'}
        variant="secondary"
        onPress={() => isPlaying ? player.pause() : player.play()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  frame: { borderRadius: 12, overflow: 'hidden' },
  video: { width: '100%', aspectRatio: 16 / 9 },
  loading: { ...StyleSheet.absoluteFill, justifyContent: 'center' },
});
