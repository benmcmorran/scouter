import "./style.css";
import "leaflet/dist/leaflet.css";
import {
  getOverpassQLForTerm,
  getOverpassResults,
  presetSearchTerms,
} from "./openstreetmap";
import osmtogeojson from "osmtogeojson";
import leaflet from "leaflet";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// @ts-ignore
import * as turf from "@turf/turf";

// TypeScript complains that type declaration files cannot be imported, but
// we're actually trying to get the content of the type declaration file as a
// string to later pass to Monaco.
// @ts-ignore
import geoJsonTypes from "@types/geojson/index.d.ts?raw";
// TODO: Bring in types for turf. This will be trickier because as shipped to
// npm, the types declarations are split across many files.

const mapElement: HTMLDivElement = document.querySelector("#map")!;
const map: leaflet.Map = leaflet.map(mapElement, {
  center: [47.6061, -122.3328],
  zoom: 13,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const observer: ResizeObserver = new ResizeObserver(() => {
  map.invalidateSize();
});
observer.observe(mapElement);

self.MonacoEnvironment = {
  getWorker(_, label: string) {
    if (label === "typescript" || label === "javascript") return new tsWorker();
    else return new editorWorker();
  },
};

monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
});

monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ES2015,
  allowJs: true,
  checkJs: true,
  allowNonTsExtensions: true,
});

monaco.languages.typescript.javascriptDefaults.addExtraLib(
  geoJsonTypes,
  "@types/geojson/index.d.ts",
);
monaco.languages.typescript.javascriptDefaults.addExtraLib(
  `declare type SearchTerm = ${presetSearchTerms
    .map((term) => `"${term}"`)
    .join(" | ")};

/**
* Searches OpenStreetMap for entries within currently visible map area that
* match the query.
* @param query The type of entry to search for. Must be a known preset type or
* associated term.
*/
declare async function search(query: SearchTerm): Promise<GeoJSON.FeatureCollection<GeoJSON.GeometryObject>>;

declare var turf: any;`,
  "api.d.ts",
);

const editorElement: HTMLDivElement = document.querySelector("#code")!;
const editor: monaco.editor.IStandaloneCodeEditor = monaco.editor.create(
  editorElement,
  {
    value: `/** @type {() => Promise<GeoJSON.GeoJSON>} */
async function run() {
// This is where you write a script to compute what to display on the map. You
// can use any JavaScript syntax that is supported by your browser.

// There are a few built-in functions available to help you out. You can call
// search() with a search term to find all the matching features in the
// currently visible map area. For example, this finds light rail stations.
const stations = await search("light rail station");

// Let's also find all the grocery stores on the map. You can get a list of all
// supported search terms by placing the caret after the "(" in "search(" and
// typing CTRL + SPACE to display autocomplete suggestions.
const groceries = await search("grocery store");

// You can define functions to make the script more readable. Here, we compute
// the area that's within an easy half-mile walking distance.
function walkableArea(data) {
    // The turf library is available to manipulate features. Unfortunately,
    // there's currently no autocomplete available in this editor for turf
    // (coming soon!), but for now you can read the docs online:
    // https://turfjs.org/docs
    const walkRanges = turf.buffer(data, .5, { units: 'miles' }).features;
    return walkRanges.reduce((a, b) => turf.union(a, b), walkRanges[0]);
}

// Let's find everywhere that's walkable to light rail stations or grocery
// stores, then intersect them to find areas that are walkable to both. These
// might be good places to live.
const lightRailWalkableArea = walkableArea(stations);
const groceriesWalkableArea = walkableArea(groceries);
const bothWalkableArea = turf.intersect(
    lightRailWalkableArea,
    groceriesWalkableArea);

// Finally, the script needs to return what should be displayed on the map.
return bothWalkableArea;
}`,
    language: "javascript",
    theme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "vs-dark"
      : "vs-light",
    minimap: { enabled: false },
    automaticLayout: true,
  },
);

// Undocumented API. See https://github.com/microsoft/monaco-editor/issues/45#issuecomment-1329509263
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(editor as any).setHiddenAreas([
  new monaco.Range(1, 0, 2, 0),
  new monaco.Range(38, 0, 38, 0),
]);

const run: HTMLButtonElement =
  document.querySelector<HTMLButtonElement>("#run")!;

const layer: leaflet.GeoJSON = leaflet.geoJSON();
layer.addTo(map);

run.addEventListener("click", async () => {
  const bounds = map.getBounds();
  const boundsString = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).search = async (term: string) => {
    const query = getOverpassQLForTerm(term, boundsString);

    // TODO: better error handling
    if (query === undefined) return;

    const response = await getOverpassResults(query);
    return osmtogeojson(response);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).turf = turf;

  try {
    const model: monaco.editor.ITextModel = editor.getModel()!;
    const code: string = model.getValueInRange(
      new monaco.Range(3, 0, model.getLineCount(), 0),
    );

    // eslint-disable-next-line no-new-func, @typescript-eslint/ban-types
    const action: Function = new Function(
      `return (async () => { ${code} })();`,
    );
    const result = await action();
    layer.clearLayers();
    layer.addData(result);
  } catch (error) {
    // TODO: better logging
    console.error(error);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).search = undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).turf = turf;
});
