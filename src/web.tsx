
import { h, render } from "preact";
import { App } from "./app";

render(<App />, document.body, document.getElementById("app") || undefined);