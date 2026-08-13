import Medusa from "@medusajs/js-sdk";

/**
 * Admin API client used by the kit's Products route.
 *
 * `auth.type: "session"` matches how the Medusa Admin dashboard authenticates,
 * so requests reuse the same session cookie the dashboard already holds - there
 * is no second token for the kit to manage. `VITE_BACKEND_URL` lets a store
 * point the admin at a non-relative backend; it defaults to the same origin.
 */
export const sdk = new Medusa({
  auth: { type: "session" },
  baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
  debug: import.meta.env.DEV,
});
