import assert from "node:assert/strict";
import { buildCreditRollText, buildPressKitSections, type PressKitCredit } from "./press-kit";

const credits: PressKitCredit[] = [
  { section: "crew", role: "Director", name: "Matthew", orderIdx: 0 },
  { section: "cast", role: "Bluey", name: "Performer A", orderIdx: 0 },
];

assert.equal(
  buildCreditRollText(credits),
  "CAST\nBluey - Performer A\n\nCREW\nDirector - Matthew",
);

assert.deepEqual(
  buildPressKitSections({
    title: "Cel Test",
    synopsis: "A tiny production test.",
    credits,
    contact: "matthew@example.com",
  }),
  [
    { heading: "Synopsis", body: "A tiny production test." },
    { heading: "Credits", body: "CAST\nBluey - Performer A\n\nCREW\nDirector - Matthew" },
    { heading: "Contact", body: "matthew@example.com" },
  ],
);
