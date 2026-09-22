import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";

const allowedDomains = (process.env.SIGNUP_ALLOWED_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "mysql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  user: {
    additionalFields: {
      // Rôle géré uniquement côté serveur (page admin) — jamais saisi à l'inscription
      role: { type: "string", required: false, defaultValue: "STUDENT", input: false },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (allowedDomains.length === 0) return;
          const domain = user.email.split("@")[1]?.toLowerCase();
          if (!domain || !allowedDomains.includes(domain)) {
            throw new APIError("FORBIDDEN", {
              message: "Inscription réservée aux adresses de l'établissement.",
            });
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});
