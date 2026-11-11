import * as Speech from 'expo-speech';
import { UserSettings } from '../types/task';
import { buildVoiceScript, VoiceTriggerType } from './voicePlanner';

export * from './voicePlanner';

/**
 * Speaks a given script using device Text-to-Speech.
 * Automatically stops previous overlapping speech before speaking.
 */
export async function speakAlertScript(
  script: string,
  language: string = 'en-IN'
): Promise<void> {
  try {
    const speaking = await Speech.isSpeakingAsync();
    if (speaking) {
      await Speech.stop();
    }

    Speech.speak(script, {
      language,
      pitch: 1.0,
      rate: 0.94,
    });
  } catch (error) {
    console.warn('Voice alert failed to speak:', error);
  }
}

/**
 * Speaks a formatted task reminder ("15min_before" or "at_start") if voice alerts are enabled.
 */
export async function speakTaskReminder(
  taskTitle: string,
  triggerType: VoiceTriggerType,
  settings?: UserSettings
): Promise<void> {
  if (settings && settings.enableVoiceAlerts === false) {
    return;
  }

  const salutation = settings?.voiceSalutation || 'Sir';
  const language = settings?.voiceLanguage || 'en-IN';
  const script = buildVoiceScript(taskTitle, triggerType, salutation);
  await speakAlertScript(script, language);
}

/**
 * Plays a sample voice alert from Settings so the user can preview their salutation and language.
 */
export async function testVoiceAssistant(settings?: UserSettings): Promise<void> {
  const salutation = settings?.voiceSalutation?.trim() || 'Sir';
  const language = settings?.voiceLanguage || 'en-IN';
  const script = buildVoiceScript('Deep Focus Session', '15min_before', salutation);
  await speakAlertScript(script, language);
}

/**
 * Stops any ongoing spoken audio immediately.
 */
export async function stopVoiceAssistant(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // Ignore stop errors if speech engine wasn't active
  }
}

