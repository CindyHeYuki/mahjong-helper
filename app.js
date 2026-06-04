// 宸濋夯鍔╂墜 UI 鐘舵€佷笌浜や簰

const state = {
    hand: [],
    melds: [],
    queMen: null,
    maxHand: 14,  // 鎽哥墝鍚庢€诲紶鏁帮細14 - 鍓湶鍗犵敤
};

function init() {
    renderPicker();
    bindEvents();
    renderHand();
    renderMelds();
}

// ---- 閫夌墝鍖?----
function renderPicker() {
    for (const suit of SUITS) {
        const row = document.getElementById('suit-' + suit);
        row.innerHTML = '';
        for (let val = 1; val <= 9; val++) {
            const tile = val + suit;
            const btn = document.createElement('button');
            btn.className = 'tile-btn suit-' + suit;
            btn.dataset.tile = tile;
            btn.innerHTML = makeTileInner(tile);
            btn.addEventListener('click', () => addTile(tile));
            row.appendChild(btn);
        }
    }
}

function makeTileInner(tile) {
    const val = getVal(tile);
    const suit = getSuit(tile);
    return `<span class="tile-val">${val}</span><span class="tile-suit">${SUIT_NAMES[suit]}</span>`;
}

// ---- 鎵嬬墝鎿嶄綔 ----
function addTile(tile) {
    updateMaxHand();
    if (state.hand.length >= state.maxHand) {
        showMsg(`鎵嬬墝宸叉弧锛?{state.maxHand}寮狅級`);
        return;
    }
    if (countTile(tile) >= 4) {
        showMsg(`${getVal(tile)}${SUIT_NAMES[getSuit(tile)]} 宸叉湁4寮燻);
        return;
    }
    state.hand.push(tile);
    renderHand();  // renderHand 鍐呴儴璋冪敤 autoAnalyze锛屼笉鍐嶉噸澶?clearResults
}

function removeTile(idx) {
    state.hand.splice(idx, 1);
    renderHand();  // 鍚屼笂
}

function countTile(tile) {
    const inHand = state.hand.filter(t => t === tile).length;
    const inMelds = state.melds.flatMap(m => m.tiles).filter(t => t === tile).length;
    return inHand + inMelds;
}

// maxHand锛氭懜鐗屽悗鐨勬殫鎵嬬墝鏁?= 14 - 闈㈠瓙缁勬暟脳3 - 鏉犳暟
function updateMaxHand() {
    const kongCount = state.melds.filter(m => m.type === 'kong_open' || m.type === 'kong_closed').length;
    state.maxHand = 14 - state.melds.length * 3 - kongCount;
}

// ---- 鎵嬬墝娓叉煋 + 鑷姩鍒嗘瀽 ----
function renderHand() {
    updateMaxHand();
    const sorted = sortTiles(state.hand);
    const display = document.getElementById('hand-display');
    display.innerHTML = '';

    sorted.forEach(tile => {
        const div = document.createElement('div');
        div.className = 'hand-tile suit-' + getSuit(tile);
        div.innerHTML = makeTileInner(tile);
        div.addEventListener('click', () => {
            const idx = state.hand.indexOf(tile);
            if (idx !== -1) removeTile(idx);
        });
        display.appendChild(div);
    });

    document.getElementById('hand-count').textContent = state.hand.length;
    document.getElementById('hand-count').className = state.hand.length === state.maxHand ? 'count-full' : '';
    document.getElementById('hand-max').textContent = state.maxHand;

    autoAnalyze();
}

function autoAnalyze() {
    if (state.hand.length === 0) { clearResults(); return; }
    if (state.hand.length === state.maxHand) {
        // 鎽哥墝鍚庯細鍏堟鏌ユ槸鍚﹀凡鑳?        if (isWinningHand(state.hand, state.melds)) {
            const fans = getFanTypes(state.hand, state.melds, null);
            const total = totalFan(fans);
            const fanNames = fans.map(f => `${f.name}(${f.fan}鐣?`).join(' + ');
            showResults(`<div class="win-banner">鑳＄墝锛?{total}鐣兓${fanNames}</div>`);
        } else {
            analyze();
        }
    } else if (state.hand.length === state.maxHand - 1) {
        // 宸?寮狅細妫€娴嬫槸鍚﹀凡鍚墝
        checkTenpaiState();
    } else {
        showResults(`<div class="hint">杩樺樊 <strong>${state.maxHand - state.hand.length}</strong> 寮?/div>`);
    }
}

function checkTenpaiState() {
    const { hand, melds, queMen } = state;
    const winTiles = [];
    for (const suit of SUITS) {
        if (queMen && suit === queMen) continue;
        for (let val = 1; val <= 9; val++) {
            const cand = val + suit;
            if (isWinningHand([...hand, cand], melds)) winTiles.push(cand);
        }
    }
    if (winTiles.length > 0) {
        const tilesHtml = winTiles.map(t =>
            `<div class="result-tile suit-${getSuit(t)}">${makeTileInner(t)}</div>`).join('');
        showResults(`
            <div class="result-card">
                <div class="result-header">
                    <span class="fan-badge tenpai-badge">宸插惉鐗屻兓绛?${winTiles.length} 寮?/span>
                </div>
                <div class="result-body">
                    <span class="win-label">鑳＄墝寮狅細</span>
                    <div class="win-tiles">${tilesHtml}</div>
                </div>
            </div>`);
    } else {
        showResults(`<div class="hint">杩樺樊 <strong>1</strong> 寮?/div>`);
    }
}

// ---- 鍓湶 ----
let pendingMeld = { type: 'pong', tiles: [] };

function openMeldModal() {
    pendingMeld = { type: 'pong', tiles: [] };
    renderMeldPicker();
    document.getElementById('meld-modal').classList.add('open');
}

function closeMeldModal() {
    document.getElementById('meld-modal').classList.remove('open');
}

function renderMeldPicker() {
    document.getElementById('meld-type-pong').classList.toggle('active', pendingMeld.type === 'pong');
    document.getElementById('meld-type-kong-open').classList.toggle('active', pendingMeld.type === 'kong_open');
    document.getElementById('meld-type-kong-closed').classList.toggle('active', pendingMeld.type === 'kong_closed');

    const target = pendingMeld.type === 'pong' ? 3 : 4;
    const preview = document.getElementById('meld-preview');
    preview.innerHTML = '';
    for (let i = 0; i < target; i++) {
        const div = document.createElement('div');
        if (pendingMeld.tiles[i]) {
            div.className = 'hand-tile suit-' + getSuit(pendingMeld.tiles[i]);
            div.innerHTML = makeTileInner(pendingMeld.tiles[i]);
        } else {
            div.className = 'hand-tile empty';
            div.innerHTML = '<span class="tile-val">?</span>';
        }
        preview.appendChild(div);
    }

    const picker = document.getElementById('meld-picker');
    picker.innerHTML = '';
    for (const suit of SUITS) {
        const row = document.createElement('div');
        row.className = 'suit-row';
        for (let val = 1; val <= 9; val++) {
            const tile = val + suit;
            const btn = document.createElement('button');
            btn.className = 'tile-btn suit-' + suit;
            btn.innerHTML = makeTileInner(tile);
            btn.addEventListener('click', () => addToMeld(tile));
            row.appendChild(btn);
        }
        picker.appendChild(row);
    }
}

function setMeldType(type) {
    pendingMeld.type = type;
    pendingMeld.tiles = [];
    renderMeldPicker();
}

function addToMeld(tile) {
    const target = pendingMeld.type === 'pong' ? 3 : 4;
    if (pendingMeld.tiles.length > 0 && pendingMeld.tiles[0] !== tile) {
        pendingMeld.tiles = [tile];
    } else if (pendingMeld.tiles.length >= target) {
        pendingMeld.tiles = [tile];
    } else {
        pendingMeld.tiles.push(tile);
    }
    renderMeldPicker();
}

function confirmMeld() {
    const target = pendingMeld.type === 'pong' ? 3 : 4;
    if (pendingMeld.tiles.length !== target) {
        showMsg(`璇烽€夋弧 ${target} 寮犲悓涓€寮犵墝`);
        return;
    }
    const tile = pendingMeld.tiles[0];
    if (countTile(tile) + target > 4) {
        showMsg(`${getVal(tile)}${SUIT_NAMES[getSuit(tile)]} 鎬诲紶鏁拌秴杩?寮燻);
        return;
    }
    state.melds.push({ type: pendingMeld.type, tiles: [...pendingMeld.tiles] });
    updateMaxHand();
    // 鑻ユ墜鐗岃秴鍑烘柊涓婇檺鍒欐埅鏂?    while (state.hand.length > state.maxHand) {
        state.hand.pop();
    }
    renderMelds();
    renderHand();  // 鍐呴儴璋冪敤 autoAnalyze
    closeMeldModal();
}

function renderMelds() {
    const container = document.getElementById('melds-display');
    container.innerHTML = '';
    state.melds.forEach((meld, idx) => {
        const div = document.createElement('div');
        div.className = 'meld-group';
        const label = { pong: '纰?, kong_open: '鏄庢潬', kong_closed: '鏆楁潬' }[meld.type];
        div.innerHTML = `<span class="meld-label">${label}</span>`;
        meld.tiles.forEach(tile => {
            const t = document.createElement('div');
            t.className = 'hand-tile suit-' + getSuit(tile);
            t.innerHTML = makeTileInner(tile);
            div.appendChild(t);
        });
        const del = document.createElement('button');
        del.className = 'meld-del';
        del.textContent = '脳';
        del.addEventListener('click', () => {
            state.melds.splice(idx, 1);
            updateMaxHand();
            renderMelds();
            renderHand();
        });
        div.appendChild(del);
        container.appendChild(div);
    });
}

// ---- 缂洪棬 ----
function setQueMen(suit) {
    state.queMen = state.queMen === suit ? null : suit;
    document.querySelectorAll('.que-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.suit === state.queMen);
    });
    autoAnalyze();
}

// ---- 鍒嗘瀽锛堟懜鐗屽悗 14 寮狅級----
// 姣忕鎵撴硶锛氳兘鍚墝鐨勬樉绀鸿儭鐗屽紶+鐣瀷锛屼笉鑳藉惉鐨勬樉绀烘湁鏁堣繘寮?function analyze() {
    const { hand, melds, queMen } = state;
    const meldTiles = melds.flatMap(m => m.tiles);
    const results = [];
    const tried = new Set();

    for (let i = 0; i < hand.length; i++) {
        const discard = hand[i];
        if (tried.has(discard)) continue;
        tried.add(discard);

        const remaining = [...hand];
        remaining.splice(i, 1);

        // 妫€娴嬪惉鐗?        const winTiles = [];
        for (const suit of SUITS) {
            if (queMen && suit === queMen) continue;
            for (let val = 1; val <= 9; val++) {
                const cand = val + suit;
                if (isWinningHand([...remaining, cand], melds)) winTiles.push(cand);
            }
        }

        if (winTiles.length > 0) {
            const fans = getFanTypes([...remaining, winTiles[0]], melds, null);
            results.push({ discard, type: 'tenpai', winTiles, fans, total: totalFan(fans) });
        } else {
            // 杩涘紶鍒嗘瀽
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
            results.push({ discard, type: 'effective', shanten: remShanten, effectiveTiles, totalCount });
        }
    }

    if (results.length === 0) {
        showResults('<div class="no-tenpai">鏃犲垎鏋愮粨鏋?/div>');
        return;
    }

    // 鍚墝鍑烘硶浼樺厛锛屾寜鐣暟鎺掞紱杩涘紶鎸夊悜鍚暟銆佸紶鏁版帓
    results.sort((a, b) => {
        if (a.type === 'tenpai' && b.type !== 'tenpai') return -1;
        if (a.type !== 'tenpai' && b.type === 'tenpai') return 1;
        if (a.type === 'tenpai') return b.total - a.total || b.winTiles.length - a.winTiles.length;
        return a.shanten - b.shanten || b.totalCount - a.totalCount;
    });

    renderCombinedResults(results);
}

function renderCombinedResults(results) {
    let html = '';
    let tenpaiHeaderShown = false, effectiveHeaderShown = false;

    results.forEach(r => {
        if (r.type === 'tenpai' && !tenpaiHeaderShown) {
            html += '<div class="shanten-group-label">鍚墝鍑烘硶</div>';
            tenpaiHeaderShown = true;
        }
        if (r.type === 'effective' && !effectiveHeaderShown) {
            html += '<div class="shanten-group-label">杩涘紶鍑烘硶</div>';
            effectiveHeaderShown = true;
        }

        if (r.type === 'tenpai') {
            const fanNames = r.fans.map(f => `${f.name}(${f.fan}鐣?`).join(' + ');
            const tilesHtml = r.winTiles.map(t =>
                `<div class="result-tile suit-${getSuit(t)}">${makeTileInner(t)}</div>`).join('');
            html += `
            <div class="result-card">
                <div class="result-header">
                    <span class="discard-label">鎵?/span>
                    <div class="result-tile suit-${getSuit(r.discard)}">${makeTileInner(r.discard)}</div>
                    <span class="fan-badge">${r.total}鐣兓${fanNames}</span>
                </div>
                <div class="result-body">
                    <span class="win-label">鍚?${r.winTiles.length} 寮狅細</span>
                    <div class="win-tiles">${tilesHtml}</div>
                </div>
            </div>`;
        } else {
            const sLabel = r.shanten === 0 ? '鍚墝' : `${r.shanten}鍚戝惉`;
            const tilesHtml = r.effectiveTiles.map(t =>
                `<div class="result-tile suit-${getSuit(t)}">${makeTileInner(t)}</div>`).join('');
            html += `
            <div class="result-card">
                <div class="result-header">
                    <span class="discard-label">鎵?/span>
                    <div class="result-tile suit-${getSuit(r.discard)}">${makeTileInner(r.discard)}</div>
                    <span class="fan-badge">${sLabel} 路 杩涘紶 ${r.totalCount} 寮?/span>
                </div>
                <div class="result-body">
                    <span class="win-label">鏈夋晥杩涘紶锛?/span>
                    <div class="win-tiles">${tilesHtml}</div>
                </div>
            </div>`;
        }
    });

    showResults(html);
}

function showResults(html) {
    const el = document.getElementById('results');
    el.innerHTML = html;
}

function clearResults() {
    document.getElementById('results').innerHTML = '';
}

function showMsg(msg) {
    const el = document.getElementById('msg');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
}

// ---- 浜嬩欢缁戝畾 ----
function bindEvents() {
    document.getElementById('clear-hand').addEventListener('click', () => {
        state.hand = [];
        renderHand();
    });
    document.getElementById('add-meld').addEventListener('click', openMeldModal);
    document.getElementById('meld-confirm').addEventListener('click', confirmMeld);
    document.getElementById('meld-cancel').addEventListener('click', closeMeldModal);
    document.getElementById('meld-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('meld-modal')) closeMeldModal();
    });
    document.getElementById('meld-type-pong').addEventListener('click', () => setMeldType('pong'));
    document.getElementById('meld-type-kong-open').addEventListener('click', () => setMeldType('kong_open'));
    document.getElementById('meld-type-kong-closed').addEventListener('click', () => setMeldType('kong_closed'));
    document.querySelectorAll('.que-btn').forEach(btn => {
        btn.addEventListener('click', () => setQueMen(btn.dataset.suit));
    });
}

document.addEventListener('DOMContentLoaded', init);
