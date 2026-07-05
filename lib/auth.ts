import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { db } from "./db";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [
    nextCookies(),
    passkey({
      rpID: "tenderhunter.palemadigital.com",
      rpName: "Tenderhunter",
    }),
  ],
  emailAndPassword: {
    enabled: true,
    autoSignInAfterRegistration: true,
    sendResetPassword: async ({ user, url }) => {
      // Mock email sender for now - log to console
      // In production, replace with Resend / SendGrid / etc.
      // eslint-disable-next-line no-console
      console.log("Password reset for", user.email, "URL:", url);
    },
  },
  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
  },
  trustedOrigins: [
    "http://localhost:3025",
    "https://tenderhunter.palemadigital.com",
    process.env.BETTER_AUTH_URL ?? "",
  ].filter(Boolean),
  advanced: {
    useSecureCookies: true,
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    freshAge: 60 * 60 * 24, // 24 hours — passkey operations need fresh session
  },
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute
    max: 10, // 10 requests per minute per IP
  },
});

export type Session = typeof auth.$Infer.Session;
