import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/design-system.css";
import "./styles/shell.css";
import "./styles/skeleton.css";
import "./styles/search.css";
import "./styles/toast.css";
import "./styles/context-menu.css";
import "./styles/welcome.css";
import "./styles/splash.css";
import "./styles/tooltip.css";
import "./styles/image-compare.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
