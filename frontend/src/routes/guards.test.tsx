import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestRoute, ProtectedRoute, RoleRoute } from "./guards";

const auth = vi.hoisted(() => ({ value: { user: null as any, loading: false } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth.value }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<GuestRoute><p>login page</p></GuestRoute>} />
        <Route path="/app" element={<ProtectedRoute />}>
          <Route index element={<p>dashboard</p>} />
          <Route path="admin" element={<RoleRoute roles={["ADMIN"]}><p>admin page</p></RoleRoute>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe("route guards", () => {
  beforeEach(() => { auth.value = { user: null, loading: false }; });

  it("sends anonymous users to login", () => {
    renderAt("/app");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });
  it("lets signed-in users in", () => {
    auth.value = { user: { role: "CUSTOMER" }, loading: false };
    renderAt("/app");
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });
  it("blocks a customer from an admin route", () => {
    auth.value = { user: { role: "CUSTOMER" }, loading: false };
    renderAt("/app/admin");
    expect(screen.getByText("dashboard")).toBeInTheDocument();
    expect(screen.queryByText("admin page")).not.toBeInTheDocument();
  });
  it("allows an admin on an admin route", () => {
    auth.value = { user: { role: "ADMIN" }, loading: false };
    renderAt("/app/admin");
    expect(screen.getByText("admin page")).toBeInTheDocument();
  });
  it("redirects signed-in users away from login", () => {
    auth.value = { user: { role: "ADMIN" }, loading: false };
    renderAt("/login");
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });
});
