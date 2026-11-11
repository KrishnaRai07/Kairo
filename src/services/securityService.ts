import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { LockType, SecurityAnswerInput } from '../types/task';
import { getDatabase } from '../database/db';
import {
  LockConfigPayload,
  buildLockConfigPayload,
  verifyCredentialAgainstPayload,
  verifyRecoveryAnswersAgainstPayload,
  validateCredential,
} from './securityLogic';

export * from './securityLogic';

const LOCK_CONFIG_KEY = 'kairo_lock_config_v1';

async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

function generateSaltHex(): string {
  const bytes = Crypto.getRandomBytes(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function writeRawConfig(jsonString: string): Promise<void> {
  const secureAvailable = await SecureStore.isAvailableAsync();
  if (secureAvailable) {
    await SecureStore.setItemAsync(LOCK_CONFIG_KEY, jsonString);
    return;
  }

  // Fallback for environments like web preview where SecureStore is unavailable
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO user_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [LOCK_CONFIG_KEY, jsonString]
  );
}

async function readRawConfig(): Promise<string | null> {
  const secureAvailable = await SecureStore.isAvailableAsync();
  if (secureAvailable) {
    return SecureStore.getItemAsync(LOCK_CONFIG_KEY);
  }

  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM user_settings WHERE key = ?`,
    [LOCK_CONFIG_KEY]
  );
  return row?.value ?? null;
}

async function deleteRawConfig(): Promise<void> {
  const secureAvailable = await SecureStore.isAvailableAsync();
  if (secureAvailable) {
    await SecureStore.deleteItemAsync(LOCK_CONFIG_KEY);
    return;
  }

  const db = await getDatabase();
  await db.runAsync(`DELETE FROM user_settings WHERE key = ?`, [LOCK_CONFIG_KEY]);
}

async function getStoredLockConfig(): Promise<LockConfigPayload | null> {
  try {
    const raw = await readRawConfig();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LockConfigPayload;
    if (!parsed.lockType || !parsed.salt || !parsed.credentialHash || !parsed.answersHashMap) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getLockStatus(): Promise<{
  isConfigured: boolean;
  lockType?: LockType;
}> {
  const payload = await getStoredLockConfig();
  if (!payload) {
    return { isConfigured: false };
  }
  return { isConfigured: true, lockType: payload.lockType };
}

export async function saveAppLockSetup(
  lockType: LockType,
  credential: string,
  answers: SecurityAnswerInput[]
): Promise<void> {
  const salt = generateSaltHex();
  const payload = await buildLockConfigPayload(
    lockType,
    credential,
    answers,
    salt,
    sha256Hex
  );
  await writeRawConfig(JSON.stringify(payload));
}

export async function verifyAppCredential(inputCredential: string): Promise<boolean> {
  const payload = await getStoredLockConfig();
  if (!payload) return false;
  return verifyCredentialAgainstPayload(inputCredential, payload, sha256Hex);
}

export async function verifyRecoveryAnswers(
  answers: SecurityAnswerInput[]
): Promise<{ verified: boolean; matchedCount: number }> {
  const payload = await getStoredLockConfig();
  if (!payload) return { verified: false, matchedCount: 0 };
  return verifyRecoveryAnswersAgainstPayload(answers, payload, sha256Hex);
}

export async function resetCredentialAfterRecovery(
  newLockType: LockType,
  newCredential: string
): Promise<void> {
  const existing = await getStoredLockConfig();
  if (!existing) {
    throw new Error('No existing security configuration found.');
  }

  const validation = validateCredential(newLockType, newCredential);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid PIN or password.');
  }

  const newCredentialHash = await sha256Hex(`${existing.salt}:cred:${newCredential.trim()}`);
  const updated: LockConfigPayload = {
    ...existing,
    lockType: newLockType,
    credentialHash: newCredentialHash,
  };

  await writeRawConfig(JSON.stringify(updated));
}

export async function clearAppLock(): Promise<void> {
  await deleteRawConfig();
}

export async function checkBiometricSupport(): Promise<{
  available: boolean;
  label: string;
}> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      return { available: false, label: 'Biometrics' };
    }

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const hasFinger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

    let label = 'Biometrics';
    if (hasFinger && hasFace) label = 'Fingerprint / Face Unlock';
    else if (hasFinger) label = 'Fingerprint';
    else if (hasFace) label = 'Face Unlock';

    return { available: true, label };
  } catch {
    return { available: false, label: 'Biometrics' };
  }
}

export async function authenticateWithBiometrics(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Kairo',
      cancelLabel: 'Use PIN / Password',
      disableDeviceFallback: true,
    });
    if (result.success) {
      return { success: true };
    }
    return { success: false, error: result.error };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Biometric authentication failed' };
  }
}

