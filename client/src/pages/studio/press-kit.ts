export interface PressKitCredit {
  section: "cast" | "crew";
  role: string;
  name: string;
  orderIdx: number;
}

export interface PressKitInput {
  title: string;
  synopsis?: string;
  credits: PressKitCredit[];
  contact?: string;
}

export interface PressKitSection {
  heading: string;
  body: string;
}

function sortedCredits(credits: PressKitCredit[], section: "cast" | "crew") {
  return credits
    .filter((credit) => credit.section === section)
    .sort((a, b) => a.orderIdx - b.orderIdx)
    .map((credit) => `${credit.role} - ${credit.name}`);
}

export function buildCreditRollText(credits: PressKitCredit[]): string {
  const cast = sortedCredits(credits, "cast");
  const crew = sortedCredits(credits, "crew");
  const sections: string[] = [];
  if (cast.length) sections.push(["CAST", ...cast].join("\n"));
  if (crew.length) sections.push(["CREW", ...crew].join("\n"));
  return sections.join("\n\n");
}

export function buildPressKitSections(input: PressKitInput): PressKitSection[] {
  const synopsis = input.synopsis?.trim() || "Synopsis pending.";
  const credits = buildCreditRollText(input.credits) || "Credits pending.";
  const contact = input.contact?.trim() || "Contact pending.";
  return [
    { heading: "Synopsis", body: synopsis },
    { heading: "Credits", body: credits },
    { heading: "Contact", body: contact },
  ];
}
