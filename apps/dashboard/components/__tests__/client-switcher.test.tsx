import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SWRResponse } from "swr";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("swr", () => ({ default: vi.fn() }));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-root">{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    className,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
  }) => (
    <button data-testid="trigger" className={className} aria-label={ariaLabel}>
      {children}
    </button>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="menu-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    "aria-current": ariaCurrent,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-current"?: string;
  }) => (
    <button
      data-testid="menu-item"
      onClick={onClick}
      aria-current={ariaCurrent}
    >
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="menu-label">{children}</div>
  ),
  DropdownMenuSeparator: () => <hr data-testid="separator" />,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(" "),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

import useSWR from "swr";
const mockUseSWR = vi.mocked(useSWR);

const CLIENTS = [
  { id: "client-1", company_name: "Acme Corp", slug: "acme" },
  { id: "client-2", company_name: "Globex Inc", slug: "globex" },
  { id: "client-3", company_name: "Initech LLC", slug: "initech" },
];

function setupSWR({
  role,
  clients = CLIENTS,
  clientsLoading = false,
  userLoading = false,
}: {
  role?: string;
  clients?: typeof CLIENTS;
  clientsLoading?: boolean;
  userLoading?: boolean;
}) {
  mockUseSWR.mockImplementation((url: unknown) => {
    if (url === "/api/auth/me") {
      return {
        data: role ? { role } : undefined,
        isLoading: userLoading,
        error: undefined,
      } as unknown as SWRResponse;
    }
    if (url === "/api/dashboard/clients") {
      return {
        data: clientsLoading ? undefined : { clients },
        isLoading: clientsLoading,
        error: undefined,
      } as unknown as SWRResponse;
    }
    return { data: undefined, isLoading: false } as unknown as SWRResponse;
  });
}

// ── Import component after mocks are set up ──────────────────────────────────

import { ClientSwitcher } from "../client-switcher";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ClientSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Without credentials / unauthenticated ──────────────────────────────────

  describe("without credentials (unauthenticated)", () => {
    it("renders nothing when user data is undefined", () => {
      setupSWR({ role: undefined });
      const { container } = render(<ClientSwitcher />);
      expect(container.firstChild).toBeNull();
    });

    it("renders nothing while user is loading", () => {
      setupSWR({ role: undefined, userLoading: true });
      const { container } = render(<ClientSwitcher />);
      expect(container.firstChild).toBeNull();
    });
  });

  // ── Non-admin roles ────────────────────────────────────────────────────────

  describe("non-admin roles", () => {
    it.each(["operator", "viewer", "member", "guest"])(
      "renders nothing for role '%s'",
      (role) => {
        setupSWR({ role });
        const { container } = render(<ClientSwitcher />);
        expect(container.firstChild).toBeNull();
      }
    );
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows skeleton while clients are loading for admin", () => {
      setupSWR({ role: "admin", clientsLoading: true });
      render(<ClientSwitcher />);
      expect(screen.getByLabelText("Loading clients")).toBeInTheDocument();
    });

    it("shows skeleton while clients are loading for super_admin", () => {
      setupSWR({ role: "super_admin", clientsLoading: true });
      render(<ClientSwitcher />);
      expect(screen.getByLabelText("Loading clients")).toBeInTheDocument();
    });

    it("skeleton does not render a dropdown", () => {
      setupSWR({ role: "admin", clientsLoading: true });
      render(<ClientSwitcher />);
      expect(screen.queryByTestId("dropdown-root")).not.toBeInTheDocument();
    });
  });

  // ── Empty clients ──────────────────────────────────────────────────────────

  describe("empty clients list", () => {
    it("shows 'All Clients' text when no clients are available", () => {
      setupSWR({ role: "admin", clients: [] });
      render(<ClientSwitcher />);
      expect(screen.getByText("All Clients")).toBeInTheDocument();
      expect(screen.queryByTestId("dropdown-root")).not.toBeInTheDocument();
    });

    it("does not render a dropdown when client list is empty", () => {
      setupSWR({ role: "super_admin", clients: [] });
      render(<ClientSwitcher />);
      expect(screen.queryByTestId("trigger")).not.toBeInTheDocument();
    });
  });

  // ── Admin with clients ─────────────────────────────────────────────────────

  describe("admin with clients", () => {
    it("renders the dropdown trigger with 'All Clients' as default label", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);
      expect(screen.getByTestId("trigger")).toBeInTheDocument();
      // "All Clients" appears in both trigger span and the menu item — verify at least one exists
      expect(screen.getAllByText("All Clients").length).toBeGreaterThanOrEqual(1);
    });

    it("renders all client names in the menu", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("Globex Inc")).toBeInTheDocument();
      expect(screen.getByText("Initech LLC")).toBeInTheDocument();
    });

    it("renders correct number of menu items (all clients + 'All Clients')", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);
      const items = screen.getAllByTestId("menu-item");
      expect(items).toHaveLength(CLIENTS.length + 1); // +1 for "All Clients"
    });

    it("trigger has accessible aria-label 'All Clients' by default", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);
      expect(screen.getByLabelText("All Clients")).toBeInTheDocument();
    });

    it("renders the 'Switch Client' label in the menu", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);
      expect(screen.getByTestId("menu-label")).toHaveTextContent("Switch Client");
    });
  });

  // ── Client selection ───────────────────────────────────────────────────────

  describe("client selection", () => {
    it("updates trigger text when a client is selected", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);

      const acmeItem = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("Acme Corp")
      );
      expect(acmeItem).toBeDefined();
      fireEvent.click(acmeItem!);

      // Verify via the trigger's aria-label which is set to "Client: <name>"
      expect(screen.getByLabelText("Client: Acme Corp")).toBeInTheDocument();
    });

    it("updates aria-label on trigger when client is selected", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);

      const globexItem = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("Globex Inc")
      );
      fireEvent.click(globexItem!);

      expect(screen.getByLabelText("Client: Globex Inc")).toBeInTheDocument();
    });

    it("sets aria-current='true' on the selected client item", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);

      const acmeItem = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("Acme Corp")
      );
      fireEvent.click(acmeItem!);

      expect(acmeItem).toHaveAttribute("aria-current", "true");
    });

    it("selecting a different client updates the trigger", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);

      // Select Acme
      const acmeItem = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("Acme Corp")
      );
      fireEvent.click(acmeItem!);
      expect(screen.getByLabelText("Client: Acme Corp")).toBeInTheDocument();

      // Switch to Globex
      const globexItem = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("Globex Inc")
      );
      fireEvent.click(globexItem!);
      expect(screen.getByLabelText("Client: Globex Inc")).toBeInTheDocument();
    });
  });

  // ── Reset to "All Clients" ─────────────────────────────────────────────────

  describe("reset to All Clients", () => {
    it("resets to 'All Clients' when that item is clicked after selection", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);

      // First select a client
      const acmeItem = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("Acme Corp")
      );
      fireEvent.click(acmeItem!);
      expect(screen.getByLabelText("Client: Acme Corp")).toBeInTheDocument();

      // Then click "All Clients"
      const allClientsItem = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("All Clients")
      );
      fireEvent.click(allClientsItem!);

      expect(screen.getByLabelText("All Clients")).toBeInTheDocument();
    });

    it("'All Clients' item has aria-current='true' when no client is selected", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);

      const allClientsItem = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("All Clients")
      );
      expect(allClientsItem).toHaveAttribute("aria-current", "true");
    });

    it("'All Clients' aria-current is removed after selecting a client", () => {
      setupSWR({ role: "admin" });
      render(<ClientSwitcher />);

      const acmeItem = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("Acme Corp")
      );
      fireEvent.click(acmeItem!);

      const allClientsItem = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("All Clients")
      );
      expect(allClientsItem).not.toHaveAttribute("aria-current");
    });
  });

  // ── super_admin role ───────────────────────────────────────────────────────

  describe("super_admin role", () => {
    it("shows dropdown for super_admin with clients", () => {
      setupSWR({ role: "super_admin" });
      render(<ClientSwitcher />);
      expect(screen.getByTestId("trigger")).toBeInTheDocument();
    });

    it("super_admin can select a client", () => {
      setupSWR({ role: "super_admin" });
      render(<ClientSwitcher />);

      const initechItem = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("Initech LLC")
      );
      fireEvent.click(initechItem!);

      expect(screen.getByLabelText("Client: Initech LLC")).toBeInTheDocument();
    });
  });

  // ── Single client ──────────────────────────────────────────────────────────

  describe("single client", () => {
    it("renders correctly with exactly one client", () => {
      setupSWR({
        role: "admin",
        clients: [{ id: "solo-1", company_name: "Solo Co", slug: "solo" }],
      });
      render(<ClientSwitcher />);
      // 1 client + "All Clients" = 2 items
      expect(screen.getAllByTestId("menu-item")).toHaveLength(2);
      expect(screen.getByText("Solo Co")).toBeInTheDocument();
    });
  });

  // ── Simulate full flow ─────────────────────────────────────────────────────

  describe("full interaction flow", () => {
    it("simulates full flow: load → see clients → select → switch → reset", () => {
      // Step 1: Loading
      setupSWR({ role: "admin", clientsLoading: true });
      const { rerender } = render(<ClientSwitcher />);
      expect(screen.getByLabelText("Loading clients")).toBeInTheDocument();

      // Step 2: Loaded with clients
      setupSWR({ role: "admin" });
      rerender(<ClientSwitcher />);
      expect(screen.getByLabelText("All Clients")).toBeInTheDocument();
      expect(screen.getAllByTestId("menu-item")).toHaveLength(4); // 3 clients + All

      // Step 3: Select first client
      const acme = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("Acme Corp")
      )!;
      fireEvent.click(acme);
      expect(screen.getByLabelText("Client: Acme Corp")).toBeInTheDocument();

      // Step 4: Switch to another client
      const globex = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("Globex Inc")
      )!;
      fireEvent.click(globex);
      expect(screen.getByLabelText("Client: Globex Inc")).toBeInTheDocument();

      // Step 5: Reset to All Clients
      const allClients = screen.getAllByTestId("menu-item").find(
        (el) => el.textContent?.includes("All Clients")
      )!;
      fireEvent.click(allClients);
      expect(screen.getByLabelText("All Clients")).toBeInTheDocument();
    });

    it("simulates flow without credentials: no UI rendered at any stage", () => {
      // No user data
      setupSWR({ role: undefined });
      const { rerender, container } = render(<ClientSwitcher />);
      expect(container.firstChild).toBeNull();

      // Even if clients data arrives, still no user = still no UI
      setupSWR({ role: undefined, clients: CLIENTS });
      rerender(<ClientSwitcher />);
      expect(container.firstChild).toBeNull();
    });
  });
});
