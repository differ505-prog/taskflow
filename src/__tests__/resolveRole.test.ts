import { describe, it, expect } from "vitest";
import { resolveUserRole } from "@/lib/resolveRole";

describe("resolveUserRole (SSOT)", () => {
  it("recognizes founder email in adminEmails even when dbRole is free", () => {
    const role = resolveUserRole({
      email: "Founder@Example.com",
      dbRole: "free",
      adminEmails: ["founder@example.com"],
      proEmails: [],
    });
    expect(role).toBe("admin");
  });

  it("recognizes admin/pro from user_metadata even if dbRole is free", () => {
    expect(
      resolveUserRole({
        email: "a@example.com",
        metadata: { is_admin: true },
        dbRole: "free",
        adminEmails: [],
        proEmails: [],
      })
    ).toBe("admin");

    expect(
      resolveUserRole({
        email: "b@example.com",
        metadata: { is_pro: "true" },
        dbRole: "free",
        adminEmails: [],
        proEmails: [],
      })
    ).toBe("pro");
  });

  it("recognizes beta user from beta_users list even when dbRole is free", () => {
    const role = resolveUserRole({
      email: "tester@example.com",
      dbRole: "free",
      isBetaEmail: true,
      adminEmails: [],
      proEmails: [],
    });
    expect(role).toBe("beta");
  });

  it("enforces admin > pro > beta > free precedence", () => {
    expect(
      resolveUserRole({
        email: "vip@example.com",
        dbRole: "beta",
        isBetaEmail: true,
        adminEmails: ["vip@example.com"],
        proEmails: ["vip@example.com"],
      })
    ).toBe("admin");

    expect(
      resolveUserRole({
        email: "pro@example.com",
        dbRole: "beta",
        isBetaEmail: true,
        adminEmails: [],
        proEmails: ["pro@example.com"],
      })
    ).toBe("pro");

    expect(
      resolveUserRole({
        email: "plain@example.com",
        dbRole: "free",
        adminEmails: [],
        proEmails: [],
      })
    ).toBe("free");
  });
});
