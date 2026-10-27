// Writes public/og.png, the share image for the home page: a founding friend on the street.
import { FOUNDING_FRIENDS } from "../src/shared/templates";
import { renderCard } from "../src/worker/png";

await Bun.write("public/og.png", await renderCard(FOUNDING_FRIENDS[0]!));
console.log("wrote public/og.png");
