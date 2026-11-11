# ⚡ Kairo

> **Master your daily flow. Without the guilt.**  
> Built with **React Native (0.88)**, **Expo (SDK 58)**, **TypeScript**, and **local SQLite (`expo-sqlite`)**.

Kairo (derived from the ancient Greek *Kairos* — "meaningful, opportune time") is a local-first, privacy-focused daily scheduling, target goal, and accountability application. Unlike traditional to-do lists that turn into guilt graveyards or rigid calendar blockers that break under real-world disruptions, Kairo combines **hard time-boundary accountability** with **psychological-safety coaching**, **spoken reminders**, and **inbuilt PIN/Password security**.

---

## 🌟 Key Features

### 1. 🎯 Long-Term Target Goals & Recurring Milestones
- **Break Big Targets into Daily Stepping Stones**: Set a goal (e.g. *"Master Advanced Python"* for 30 days) and Kairo generates daily milestone tasks (`[Day 1/30]`, `[Day 2/30]`) at your preferred focus time.
- **Live Progress & Streak Tracker**: Dedicated goal spotlight card tracking completed sessions, active milestone day, and completion percentage.
- **Milestone Task Badging**: Task cards highlight `🎯 Day X` badges linking focus blocks to long-term goals.

### 2. 🎙️ Hybrid Voice Coach Reminders (`expo-speech` + `expo-notifications`)
- **Pre-Start Spoken Alert (15 Mins Before)**: Speaks natural reminders automatically when active or notification is tapped (e.g. *"Sir, 15 minute baad aapka Deep Work schedule hai. Please make sure your availability."*).
- **At-Start Launch Voice Alert**: Announces task start times cleanly with customizable salutation (`Sir` or custom name) and language (`en-IN`, `hi-IN`, `en-US`).
- **3-Tier OS Notifications**: 15-min pre-start, at-start, and overdue check-in alerts with automatic cancellation and micro-task (< 15m) duplicate suppression.

### 3. 🔐 Inbuilt App Lock & 5-Question Security Recovery
- **3 Flexible Credentials**: Choose a **4-Digit PIN**, **6-Digit PIN**, or **8+ Character Alphanumeric Password**, stored as salted SHA-256 hashes in OS Keychain/Keystore (`expo-secure-store` + `expo-crypto`).
- **Optional Biometric Unlock**: Fast Fingerprint / Face ID unlock via `expo-local-authentication`.
- **Smart Background Grace Period**: Configurable `Immediate`, `1 Min Grace`, or `5 Min Grace` lock behavior with zero content flash on startup.
- **5-Question Account Recovery**: Verify 5 personal security questions to safely reset a forgotten PIN/password without losing local SQLite data.

### 4. 🌓 Dual Theme Engine & Airy Navigation
- **Obsidian Dark & Nordic Light**: High-contrast dark focus palette and warm paper daylight theme persisted locally.
- **4-Tab Workspace**:
  - **Today**: Active focus hero card, compact progress strip, context-aware coaching banner, and actionable timeline.
  - **Schedule**: Multi-day navigation with interactive **Calendar Date Picker** and 1-tap date shortcuts.
  - **Insights**: Two-tab analytics dashboard (*Daily & Resilience* and *Trends & Rhythm*) with 7-day/monthly charts and 28-day heatmap.
  - **Settings**: Voice coach customization, App Lock & recovery setup, 12h/24h toggle, haptic feedback toggle, storage telemetry, and offline JSON export/restore.

### 5. ⏱️ Deterministic & Idempotent Status Engine
Task status transitions are computed purely from scheduled boundaries:
- **`upcoming`** → **`in_progress`** → **`missed`**
- **`completed`** (on time) vs. **`completed_late`** (preserves original schedule intact)
- **`skipped`** (intentional conscious choice, separate from `missed`)
- **`rescheduled`** (logs old schedule in chronological audit history)
- **Idempotency**: Re-running reconciliation produces zero duplicate history events or alerts.

---

## 🏗️ Project Structure

```text
SeeYourSelf/
├── assets/                          # App icon, adaptive icons, SVG vector mark & favicon
├── docs/
│   ├── pitch-deck/                  # Investor pitch deck exports (PDF & PPTX)
│   ├── ARCHITECTURE.md              # System architecture & SQLite v3 schema spec
│   └── RELEASE_CHECKLIST.md         # Pre-release verification & EAS build guide
├── src/
│   ├── components/
│   │   ├── ActiveTaskHero.tsx       # Spotlight card for in-progress focus block
│   │   ├── CalendarPickerModal.tsx  # Month grid calendar picker & quick jumps
│   │   ├── CoachingBanner.tsx       # Contextual encouragement / recovery banner
│   │   ├── CreateGoalModal.tsx      # Long-term goal & daily milestone generator
│   │   ├── CreateTaskModal.tsx      # Task scheduler with quick presets & steppers
│   │   ├── DeleteConfirmModal.tsx   # Deliberate delete confirmation dialog
│   │   ├── EditTaskModal.tsx        # Task editing & live schedule recalculation
│   │   ├── GoalProgressCard.tsx     # Goal streak & completion card
│   │   ├── HeaderProgress.tsx       # Compact header summary strip
│   │   ├── HistoryModal.tsx         # Chronological task accountability log
│   │   ├── InsightsView.tsx         # 2-tab analytics & activity heatmap
│   │   ├── LockScreen.tsx           # Zero-flash PIN/Password + Biometric lock screen
│   │   ├── RescheduleModal.tsx      # Quick time-shift & reschedule modal
│   │   ├── SecuritySetupModal.tsx   # 2-step PIN/Password + 5-question setup wizard
│   │   ├── SettingsView.tsx         # Themes, voice, lock, schedule & JSON backup
│   │   └── TaskCard.tsx             # Task card with non-wrapping primary actions
│   ├── database/
│   │   ├── db.ts                    # SQLite connection, WAL mode, v1-v3 migrations
│   │   └── taskRepository.ts        # Atomic transactions, CRUD, goals & settings
│   ├── hooks/
│   │   └── useTasks.ts              # Task/goal orchestration & AppState sync
│   ├── services/
│   │   ├── analyticsService.ts      # Daily, weekly, monthly & heatmap aggregators
│   │   ├── hapticsService.ts        # Expo Haptics wrappers
│   │   ├── notificationPlanner.ts   # Pure 3-tier reminder schedule planner
│   │   ├── notificationService.ts   # Expo Notifications scheduling & cancellation
│   │   ├── securityLogic.ts         # Credential rules, SHA-256 hashing & recovery
│   │   ├── securityService.ts       # SecureStore & LocalAuthentication integration
│   │   ├── statusEngine.ts          # Deterministic task state machine
│   │   ├── voicePlanner.ts          # Pure voice script builder & duplicate filter
│   │   └── voiceService.ts          # Expo Speech TTS playback & salutation
│   ├── theme/
│   │   ├── ThemeContext.tsx         # Light / Dark theme provider & hook
│   │   └── theme.ts                 # Design tokens, colors, typography & spacing
│   ├── types/
│   │   └── task.ts                  # Shared domain types, settings & security models
│   └── utils/
│       └── dateUtils.ts             # Date formatting, day/week/month boundaries
├── tests/                           # 57 automated tests across 9 test files
├── App.tsx                          # Root navigation, lock gate & voice coordinator
├── app.json                         # Expo manifest, permissions & native plugins
├── eas.json                         # EAS Build profiles (development/preview/production)
├── eslint.config.js                 # ESLint v9 flat config (eslint-config-expo)
├── package.json                     # Expo SDK 58 / React Native 0.88 dependencies
└── tsconfig.json                    # TypeScript strict configuration
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm
- Expo Go or an Android Development/Preview Build (recommended for full native features such as Biometrics, SecureStore & Notifications)

### Installation & Running
```bash
git clone https://github.com/KrishnaRai07/Kairo.git
cd Kairo
npm install
npx expo start
```

---

## 🧪 Automated Testing & Verification

```bash
# Run ESLint check
npx expo lint

# Run TypeScript typecheck
npx tsc --noEmit

# Run all 57 unit tests across 9 suites
npm test

# Diagnose Expo SDK 58 compatibility
npx expo-doctor
```

---

## 📦 Android EAS Builds

Kairo uses package ID `com.kairo.app` configured in [app.json](app.json) and [eas.json](eas.json):

```bash
# Standalone preview APK
npx eas-cli build --platform android --profile preview

# Production Google Play AAB
npx eas-cli build --platform android --profile production
```

---

## 📜 License
MIT License. See [LICENSE](LICENSE).
