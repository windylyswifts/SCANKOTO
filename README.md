# SCANKOTO — Offline-First PWA for Automated Event Attendance Tracking

## 1. Overview
SCANKOTO is an offline-first Progressive Web Application (PWA) designed to solve manual encoding bottlenecks, long check-in queues, and unreliable campus Wi-Fi/cellular connectivity during large student events at Caraga State University (CSU). Built for CSU student organization officers (such as CSU-ISS and LCO executives) and student attendees, the system enables sub-second optical QR code scanning of Student ID (`2XX-XXXXXX`), enforces a 5-minute anti-passback throttle, queues attendance records locally in IndexedDB while offline, and automatically synchronizes and reconciles multi-device timestamps with a cloud relational database upon reconnection.

## 2. Features (implemented)
- **Optical QR Code Scan Capture & Confirmation (`FR-01`, `F5`):** Real-time camera stream QR scanning via HTML5 `getUserMedia` API with centralized `2XX-XXXXXX` ID normalization and sub-second visual/audio feedback.
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
git clone [https://github.com/windylyswifts/scankoto-pwa.git](https://github.com/windylyswifts/scankoto-pwa.git)
cd scankoto-pwa
