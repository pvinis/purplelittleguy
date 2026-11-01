// Picks the theme before the page paints: dark when the system is dark, or when Dark Reader is on.
// Dark Reader can't tell that this page has a dark theme of its own, so when it shows up, the page
// switches to that theme and adds a darkreader-lock, which makes Dark Reader take its styles back off.
// Loaded as a plain blocking script in <head>, not a module, so it runs before anything is drawn.

const root = document.documentElement;
const system = matchMedia("(prefers-color-scheme: dark)");
let darkReader = false;

const apply = () => {
	root.dataset.theme = darkReader || system.matches ? "dark" : "light";
};
apply();
system.addEventListener("change", apply);

// Dark Reader announces itself with a meta tag in <head> and an attribute on <html>.
const spotted = () => document.querySelector('meta[name="darkreader"]') !== null || root.hasAttribute("data-darkreader-mode");
const watch = new MutationObserver(() => {
	if (spotted()) lock();
});

function lock() {
	watch.disconnect();
	darkReader = true;
	apply();
	const meta = document.createElement("meta");
	meta.name = "darkreader-lock";
	document.head.append(meta);
}

if (spotted()) lock();
else {
	watch.observe(document.head, { childList: true });
	watch.observe(root, { attributes: true, attributeFilter: ["data-darkreader-mode"] });
}
