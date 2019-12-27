
import { h, render } from "preact";
import { App } from "./app";

(window as any).h = h;

render(<App />, document.body, document.getElementById("app") || undefined);