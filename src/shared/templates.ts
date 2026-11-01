// The founding friends: hand-drawn guys who keep the street from looking empty
// before visitors have moved in.

const rows = (r: string[]) => r.join("");

export const FOUNDING_FRIENDS: string[] = [
	rows(["............", "....pppp....", "...plpppp...", "..plpppppp..", "..ppkppkpp..", "..ppkppkpp..", "..pppppppp..", "..pppkkppp..", "..pppppppp..", "...pppppp...", "...dd..dd...", "............"]),
	rows(["......l.....", "......d.....", "....pppp....", "...pppppp...", "..pppppppp..", "..pkkppkkp..", "..pppppppp..", "..pppppppp..", "..pppllppp..", "...pppppp...", "...d....d...", "...d....d..."]),
	rows(["............", "............", "............", "...pppppp...", ".pppppppppp.", ".pppppppppp.", ".ppkkppkkpp.", ".pppppppppp.", ".ppppkkpppp.", ".pppppppppp.", "..dd....dd..", "............"]),
	rows([".....ll.....", ".....ll.....", "....llll....", "....pppp....", "...pppppp...", "..ppkppkpp..", "..pppppppp..", "..pppkkppp..", "..pppppppp..", "...pppppp...", "...dd..dd...", "............"]),
	rows(["............", "....dddd....", "...dddddd...", "..dddddddd..", "..kkkkkkkk..", "..dkkddkkd..", "..dddddddd..", "..ddlllldd..", "..ddlllldd..", "...dddddd...", "...pp..pp...", "............"]),
	rows(["............", "............", "............", "............", "............", "....pppp....", "...pppppp...", "...pkppkp...", "...pppppp...", "...pppppp...", "....d..d....", "............"]),
	rows(["............", "....llll....", "...llllll...", "..llllllll..", "..llkllkll..", "..llllllll..", "..lllddlll..", "..lllddlll..", "..llllllll..", "..llllllll..", "..ll.ll.ll..", "............"]),
	rows(["............", "....pppp....", "d..pppppp..d", "d.pppppppp.d", ".dppkppkppd.", "..pppppppp..", "..ppkkkkpp..", "..pppppppp..", "..pppppppp..", "...pppppp...", "...dd..dd...", "............"]),
	rows(["............", "..d......d..", "..pp....pp..", "..pppppppp..", ".pppppppppp.", ".ppkppppkpp.", ".pppppppppp.", ".lpppkkpppl.", ".pppppppppp.", "..pppppppp..", "..dd....dd..", "............"]),
	rows(["............", "............", "....llll....", "...llllll...", "..llllllll..", "..lddllddl..", "pllllllllllp", "..llllllll..", "..lllpplll..", "...llllll...", "...pp..pp...", "............"]),
];

// The street always has at least this many guys. Founding friends fill the gap,
// one fewer for every visitor's guy, until there are enough of those.
export const STREET_MINIMUM = 10;
export const foundingWanted = (visitorGuys: number) => Math.max(0, Math.min(FOUNDING_FRIENDS.length, STREET_MINIMUM - visitorGuys));
