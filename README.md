# SCANKOTO — Offline-First PWA for Automated Event Attendance Tracking

## 1. Overview
SCANKOTO is an offline-first Progressive Web Application (PWA) designed to solve manual encoding bottlenecks, long check-in queues, and unreliable campus Wi-Fi/cellular connectivity during large student events at Caraga State University (CSU). Built for CSU student organization officers (such as CSU-ISS and LCO executives) and student attendees, the system enables sub-second optical QR code scanning of Student ID badges (`CSU-XXXXXX`), enforces a 5-minute anti-passback throttle, queues attendance records locally in IndexedDB while offline, and automatically synchronizes and reconciles multi-device timestamps with a cloud relational database upon reconnection.

## 2. Features (implemented)
- **Optical QR Code Scan Capture & Confirmation (`FR-01`, `F5`):** Real-time camera stream QR scanning via HTML5 `getUserMedia` API with centralized `CSU-XXXXXX` ID normalization and sub-second visual/audio feedback.
- **Fallback Manual Student ID Lookup (`FR-02`, `F5`):** Drawer-based manual ID entry for damaged or unreadable QR badges, sharing the same centralized validation pipeline as optical scanning.
- **5-Minute Anti-Passback Duplicate Throttle (`BR-03`, `F2`):** Client-side `ThrottleValidator` preventing accidental double scans of the same student within a 300-second window.
- **Offline-First Local Queue Persistence (`ADR-001`, `F2`):** Encapsulated `LocalQueueRepository` over `IndexedDBStore` (`scankoto_local_db`) storing pending check-in/check-out records locally without internet access.
- **Background Sync & Cross-Device Timestamp Reconciliation (`FR-04`, `F3`):** Service Worker background sync paired with `AttendanceSyncReconciler` to sort and merge out-of-order offline scans across multiple officer devices before evaluation.
- **Attendance Duration Rule Engine (`FR-03`, `BR-04`):** Evaluates `Check-Out - Check-In` duration against configurable event minimum thresholds to classify attendance validity (`Complete` vs. `Incomplete`).
- **Executive Analytics & Automated CSV/XLSX Report Export (`FR-05`, `F1`, `F4`):** Live headcount summary metrics via `AnalyticsQueryService` (data-minimized DTOs) and tabular CSV/XLSX export with decoupled `EmailNotificationGateway` dispatch.

## 3. Technologies and versions
- **Languages:** JavaScript (ES2023+), SQL
- **Frontend Framework & UI:** React `18.3` / `19.x`, Vite `6.x`, Tailwind CSS `v4`, DaisyUI `v5`, `html5-qrcode`
- **Offline & PWA Layer:** Service Workers (Workbox), IndexedDB (`idb`), Web Background Sync API
- **Backend & Database:** Node.js `v20.x LTS`, Express.js `4.x` (Modular Monolith per Refined HLD v2.0), PostgreSQL `16.x` / `18.x` (with Prisma ORM & Row-Level Security)
- **Security & Testing Tools:** HTTPS/TLS 1.3, RFC 6238 TOTP 2FA, AES-256 field-level encryption (RA 10173 compliance), Vitest, ESLint, Prettier

## 4. Installation and setup
### 1. Requirements (software and versions)
- Node.js `v20.x LTS` or higher and `npm` `v10.x`+
- PostgreSQL `v16.x` or higher (or a Supabase/PostgreSQL instance)
- Modern Chromium-based browser or mobile browser with camera permissions (for `getUserMedia` QR scanning)

### 2. Steps to download / clone
```bash
git clone https://github.com/windylyswifts/scankoto-pwa.git
cd scankoto-pwa
```

### 3. Configuration (copy the sample config; do not include real secrets)
Create local `.env` files from the provided templates in both `backend/` and `frontend/` directories (never commit `.env` files to Git):
```bash
# Backend configuration
cp backend/.env.example backend/.env

# Frontend configuration
cp frontend/.env.example frontend/.env
```
Populate `backend/.env` with your local database connection string (`DATABASE_URL`), JWT signing secret (`JWT_SECRET`), and SMTP sandbox credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

### 4. How to start the application
```bash
# Terminal 1: Start the backend API & sync services
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run dev

# Terminal 2: Start the frontend PWA client
cd ../frontend
npm install
npm run dev
```
Open the local Vite URL (typically `http://localhost:5173`) in your browser and grant camera permissions when prompted.

## 5. Sample accounts / test data
All seeded credentials and student records are **fictitious test data only** (compliant with RA 10173):

| Role | Username / Email | Password | Sample Student QR IDs (Seeded) |
| :--- | :--- | :--- | :--- |
| **Executive Admin (LCO / Society Pres.)** | `exec.demo@scankoto.test` | `ScanTest@2026!` | `CSU-202601` to `CSU-202650` |
| **Event Scanner Officer** | `officer.demo@scankoto.test` | `Officer@2026!` | `CSU-202601` to `CSU-202650` |

## 6. Running the tests
Run unit and integration tests for both frontend client modules and backend domain services:
```bash
# Run frontend offline queue, throttle, and scanner controller tests
cd frontend
npm test

# Run backend sync reconciliation, duration rule, and analytics tests
cd ../backend
npm test
```
- **Test Documentation & Results:** Detailed test plans, test case specifications (`TC-SCAN-01`, `TC-THROT-02`, `TC-OFFLINE-01`, `TC-DUR-01`, `TC-SYNC-03`), actual execution results, and defect logs are documented in **Lab Worksheet 11** (`02_Documents_Source/TestPlan/`) and **Section 6** of the Final Project Portfolio (`01_Portfolio/`), with raw screenshots stored in `04_Evidence/Testing_Evidence/`.

## 7. Project structure
```text
scankoto-pwa/
|-- docs/
|   |-- team-style-guide.md          # Coding, branching, commit, and RA 10173 security rules
|-- frontend/
|   |-- public/sw.js                 # Service Worker for app-shell caching & background sync
|   |-- src/
|       |-- presentation/            # Thin UI views (ScannerView, AdminDashboardView, ManualLookupDrawer)
|       |-- client-app/              # Client controllers (ScannerController, ThrottleValidator, SyncServiceWorker)
|       |-- persistence/             # Local storage encapsulation (LocalQueueRepository, IndexedDBStore)
|-- backend/
|   |-- prisma/                      # PostgreSQL schema, migrations, and fictitious seed script
|   |-- src/
|       |-- services/                # Tier 3 domain services (AttendanceSyncReconciler, DurationRuleEngine, AnalyticsQueryService, ReportExportService)
|       |-- repositories/            # Tier 4 data access (CentralDatabaseRepository)
|       |-- adapters/                # External service adapters (EmailNotificationGateway)
|-- README.md
```

## 8. Team
**Team Name:** The Triad Initiative (`CSC 106 · BSIS 3`, Caraga State University)
- **Isiah W. Aliñab** — Project Leader, Software Release Lead & Full-Stack/Sync Architect (`AttendanceSyncReconciler`, `LocalQueueRepository`, Database Schema & Deployment)
- **Dorothy Mae I. Dumas** — UI/UX Lead & Client App Developer (`ScannerView`, `ManualLookupDrawer`, `ScannerController`, `IndexedDBStore`)
- **Jelaiza S. Arevalo** — Domain & QA Lead (`ThrottleValidator`, `DurationRuleEngine`, `ReportExportService`, Test Plan & Traceability)

## 9. Known limitations
- **Unified Manual Lookup & Queue Diagnostics Drawer (`HLD v2.0 Finding F6`):** `ManualLookupDrawer` currently houses both fallback manual ID entry and the offline pending-sync diagnostic list in one UI drawer; splitting them into separate views was intentionally deferred for post-usability iteration.
- **No Peer-to-Peer Offline Mesh Sync:** Offline devices cannot reconcile Check-In/Check-Out pairs directly with each other over Bluetooth/LAN without internet; reconciliation occurs deterministically via `AttendanceSyncReconciler` once at least one device reconnects to the server.
- **Camera Autofocus Dependency on Low-End Devices:** Optical QR decoding speed relies on device camera hardware autofocus; severely scratched or low-contrast printed IDs require fallback manual ID entry (`FR-02`).

## 10. Final version
Final commit ID: `<paste-final-commit-hash>`   Date: `November 25, 2026`
