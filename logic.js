// 川麻核心算法：听牌分析、番型计算
// 牌编码：'1m'-'9m'（万），'1p'-'9p'（饼），'1s'-'9s'（条）

const SUITS = ['m', 'p', 's'];
const SUIT_NAMES = { m: '万', p: '饼', s: '条' };

function getSuit(tile) { return tile[tile.length - 1]; }
function getVal(tile) { return parseInt(tile); }

function tileNum(tile) {
    return SUITS.indexOf(getSuit(tile)) * 9 + getVal(tile) - 1;
}

function sortTiles(tiles) {
    return [...tiles].sort((a, b) => tileNum(a) - tileNum(b));
}

// ---- 胡牌判断 ----

function canFormMelds(sorted) {
    if (sorted.length === 0) return true;
    const first = sorted[0];
    const suit = getSuit(first);
    const val = getVal(first);

    // 先试刻子
    if (sorted.length >= 3 && sorted[1] === first && sorted[2] === first) {
        if (canFormMelds(sorted.slice(3))) return true;
    }
    // 再试顺子
    if (val <= 7) {
        const t2 = (val + 1) + suit;
        const t3 = (val + 2) + suit;
        const arr = [...sorted];
        arr.splice(0, 1);
        const i2 = arr.indexOf(t2);
        if (i2 !== -1) {
            arr.splice(i2, 1);
            const i3 = arr.indexOf(t3);
            if (i3 !== -1) {
                arr.splice(i3, 1);
                if (canFormMelds(arr)) return true;
            }
        }
    }
    return false;
}

function checkSevenPairs(sorted) {
    if (sorted.length !== 14) return false;
    const counts = {};
    for (const t of sorted) counts[t] = (counts[t] || 0) + 1;
    const vals = Object.values(counts);
    if (vals.every(v => v === 2) && vals.length === 7) return 'qidui';
    const pairs = vals.reduce((s, v) => {
        if (v !== 2 && v !== 4) return -999;
        return s + v / 2;
    }, 0);
    if (pairs === 7) return 'longqidui';
    return false;
}

function canWinStandard(sorted, meldsNeeded) {
    if (sorted.length !== meldsNeeded * 3 + 2) return false;
    const tried = new Set();
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i] === sorted[i + 1] && !tried.has(sorted[i])) {
            tried.add(sorted[i]);
            const rest = [...sorted];
            rest.splice(i, 2);
            if (canFormMelds(rest)) return true;
        }
    }
    return false;
}

function isWinningHand(concealedTiles, melds) {
    const sorted = sortTiles(concealedTiles);
    const meldsNeeded = 4 - melds.length;

    if (melds.length === 0 && sorted.length === 14) {
        if (checkSevenPairs(sorted)) return true;
    }
    return canWinStandard(sorted, meldsNeeded);
}

// ---- 提取手牌结构（用于番型判断）----

function extractMelds(sorted, count) {
    if (sorted.length === 0 && count === 0) return [];
    if (sorted.length === 0 || count === 0) return null;
    const first = sorted[0];
    const suit = getSuit(first);
    const val = getVal(first);
    if (sorted.length >= 3 && sorted[1] === first && sorted[2] === first) {
        const res = extractMelds(sorted.slice(3), count - 1);
        if (res !== null) return [{ type: 'triplet' }, ...res];
    }
    if (val <= 7) {
        const t2 = (val + 1) + suit;
        const t3 = (val + 2) + suit;
        const arr = [...sorted];
        arr.splice(0, 1);
        const i2 = arr.indexOf(t2);
        if (i2 !== -1) {
            arr.splice(i2, 1);
            const i3 = arr.indexOf(t3);
            if (i3 !== -1) {
                arr.splice(i3, 1);
                const res = extractMelds(arr, count - 1);
                if (res !== null) return [{ type: 'sequence' }, ...res];
            }
        }
    }
    return null;
}

function extractStructure(sorted, meldsNeeded) {
    const tried = new Set();
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i] === sorted[i + 1] && !tried.has(sorted[i])) {
            tried.add(sorted[i]);
            const rest = [...sorted];
            rest.splice(i, 2);
            const meldList = extractMelds(rest, meldsNeeded);
            if (meldList !== null) return { pair: sorted[i], melds: meldList };
        }
    }
    return null;
}

// ---- 番型计算 ----

function getFanTypes(concealedTiles, melds, extraCtx) {
    const fans = [];
    const allTiles = [...concealedTiles, ...melds.flatMap(m => m.tiles)];
    const sorted = sortTiles(concealedTiles);
    const meldsNeeded = 4 - melds.length;
    const suits = new Set(allTiles.map(getSuit));
    const isQingYiSe = suits.size === 1;

    if (melds.length === 0) {
        const qd = checkSevenPairs(sorted);
        if (qd) {
            fans.push(qd === 'longqidui'
                ? { name: '龙七对', fan: 8 }
                : { name: '七对', fan: 4 });
            if (isQingYiSe) fans.push({ name: '清一色', fan: 4 });
            return applyExtra(fans, extraCtx);
        }
    }

    const struct = extractStructure(sorted, meldsNeeded);
    if (!struct) return applyExtra([{ name: '平胡', fan: 1 }], extraCtx);

    const allMeldTypes = [
        ...struct.melds,
        ...melds.map(m => ({ type: (m.type === 'kong_open' || m.type === 'kong_closed') ? 'triplet' : m.type }))
    ];
    const isDuiDui = allMeldTypes.every(m => m.type === 'triplet');

    if (isQingYiSe && isDuiDui) {
        fans.push({ name: '清对', fan: 16 });
    } else if (isQingYiSe) {
        fans.push({ name: '清一色', fan: 4 });
    } else if (isDuiDui) {
        fans.push({ name: '对对胡', fan: 2 });
    } else {
        fans.push({ name: '平胡', fan: 1 });
    }

    return applyExtra(fans, extraCtx);
}

function applyExtra(fans, ctx) {
    if (!ctx) return fans;
    if (ctx.gangShang) fans.push({ name: '杠上花', fan: 1 });
    if (ctx.haiDi) fans.push({ name: '海底捞月', fan: 1 });
    if (ctx.qiangGang) fans.push({ name: '抢杠胡', fan: 1 });
    return fans;
}

function totalFan(fans) {
    return fans.reduce((s, f) => s + f.fan, 0);
}

// ---- 听牌分析（主入口）----
// handTiles: 暗手牌（13 - 副露面子数×3 张，杠再-1）
// melds: 副露 [{ type: 'pong'|'kong_open'|'kong_closed', tiles: [...] }]
// queMen: 缺门 suit ('m'|'p'|'s'|null)
function analyzeTenpai(handTiles, melds, queMen) {
    const kongCount = melds.filter(m => m.type === 'kong_open' || m.type === 'kong_closed').length;
    const expected = 13 - melds.length * 3 - kongCount;

    if (handTiles.length !== expected) {
        return { error: `手牌张数应为 ${expected} 张，当前 ${handTiles.length} 张` };
    }

    const results = [];
    const triedDiscard = new Set();

    for (let i = 0; i < handTiles.length; i++) {
        const discard = handTiles[i];
        if (triedDiscard.has(discard)) continue;
        triedDiscard.add(discard);

        const remaining = [...handTiles];
        remaining.splice(i, 1);

        const winTiles = [];
        for (const suit of SUITS) {
            if (queMen && suit === queMen) continue;
            for (let val = 1; val <= 9; val++) {
                const candidate = val + suit;
                const testHand = [...remaining, candidate];
                if (isWinningHand(testHand, melds)) {
                    winTiles.push(candidate);
                }
            }
        }

        if (winTiles.length > 0) {
            const sampleHand = [...remaining, winTiles[0]];
            const fans = getFanTypes(sampleHand, melds, null);
            results.push({
                discard,
                winTiles,
                fans,
                total: totalFan(fans),
            });
        }
    }

    results.sort((a, b) => b.total - a.total || b.winTiles.length - a.winTiles.length);
    return { results };
}
