## 2024-05-14 - Test Bun with global mock preloads
**Learning:** When using `bun:test`, mocking native bindings like `better-sqlite3` inline within the test file won't work if they are evaluated as part of static top-level imports (like importing a `storage` object that imports the DB). The static imports load before the inline `mock.module()` runs.
**Action:** Use a `bunfig.toml` with `preload = ["./test-preload.ts"]` and put the `mock.module("better-sqlite3", ...)` configuration in `test-preload.ts` to ensure the module is mocked *before* any test files are parsed.
