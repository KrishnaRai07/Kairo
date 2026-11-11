import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LockType, SecurityAnswerInput } from '../types/task';
import {
  SECURITY_QUESTIONS,
  verifyAppCredential,
  verifyRecoveryAnswers,
  resetCredentialAfterRecovery,
  checkBiometricSupport,
  authenticateWithBiometrics,
  validateCredential,
} from '../services/securityService';
import {
  triggerLightTapHaptic,
  triggerSuccessHaptic,
  triggerErrorHaptic,
} from '../services/hapticsService';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';

interface Props {
  lockType: LockType;
  enableBiometrics?: boolean;
  enableHaptics?: boolean;
  onUnlock: () => void;
}

export const LockScreen: React.FC<Props> = ({
  lockType,
  enableBiometrics = true,
  enableHaptics = true,
  onUnlock,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  // View state: 'credential' | 'recovery' | 'reset'
  const [viewState, setViewState] = useState<'credential' | 'recovery' | 'reset'>('credential');

  // Credential input state
  const [pinDigits, setPinDigits] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);

  // Biometrics
  const [bioAvailable, setBioAvailable] = useState<boolean>(false);
  const [bioLabel, setBioLabel] = useState<string>('Biometrics');

  // Recovery Questions state
  const [recoveryAnswers, setRecoveryAnswers] = useState<Record<string, string>>({
    first_school: '',
    best_friend: '',
    mothers_name: '',
    favorite_place: '',
    favorite_person: '',
  });

  // Reset state after recovery
  const [newLockType, setNewLockType] = useState<LockType>(lockType);
  const [newCredential, setNewCredential] = useState<string>('');
  const [confirmNewCredential, setConfirmNewCredential] = useState<string>('');

  const pinTargetLength = lockType === 'pin6' ? 6 : 4;

  // Initialize biometric support & auto-prompt on mount
  useEffect(() => {
    let mounted = true;
    async function initBio() {
      if (!enableBiometrics) return;
      const bio = await checkBiometricSupport();
      if (mounted && bio.available) {
        setBioAvailable(true);
        setBioLabel(bio.label);
        // Subtle prompt on cold mount
        setTimeout(async () => {
          if (!mounted) return;
          const auth = await authenticateWithBiometrics();
          if (auth.success) {
            triggerSuccessHaptic(enableHaptics);
            onUnlock();
          }
        }, 350);
      }
    }
    initBio();
    return () => {
      mounted = false;
    };
  }, [enableBiometrics, enableHaptics, onUnlock]);

  // Handle PIN entry
  const handlePressKeypad = async (digit: string) => {
    if (verifying || pinDigits.length >= pinTargetLength) return;
    triggerLightTapHaptic(enableHaptics);
    setErrorMessage(null);

    const nextDigits = pinDigits + digit;
    setPinDigits(nextDigits);

    if (nextDigits.length === pinTargetLength) {
      await attemptUnlock(nextDigits);
    }
  };

  const handleBackspace = () => {
    if (verifying || pinDigits.length === 0) return;
    triggerLightTapHaptic(enableHaptics);
    setErrorMessage(null);
    setPinDigits((prev) => prev.slice(0, -1));
  };

  const attemptUnlock = async (candidate: string) => {
    try {
      setVerifying(true);
      const isMatch = await verifyAppCredential(candidate);
      if (isMatch) {
        triggerSuccessHaptic(enableHaptics);
        onUnlock();
      } else {
        triggerErrorHaptic(enableHaptics);
        setErrorMessage('Incorrect PIN. Please try again.');
        setPinDigits('');
      }
    } catch {
      setErrorMessage('Verification failed.');
      setPinDigits('');
    } finally {
      setVerifying(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim() || verifying) return;
    await attemptUnlock(passwordInput.trim());
  };

  const handleManualBiometric = async () => {
    triggerLightTapHaptic(enableHaptics);
    const auth = await authenticateWithBiometrics();
    if (auth.success) {
      triggerSuccessHaptic(enableHaptics);
      onUnlock();
    } else if (auth.error) {
      setErrorMessage(auth.error);
    }
  };

  // Recovery Questions Verification
  const handleVerifyRecovery = async () => {
    setErrorMessage(null);
    const formatted: SecurityAnswerInput[] = SECURITY_QUESTIONS.map((q) => ({
      questionId: q.id,
      answer: recoveryAnswers[q.id] || '',
    }));

    const incomplete = formatted.some((a) => !a.answer.trim());
    if (incomplete) {
      setErrorMessage('Please answer all 5 recovery questions.');
      triggerErrorHaptic(enableHaptics);
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyRecoveryAnswers(formatted);
      if (result.verified) {
        triggerSuccessHaptic(enableHaptics);
        setErrorMessage(null);
        setViewState('reset');
      } else {
        triggerErrorHaptic(enableHaptics);
        setErrorMessage(
          `Answers do not match. (${result.matchedCount}/5 matched). Answers are case-insensitive.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  // Reset Credential after Recovery
  const handleExecuteReset = async () => {
    setErrorMessage(null);
    const val = validateCredential(newLockType, newCredential);
    if (!val.valid) {
      setErrorMessage(val.error || 'Invalid credentials');
      triggerErrorHaptic(enableHaptics);
      return;
    }

    if (newCredential !== confirmNewCredential) {
      setErrorMessage('Credentials do not match.');
      triggerErrorHaptic(enableHaptics);
      return;
    }

    setVerifying(true);
    try {
      await resetCredentialAfterRecovery(newLockType, newCredential);
      triggerSuccessHaptic(enableHaptics);
      onUnlock();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update credentials.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.fullscreenOverlay}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Brand */}
          <View style={styles.brandRow}>
            <Text style={styles.brandTitle}>Kairo</Text>
            <View style={styles.brandDot} />
          </View>
          <Text style={styles.brandSubtitle}>
            {viewState === 'credential'
              ? 'Protected with App Lock'
              : viewState === 'recovery'
              ? 'Security Question Recovery'
              : 'Set New PIN or Password'}
          </Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          )}

          {/* VIEW 1: NORMAL UNLOCK */}
          {viewState === 'credential' && (
            <>
              {lockType === 'password' ? (
                /* Password Input View */
                <View style={styles.passwordSection}>
                  <Text style={styles.passwordLabel}>Enter Your Master Password</Text>
                  <View style={styles.passwordInputWrapper}>
                    <TextInput
                      style={styles.passwordInput}
                      secureTextEntry={!showPassword}
                      placeholder="Enter password..."
                      placeholderTextColor={theme.colors.textMuted}
                      value={passwordInput}
                      onChangeText={setPasswordInput}
                      onSubmitEditing={handlePasswordSubmit}
                      autoCapitalize="none"
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.eyeBtnText}>{showPassword ? '👁️' : '🔒'}</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.unlockActionBtn}
                    onPress={handlePasswordSubmit}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.unlockActionBtnText}>Unlock</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                /* PIN Dots View & Numeric Keypad */
                <View style={styles.pinSection}>
                  <View style={styles.pinDotsRow}>
                    {Array.from({ length: pinTargetLength }).map((_, idx) => {
                      const isFilled = idx < pinDigits.length;
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.pinDot,
                            isFilled && styles.pinDotFilled,
                          ]}
                        />
                      );
                    })}
                  </View>

                  {/* 3x4 Touch Keypad */}
                  <View style={styles.keypadGrid}>
                    {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
                      <View key={rIdx} style={styles.keypadRow}>
                        {row.map((digit) => (
                          <TouchableOpacity
                            key={digit}
                            style={styles.keypadKey}
                            onPress={() => handlePressKeypad(digit)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.keypadDigit}>{digit}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}

                    {/* Bottom Row: Biometrics (or blank), 0, Backspace */}
                    <View style={styles.keypadRow}>
                      <TouchableOpacity
                        style={styles.keypadKey}
                        onPress={handleManualBiometric}
                        disabled={!bioAvailable}
                        activeOpacity={0.7}
                      >
                        {bioAvailable && <Text style={styles.keypadUtilityText}>🛡️</Text>}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.keypadKey}
                        onPress={() => handlePressKeypad('0')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.keypadDigit}>0</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.keypadKey}
                        onPress={handleBackspace}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.keypadUtilityText}>⌫</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Biometrics Action Pill */}
              {bioAvailable && (
                <TouchableOpacity
                  style={styles.bioActionPill}
                  onPress={handleManualBiometric}
                  activeOpacity={0.8}
                >
                  <Text style={styles.bioActionPillText}>
                    🔓 Unlock with {bioLabel}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Forgot PIN / Password Link */}
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => {
                  setErrorMessage(null);
                  setViewState('recovery');
                }}
              >
                <Text style={styles.forgotBtnText}>Forgot PIN or Password?</Text>
              </TouchableOpacity>
            </>
          )}

          {/* VIEW 2: RECOVERY QUESTIONS */}
          {viewState === 'recovery' && (
            <View style={styles.recoveryContainer}>
              <Text style={styles.recoveryNotice}>
                Answer your 5 security questions to verify identity and reset your PIN/Password:
              </Text>

              {SECURITY_QUESTIONS.map((q, qIndex) => (
                <View key={q.id} style={styles.recoveryQuestionBlock}>
                  <Text style={styles.recoveryQuestionTitle}>
                    {qIndex + 1}. {q.question}
                  </Text>
                  <TextInput
                    style={styles.recoveryInput}
                    placeholder={q.placeholder}
                    placeholderTextColor={theme.colors.textMuted}
                    value={recoveryAnswers[q.id]}
                    onChangeText={(val) =>
                      setRecoveryAnswers((prev) => ({ ...prev, [q.id]: val }))
                    }
                    autoCapitalize="none"
                  />
                </View>
              ))}

              <View style={styles.recoveryActionRow}>
                <TouchableOpacity
                  style={styles.recoveryCancelBtn}
                  onPress={() => {
                    setErrorMessage(null);
                    setViewState('credential');
                  }}
                >
                  <Text style={styles.recoveryCancelText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.recoveryConfirmBtn}
                  onPress={handleVerifyRecovery}
                  disabled={verifying}
                >
                  {verifying ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.recoveryConfirmText}>Verify 5 Answers</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* VIEW 3: RESET CREDENTIAL AFTER RECOVERY */}
          {viewState === 'reset' && (
            <View style={styles.resetContainer}>
              <Text style={styles.resetSuccessNote}>
                ✓ Identity verified successfully! Choose your new PIN or password:
              </Text>

              {/* Lock Type Selector */}
              <View style={styles.typeSelectorRow}>
                {(['pin4', 'pin6', 'password'] as LockType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeSelectorBtn,
                      newLockType === t && styles.typeSelectorBtnActive,
                    ]}
                    onPress={() => {
                      setNewLockType(t);
                      setNewCredential('');
                      setConfirmNewCredential('');
                      setErrorMessage(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.typeSelectorText,
                        newLockType === t && styles.typeSelectorTextActive,
                      ]}
                    >
                      {t === 'pin4' ? '4-PIN' : t === 'pin6' ? '6-PIN' : 'Password'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputPromptLabel}>
                {newLockType === 'pin4'
                  ? 'New 4-Digit PIN'
                  : newLockType === 'pin6'
                  ? 'New 6-Digit PIN'
                  : 'New Password (8+ alphanumeric)'}
              </Text>
              <TextInput
                style={styles.recoveryInput}
                secureTextEntry
                keyboardType={newLockType === 'password' ? 'default' : 'number-pad'}
                maxLength={newLockType === 'pin4' ? 4 : newLockType === 'pin6' ? 6 : 32}
                placeholder="Enter new credential..."
                placeholderTextColor={theme.colors.textMuted}
                value={newCredential}
                onChangeText={setNewCredential}
              />

              <Text style={styles.inputPromptLabel}>Confirm New Credential</Text>
              <TextInput
                style={styles.recoveryInput}
                secureTextEntry
                keyboardType={newLockType === 'password' ? 'default' : 'number-pad'}
                maxLength={newLockType === 'pin4' ? 4 : newLockType === 'pin6' ? 6 : 32}
                placeholder="Confirm new credential..."
                placeholderTextColor={theme.colors.textMuted}
                value={confirmNewCredential}
                onChangeText={setConfirmNewCredential}
              />

              <TouchableOpacity
                style={styles.unlockActionBtn}
                onPress={handleExecuteReset}
                disabled={verifying}
              >
                {verifying ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.unlockActionBtnText}>Save & Unlock Kairo</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    fullscreenOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.background,
      zIndex: 9999,
      elevation: 9999,
    },
    keyboardContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 40,
      alignItems: 'center',
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    brandTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.5,
    },
    brandDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#38BDF8',
      marginTop: 4,
    },
    brandSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 4,
      marginBottom: theme.spacing.lg,
    },
    errorBox: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
      borderRadius: theme.radius.md,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: theme.spacing.md,
      maxWidth: 320,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    pinSection: {
      alignItems: 'center',
      width: '100%',
      maxWidth: 320,
    },
    pinDotsRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 32,
      marginTop: 8,
    },
    pinDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : theme.colors.borderMedium,
      backgroundColor: 'transparent',
    },
    pinDotFilled: {
      backgroundColor: '#38BDF8',
      borderColor: '#38BDF8',
      shadowColor: '#38BDF8',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 8,
      elevation: 4,
    },
    keypadGrid: {
      width: '100%',
      gap: 16,
      marginBottom: 20,
    },
    keypadRow: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
    },
    keypadKey: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.borderSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keypadDigit: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    keypadUtilityText: {
      fontSize: 20,
      color: theme.colors.textSecondary,
    },
    passwordSection: {
      width: '100%',
      maxWidth: 320,
      marginTop: 10,
    },
    passwordLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    passwordInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      marginBottom: 16,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 14,
      fontSize: 15,
      color: theme.colors.textPrimary,
    },
    eyeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    eyeBtnText: {
      fontSize: 16,
    },
    unlockActionBtn: {
      backgroundColor: '#38BDF8',
      borderRadius: theme.radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      shadowColor: '#38BDF8',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
      width: '100%',
    },
    unlockActionBtnText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    bioActionPill: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.08)',
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.3)',
      marginTop: 10,
    },
    bioActionPillText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#38BDF8',
    },
    forgotBtn: {
      marginTop: 24,
      paddingVertical: 8,
    },
    forgotBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
      textDecorationLine: 'underline',
    },
    recoveryContainer: {
      width: '100%',
      maxWidth: 340,
    },
    recoveryNotice: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 18,
      marginBottom: 16,
      textAlign: 'center',
    },
    recoveryQuestionBlock: {
      marginBottom: 12,
    },
    recoveryQuestionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    recoveryInput: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 13,
      color: theme.colors.textPrimary,
    },
    recoveryActionRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    recoveryCancelBtn: {
      flex: 1,
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    recoveryCancelText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    recoveryConfirmBtn: {
      flex: 2,
      backgroundColor: '#38BDF8',
      borderRadius: theme.radius.md,
      paddingVertical: 12,
      alignItems: 'center',
    },
    recoveryConfirmText: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    resetContainer: {
      width: '100%',
      maxWidth: 340,
    },
    resetSuccessNote: {
      fontSize: 13,
      fontWeight: '600',
      color: '#10B981',
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 18,
    },
    typeSelectorRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    typeSelectorBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
    },
    typeSelectorBtnActive: {
      borderColor: '#38BDF8',
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.1)',
    },
    typeSelectorText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    typeSelectorTextActive: {
      color: '#38BDF8',
      fontWeight: 'bold',
    },
    inputPromptLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginBottom: 4,
      marginTop: 8,
    },
  });
