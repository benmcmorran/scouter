import "./style.css";
import "leaflet/dist/leaflet.css";
import {
  getOverpassQLForTerm,
  getOverpassResults,
  presetSearchTerms,
} from "./openstreetmap";
import osmtogeojson from "osmtogeojson";
import leaflet from "leaflet";

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

const list: HTMLInputElement =
  document.querySelector<HTMLInputElement>("#known-presets")!;

for (const term of presetSearchTerms) {
  const option: HTMLOptionElement = document.createElement("option");
  option.value = term;
  list.appendChild(option);
}

const search: HTMLInputElement =
  document.querySelector<HTMLInputElement>("#search")!;
const run: HTMLButtonElement =
  document.querySelector<HTMLButtonElement>("#run")!;

const layer: leaflet.GeoJSON = leaflet.geoJSON();
layer.addTo(map);

run.addEventListener("click", async () => {
  const bounds = map.getBounds();
  const query = getOverpassQLForTerm(
    search.value,
    `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`,
  );
  if (query === undefined) return;

  const osmResults: unknown = await getOverpassResults(query);
  const geojson = osmtogeojson(osmResults);

  layer.clearLayers();
  layer.addData(geojson);
});
