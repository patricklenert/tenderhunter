export const BUNDESLAENDER = [
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
] as const;

export type Bundesland = (typeof BUNDESLAENDER)[number];

const normalizeLocationText = (value: string): string =>
  value
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const BUNDESLAND_ALIASES: Record<string, Bundesland> = {
  "baden wurttemberg": "Baden-Württemberg",
  bayern: "Bayern",
  berlin: "Berlin",
  brandenburg: "Brandenburg",
  bremen: "Bremen",
  hamburg: "Hamburg",
  hessen: "Hessen",
  "mecklenburg vorpommern": "Mecklenburg-Vorpommern",
  niedersachsen: "Niedersachsen",
  "nordrhein westfalen": "Nordrhein-Westfalen",
  nrw: "Nordrhein-Westfalen",
  ruhrgebiet: "Nordrhein-Westfalen",
  "rheinland pfalz": "Rheinland-Pfalz",
  rlp: "Rheinland-Pfalz",
  rp: "Rheinland-Pfalz",
  "r l p": "Rheinland-Pfalz",
  "r p": "Rheinland-Pfalz",
  saarland: "Saarland",
  sachsen: "Sachsen",
  "sachsen anhalt": "Sachsen-Anhalt",
  "schleswig holstein": "Schleswig-Holstein",
  thuringen: "Thüringen",
};

export function normalizeBundesland(value: string | null | undefined): Bundesland | null {
  if (!value) return null;
  return BUNDESLAND_ALIASES[normalizeLocationText(value)] ?? null;
}

// SEO: URL-friendly slugs for Bundesländer region landing pages
export const BUNDESLAND_SLUGS: Record<string, string> = {
  "Baden-Württemberg": "baden-wuerttemberg",
  Bayern: "bayern",
  Berlin: "berlin",
  Brandenburg: "brandenburg",
  Bremen: "bremen",
  Hamburg: "hamburg",
  Hessen: "hessen",
  "Mecklenburg-Vorpommern": "mecklenburg-vorpommern",
  Niedersachsen: "niedersachsen",
  "Nordrhein-Westfalen": "nordrhein-westfalen",
  "Rheinland-Pfalz": "rheinland-pfalz",
  Saarland: "saarland",
  Sachsen: "sachsen",
  "Sachsen-Anhalt": "sachsen-anhalt",
  "Schleswig-Holstein": "schleswig-holstein",
  Thüringen: "thueringen",
};

export const SLUG_TO_BUNDESLAND: Record<string, string> = Object.entries(
  BUNDESLAND_SLUGS,
).reduce(
  (acc, [bundesland, slug]) => {
    acc[slug] = bundesland;
    return acc;
  },
  {} as Record<string, string>,
);

export const ALL_BUNDESLAND_SLUGS = Object.values(BUNDESLAND_SLUGS);

const CITY_TO_BUNDESLAND: Record<string, Bundesland> = {
  "Baden-Württemberg": "Baden-Württemberg",
  Stuttgart: "Baden-Württemberg",
  Mannheim: "Baden-Württemberg",
  Karlsruhe: "Baden-Württemberg",
  Freiburg: "Baden-Württemberg",
  Heidelberg: "Baden-Württemberg",
  Heilbronn: "Baden-Württemberg",
  Ulm: "Baden-Württemberg",
  Reutlingen: "Baden-Württemberg",
  Esslingen: "Baden-Württemberg",

  München: "Bayern",
  Muenchen: "Bayern",
  Nürnberg: "Bayern",
  Nuernberg: "Bayern",
  Augsburg: "Bayern",
  Regensburg: "Bayern",
  Würzburg: "Bayern",
  Wuerzburg: "Bayern",
  Ingolstadt: "Bayern",
  Erlangen: "Bayern",
  Passau: "Bayern",
  Rosenheim: "Bayern",
  Bamberg: "Bayern",

  Berlin: "Berlin",

  Potsdam: "Brandenburg",
  Cottbus: "Brandenburg",
  "Frankfurt (Oder)": "Brandenburg",
  "Frankfurt/Oder": "Brandenburg",

  Bremen: "Bremen",
  Bremerhaven: "Bremen",

  Hamburg: "Hamburg",

  "Frankfurt am Main": "Hessen",
  "Frankfurt": "Hessen",
  Wiesbaden: "Hessen",
  Kassel: "Hessen",
  Darmstadt: "Hessen",
  Offenbach: "Hessen",
  Fulda: "Hessen",
  Marburg: "Hessen",

  Rostock: "Mecklenburg-Vorpommern",
  Schwerin: "Mecklenburg-Vorpommern",
  Neubrandenburg: "Mecklenburg-Vorpommern",
  Stralsund: "Mecklenburg-Vorpommern",
  Greifswald: "Mecklenburg-Vorpommern",
  Güstrow: "Mecklenburg-Vorpommern",
  Wismar: "Mecklenburg-Vorpommern",
  Waren: "Mecklenburg-Vorpommern",
  Malchin: "Mecklenburg-Vorpommern",
  Penzlin: "Mecklenburg-Vorpommern",
  Neustrelitz: "Mecklenburg-Vorpommern",
  Anklam: "Mecklenburg-Vorpommern",
  Barth: "Mecklenburg-Vorpommern",
  "Bad Doberan": "Mecklenburg-Vorpommern",

  Hannover: "Niedersachsen",
  Braunschweig: "Niedersachsen",
  Oldenburg: "Niedersachsen",
  Osnabrück: "Niedersachsen",
  Göttingen: "Niedersachsen",
  Wolfsburg: "Niedersachsen",
  Salzgitter: "Niedersachsen",
  Hildesheim: "Niedersachsen",

  Köln: "Nordrhein-Westfalen",
  Koeln: "Nordrhein-Westfalen",
  Düsseldorf: "Nordrhein-Westfalen",
  Duesseldorf: "Nordrhein-Westfalen",
  Dortmund: "Nordrhein-Westfalen",
  Essen: "Nordrhein-Westfalen",
  Duisburg: "Nordrhein-Westfalen",
  Bochum: "Nordrhein-Westfalen",
  Wuppertal: "Nordrhein-Westfalen",
  Bielefeld: "Nordrhein-Westfalen",
  Bonn: "Nordrhein-Westfalen",
  Münster: "Nordrhein-Westfalen",
  Muenster: "Nordrhein-Westfalen",
  Aachen: "Nordrhein-Westfalen",
  Mönchengladbach: "Nordrhein-Westfalen",
  Gelsenkirchen: "Nordrhein-Westfalen",
  Koblenz: "Rheinland-Pfalz",

  Mainz: "Rheinland-Pfalz",
  Ludwigshafen: "Rheinland-Pfalz",
  "Ludwigshafen am Rhein": "Rheinland-Pfalz",
  Trier: "Rheinland-Pfalz",
  Kaiserslautern: "Rheinland-Pfalz",
  Worms: "Rheinland-Pfalz",
  Neuwied: "Rheinland-Pfalz",
  Speyer: "Rheinland-Pfalz",
  Landau: "Rheinland-Pfalz",
  "Landau in der Pfalz": "Rheinland-Pfalz",
  "Landau (Pfalz)": "Rheinland-Pfalz",
  Frankenthal: "Rheinland-Pfalz",
  "Frankenthal (Pfalz)": "Rheinland-Pfalz",
  "Bad Kreuznach": "Rheinland-Pfalz",
  Bingen: "Rheinland-Pfalz",
  "Bingen am Rhein": "Rheinland-Pfalz",
  "Neustadt an der Weinstraße": "Rheinland-Pfalz",
  "Neustadt an der Weinstrasse": "Rheinland-Pfalz",
  "Neustadt a. d. Weinstraße": "Rheinland-Pfalz",
  "Neustadt a. d. Weinstrasse": "Rheinland-Pfalz",
  "Neustadt (Weinstraße)": "Rheinland-Pfalz",
  Pirmasens: "Rheinland-Pfalz",
  Zweibrücken: "Rheinland-Pfalz",
  Zweibruecken: "Rheinland-Pfalz",
  Germersheim: "Rheinland-Pfalz",
  "Idar-Oberstein": "Rheinland-Pfalz",
  "Bad Dürkheim": "Rheinland-Pfalz",
  "Bad Duerkheim": "Rheinland-Pfalz",
  Ingelheim: "Rheinland-Pfalz",
  "Ingelheim am Rhein": "Rheinland-Pfalz",
  Andernach: "Rheinland-Pfalz",
  Mayen: "Rheinland-Pfalz",
  Bitburg: "Rheinland-Pfalz",
  Wittlich: "Rheinland-Pfalz",
  Cochem: "Rheinland-Pfalz",
  Alzey: "Rheinland-Pfalz",
  "Bad Neuenahr-Ahrweiler": "Rheinland-Pfalz",
  "Bad Neuenahr": "Rheinland-Pfalz",
  Ahrweiler: "Rheinland-Pfalz",
  Montabaur: "Rheinland-Pfalz",
  Boppard: "Rheinland-Pfalz",
  Lahnstein: "Rheinland-Pfalz",
  Remagen: "Rheinland-Pfalz",
  Schifferstadt: "Rheinland-Pfalz",
  "Wörth am Rhein": "Rheinland-Pfalz",
  "Woerth am Rhein": "Rheinland-Pfalz",
  Kandel: "Rheinland-Pfalz",
  Grünstadt: "Rheinland-Pfalz",
  Gruenstadt: "Rheinland-Pfalz",
  Haßloch: "Rheinland-Pfalz",
  Hassloch: "Rheinland-Pfalz",

  Saarbrücken: "Saarland",

  Dresden: "Sachsen",
  Leipzig: "Sachsen",
  Chemnitz: "Sachsen",

  Magdeburg: "Sachsen-Anhalt",
  Halle: "Sachsen-Anhalt",
  "Halle (Saale)": "Sachsen-Anhalt",
  Dessau: "Sachsen-Anhalt",

  Kiel: "Schleswig-Holstein",
  Lübeck: "Schleswig-Holstein",
  Luebeck: "Schleswig-Holstein",
  Flensburg: "Schleswig-Holstein",

  Erfurt: "Thüringen",
  Jena: "Thüringen",
  Gera: "Thüringen",
  Weimar: "Thüringen",
};

const PLZ_PREFIX_TO_BUNDESLAND: Array<{ prefix: number; bundesland: Bundesland }> = [
  { prefix: 10, bundesland: "Berlin" },
  { prefix: 11, bundesland: "Berlin" },
  { prefix: 12, bundesland: "Berlin" },
  { prefix: 13, bundesland: "Berlin" },
  { prefix: 14, bundesland: "Brandenburg" },
  { prefix: 15, bundesland: "Brandenburg" },
  { prefix: 16, bundesland: "Brandenburg" },
  { prefix: 17, bundesland: "Brandenburg" },
  { prefix: 18, bundesland: "Mecklenburg-Vorpommern" },
  { prefix: 19, bundesland: "Mecklenburg-Vorpommern" },
  { prefix: 20, bundesland: "Hamburg" },
  { prefix: 22, bundesland: "Hamburg" },
  { prefix: 23, bundesland: "Schleswig-Holstein" },
  { prefix: 24, bundesland: "Schleswig-Holstein" },
  { prefix: 25, bundesland: "Schleswig-Holstein" },
  { prefix: 26, bundesland: "Niedersachsen" },
  { prefix: 27, bundesland: "Niedersachsen" },
  { prefix: 28, bundesland: "Bremen" },
  { prefix: 29, bundesland: "Niedersachsen" },
  { prefix: 30, bundesland: "Niedersachsen" },
  { prefix: 31, bundesland: "Niedersachsen" },
  { prefix: 32, bundesland: "Niedersachsen" },
  { prefix: 33, bundesland: "Niedersachsen" },
  { prefix: 34, bundesland: "Niedersachsen" },
  { prefix: 35, bundesland: "Niedersachsen" },
  { prefix: 36, bundesland: "Niedersachsen" },
  { prefix: 37, bundesland: "Niedersachsen" },
  { prefix: 38, bundesland: "Niedersachsen" },
  { prefix: 39, bundesland: "Sachsen-Anhalt" },
  { prefix: 40, bundesland: "Nordrhein-Westfalen" },
  { prefix: 41, bundesland: "Nordrhein-Westfalen" },
  { prefix: 42, bundesland: "Nordrhein-Westfalen" },
  { prefix: 43, bundesland: "Nordrhein-Westfalen" },
  { prefix: 44, bundesland: "Nordrhein-Westfalen" },
  { prefix: 45, bundesland: "Nordrhein-Westfalen" },
  { prefix: 46, bundesland: "Nordrhein-Westfalen" },
  { prefix: 47, bundesland: "Nordrhein-Westfalen" },
  { prefix: 48, bundesland: "Nordrhein-Westfalen" },
  { prefix: 49, bundesland: "Niedersachsen" },
  { prefix: 50, bundesland: "Nordrhein-Westfalen" },
  { prefix: 51, bundesland: "Nordrhein-Westfalen" },
  { prefix: 52, bundesland: "Nordrhein-Westfalen" },
  { prefix: 53, bundesland: "Nordrhein-Westfalen" },
  { prefix: 54, bundesland: "Rheinland-Pfalz" },
  { prefix: 55, bundesland: "Rheinland-Pfalz" },
  { prefix: 56, bundesland: "Rheinland-Pfalz" },
  { prefix: 57, bundesland: "Nordrhein-Westfalen" },
  { prefix: 58, bundesland: "Nordrhein-Westfalen" },
  { prefix: 59, bundesland: "Nordrhein-Westfalen" },
  { prefix: 60, bundesland: "Hessen" },
  { prefix: 61, bundesland: "Hessen" },
  { prefix: 62, bundesland: "Hessen" },
  { prefix: 63, bundesland: "Hessen" },
  { prefix: 64, bundesland: "Hessen" },
  { prefix: 65, bundesland: "Hessen" },
  { prefix: 66, bundesland: "Saarland" },
  { prefix: 67, bundesland: "Rheinland-Pfalz" },
  { prefix: 68, bundesland: "Baden-Württemberg" },
  { prefix: 69, bundesland: "Baden-Württemberg" },
  { prefix: 70, bundesland: "Baden-Württemberg" },
  { prefix: 71, bundesland: "Baden-Württemberg" },
  { prefix: 72, bundesland: "Baden-Württemberg" },
  { prefix: 73, bundesland: "Baden-Württemberg" },
  { prefix: 74, bundesland: "Baden-Württemberg" },
  { prefix: 75, bundesland: "Baden-Württemberg" },
  { prefix: 76, bundesland: "Baden-Württemberg" },
  { prefix: 77, bundesland: "Baden-Württemberg" },
  { prefix: 78, bundesland: "Baden-Württemberg" },
  { prefix: 79, bundesland: "Baden-Württemberg" },
  { prefix: 80, bundesland: "Bayern" },
  { prefix: 81, bundesland: "Bayern" },
  { prefix: 82, bundesland: "Bayern" },
  { prefix: 83, bundesland: "Bayern" },
  { prefix: 84, bundesland: "Bayern" },
  { prefix: 85, bundesland: "Bayern" },
  { prefix: 86, bundesland: "Bayern" },
  { prefix: 87, bundesland: "Bayern" },
  { prefix: 88, bundesland: "Baden-Württemberg" },
  { prefix: 89, bundesland: "Bayern" },
  { prefix: 90, bundesland: "Bayern" },
  { prefix: 91, bundesland: "Bayern" },
  { prefix: 92, bundesland: "Bayern" },
  { prefix: 93, bundesland: "Bayern" },
  { prefix: 94, bundesland: "Bayern" },
  { prefix: 95, bundesland: "Bayern" },
  { prefix: 96, bundesland: "Bayern" },
  { prefix: 97, bundesland: "Bayern" },
  { prefix: 98, bundesland: "Thüringen" },
  { prefix: 99, bundesland: "Thüringen" },
  { prefix: 1, bundesland: "Sachsen" },
  { prefix: 2, bundesland: "Sachsen" },
  { prefix: 3, bundesland: "Sachsen-Anhalt" },
  { prefix: 4, bundesland: "Sachsen" },
  { prefix: 5, bundesland: "Sachsen-Anhalt" },
  { prefix: 6, bundesland: "Sachsen-Anhalt" },
  { prefix: 7, bundesland: "Thüringen" },
  { prefix: 8, bundesland: "Sachsen" },
  { prefix: 9, bundesland: "Bayern" },
];

const RHEINLAND_PFALZ_POSTAL_CODE_RANGES: Array<{
  min: number;
  max: number;
  bundesland: Bundesland;
}> = [
  { min: 54000, max: 54999, bundesland: "Rheinland-Pfalz" },
  { min: 66482, max: 66482, bundesland: "Rheinland-Pfalz" },
  { min: 66900, max: 66999, bundesland: "Rheinland-Pfalz" },
  { min: 76726, max: 76726, bundesland: "Rheinland-Pfalz" },
  { min: 76744, max: 76744, bundesland: "Rheinland-Pfalz" },
  { min: 76751, max: 76751, bundesland: "Rheinland-Pfalz" },
  { min: 76756, max: 76756, bundesland: "Rheinland-Pfalz" },
  { min: 76761, max: 76761, bundesland: "Rheinland-Pfalz" },
  { min: 76764, max: 76764, bundesland: "Rheinland-Pfalz" },
  { min: 76767, max: 76768, bundesland: "Rheinland-Pfalz" },
  { min: 76770, max: 76771, bundesland: "Rheinland-Pfalz" },
  { min: 76773, max: 76774, bundesland: "Rheinland-Pfalz" },
  { min: 76776, max: 76777, bundesland: "Rheinland-Pfalz" },
  { min: 76779, max: 76779, bundesland: "Rheinland-Pfalz" },
  { min: 76800, max: 76899, bundesland: "Rheinland-Pfalz" },
];

function deriveBundeslandFromPostalCode(location: string): Bundesland | null {
  for (const match of location.matchAll(/(?:^|[^\d])(\d{2})\s?(\d{3})(?!\d)/g)) {
    const postalCode = Number(`${match[1]}${match[2]}`);
    const range = RHEINLAND_PFALZ_POSTAL_CODE_RANGES.find(
      ({ min, max }) => postalCode >= min && postalCode <= max,
    );
    if (range) return range.bundesland;

    const prefix = Number(match[1]);
    const bundesland = PLZ_PREFIX_TO_BUNDESLAND.find((entry) => entry.prefix === prefix);
    if (bundesland) return bundesland.bundesland;
  }

  return null;
}

const CITY_ALIASES: Record<string, string> = {
  "München": "München",
  "Muenchen": "München",
  "Munchen": "München",
  "Nürnberg": "Nürnberg",
  "Nuernberg": "Nürnberg",
  "Köln": "Köln",
  "Koeln": "Köln",
  "Düsseldorf": "Düsseldorf",
  "Duesseldorf": "Düsseldorf",
  "Münster": "Münster",
  "Muenster": "Münster",
  "Lübeck": "Lübeck",
  "Luebeck": "Lübeck",
  "Osnabrück": "Osnabrück",
  "Würzburg": "Würzburg",
  "Wuerzburg": "Würzburg",
  "Göttingen": "Göttingen",
  "Ludwigshafen am Rhein": "Ludwigshafen",
  "Frankenthal (Pfalz)": "Frankenthal",
  "Landau in der Pfalz": "Landau",
  "Landau (Pfalz)": "Landau",
  "Bingen am Rhein": "Bingen",
  "Neustadt an der Weinstrasse": "Neustadt an der Weinstraße",
  "Neustadt a. d. Weinstraße": "Neustadt an der Weinstraße",
  "Neustadt a. d. Weinstrasse": "Neustadt an der Weinstraße",
  "Neustadt (Weinstraße)": "Neustadt an der Weinstraße",
  Zweibruecken: "Zweibrücken",
  "Bad Duerkheim": "Bad Dürkheim",
  "Ingelheim am Rhein": "Ingelheim",
  "Woerth am Rhein": "Wörth am Rhein",
  Gruenstadt: "Grünstadt",
  Hassloch: "Haßloch",
};

export function deriveBundesland(location: string | null | undefined): Bundesland | null {
  if (!location || location.trim().length < 2) return null;

  const normalizedLocation = normalizeLocationText(location);
  for (const [alias, bundesland] of Object.entries(BUNDESLAND_ALIASES)) {
    if (normalizedLocation === alias || normalizedLocation.includes(` ${alias} `) || normalizedLocation.startsWith(`${alias} `) || normalizedLocation.endsWith(` ${alias}`)) {
      return bundesland;
    }
  }

  const parts = location.split(",").map((s) => s.trim());
  for (const part of parts) {
    const cleaned = part.replace(/^\d{4,5}\s+/, "").trim();
    if (cleaned.length < 2) continue;

    for (const bl of BUNDESLAENDER) {
      if (cleaned.toLowerCase() === bl.toLowerCase()) return bl;
      if (cleaned.toLowerCase().includes(bl.toLowerCase())) return bl;
    }
  }

  for (const [city, bundesland] of Object.entries(CITY_TO_BUNDESLAND)) {
    const normalizedCity = normalizeLocationText(city);
    if (
      normalizedLocation === normalizedCity ||
      normalizedLocation.includes(` ${normalizedCity} `) ||
      normalizedLocation.startsWith(`${normalizedCity} `) ||
      normalizedLocation.endsWith(` ${normalizedCity}`)
    ) {
      return bundesland;
    }
  }

  for (const part of parts) {
    const cleaned = part.replace(/^\d{4,5}\s+/, "").trim();
    if (cleaned.length < 2) continue;

    for (const [city, bl] of Object.entries(CITY_TO_BUNDESLAND)) {
      if (cleaned.toLowerCase() === city.toLowerCase()) return bl;
    }
  }

  return deriveBundeslandFromPostalCode(location);
}

export function deriveCity(location: string | null | undefined): string | null {
  if (!location || location.trim().length < 2) return null;

  const parts = location.split(",").map((s) => s.trim());
  for (const part of parts) {
    const cleaned = part.replace(/^\d{4,5}\s+/, "").trim();
    if (cleaned.length < 2) continue;

    for (const city of Object.keys(CITY_TO_BUNDESLAND)) {
      if (cleaned.toLowerCase() === city.toLowerCase()) {
        return CITY_ALIASES[city] ?? city;
      }
    }
  }

  const normalizedLocation = normalizeLocationText(location);
  for (const city of Object.keys(CITY_TO_BUNDESLAND)) {
    const normalizedCity = normalizeLocationText(city);
    if (
      normalizedLocation === normalizedCity ||
      normalizedLocation.includes(` ${normalizedCity} `) ||
      normalizedLocation.startsWith(`${normalizedCity} `) ||
      normalizedLocation.endsWith(` ${normalizedCity}`)
    ) {
      return CITY_ALIASES[city] ?? city;
    }
  }

  for (const part of parts) {
    const cleaned = part.replace(/^\d{4,5}\s+/, "").trim();
    if (cleaned.length < 2) continue;

    for (const bl of BUNDESLAENDER) {
      if (cleaned.toLowerCase() === bl.toLowerCase()) return null;
    }

    if (cleaned.length >= 3 && cleaned.length <= 30 && /^[A-ZÄÖÜa-zäöüß\-\s\/.]+$/.test(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

export interface LocationOption {
  label: string;
  value: string;
  group: "Bundesländer" | "Städte";
}

export function getAllLocationOptions(): LocationOption[] {
  const bundeslandOptions: LocationOption[] = BUNDESLAENDER.map((bl) => ({
    label: bl,
    value: `bl:${bl}`,
    group: "Bundesländer" as const,
  }));

  const citySet = new Set<string>();
  for (const city of Object.keys(CITY_TO_BUNDESLAND)) {
    if (CITY_ALIASES[city]) {
      citySet.add(CITY_ALIASES[city]);
    } else if (!BUNDESLAENDER.includes(city as typeof BUNDESLAENDER[number])) {
      citySet.add(city);
    }
  }
  const cityOptions: LocationOption[] = Array.from(citySet)
    .sort((a, b) => a.localeCompare(b, "de"))
    .map((city) => ({
      label: city,
      value: `city:${city}`,
      group: "Städte" as const,
    }));

  return [...bundeslandOptions, ...cityOptions];
}
