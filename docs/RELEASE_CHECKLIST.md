# Kairo — Production Release Checklist

**Application:** Kairo  
**Package / Bundle ID:** `com.kairo.app`  
**Expo SDK:** 58 (`~58.0.23`)  
**React Native:** `0.88.1`

---

## Pre-Release Verification Checklist

### 1. Functional Integrity
- [x] **Task Scheduling & Validation:** Schedule tasks with exact time steppers or presets, rejecting empty titles or invalid intervals.
- [x] **Deterministic Lifecycle:** `upcoming` → `in_progress` → `missed`, plus `completed`, `completed_late`, `skipped`, and `rescheduled` with audit logs.
- [x] **Target Goals:** Long-term multi-day goal creation generating daily milestones and live progress cards.
- [x] **Calendar & Navigation:** 4-tab navigation (`Today`, `Schedule`, `Insights`, `Settings`) with interactive month picker modal.
- [x] **Hybrid Voice Coach:** Pre-start (`15m` before) and at-start spoken alerts via `expo-speech` with custom salutation and language selection.
- [x] **App Lock & Recovery:** 4-PIN, 6-PIN, or 8+ Alphanumeric password, optional Biometrics, background grace period, and 5-question recovery flow.
- [x] **Dual Theme & Settings:** Nordic Light and Obsidian Dark modes, 12h/24h time format, haptic feedback toggle, and local JSON export/restore.

### 2. Automated Verification Gates
- [x] `npx expo lint` — 0 errors, 0 warnings
- [x] `npx tsc --noEmit` — 0 TypeScript errors
- [x] `npm test` — 57 / 57 tests passing across 9 test suites (`tests/*.test.ts`)
- [x] `npx expo-doctor` — 20 / 20 checks passing

### 3. Build Manifest (`app.json` & `eas.json`)
- [x] **Android Package & iOS Bundle ID:** `com.kairo.app`
- [x] **Plugins:** `expo-sqlite`, `expo-notifications`, `expo-local-authentication`, `expo-secure-store`
- [x] **Android Permissions:** `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `POST_NOTIFICATIONS`

---

## EAS Build Commands

```bash
# Preview APK (internal distribution)
npx eas-cli build --platform android --profile preview

# Production AAB (Play Store)
npx eas-cli build --platform android --profile production
```
