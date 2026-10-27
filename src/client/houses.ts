// A row of simple houses behind the street, so it reads as a neighborhood.
export function drawHouses(container: HTMLElement, width: number) {
	let seed = 7;
	const rand = () => {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};
	const height = 150;
	let svg = "";
	for (let x = -20 + rand() * 30; x < width; ) {
		const w = 64 + rand() * 56;
		const h = 46 + rand() * 62;
		const top = height - h;
		const roof = rand() < 0.7 ? 18 + rand() * 14 : 0;
		svg += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" class="house"/>`;
		if (roof) svg += `<path d="M${(x - 6).toFixed(1)} ${top.toFixed(1)} L${(x + w / 2).toFixed(1)} ${(top - roof).toFixed(1)} L${(x + w + 6).toFixed(1)} ${top.toFixed(1)} Z" class="house"/>`;
		const windows = w > 90 ? 2 : 1;
		for (let i = 0; i < windows; i++) {
			const wx = x + (w / (windows + 1)) * (i + 1) - 7;
			svg += `<rect x="${wx.toFixed(1)}" y="${(top + 14).toFixed(1)}" width="14" height="14" rx="2" class="window"/>`;
		}
		if (rand() < 0.5) svg += `<rect x="${(x + w - 24).toFixed(1)}" y="${(height - 26).toFixed(1)}" width="14" height="26" rx="3" class="window"/>`;
		x += w + 10 + rand() * 40;
	}
	container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">${svg}</svg>`;
}
