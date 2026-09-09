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

for (const duplicate of duplicates(GLOSSARY.map((entry) => entry.slug))) {
  errors.push(`Duplicate glossary slug: ${duplicate}`);
}

for (const duplicate of duplicates(Object.keys(ARTICLES))) {
  errors.push(`Duplicate article slug: ${duplicate}`);
}

for (const entry of GLOSSARY) {
  for (const relatedSlug of entry.relatedTerms ?? []) {
    if (!glossarySlugs.has(relatedSlug)) {
      errors.push(`${entry.slug}.relatedTerms -> missing glossary slug: ${relatedSlug}`);
    }
  }
  for (const relatedSlug of entry.relatedArticles ?? []) {
    if (!articleSlugs.has(relatedSlug)) {
      errors.push(`${entry.slug}.relatedArticles -> missing article slug: ${relatedSlug}`);
    }
  }
  for (const category of entry.relatedCategories ?? []) {
    if (!categoryKeys.has(category)) {
      errors.push(`${entry.slug}.relatedCategories -> missing category: ${category}`);
    }
  }
}

for (const article of Object.values(ARTICLES)) {
  for (const relatedSlug of article.relatedArticles ?? []) {
    if (!articleSlugs.has(relatedSlug)) {
      errors.push(`${article.slug}.relatedArticles -> missing article slug: ${relatedSlug}`);
    }
  }
  for (const relatedSlug of article.relatedGlossaryTerms ?? []) {
    if (!glossarySlugs.has(relatedSlug)) {
      errors.push(`${article.slug}.relatedGlossaryTerms -> missing glossary slug: ${relatedSlug}`);
    }
  }
  for (const category of article.relatedCategories) {
    if (!categoryKeys.has(category)) {
      errors.push(`${article.slug}.relatedCategories -> missing category: ${category}`);
    }
  }
}

const vobA = GLOSSARY_MAP["vob-a"];
const requiredVobLinks = [
  "vob-b",
  "vob-c",
  "vob-a-eu",
  "schwellenwerte",
  "auftragswert",
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

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Content graph valid: ${GLOSSARY.length} glossary entries, ${articleSlugs.size} articles.`);
}
