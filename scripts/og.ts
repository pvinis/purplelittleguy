// Writes public/og.png, the share image for the home page: a hand-drawn guy on the street.
import { HAND_DRAWN } from "../src/shared/templates";
import { renderCard } from "../src/worker/png";

await Bun.write("public/og.png", await renderCard(HAND_DRAWN[0]!));
console.log("wrote public/og.png");
