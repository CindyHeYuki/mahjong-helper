// 川麻助手 UI 状态与交互

const state = {
    hand: [],
    melds: [],
    queMen: null,
    maxHand: 14,  // 摸牌后总张数：14 - 副露占用
};

function init() {
    renderPicker();
    bindEvents();
    renderHand();
    renderMelds();
}

// ---- 选牌区 ----
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

// ---- 手牌操作 ----
function addTile(tile) {
    updateMaxHand();
    if (state.hand.length >= state.maxHand) {
        showMsg(`手牌已满（${state.maxHand}张）`);
        return;
    }
    if (countTile(tile) >= 4) {
        showMsg(`${getVal(tile)}${SUIT_NAMES[getSuit(tile)]} 已有4张`);
        return;
    }
    state.hand.push(tile);
    renderHand();  // renderHand 内部调用 autoAnalyze，不再重复 clearResults
}

function removeTile(idx) {
    state.hand.splice(idx, 1);
    renderHand();  // 同上
}

function countTile(tile) {
    const inHand = state.hand.filter(t => t === tile).length;
    const inMelds = state.melds.flatMap(m => m.tiles).filter(t => t === tile).length;
    return inHand + inMelds;
}

// maxHand：摸牌后的暗手牌数 = 14 - 面子组数×3 - 杠数
function updateMaxHand() {
    const kongCount = state.melds.filter(m => m.type === 'kong_open' || m.type === 'kong_closed').length;
    state.maxHand = 14 - state.melds.length * 3 - kongCount;
}

// ---- 手牌渲染 + 自动分析 ----
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
    const lacking = state.maxHand - state.hand.length;
    if (lacking > 0) {
        if (state.hand.length > 0) {
            showResults(`<div class="hint">还差 <strong>${lacking}</strong> 张</div>`);
        } else {
            clearResults();
        }
    } else {
        analyze();
    }
}

// ---- 副露 ----
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
        showMsg(`请选满 ${target} 张同一张牌`);
        return;
    }
    const tile = pendingMeld.tiles[0];
    if (countTile(tile) + target > 4) {
        showMsg(`${getVal(tile)}${SUIT_NAMES[getSuit(tile)]} 总张数超过4张`);
        return;
    }
    state.melds.push({ type: pendingMeld.type, tiles: [...pendingMeld.tiles] });
    updateMaxHand();
    // 若手牌超出新上限则截断
    while (state.hand.length > state.maxHand) {
        state.hand.pop();
    }
    renderMelds();
    renderHand();  // 内部调用 autoAnalyze
    closeMeldModal();
}

function renderMelds() {
    const container = document.getElementById('melds-display');
    container.innerHTML = '';
    state.melds.forEach((meld, idx) => {
        const div = document.createElement('div');
        div.className = 'meld-group';
        const label = { pong: '碰', kong_open: '明杠', kong_closed: '暗杠' }[meld.type];
        div.innerHTML = `<span class="meld-label">${label}</span>`;
        meld.tiles.forEach(tile => {
            const t = document.createElement('div');
            t.className = 'hand-tile suit-' + getSuit(tile);
            t.innerHTML = makeTileInner(tile);
            div.appendChild(t);
        });
        const del = document.createElement('button');
        del.className = 'meld-del';
        del.textContent = '×';
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

// ---- 缺门 ----
function setQueMen(suit) {
    state.queMen = state.queMen === suit ? null : suit;
    document.querySelectorAll('.que-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.suit === state.queMen);
    });
    autoAnalyze();
}

// ---- 分析 ----
function analyze() {
    const { results, error } = analyzeTenpai(state.hand, state.melds, state.queMen);
    if (error) {
        showResults(`<div class="error">${error}</div>`);
        return;
    }
    if (results.length === 0) {
        showResults('<div class="no-tenpai">当前手牌没有听牌出法</div>');
        return;
    }
    renderResults(results);
}

function renderResults(results) {
    let html = '<h2>听牌分析</h2>';
    results.forEach(r => {
        const fanNames = r.fans.map(f => `${f.name}(${f.fan}番)`).join(' + ');
        const winTilesHtml = r.winTiles.map(t =>
            `<div class="result-tile suit-${getSuit(t)}">${makeTileInner(t)}</div>`
        ).join('');
        html += `
        <div class="result-card">
            <div class="result-header">
                <span class="discard-label">打</span>
                <div class="result-tile suit-${getSuit(r.discard)}">${makeTileInner(r.discard)}</div>
                <span class="fan-badge">${r.total}番・${fanNames}</span>
            </div>
            <div class="result-body">
                <span class="win-label">听 ${r.winTiles.length} 张：</span>
                <div class="win-tiles">${winTilesHtml}</div>
            </div>
        </div>`;
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

// ---- 事件绑定 ----
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
