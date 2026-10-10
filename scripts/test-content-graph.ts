import { ARTICLES } from "../lib/articles";
import { CATEGORY_LABELS } from "../lib/categories";
import { GLOSSARY, GLOSSARY_MAP } from "../lib/glossary";

const errors: string[] = [];
const articleSlugs = new Set(Object.keys(ARTICLES));
const glossarySlugs = new Set(GLOSSARY.map((entry) => entry.slug));
const categoryKeys = new Set(Object.keys(CATEGORY_LABELS));

function duplicates(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function checkLinks(owner: string, links: string[] | undefined, known: Set<string>, kind: string) {
  if (!links) return;
  for (const duplicate of duplicates(links)) {
    errors.push(`${owner}.${kind} -> duplicate slug: ${duplicate}`);
  }
  for (const slug of links) {
    if (slug === owner) errors.push(`${owner}.${kind} -> self-link: ${slug}`);
    if (!known.has(slug)) errors.push(`${owner}.${kind} -> missing slug: ${slug}`);
  }
}

function checkDate(owner: string, field: string, value: string | undefined) {
  if (value === undefined) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.push(`${owner}.${field} -> invalid ISO date: ${value}`);
  }
}

function checkSources(owner: string, sources: Array<{ title: string; url: string }> | undefined) {
  if (!sources) return;
  for (const duplicate of duplicates(sources.map((source) => source.url))) {
    errors.push(`${owner}.sources -> duplicate URL: ${duplicate}`);
  }
  for (const source of sources) {
    if (!source.title.trim()) errors.push(`${owner}.sources -> empty title`);
    if (!/^https:\/\//.test(source.url)) {
      errors.push(`${owner}.sources -> non-HTTPS URL: ${source.url}`);
    }
  }
}

for (const duplicate of duplicates(GLOSSARY.map((entry) => entry.slug))) {
  errors.push(`Duplicate glossary slug: ${duplicate}`);
}

for (const duplicate of duplicates(Object.keys(ARTICLES))) {
  errors.push(`Duplicate article slug: ${duplicate}`);
}

for (const entry of GLOSSARY) {
  checkLinks(entry.slug, entry.relatedTerms, glossarySlugs, "relatedTerms");
  checkLinks(entry.slug, entry.relatedArticles, articleSlugs, "relatedArticles");
  for (const category of entry.relatedCategories ?? []) {
    if (!categoryKeys.has(category)) {
      errors.push(`${entry.slug}.relatedCategories -> missing category: ${category}`);
    }
  }
  checkSources(entry.slug, entry.sources);
  checkDate(entry.slug, "lastReviewed", entry.lastReviewed);
}

for (const article of Object.values(ARTICLES)) {
  checkLinks(article.slug, article.relatedArticles, articleSlugs, "relatedArticles");
  checkLinks(article.slug, article.relatedGlossaryTerms, glossarySlugs, "relatedGlossaryTerms");
  for (const category of article.relatedCategories) {
    if (!categoryKeys.has(category)) {
      errors.push(`${article.slug}.relatedCategories -> missing category: ${category}`);
    }
  }
  checkSources(article.slug, article.sources);
  checkDate(article.slug, "datePublished", article.datePublished);
  checkDate(article.slug, "dateModified", article.dateModified);
  checkDate(article.slug, "lastReviewed", article.lastReviewed);
  if (article.dateModified < article.datePublished) {
    errors.push(`${article.slug}.dateModified -> predates datePublished`);
  }
}

const vobA = GLOSSARY_MAP["vob-a"];
const requiredVobSpellings = [
  ["vob-a", "VOB A"],
  ["vob-a-eu", "VOB A EU"],
  ["vob-a-eu", "EU VOB/A"],
  ["vob-a-eu", "EU-VOB/A"],
  ["vob-a-eu", "VOB Teil A EU"],
] as const;
for (const [slug, spelling] of requiredVobSpellings) {
  if (!GLOSSARY_MAP[slug]?.definition.join(" ").includes(spelling)) {
    errors.push(`${slug}.definition -> missing spelling variant: ${spelling}`);
  }
}

const requiredVobLinks = [
  "vob-b",
  "vob-c",
  "vob-a-eu",
  "schwellenwerte",
  "auftragswert",
  "losvergabe",
  "leistungsbeschreibung",
  "leistungsverzeichnis",
  "vgv-vergabeverordnung",
  "gwb-vergaberecht",
];
for (const slug of requiredVobLinks) {
  if (!vobA?.relatedTerms?.includes(slug)) {
    errors.push(`vob-a.relatedTerms -> required cluster link missing: ${slug}`);
  }
}

if (!ARTICLES["vob-vergabe"]?.relatedGlossaryTerms?.includes("vob-a-eu")) {
  errors.push("vob-vergabe.relatedGlossaryTerms -> missing vob-a-eu");
}
if (!ARTICLES["vob-vergabe"]?.relatedGlossaryTerms?.includes("losvergabe")) {
  errors.push("vob-vergabe.relatedGlossaryTerms -> missing losvergabe");
}
if (!GLOSSARY_MAP["losvergabe"]?.relatedArticles?.includes("vob-vergabe")) {
  errors.push("losvergabe.relatedArticles -> missing vob-vergabe");
}

if (!GLOSSARY_MAP["vob-a"]?.sources?.some((source) => source.title.includes("Änderung vom 22. Juli 2026") && source.title.includes("BAnz AT 24.08.2026 B6"))) {
  errors.push("vob-a.sources -> missing accurately dated 2026 Bundesanzeiger reference");
}

if (GLOSSARY_MAP["schwellenwerte"]?.shortDefinition.includes("EU-weite Vergabeverfahren")) {
  errors.push("schwellenwerte.shortDefinition -> uses an unqualified EU-wide claim");
}

for (const slug of ["vob-b", "vob-c", "vob-a-eu"]) {
  if (!GLOSSARY_MAP[slug]?.relatedTerms?.includes("vob-a")) {
    errors.push(`${slug}.relatedTerms -> missing reciprocal vob-a link`);
  }
}

for (const [slug, target] of [["vob-b", "nachunternehmer"], ["nachunternehmer", "vob-b"], ["auftragswert", "vob-a"]]) {
  if (!GLOSSARY_MAP[slug]?.relatedTerms?.includes(target)) {
    errors.push(`${slug}.relatedTerms -> missing relevant cluster link: ${target}`);
  }
}

for (const slug of ["vergabeverfahren-uebersicht", "eu-vergabe", "schwellenwerte-vergabe"]) {
  if (!ARTICLES[slug]?.sources?.some((source) => source.url.includes("BAnz%20AT%2018.12.2025%20B4"))) {
    errors.push(`${slug}.sources -> missing primary 2026 threshold reference`);
  }
  if (!ARTICLES[slug]?.lastReviewed) errors.push(`${slug}.lastReviewed -> missing review date`);
}

for (const slug of ["vergabeverfahren-uebersicht", "eu-vergabe"]) {
  const content = ARTICLES[slug]?.content ?? "";
  for (const value of ["140.000 €", "216.000 €", "5.404.000 €"]) {
    if (!content.includes(value)) errors.push(`${slug}.content -> missing 2026/2027 threshold ${value}`);
  }
}

for (const slug of ["schwellenwerte", "auftragswert"]) {
  if (!GLOSSARY_MAP[slug]?.relatedTerms?.includes("vob-a-eu")) {
    errors.push(`${slug}.relatedTerms -> missing VOB/A EU threshold link`);
  }
}

if (!ARTICLES["schwellenwerte-vergabe"]?.relatedArticles?.includes("vob-vergabe")) {
  errors.push("schwellenwerte-vergabe.relatedArticles -> missing vob-vergabe");
}
if (!ARTICLES["vob-vergabe"]?.relatedArticles?.includes("schwellenwerte-vergabe")) {
  errors.push("vob-vergabe.relatedArticles -> missing schwellenwerte-vergabe");
}

const processCluster = ["e-vergabe", "vergabeunterlagen", "teilnahmewettbewerb"];
for (const slug of processCluster) {
  if (!GLOSSARY_MAP[slug]) errors.push(`process cluster -> missing glossary entry: ${slug}`);
  if (!GLOSSARY_MAP[slug]?.sources?.length) errors.push(`${slug}.sources -> missing primary source`);
}
if (!GLOSSARY_MAP["e-vergabe"]?.relatedTerms?.includes("vergabeunterlagen")) {
  errors.push("e-vergabe.relatedTerms -> missing vergabeunterlagen");
}
if (!GLOSSARY_MAP["vergabeunterlagen"]?.relatedTerms?.includes("e-vergabe")) {
  errors.push("vergabeunterlagen.relatedTerms -> missing e-vergabe");
}
if (!GLOSSARY_MAP["teilnahmewettbewerb"]?.relatedTerms?.includes("e-vergabe")) {
  errors.push("teilnahmewettbewerb.relatedTerms -> missing e-vergabe");
}
for (const slug of ["vergabeverfahren-uebersicht", "wie-funktioniert-ausschreibung", "ausschreibung-schreiben", "vergabeportal-vergleich"]) {
  if (!ARTICLES[slug]?.relatedGlossaryTerms?.some((term) => processCluster.includes(term))) {
    errors.push(`${slug}.relatedGlossaryTerms -> missing process cluster link`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Content graph valid: ${GLOSSARY.length} glossary entries, ${articleSlugs.size} articles.`);
}
