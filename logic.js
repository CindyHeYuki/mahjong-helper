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

// 七对/龙七对检测：手牌必须恰好14张
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

// 标准胡牌：concealed tiles 满足 meldsNeeded*3+2 张（即 4 面子+1 将）
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

// isWinningHand：14 张总牌力校验
// concealedTiles：暗手牌（应为 4-melds.length 组面子+1将所需张数）
// melds：副露列表
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

    // 七对 / 龙七对（副露时不可能）
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

    // 将所有面子（暗+副露）统一为 triplet/sequence 类型
    const isTripletMeld = (type) =>
        type === 'triplet' || type === 'pong' || type === 'kong_open' || type === 'kong_closed';
    const allMeldTypes = [
        ...struct.melds,
        ...melds.map(m => ({ type: isTripletMeld(m.type) ? 'triplet' : 'sequence' }))
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
// handTiles：暗手牌
//   正确张数 = 14 - 副露面子数×3 - 杠数（即摸牌后14张状态）
//   例：0副露→14张，1碰→11张，1明杠→10张，1暗杠→10张
// melds：副露 [{ type: 'pong'|'kong_open'|'kong_closed', tiles: [...] }]
// queMen：缺门 suit ('m'|'p'|'s'|null)
function analyzeTenpai(handTiles, melds, queMen) {
    const kongCount = melds.filter(m => m.type === 'kong_open' || m.type === 'kong_closed').length;
    // 正确期望张数：14 张完整手牌 - 副露占用的暗手张数
    const expected = 14 - melds.length * 3 - kongCount;

    if (handTiles.length !== expected) {
        return { error: `手牌张数应为 ${expected} 张（摸牌后），当前 ${handTiles.length} 张` };
    }

    const results = [];
    const triedDiscard = new Set();

    for (let i = 0; i < handTiles.length; i++) {
        const discard = handTiles[i];
        if (triedDiscard.has(discard)) continue;
        triedDiscard.add(discard);

        const remaining = [...handTiles];
        remaining.splice(i, 1);  // 打出后剩余 expected-1 张

        const winTiles = [];
        for (const suit of SUITS) {
            if (queMen && suit === queMen) continue;
            for (let val = 1; val <= 9; val++) {
                const candidate = val + suit;
                // 加上候选牌后变回 expected 张（完整胡牌张数）
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

// ---- 向听数计算 ----

function calcShanten(concealedTiles, melds) {
    if (!concealedTiles || concealedTiles.length === 0) return 8;
    const sorted = sortTiles(concealedTiles);
    const meldsNeeded = 4 - melds.length;
    let best = meldsNeeded * 2;
    if (melds.length === 0) best = Math.min(best, _shanten7Pairs(sorted));
    best = Math.min(best, _shantenStd(sorted, meldsNeeded));
    return best;
}

function _shanten7Pairs(sorted) {
    const cnt = {};
    for (const t of sorted) cnt[t] = (cnt[t] || 0) + 1;
    const pairs = Object.values(cnt).filter(v => v >= 2).length;
    return 6 - Math.min(pairs, 7);
}

function _shantenStd(sorted, meldsNeeded) {
    let best = [meldsNeeded * 2];

    function dfs(tiles, mentuLeft, taatsu, jantou) {
        const s = mentuLeft * 2 - taatsu - (jantou ? 1 : 0);
        if (s < best[0]) best[0] = s;
        if (tiles.length === 0 || best[0] <= -1) return;

        const t0 = tiles[0], suit = getSuit(t0), val = getVal(t0);

        // 刻子
        if (mentuLeft > 0 && tiles.length >= 3 && tiles[1] === t0 && tiles[2] === t0)
            dfs(tiles.slice(3), mentuLeft - 1, taatsu, jantou);

        // 顺子
        if (mentuLeft > 0 && val <= 7) {
            const t2 = (val+1)+suit, t3 = (val+2)+suit;
            const a = [...tiles.slice(1)], i2 = a.indexOf(t2);
            if (i2 !== -1) { a.splice(i2,1); const i3 = a.indexOf(t3);
                if (i3 !== -1) { a.splice(i3,1); dfs(a, mentuLeft-1, taatsu, jantou); } }
        }

        // 将牌对
        if (!jantou && tiles.length >= 2 && tiles[1] === t0)
            dfs(tiles.slice(2), mentuLeft, taatsu, true);

        if (taatsu < mentuLeft) {
            // 对子搭子
            if (tiles.length >= 2 && tiles[1] === t0)
                dfs(tiles.slice(2), mentuLeft, taatsu+1, jantou);
            // 连张搭子
            if (val <= 8) {
                const a = [...tiles.slice(1)], idx = a.indexOf((val+1)+suit);
                if (idx !== -1) { a.splice(idx,1); dfs(a, mentuLeft, taatsu+1, jantou); }
            }
            // 嵌张搭子
            if (val <= 7) {
                const a = [...tiles.slice(1)], idx = a.indexOf((val+2)+suit);
                if (idx !== -1) { a.splice(idx,1); dfs(a, mentuLeft, taatsu+1, jantou); }
            }
        }

        // 跳过孤张（同牌只跳一次）
        let skip = 1;
        while (skip < tiles.length && tiles[skip] === t0) skip++;
        dfs(tiles.slice(skip), mentuLeft, taatsu, jantou);
    }

    dfs(sorted, meldsNeeded, 0, false);
    return best[0];
}

// ---- 进张分析（听牌前任意手牌）----
// handTiles：当前暗手牌（任意张数）
// 返回每种打法的向听数、有效进张列表和张数
function analyzeEffective(handTiles, melds, queMen) {
    if (handTiles.length === 0) return { results: [], currentShanten: 8 };

    const meldTiles = melds.flatMap(m => m.tiles);
    const currentShanten = calcShanten(handTiles, melds);
    const results = [];
    const tried = new Set();

    for (let i = 0; i < handTiles.length; i++) {
        const discard = handTiles[i];
        if (tried.has(discard)) continue;
        tried.add(discard);

        const remaining = [...handTiles];
        remaining.splice(i, 1);
        const remShanten = calcShanten(remaining, melds);

        const effectiveTiles = [];
        let totalCount = 0;

        for (const suit of SUITS) {
            if (queMen && suit === queMen) continue;
            for (let val = 1; val <= 9; val++) {
                const cand = val + suit;
                const used = remaining.filter(t => t === cand).length
                           + meldTiles.filter(t => t === cand).length;
                const left = 4 - used;
                if (left <= 0) continue;
                if (calcShanten([...remaining, cand], melds) < remShanten) {
                    effectiveTiles.push(cand);
                    totalCount += left;
                }
            }
        }

        results.push({ discard, shanten: remShanten, effectiveTiles, totalCount });
    }

    results.sort((a, b) => a.shanten - b.shanten || b.totalCount - a.totalCount);
    return { results, currentShanten };
}
