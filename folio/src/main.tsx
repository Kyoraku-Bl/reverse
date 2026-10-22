import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/jetbrains-mono/500.css";
import App from "./App";
import { StoreProvider } from "./lib/store";
import { Toasts } from "./components/Ui";
import "./styles.css";

class Boundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error) {
      return <pre style={{ color: "#ffb4c0", padding: 24, whiteSpace: "pre-wrap" }}>{this.state.error}</pre>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <Boundary>
    <StoreProvider>
      <HashRouter>
        <App />
        <Toasts />
      </HashRouter>
    </StoreProvider>
  </Boundary>,
);
