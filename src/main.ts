import "./style.css";
import typescriptLogo from "./typescript.svg";
import viteLogo from "/vite.svg";
import { setupCounter } from "./counter.ts";
import { getOverpassQLForTerm } from "./openstreetmap";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
      <input type="text" id="search"></input>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
    <pre class="output" style="text-align: left;"></pre>
  </div>
`;

setupCounter(document.querySelector<HTMLButtonElement>("#counter")!);

const search: HTMLInputElement =
  document.querySelector<HTMLInputElement>("#search")!;
search?.addEventListener("input", () => {
  document.querySelector(".output")!.innerHTML =
    getOverpassQLForTerm(
      search.value,
      "47.489939,-122.445140,47.735581,-121.992185",
    ) ?? "unknown search term";
});
