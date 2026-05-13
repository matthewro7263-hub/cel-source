const subjects = [
  "a curious kid searching under the sofa",
  "two siblings inventing a new game",
  "a shy background character entering frame",
  "a prop rolling across the room",
  "a client mascot reacting to feedback",
  "a walk cycle with a sudden stop",
  "a character spotting a tiny clue",
  "a sleepy morning stretch",
  "a dramatic toy rescue",
  "a happy accident during cleanup",
  "a tiny creature crossing a big space",
  "a character trying not to laugh",
  "a backpack full of impossible props",
  "a nervous first pose before a performance",
  "a handoff between two characters",
  "a jump from confidence to panic",
  "a quiet apology after chaos",
  "a proud reveal of a handmade thing",
  "a character following a sound",
  "a prop that feels heavier than expected",
];

const actions = [
  "using only three clear key poses",
  "as a 12-frame stepped animation",
  "with the strongest silhouette possible",
  "from an overhead camera angle",
  "with a squash-and-stretch accent",
  "as a looping GIF idea",
  "with one exaggerated anticipation pose",
  "as if it were animated for Moho rigs",
  "with the emotion changing halfway through",
  "without using dialogue",
  "with a clear beginning, middle, and end",
  "as a tiny storyboard beat",
  "with a camera push-in",
  "using a foreground prop for depth",
  "with the action readable at thumbnail size",
  "with one smear or motion accent",
  "using only warm/cool contrast",
  "with a comedic pause",
  "with a strong line of action",
];

const constraints = [
  "Limit yourself to 10 minutes.",
  "Use one color plus black and white.",
  "Draw it twice: normal, then 30% more expressive.",
  "Keep the feet planted unless the story needs movement.",
  "Make the first and last poses feel different.",
  "Add one note about timing after you draw.",
  "Make it work as a storyboard panel first.",
  "Try a version with no facial expression.",
  "Push the pose until it almost breaks.",
  "Add a prop that explains the situation.",
  "Use big, medium, and tiny shapes.",
  "Mark the contact poses.",
  "Keep the staging simple enough for a client to understand.",
];

export interface DailySketchPrompt {
  dayIndex: number;
  title: string;
  prompt: string;
  constraint: string;
}

export interface PrincipleDrill {
  principle: string;
  focus: string;
  exercise: string;
}

export const principleDrills: PrincipleDrill[] = [
  { principle: "Squash and stretch", focus: "Weight and flexibility", exercise: "Animate a soft toy landing, holding shape at impact, then settling." },
  { principle: "Anticipation", focus: "Readable setup", exercise: "Draw three poses before a character opens a door they are nervous about." },
  { principle: "Staging", focus: "One clear idea", exercise: "Thumbnail a scene so the main action reads even at 80px wide." },
  { principle: "Straight ahead / pose to pose", focus: "Planning vs discovery", exercise: "Plan four key poses, then add one straight-ahead surprise between them." },
  { principle: "Follow through", focus: "Loose parts", exercise: "Add ears, tail, sleeves, or hair settling after the body stops." },
  { principle: "Slow in and slow out", focus: "Spacing", exercise: "Place 9 dots for a hand wave that eases into the final pose." },
  { principle: "Arcs", focus: "Natural motion", exercise: "Trace the nose path through a head turn and clean it into one arc." },
  { principle: "Secondary action", focus: "Support, not clutter", exercise: "Add a small hand or ear action that reinforces the main emotion." },
  { principle: "Timing", focus: "Comedy and clarity", exercise: "Try the same reaction at 6, 12, and 18 frames, then pick the funniest." },
  { principle: "Exaggeration", focus: "Pushed truth", exercise: "Redraw a worried pose at 150% intensity while keeping it believable." },
  { principle: "Solid drawing", focus: "Volume", exercise: "Turn a character in space using simple box/cylinder guides." },
  { principle: "Appeal", focus: "Clear, charming choices", exercise: "Simplify a pose until the expression, silhouette, and line of action agree." },
];

export function getDailySketchPrompt(date = new Date(), offset = 0): DailySketchPrompt {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayIndex = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  const index = Math.abs(dayIndex + offset) % 365;
  const subject = subjects[index % subjects.length];
  const action = actions[Math.floor(index / subjects.length) % actions.length];
  const constraint = constraints[Math.floor(index / (subjects.length * actions.length)) % constraints.length];
  return {
    dayIndex: index + 1,
    title: `Day ${index + 1} sketch prompt`,
    prompt: `Sketch ${subject} ${action}.`,
    constraint,
  };
}
