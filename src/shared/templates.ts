// Hand-drawn guys. Randomize falls back to one if it ever can't build a good guy,
// and the first one stands on the home page's share image.

const rows = (r: string[]) => r.join("");

export const HAND_DRAWN: string[] = [
	rows(["............", "....pppp....", "...plpppp...", "..plpppppp..", "..ppkppkpp..", "..ppkppkpp..", "..pppppppp..", "..pppkkppp..", "..pppppppp..", "...pppppp...", "...dd..dd...", "............"]),
	rows(["......l.....", "......d.....", "....pppp....", "...pppppp...", "..pppppppp..", "..pkkppkkp..", "..pppppppp..", "..pppppppp..", "..pppllppp..", "...pppppp...", "...d....d...", "...d....d..."]),
	rows(["............", "............", "............", "...pppppp...", ".pppppppppp.", ".pppppppppp.", ".ppkkppkkpp.", ".pppppppppp.", ".ppppkkpppp.", ".pppppppppp.", "..dd....dd..", "............"]),
	rows([".....ll.....", ".....ll.....", "....llll....", "....pppp....", "...pppppp...", "..ppkppkpp..", "..pppppppp..", "..pppkkppp..", "..pppppppp..", "...pppppp...", "...dd..dd...", "............"]),
	rows(["............", "....dddd....", "...dddddd...", "..dddddddd..", "..kkkkkkkk..", "..dkkddkkd..", "..dddddddd..", "..ddlllldd..", "..ddlllldd..", "...dddddd...", "...pp..pp...", "............"]),
	rows(["............", "............", "............", "............", "............", "....pppp....", "...pppppp...", "...pkppkp...", "...pppppp...", "...pppppp...", "....d..d....", "............"]),
	rows(["............", "....llll....", "...llllll...", "..llllllll..", "..llkllkll..", "..llllllll..", "..lllddlll..", "..lllddlll..", "..llllllll..", "..llllllll..", "..ll.ll.ll..", "............"]),
	rows(["............", "....pppp....", "d..pppppp..d", "d.pppppppp.d", ".dppkppkppd.", "..pppppppp..", "..ppkkkkpp..", "..pppppppp..", "..pppppppp..", "...pppppp...", "...dd..dd...", "............"]),
];
