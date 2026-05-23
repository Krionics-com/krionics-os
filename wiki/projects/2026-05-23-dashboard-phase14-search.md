# Phase 14 — Command Palette & Global Search

This document covers the Phase 14 implementation details of the Krionics Operator Dashboard, focusing on global search capabilities, centered overlay overlays modal portals, keyboard shortcuts navigation list structures, and dynamic syntax quick actions triggers.

## Search API Specification

### `GET /api/search?q=<query>&limit=5`
*   Requires a valid operator session token.
*   Triggers `ILIKE` database lookups on:
    *   **Clients:** `clients.company_name`
    *   **Campaigns:** `campaigns.name` joined with customer clients.
    *   **Leads:** `first_name`, `last_name`, `email`
    *   **Replies:** Joined with leads name/email, searching reply statuses and intent classifications.
*   Returns immediate results with maximum 5 items per category.

---

## Command Palette Overlay UI (/components/command-palette.tsx)

### 1. Global Event Listening Toggles
*   Monitors `Cmd+K` (Mac OS) or `Ctrl+K` (Windows/Linux) to immediately display or dismiss the centered search overlay.
*   Topbar Search button dispatches a decoupled CustomEvent to toggle the open/close state of the command palette easily.

### 2. Centered Modal Layout
*   Built utilizing native `ReactDOM.createPortal` rendering elements directly on the document `body` level.
*   Features a responsive input search field, debounced search (200ms), and custom active list item focus indexes.
*   Matched query substrings are dynamically highlighted using a `<mark>` element in bold terracotta text.

### 3. Keyboard Navigation Options
*   `ArrowUp` / `ArrowDown` to navigate seamlessly between active result list elements.
*   `Enter` to confirm navigation selection.
*   `Escape` or Backdrop clicks to dismiss.

---

## Quick Actions & Syntax (">" Parsing)

When the query begins with `>` (e.g. `> pause campaign Outreach`), the search displays command suggestions:
*   `> pause campaign [name]` -> links to Campaigns page
*   `> open client [name]` -> links to Clients list
*   `> approve draft [id]` -> links to Review Queue detail page
Renders with keyboard shortcut hints styled in custom tags.
