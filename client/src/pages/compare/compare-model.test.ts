import assert from "node:assert/strict";
import { flattenComparableMedia, type CompareStoryboard } from "./compare-model";

const storyboards: CompareStoryboard[] = [
  {
    id: 1,
    title: "Main board",
    panels: [
      { id: 11, orderIdx: 1, imageData: "panel-b", caption: "B", dialogue: "" },
      { id: 10, orderIdx: 0, imageData: "panel-a", caption: "A", dialogue: "Hello" },
    ],
  },
];

assert.deepEqual(
  flattenComparableMedia(storyboards, [
    { id: 5, title: "Animatic v1", videoData: "video-a", notes: "", createdAt: "2026-01-01" },
  ]).map((item) => `${item.kind}:${item.id}:${item.label}`),
  [
    "panel:10:Main board - Panel 1",
    "panel:11:Main board - Panel 2",
    "animatic:5:Animatic v1",
  ],
);
