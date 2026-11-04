import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

/** The current time, refreshed on an interval so screens that show it re-render. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function tapFeedback(): void {
  if (Platform.OS === 'ios')
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function successFeedback(): void {
  if (Platform.OS === 'ios') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

type BrowserConfirm = { confirm?: (message: string) => boolean };

/** A two-button alert that resolves true when the lifter picks `confirmLabel`. */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  destructive = false,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    const browser = globalThis as BrowserConfirm;
    return Promise.resolve(browser.confirm ? browser.confirm(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
