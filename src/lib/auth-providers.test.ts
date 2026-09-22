import { describe, expect, it } from "vitest";
import { parseAuthProviders } from "./auth-providers";

describe("parseAuthProviders", () => {
  it("par défaut : e-mail + mot de passe uniquement", () => {
    expect(parseAuthProviders("")).toEqual(["credentials"]);
    expect(parseAuthProviders("credentials")).toEqual(["credentials"]);
  });
  it("garde toujours la connexion locale en secours", () => {
    expect(parseAuthProviders("cas")).toEqual(["credentials", "cas"]);
    expect(parseAuthProviders(" Credentials , OIDC ")).toEqual(["credentials", "oidc"]);
  });
  it("refuse un fournisseur inconnu", () => {
    expect(() => parseAuthProviders("credentials,saml")).toThrow(/saml/);
  });
});
