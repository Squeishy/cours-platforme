import { describe, expect, it } from "vitest";
import { classifyResponse, isPrivateAddress } from "./link-check-core";

describe("isPrivateAddress (anti-SSRF)", () => {
  it("bloque les plages internes IPv4", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.10", "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("laisse passer les IPv4 publiques", () => {
    for (const ip of ["140.82.121.4", "8.8.8.8", "172.32.0.1", "193.54.1.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
  it("bloque les plages internes IPv6 et les IPv4 encapsulées", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::10.0.0.1", "2001:db8::1", "[::1]"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("bloque les formes IPv6 exotiques (audit sécurité)", () => {
    for (const ip of ["::7f00:1", "::127.0.0.1", "64:ff9b::7f00:1", "64:ff9b::a00:1", "fec0::1", "0:0:0:0:0:ffff:127.0.0.1", "::ffff:a9fe:a9fe", "100::1", "fe80::1%eth0", "1::2::3", "zzzz::1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("laisse passer les IPv6 publiques", () => {
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
    expect(isPrivateAddress("64:ff9b::808:808")).toBe(false);
    expect(isPrivateAddress("2a00:1450:4007:80f::200e")).toBe(false);
  });
  it("refuse ce qui n'est pas une IP", () => {
    expect(isPrivateAddress("localhost")).toBe(true);
    expect(isPrivateAddress("999.1.1.1")).toBe(true);
  });
});

describe("classifyResponse", () => {
  it("200 public → OK", () => {
    expect(classifyResponse(200, "https://github.com/org/repo").status).toBe("OK");
  });
  it("redirection finale vers une page de connexion → PRIVATE", () => {
    expect(classifyResponse(200, "https://accounts.google.com/v3/signin/identifier?x").status).toBe("PRIVATE");
    expect(classifyResponse(200, "https://github.com/login?return_to=/org/repo").status).toBe("PRIVATE");
    expect(classifyResponse(200, "https://gitlab.univ-exemple.fr/users/sign_in").status).toBe("PRIVATE");
  });
  it("404 GitHub/GitLab → dépôt privé probable", () => {
    expect(classifyResponse(404, "https://github.com/org/private").status).toBe("PRIVATE");
  });
  it("404 ailleurs → cassé ; 5xx → injoignable ; 403 → privé", () => {
    expect(classifyResponse(404, "https://exemple.fr/x").status).toBe("BROKEN");
    expect(classifyResponse(503, "https://exemple.fr/x").status).toBe("UNREACHABLE");
    expect(classifyResponse(403, "https://drive.google.com/x").status).toBe("PRIVATE");
  });
});
