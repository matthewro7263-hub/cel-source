import { mock } from "bun:test";

// Minimal env so server modules can load during tests without real services.
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/cel_test";
process.env.SESSION_SECRET ??= "test-session-secret-for-unit-tests-only-32bytes";
process.env.R2_BUCKET ??= "test-bucket";
process.env.R2_ENDPOINT ??= "https://example.r2.cloudflarestorage.com";
process.env.R2_ACCESS_KEY_ID ??= "test-access-key";
process.env.R2_SECRET_ACCESS_KEY ??= "test-secret-key";

mock.module("better-sqlite3", () => {
  return {
    default: function Database() {
      return {
        pragma: () => {},
        exec: () => {},
        prepare: () => ({ run: () => {}, get: () => {}, all: () => {} })
      };
    }
  };
});
