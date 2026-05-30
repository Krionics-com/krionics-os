# Client Infrastructure Onboarding Redesign

We updated the Client Onboarding Wizard and the PostgreSQL database schema to match our real business operations: **Outbound infrastructure (domains, mailboxes) are owned entirely by the client**, and Krionics acts as a manager/operator rather than assigning resources from an internal pool of Krionics-owned inventory.

## Technical Architecture

### 1. Database Schema Additions
In PostgreSQL, the `clients` table was updated to store the client's infrastructure details directly as first-class, indexed columns, removing any superficial inventory-based assignment layers.
```sql
ALTER TABLE clients
  ADD COLUMN primary_domain TEXT,
  ADD COLUMN outbound_domains TEXT[] DEFAULT '{}',
  ADD COLUMN inboxes TEXT[] DEFAULT '{}',
  ADD COLUMN mail_provider TEXT,
  ADD COLUMN technical_contact JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN access_checklist JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN setup_checklist JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN notes TEXT;
```

### 2. Form Strategy Toggles
The Infrastructure step of the onboarding wizard (`Step 4`) was restructured around a binary select option (`infrastructure_strategy`):
1. **Existing (`existing`)**:
   - For clients bringing pre-purchased outbound domains and mailboxes to Krionics.
   - Captures **Primary Domain**, **Outbound Domains**, **Existing Inboxes**, **Mail Provider** (Google, Microsoft, Other), **Access Checklist** (DNS access, Mailbox access), and the IT **Technical Contact**.
2. **Needs Setup (`setup_required`)**:
   - For clients that do not yet have outbound setup. Krionics assists in provisioning and tracking setup.
   - Captures the **Setup Progress Checklist** (8 deliverability milestones), **Planned Outbound Domains**, **Planned Inboxes**, the **Technical Contact**, and onboarding coordination **Notes**.

---

## Code Base Implementation

### 1. APIs
- **Client POST Endpoint** (`/api/dashboard/clients`): Updates client creation to accept the root payload keys for the new columns and insert them into the `clients` table on onboarding activation.
- **Client PATCH Endpoint** (`/api/dashboard/clients/[slug]`): Adds all new fields to `allowedScalars` to permit full inline editing of existing clients' infrastructure in their settings profiles, handling array maps and JSONB stringification.
- **Deprecated Endpoint Removal**: The `/api/dashboard/clients/[slug]/assign-infrastructure` endpoint has been safely deleted.

### 2. Frontend Wizard Redesign
- **Premium List Input (`DynamicListInput`)**: Designed a polished, highly-interactive list builder component with keyboard listeners (adds items on "Enter") and close-click transitions for removing badges.
- **Validation Checks**: Validation enforces that `primary_domain` is provided if the `'existing'` strategy is chosen.
- **Summary Rendering**: The Review & Activate step is updated to display a breakdown of the chosen strategy, lists of domains/inboxes, and IT contacts.

---

## Migrations Integration Learning
During schema migrations, we found and fixed two pre-existing blocker bugs in the system's prior SQL migrations:
- **`create_events.sql`**: A unique constraint (`PRIMARY KEY`) on a partitioned table must include all partitioning columns in PostgreSQL. Because `events` was partitioned by `created_at`, the standalone primary key on `event_id` and self-referencing foreign keys were invalid. This table was converted to a standard unpartitioned table.
- **`create_timing_rules.sql`**: Contained duplicate primary key definitions (on the `id` column directly and a composite key at the bottom). This was corrected by making `id` the single primary key and adding a `UNIQUE (client_id, intent)` constraint.
