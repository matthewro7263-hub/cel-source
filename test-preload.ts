import { mock } from "bun:test";

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
