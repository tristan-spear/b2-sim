import { GameManager } from "./game/GameManager";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/barlow-condensed/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./style.css";
import "./hud/campaign.css";

function showError(message: string) {
  const panel = document.createElement("div");
  panel.className = "error-screen";
  const title = document.createElement("h1");
  title.textContent = "A clear sky needs WebGL 2.";
  const text = document.createElement("p");
  text.textContent = message;
  const retry = document.createElement("button");
  retry.textContent = "Try again";
  retry.onclick = () => location.reload();
  panel.append(title, text, retry);
  document.body.append(panel);
}
try {
  new GameManager();
} catch (error) {
  console.error(error);
  showError(
    "The simulator could not start. Try a current browser with hardware acceleration enabled.",
  );
}
