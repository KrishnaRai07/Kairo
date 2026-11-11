import * as Haptics from 'expo-haptics';

export async function triggerLightTapHaptic(enabled: boolean = true): Promise<void> {
  if (!enabled) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore on platforms where haptics are unsupported
  }
}

export async function triggerSelectionHaptic(enabled: boolean = true): Promise<void> {
  if (!enabled) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Ignore
  }
}

export async function triggerSuccessHaptic(enabled: boolean = true): Promise<void> {
  if (!enabled) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore
  }
}

export async function triggerErrorHaptic(enabled: boolean = true): Promise<void> {
  if (!enabled) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Ignore
  }
}

