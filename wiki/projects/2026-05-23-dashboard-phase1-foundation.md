# Dashboard Phase 1 — Design Foundation

## Objective
Set up the design foundation for the entire dashboard, install Shadcn UI, configure Tailwind with Krionics brand tokens, build the layout shell, redesign the login page, and implement role-based access control (RBAC).

## What Was Built
- **Design Tokens**: Configured `app/globals.css` with Krionics brand colors (warm cream, burnt terracotta) and fonts (Playfair Display, Inter).
- **Shadcn UI Components**: Installed and configured base components: Button, Input, Label, Card, Form, Sonner, Badge, Table, Dropdown-Menu.
- **Custom UI Components**: 
  - `ui/spinner.tsx` (using Lucide's `Loader2`)
  - `ui/empty-state.tsx` (standard empty state with icon and action slot)
- **Layout Shell**: 
  - `layout/sidebar.tsx` (collapsible, Krionics logo + nav, operator profile at bottom)
  - `layout/topbar.tsx` (breadcrumb, search bar, alerts, logout)
  - `layout/auth-shell.tsx` (for login pages)
  - `session-manager.tsx` (Client-side wrapper to handle 10-minute idle session timeout)
  - Updated `app/dashboard/layout.tsx` to use the new `DashboardShell` and `SessionManager`.
- **Authentication & Authorization**:
  - Redesigned `app/login/page.tsx` using new AuthShell and components to match Krionics brand.
  - Implemented 6 roles in JWT hierarchy: `super_admin`, `admin`, `campaign_manager`, `reply_reviewer`, `analyst`, `support_operator`.
  - Added role-gated middleware in `middleware.ts` to restrict `/dashboard/admin` to admins.
  - Created `lib/auth-helpers.ts` with `requireRole`, `hasPermission`, and `canAccessClient` functions.

## Design Decisions
- **Why shadcn/ui**: Provides accessible, unstyled primitives that are fully customizable with Tailwind CSS, fitting the exact brand requirements of Krionics OS perfectly.
- **Why OKLCH to Hex**: Converted the design tokens directly into hex and standard CSS variables in `globals.css` to closely mirror the exact color specification from the design.

## Database Changes
- N/A

## API Endpoints
- Updated `/api/reply-items/[replyItemId]` to explicitly cast `confidence` as a Number, fixing an E2E test type error.

## Bug Fixes Applied
- Fixed `OperatorToken` type to include `client_access` and ensure it's passed correctly in the login payload.
- Fixed `SessionManager` toast spam by adding a `warningShown` ref to only trigger the warning once.
- Fixed token refresh by implementing a dedicated `/api/auth/refresh` endpoint and calling it in `SessionManager`.
- Fixed sidebar color blending into the main background by explicitly setting `--sidebar` to white in `globals.css`.

## Missing Features Implemented
- Added `Breadcrumb` component to `Topbar` for navigation context.
- Added `ClientSwitcher` dropdown to `Topbar` to support multi-tenant filtering.
- Implemented a reusable `DataTable` component using `@tanstack/react-table` with sorting and pagination capabilities.

## Testing
- **E2E Tests**: `npx tsx scripts/e2e-dashboard.ts` (All passed successfully).
- **TypeScript**: Verified `npm run build` succeeds without errors.
- **Manual Verifications**:
  - Login token contains `client_access` array.
  - Idle timeout correctly shows only 1 warning toast at 9 minutes.
  - Token refresh cookie correctly extends expiry.
  - Sidebar visibly distinct from content area.
  - Topbar breadcrumb updates according to path.
  - Topbar client switcher functional.

## Sources
- `ANTIGRAVITY_PROMPTS.md` (Phase 1)
- `DASHBOARD_BUILD_GUIDE.md`
