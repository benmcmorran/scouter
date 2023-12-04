import presets from "@openstreetmap/id-tagging-schema/dist/presets.min.json";
import en from "@openstreetmap/id-tagging-schema/dist/translations/en.min.json";

// Based on schema at https://github.com/ideditor/schema-builder/blob/main/schemas/preset.json
interface IPreset {
  geometry: ("point" | "vertex" | "line" | "area" | "relation")[];
  tags: { [key: string]: string };
  searchable?: boolean;
  matchScore?: number;
}

interface IPresetTermIndex {
  [term: string]: IPreset[] | undefined;
}

function buildIndex(): IPresetTermIndex {
  const result: IPresetTermIndex = {};
  const translations = en.en.presets.presets;

  for (const name in translations) {
    if (Object.prototype.hasOwnProperty.call(translations, name)) {
      const preset = (presets as { [key: string]: IPreset })[name];
      if (!preset || preset.searchable === false) continue;

      const translation = (
        translations as { [key: string]: { name?: string; terms?: string } }
      )[name];

      if (!translation.name) continue;

      const terms: string[] = [translation.name.toLowerCase().trim()];
      if (translation.terms) {
        terms.push(
          ...translation.terms
            .split(",")
            .map((term) => term.toLowerCase().trim()),
        );
      }

      for (const term of terms) {
        const entries = result[term] ?? [];

        // We only keep entries with the highest matchScore (explicit or
        // implied), so we only need to check the first entry to see if this
        // preset should be added.
        const currentMatchScore = entries[0]?.matchScore ?? 1.0;
        const newMatchScore = preset.matchScore ?? 1.0;
        if (currentMatchScore <= newMatchScore) {
          // Check if this is a better match than anything seen so far.
          if (currentMatchScore < newMatchScore) entries.length = 0;
          entries.push(preset);
        }

        result[term] = entries;
      }
    }
  }

  return result;
}

const index: IPresetTermIndex = buildIndex();

export const presetSearchTerms: string[] = Object.keys(index);

// See https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#Escaping
export function escapeForOverpassQL(content: string): string {
  return content.replace(/[\n\t"'\\]/g, (match: string) => {
    switch (match) {
      case "\n":
        return "\\\n";
      case "\t":
        return "\\\t";
      case '"':
        return '\\"';
      case "'":
        return "\\'";
      case "\\":
        return "\\\\";
      default:
        throw new Error(
          `Unexpected character "${match}" when escaping for OverpassQL.`,
        );
    }
  });
}

type OverpassQLTypeSpecifier = "node" | "way" | "relation" | "area";

// See OverpassQL documentation at https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
function getOverpassQLForPreset(preset: IPreset): string {
  const types: OverpassQLTypeSpecifier[] = Array.from(
    new Set<OverpassQLTypeSpecifier>(
      preset.geometry.flatMap((type) => {
        switch (type) {
          case "point":
          case "vertex":
            return ["node"];
          case "line":
            return ["way"];
          case "area":
            return ["way", "relation"];
          case "relation":
            return ["relation"];
        }
      }),
    ),
  );

  const conditions = Object.entries(preset.tags)
    .map((entry) => {
      const [name, value] = entry;
      const escapedName = escapeForOverpassQL(name);
      if (value === "*") return `["${escapedName}"]`;
      else return `["${escapedName}"="${escapeForOverpassQL(value)}"]`;
    })
    .join("");

  return types.map((type) => `${type}${conditions};`).join("\n");
}

// See OverpassQL documentation at https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
// TODO: bbox to GeoJSON type
export function getOverpassQLForTerm(
  term: string,
  bbox: string,
): string | undefined {
  const presets = index[term];
  if (!presets) return undefined;

  return `[bbox:${bbox}][out:json];
(
${presets.map(getOverpassQLForPreset).join("\n")}
);
out geom;`;
}

export async function getOverpassResults(query: string): Promise<unknown> {
  return await (
    await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
    })
  ).json();
}
