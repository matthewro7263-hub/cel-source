export type Season = "spring" | "summer" | "autumn" | "winter";
export type WeatherMood = "clear" | "golden" | "overcast" | "storm" | "night";

export type LightLabState = {
  hour: number;
  season: Season;
  cloudCover: number;
  mood: WeatherMood;
};

export type SunPathPoint = {
  hour: number;
  label: string;
  visible: boolean;
  x: number;
  y: number;
};

export type LightPlan = {
  hour: number;
  season: Season;
  mood: WeatherMood;
  moodLabel: string;
  kelvin: number;
  shadowSoftness: number;
  exposureBias: number;
  skyTop: string;
  skyBottom: string;
  sunColor: string;
  summary: string;
  note: string;
};

export type HdriLocation = {
  id: string;
  name: string;
  region: string;
  tags: string[];
  sky: string;
  sun: string;
  note: string;
};

export type RankedHdriLocation = HdriLocation & {
  score: number;
  reason: string;
};

export const LIGHT_MOODS: Array<{
  value: WeatherMood;
  label: string;
  hint: string;
}> = [
  { value: "clear", label: "Clear", hint: "Clean key light and crisp edges." },
  { value: "golden", label: "Golden", hint: "Warm sun with long shadows." },
  { value: "overcast", label: "Overcast", hint: "Soft top-light and broad fill." },
  { value: "storm", label: "Storm", hint: "Low skies, cool bounce, drama." },
  { value: "night", label: "Night", hint: "Moonlit contrast and cool haze." },
];

export const SEASONS: Array<{
  value: Season;
  label: string;
}> = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "autumn", label: "Autumn" },
  { value: "winter", label: "Winter" },
];

const SEASON_WINDOWS: Record<Season, { sunrise: number; sunset: number; peak: number }> = {
  spring: { sunrise: 6.25, sunset: 18.9, peak: 0.92 },
  summer: { sunrise: 5.5, sunset: 20.1, peak: 1 },
  autumn: { sunrise: 6.6, sunset: 18.2, peak: 0.86 },
  winter: { sunrise: 7.4, sunset: 17.1, peak: 0.72 },
};

const BASE_PALETTES: Record<WeatherMood, { top: string; bottom: string; sun: string; shadow: string }> = {
  clear: { top: "#8FD1FF", bottom: "#F7E7B1", sun: "#FFF8E6", shadow: "#4E6D98" },
  golden: { top: "#F7AC57", bottom: "#FFE0AE", sun: "#FFF5D4", shadow: "#856145" },
  overcast: { top: "#A5B4C8", bottom: "#E3E8F0", sun: "#FFF8EA", shadow: "#667084" },
  storm: { top: "#7A8AA4", bottom: "#D7DEEA", sun: "#F5F7FA", shadow: "#4A5568" },
  night: { top: "#1A2240", bottom: "#485D8E", sun: "#DCE7FF", shadow: "#0F172A" },
};

const SEASON_TINTS: Record<Season, string> = {
  spring: "#D9F4D9",
  summer: "#D8F0FF",
  autumn: "#F8D6B7",
  winter: "#DCE7FF",
};

const HDRI_LOCATIONS: HdriLocation[] = [
  {
    id: "storm-coast",
    name: "Storm Coast",
    region: "Salt spray headland",
    tags: ["storm", "overcast", "wind", "dramatic", "cool"],
    sky: "#8A99AF",
    sun: "#F3F6FA",
    note: "Best when the shot needs a wet horizon, rolling cloud, and a hard-edged silhouette.",
  },
  {
    id: "golden-rooftop",
    name: "Golden Rooftop",
    region: "Warm city skyline",
    tags: ["golden", "clear", "warm", "urban", "sunset"],
    sky: "#F39A52",
    sun: "#FFF3C6",
    note: "Great for city beats, warm bounce, and reflective windows at the end of day.",
  },
  {
    id: "pine-valley",
    name: "Pine Valley",
    region: "Forest floor break",
    tags: ["clear", "spring", "summer", "green", "soft"],
    sky: "#87C8E7",
    sun: "#FFF8E8",
    note: "Useful for gentle backlight, leafy fill, and a calmer mid-morning read.",
  },
  {
    id: "snow-ridge",
    name: "Snow Ridge",
    region: "Cold mountain pass",
    tags: ["winter", "night", "clear", "cool", "high-contrast"],
    sky: "#AEBFDC",
    sun: "#F8FAFF",
    note: "Use for crisp winter bounce, thin atmosphere, and clean shadow separation.",
  },
  {
    id: "desert-dusk",
    name: "Desert Dusk",
    region: "Open sand basin",
    tags: ["golden", "clear", "warm", "wide", "sunset"],
    sky: "#F1A04C",
    sun: "#FFF0CA",
    note: "Strong for long shadows, glowing sand bounce, and saturated sunset edges.",
  },
  {
    id: "moonlit-backlot",
    name: "Moonlit Backlot",
    region: "Cinematic night set",
    tags: ["night", "storm", "urban", "cool", "dramatic"],
    sky: "#243055",
    sun: "#CAD8FF",
    note: "A controlled night sphere with clean moonlight and a heavy production look.",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatHour(hour: number) {
  const rounded = clamp(Math.round(hour * 2) / 2, 0, 23.5);
  const whole = Math.floor(rounded);
  const minutes = rounded - whole >= 0.5 ? ":30" : ":00";
  const suffix = whole >= 12 ? "PM" : "AM";
  const display = whole % 12 || 12;
  return `${display}${minutes} ${suffix}`;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "").trim();
  const value = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;

  const parsed = Number.parseInt(value, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(a: string, b: string, amount: number) {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  const blend = clamp(amount, 0, 1);
  return rgbToHex(
    Math.round(left.r + ((right.r - left.r) * blend)),
    Math.round(left.g + ((right.g - left.g) * blend)),
    Math.round(left.b + ((right.b - left.b) * blend)),
  );
}

function moodLabel(mood: WeatherMood) {
  return LIGHT_MOODS.find((entry) => entry.value === mood)?.label ?? mood;
}

function seasonLabel(season: Season) {
  return SEASONS.find((entry) => entry.value === season)?.label ?? season;
}

export function clampHour(hour: number) {
  if (!Number.isFinite(hour)) return 12;
  return clamp(Math.round(hour * 2) / 2, 0, 23.5);
}

export function clampCloudCover(cloudCover: number) {
  if (!Number.isFinite(cloudCover)) return 0;
  return clamp(Math.round(cloudCover), 0, 100);
}

export function computeSunPosition(hour: number, season: Season, cloudCover = 0): SunPathPoint {
  const clampedHour = clampHour(hour);
  const window = SEASON_WINDOWS[season];
  const daylightSpan = Math.max(1, window.sunset - window.sunrise);
  const progress = (clampedHour - window.sunrise) / daylightSpan;
  const daylight = clamp(progress, 0, 1);
  const visible = clampedHour >= window.sunrise && clampedHour <= window.sunset;
  const arc = visible ? Math.sin(Math.PI * daylight) : 0;
  const cloudSoftness = clampCloudCover(cloudCover) / 100;
  const altitude = arc * window.peak * (1 - (cloudSoftness * 0.28));

  return {
    hour: clampedHour,
    label: formatHour(clampedHour),
    visible,
    x: 8 + (daylight * 84),
    y: visible ? (78 - (altitude * 56)) + (cloudSoftness * 2) : (clampedHour < window.sunrise ? 86 : 84),
  };
}

export function buildSunPathSamples(season: Season): SunPathPoint[] {
  return [6, 8, 10, 12, 14, 16, 18].map((hour) => computeSunPosition(hour, season, 0));
}

export function buildLightingPlan(state: LightLabState): LightPlan {
  const cloudCover = clampCloudCover(state.cloudCover);
  const hour = clampHour(state.hour);
  const moodPalette = BASE_PALETTES[state.mood];
  const seasonTint = SEASON_TINTS[state.season];

  const kelvinBase: Record<WeatherMood, number> = {
    clear: 6200,
    golden: 4800,
    overcast: 7200,
    storm: 7600,
    night: 4000,
  };

  const seasonShift: Record<Season, number> = {
    spring: 100,
    summer: 250,
    autumn: -120,
    winter: 380,
  };

  const cloudShift = state.mood === "overcast" ? 260 : state.mood === "storm" ? 320 : 0;
  const exposureShift = state.mood === "golden" ? -0.35 : state.mood === "night" ? 1.1 : state.mood === "storm" ? 0.55 : 0;
  const kelvin = Math.round(kelvinBase[state.mood] + seasonShift[state.season] + (cloudCover * 4.2) - cloudShift);
  const shadowSoftness = Math.round(clamp((cloudCover * 0.45) + (state.mood === "overcast" ? 28 : state.mood === "storm" ? 34 : state.mood === "night" ? 18 : 8), 5, 100));
  const sunPosition = computeSunPosition(hour, state.season, cloudCover);

  const skyTop = mixHex(moodPalette.top, seasonTint, 0.22);
  const skyBottom = mixHex(moodPalette.bottom, seasonTint, 0.14 + (cloudCover / 260));
  const sunColor = mixHex(moodPalette.sun, "#FFFFFF", state.mood === "night" ? 0.12 : 0.32);

  const timeLabel = formatHour(hour);
  const summaryByMood: Record<WeatherMood, string> = {
    clear: "Clean key light with crisp shadows and balanced fill.",
    golden: "Warm golden hour light with long, painterly shadows.",
    overcast: "Soft overcast light with broad, readable faces.",
    storm: "Low storm cover with cool bounce and a dramatic edge.",
    night: "Moonlit night cover with cool contrast and deep atmosphere.",
  };

  return {
    hour,
    season: state.season,
    mood: state.mood,
    moodLabel: moodLabel(state.mood),
    kelvin,
    shadowSoftness,
    exposureBias: Number(exposureShift.toFixed(2)),
    skyTop,
    skyBottom,
    sunColor,
    summary: `${moodLabel(state.mood)} ${state.mood === "golden" ? "golden hour" : seasonLabel(state.season).toLowerCase()} light with ${shadowSoftness}% shadow softness.`,
    note: summaryByMood[state.mood],
  };
}

export function rankHdriLocations(state: LightLabState): RankedHdriLocation[] {
  const hour = clampHour(state.hour);
  const cloudCover = clampCloudCover(state.cloudCover);
  const mood = state.mood;
  const season = state.season;

  return HDRI_LOCATIONS.map((location) => {
    let score = 42;
    const reasons: string[] = [];

    if (location.tags.includes(mood)) {
      score += 34;
      reasons.push(`matches ${moodLabel(mood).toLowerCase()} mood`);
    }

    if (mood === "golden" && location.tags.includes("sunset")) {
      score += 10;
      reasons.push("holds onto sunset warmth");
    }

    if (mood === "storm" && location.tags.includes("wind")) {
      score += 12;
      reasons.push("leans into weather and motion");
    }

    if (mood === "overcast" && location.tags.includes("soft")) {
      score += 11;
      reasons.push("keeps the light broad and soft");
    }

    if (mood === "night" && location.tags.includes("cool")) {
      score += 10;
      reasons.push("supports a cool night read");
    }

    if (cloudCover >= 65 && location.tags.includes("overcast")) {
      score += 12;
      reasons.push("handles heavy cloud cover");
    } else if (cloudCover <= 30 && location.tags.includes("clear")) {
      score += 10;
      reasons.push("benefits from a clear sky");
    }

    if (season === "winter" && location.tags.includes("cool")) score += 8;
    if (season === "summer" && location.tags.includes("warm")) score += 8;
    if (season === "autumn" && location.tags.includes("sunset")) score += 6;
    if (season === "spring" && location.tags.includes("green")) score += 6;

    if (hour < 8 || hour > 18) {
      if (location.tags.includes("night") || location.tags.includes("dramatic")) {
        score += 6;
        reasons.push("keeps the shape readable at low sun");
      }
    }

    if (reasons.length === 0) {
      reasons.push("keeps the rig flexible");
    }

    return {
      ...location,
      score,
      reason: reasons.slice(0, 2).join(" and "),
    };
  }).sort((a, b) => b.score - a.score);
}
