import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
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
  validateCredential,
  validateSecurityAnswers,
  saveAppLockSetup,
} from '../services/securityService';
import { triggerSuccessHaptic, triggerErrorHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/ThemeContext';
import { Theme } from '../theme/theme';

interface Props {
  visible: boolean;
  enableHaptics?: boolean;
  onClose: () => void;
  onSuccess: (lockType: LockType) => void;
}

export const SecuritySetupModal: React.FC<Props> = ({
  visible,
  enableHaptics = true,
  onClose,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [step, setStep] = useState<'credential' | 'questions'>('credential');
  const [lockType, setLockType] = useState<LockType>('pin4');
  const [credential, setCredential] = useState<string>('');
  const [confirmCredential, setConfirmCredential] = useState<string>('');
  const [showText, setShowText] = useState<boolean>(false);

  const [answers, setAnswers] = useState<Record<string, string>>({
    first_school: '',
    best_friend: '',
    mothers_name: '',
    favorite_place: '',
    favorite_person: '',
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const resetWizard = () => {
    setStep('credential');
    setLockType('pin4');
    setCredential('');
    setConfirmCredential('');
    setAnswers({
      first_school: '',
      best_friend: '',
      mothers_name: '',
      favorite_place: '',
      favorite_person: '',
    });
    setErrorMsg(null);
    setSaving(false);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const handleProceedToQuestions = () => {
    setErrorMsg(null);
    const val = validateCredential(lockType, credential);
    if (!val.valid) {
      setErrorMsg(val.error || 'Invalid PIN or Password');
      triggerErrorHaptic(enableHaptics);
      return;
    }

    if (credential !== confirmCredential) {
      setErrorMsg('Confirmation does not match. Please verify.');
      triggerErrorHaptic(enableHaptics);
      return;
    }

    setStep('questions');
  };

  const handleSaveSetup = async () => {
    setErrorMsg(null);
    const formattedAnswers: SecurityAnswerInput[] = SECURITY_QUESTIONS.map((q) => ({
      questionId: q.id,
      answer: answers[q.id] || '',
    }));

    const ansVal = validateSecurityAnswers(formattedAnswers);
    if (!ansVal.valid) {
      setErrorMsg(ansVal.error || 'Please answer all 5 questions.');
      triggerErrorHaptic(enableHaptics);
      return;
    }

    setSaving(true);
    try {
      await saveAppLockSetup(lockType, credential, formattedAnswers);
      triggerSuccessHaptic(enableHaptics);
      const chosenType = lockType;
      resetWizard();
      onSuccess(chosenType);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save App Lock.');
      triggerErrorHaptic(enableHaptics);
    } finally {
      setSaving(false);
    }
  };

  const answeredCount = SECURITY_QUESTIONS.filter(
    (q) => (answers[q.id] || '').trim().length >= 2
  ).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {step === 'credential' ? '🔐 Setup App Lock' : '🛡️ 5 Recovery Questions'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 'credential'
                  ? 'Step 1 of 2 • Choose PIN or alphanumeric password'
                  : `Step 2 of 2 • ${answeredCount}/5 answered for safe recovery`}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {step === 'credential' ? (
              <View style={styles.stepBody}>
                <Text style={styles.fieldLabel}>Select Lock Method</Text>
                <View style={styles.methodRow}>
                  {([
                    { id: 'pin4', label: '4-Digit PIN' },
                    { id: 'pin6', label: '6-Digit PIN' },
                    { id: 'password', label: '8+ Password' },
                  ] as const).map((opt) => {
                    const active = lockType === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.methodBtn, active && styles.methodBtnActive]}
                        onPress={() => {
                          setLockType(opt.id);
                          setCredential('');
                          setConfirmCredential('');
                          setErrorMsg(null);
                        }}
                      >
                        <Text style={[styles.methodBtnText, active && styles.methodBtnTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.hintText}>
                  {lockType === 'pin4'
                    ? 'Enter any 4 numeric digits (0–9).'
                    : lockType === 'pin6'
                    ? 'Enter any 6 numeric digits (0–9) for stronger privacy.'
                    : 'Minimum 8 characters containing at least 1 letter and 1 number.'}
                </Text>

                <Text style={styles.fieldLabel}>
                  {lockType === 'password' ? 'Enter Password' : 'Enter PIN'}
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    secureTextEntry={!showText}
                    keyboardType={lockType === 'password' ? 'default' : 'number-pad'}
                    maxLength={lockType === 'pin4' ? 4 : lockType === 'pin6' ? 6 : 32}
                    placeholder={
                      lockType === 'pin4'
                        ? '••••'
                        : lockType === 'pin6'
                        ? '••••••'
                        : 'e.g., Kairo2026'
                    }
                    placeholderTextColor={theme.colors.textMuted}
                    value={credential}
                    onChangeText={setCredential}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowText(!showText)}
                  >
                    <Text style={styles.eyeIcon}>{showText ? '👁️' : '🔒'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>
                  Confirm {lockType === 'password' ? 'Password' : 'PIN'}
                </Text>
                <TextInput
                  style={styles.standaloneInput}
                  secureTextEntry={!showText}
                  keyboardType={lockType === 'password' ? 'default' : 'number-pad'}
                  maxLength={lockType === 'pin4' ? 4 : lockType === 'pin6' ? 6 : 32}
                  placeholder="Re-enter to verify"
                  placeholderTextColor={theme.colors.textMuted}
                  value={confirmCredential}
                  onChangeText={setConfirmCredential}
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleProceedToQuestions}
                >
                  <Text style={styles.primaryBtnText}>Next: Set Recovery Questions →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.stepBody}>
                <View style={styles.infoBanner}>
                  <Text style={styles.infoBannerText}>
                    If you ever forget your PIN/Password, answering these 5 questions restores full access safely. Matching is case-insensitive.
                  </Text>
                </View>

                {SECURITY_QUESTIONS.map((q, index) => (
                  <View key={q.id} style={styles.questionCard}>
                    <Text style={styles.questionText}>
                      {index + 1}. {q.question}
                    </Text>
                    <TextInput
                      style={styles.questionInput}
                      placeholder={q.placeholder}
                      placeholderTextColor={theme.colors.textMuted}
                      value={answers[q.id]}
                      onChangeText={(txt) =>
                        setAnswers((prev) => ({ ...prev, [q.id]: txt }))
                      }
                      autoCapitalize="none"
                    />
                  </View>
                ))}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => {
                      setErrorMsg(null);
                      setStep('credential');
                    }}
                  >
                    <Text style={styles.backBtnText}>← Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveSetup}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>✓ Activate App Lock</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.78)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      padding: theme.spacing.lg,
      maxHeight: '90%',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : theme.colors.borderSubtle,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.md,
    },
    title: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.heavy,
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      fontSize: 18,
      color: theme.colors.textMuted,
      padding: 4,
    },
    errorBox: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
      borderRadius: theme.radius.md,
      padding: 10,
      marginBottom: theme.spacing.md,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 12,
      fontWeight: '600',
    },
    stepBody: {
      paddingBottom: 24,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginBottom: 6,
      marginTop: 10,
    },
    methodRow: {
      flexDirection: 'row',
      gap: 8,
    },
    methodBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      alignItems: 'center',
    },
    methodBtnActive: {
      borderColor: theme.colors.primary,
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.08)',
    },
    methodBtnText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    methodBtnTextActive: {
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
    hintText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 6,
      marginBottom: 4,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    input: {
      flex: 1,
      paddingVertical: 11,
      paddingHorizontal: 14,
      fontSize: 15,
      color: theme.colors.textPrimary,
    },
    eyeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    eyeIcon: {
      fontSize: 16,
    },
    standaloneInput: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      paddingVertical: 11,
      paddingHorizontal: 14,
      fontSize: 15,
      color: theme.colors.textPrimary,
      marginBottom: 16,
    },
    primaryBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 6,
    },
    primaryBtnText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    infoBanner: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.1)' : '#F0F9FF',
      borderRadius: theme.radius.md,
      padding: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : '#BAE6FD',
    },
    infoBannerText: {
      fontSize: 11,
      color: isDark ? '#BAE6FD' : '#0369A1',
      lineHeight: 16,
    },
    questionCard: {
      marginBottom: 12,
    },
    questionText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    questionInput: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      paddingVertical: 9,
      paddingHorizontal: 12,
      fontSize: 13,
      color: theme.colors.textPrimary,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    backBtn: {
      flex: 1,
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radius.md,
      paddingVertical: 13,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    backBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    saveBtn: {
      flex: 2,
      backgroundColor: '#10B981',
      borderRadius: theme.radius.md,
      paddingVertical: 13,
      alignItems: 'center',
    },
    saveBtnText: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
  });

