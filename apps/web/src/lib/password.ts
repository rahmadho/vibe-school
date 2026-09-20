import "server-only";

/**
 * Public API password hashing — hanya untuk pemakaian di luar seed/worker
 * yang berada di konteks Next.js (Server Components / Server Actions).
 * Logika asli ada di `password-hash.ts` agar reusable di luar Next runtime.
 */
export { hashPassword, verifyPassword } from "./password-hash";
