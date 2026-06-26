export const CATEGORY_LABELS: Record<string, string> = {
  Bauarbeiten: "Bauarbeiten",
  Tiefbau: "Tiefbau & Infrastruktur",
  TGA: "Technische Gebäudeausrüstung",
  Gebaeudereinigung: "Gebäudereinigung",
  Winterdienst: "Winterdienst",
  Immobilienverwaltung: "Immobilienverwaltung",
  "Facility Management": "Facility Management",
  Gruenflaechenpflege: "Grünflächenpflege",
  Gartenarbeiten: "Garten- und Landschaftsbau",
  Planungsleistungen: "Planungsleistungen",
  "IT-Dienstleistungen": "IT-Dienstleistungen",
  Lieferung: "Lieferung & Material",
  Sonstiges: "Diverse Leistungen",
};

export const CATEGORY_SLUGS: Record<string, string> = {
  Bauarbeiten: "bauarbeiten",
  Tiefbau: "tiefbau",
  TGA: "tga",
  Gebaeudereinigung: "gebaeudereinigung",
  Winterdienst: "winterdienst",
  Immobilienverwaltung: "immobilienverwaltung",
  "Facility Management": "facility-management",
  Gruenflaechenpflege: "gruenflaechenpflege",
  Gartenarbeiten: "garten-und-landschaftsbau",
  Planungsleistungen: "planungsleistungen",
  "IT-Dienstleistungen": "it-dienstleistungen",
  Lieferung: "lieferung",
  Sonstiges: "diverse",
};

export const SLUG_TO_CATEGORY: Record<string, string> = Object.entries(
  CATEGORY_SLUGS,
).reduce(
  (acc, [category, slug]) => {
    acc[slug] = category;
    return acc;
  },
  {} as Record<string, string>,
);

export const ALL_CATEGORY_SLUGS = Object.values(CATEGORY_SLUGS);
