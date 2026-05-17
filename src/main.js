import { PathFinder } from './pathfinding.js';

import coordData from './assets/coordinates.json';
import graphData from './assets/graph.json';
import locationData from './assets/locations.json';

// --- 系統狀態管理 ---
let appState = 'INTRO';
let playMode = 'AUTO';
let algo = 'DIJKSTRA';
let mapClickMode = 'START';

// --- 導航資料 ---
let currentStartId = null;
let currentEndId = null;
let currentPath = [];
let snapshots = [];
let animIndex = 0;

let modifiedEdges = new Set();
// 🌟 新增：用來儲存乾淨原始地圖的拷貝
let originalGraphData = null;

const nodeIds = Object.keys(coordData);
const locationIds = Object.keys(locationData);
const edgePairs = [];

// per-frame caches
let nodePositions = {};
let pathEdgeSet = new Set();
let hoveredLocationId = null;
let hoverStamp = '';

// --- 播放器狀態 ---
let isPlaying = false;
let autoPlaySpeed = 2;
let frameCounter = 0;

const PLAYBACK_SPEEDS = [
    { maxSteps: 500, delay: 4 },
    { maxSteps: 1000, delay: 3 },
    { maxSteps: 2000, delay: 2 },
    { maxSteps: Infinity, delay: 1 }
];

// --- 畫布拖曳與縮放 (Pan & Zoom) ---
let zoom = 1;
let cameraX = 0;
let cameraY = 0;
let isDraggingMap = false;
let dragStartMouseX = 0;
let dragStartMouseY = 0;
let dragStartCamX = 0;
let dragStartCamY = 0;

const mapBounds = { minLon: 121.530, maxLon: 121.550, minLat: 25.008, maxLat: 25.025 };
let mapProjection = { scale: 1, offsetX: 0, offsetY: 0 };

for (const fromId of Object.keys(graphData)) {
    for (const toId of Object.keys(graphData[fromId])) {
        edgePairs.push({ fromId, toId });
    }
}

function setup() {
    let container = document.getElementById('canvas-container');
    let canvas = createCanvas(container.clientWidth, container.clientHeight);
    canvas.parent('canvas-container');

    cameraX = width / 2;
    cameraY = height / 2;

    // 🌟 初始化時，深層拷貝一份乾淨的原始地圖資料
    originalGraphData = JSON.parse(JSON.stringify(graphData));

    updateMapProjection();
    rebuildProjectedNodePositions();
    updateHoveredLocation(true);

    initUI();
}

function draw() {
    background(18);

    if (appState === 'PLAYBACK' && isPlaying && snapshots.length > 0) {
        frameCounter++;
        if (frameCounter >= autoPlaySpeed) {
            frameCounter = 0;
            if (animIndex < snapshots.length - 1) {
                animIndex++;
                document.getElementById('playback-status').innerText = `目前步數: ${animIndex + 1} / ${snapshots.length}`;
            } else {
                handlePlaybackFinish();
            }
        }
    }

    push();
    translate(width / 2, height / 2);
    scale(zoom);
    translate(-cameraX, -cameraY);

    let padding = 100 / zoom;
    let viewHalfW = (width / 2) / zoom;
    let viewHalfH = (height / 2) / zoom;
    let viewLeft = cameraX - viewHalfW - padding;
    let viewRight = cameraX + viewHalfW + padding;
    let viewTop = cameraY - viewHalfH - padding;
    let viewBottom = cameraY + viewHalfH + padding;

    updateHoveredLocation();

    drawEdges(viewLeft, viewRight, viewTop, viewBottom);
    drawNodesAndState(viewLeft, viewRight, viewTop, viewBottom);

    pop();
    drawHoverTooltip();
}

function drawEdges(vLeft, vRight, vTop, vBottom) {
    for (const { fromId, toId } of edgePairs) {
        const pos1 = nodePositions[fromId];
        if (!pos1) continue;

        const pos2 = nodePositions[toId];
        if (!pos2) continue;

        const x1 = pos1.x, y1 = pos1.y, x2 = pos2.x, y2 = pos2.y;

        if (Math.max(x1, x2) < vLeft || Math.min(x1, x2) > vRight ||
            Math.max(y1, y2) < vTop || Math.min(y1, y2) > vBottom) {
            continue;
        }

        const edgeKey = `${fromId}-${toId}`;
        const isPath = pathEdgeSet.has(edgeKey);
        const isModified = modifiedEdges.has(edgeKey) || modifiedEdges.has(`${toId}-${fromId}`);

        if (isPath) { stroke(65, 105, 225); strokeWeight(4 / zoom); }
        else if (isModified) { stroke(255, 165, 0); strokeWeight(3 / zoom); }
        else { stroke(60, 60, 60); strokeWeight(1 / zoom); }

        line(x1, y1, x2, y2);

        if (zoom > 10 || isModified) {
            push();
            noStroke();
            if (isModified) fill(255, 165, 0); else fill(180, 180, 180);
            textSize((isModified ? 14 : 10) / zoom);
            textAlign(CENTER, CENTER);

            let rawWeight = graphData[fromId][toId];
            let displayWeight = Math.round(rawWeight * 10) / 10;

            text(displayWeight, (x1 + x2) / 2, (y1 + y2) / 2 - (3 / zoom));
            pop();
        }
    }
}

function drawNodesAndState(vLeft, vRight, vTop, vBottom) {
    let activeSnapshot = (appState === 'PLAYBACK' || appState === 'RESULT') && snapshots.length > 0 ? snapshots[animIndex] : null;
    let visitedSet = null;
    if (activeSnapshot && activeSnapshot.visitedNodes) {
        visitedSet = activeSnapshot.visitedSet || new Set(activeSnapshot.visitedNodes);
        activeSnapshot.visitedSet = visitedSet;
    }

    for (const id of nodeIds) {
        const pos = nodePositions[id];
        if (!pos) continue;
        let x = pos.x, y = pos.y;

        if (x < vLeft || x > vRight || y < vTop || y > vBottom) {
            continue;
        }

        let nColor = color(90, 90, 90, 150);
        let nSize = 1.5;
        let showDist = false;
        let distVal = "";

        if (activeSnapshot) {
            if (visitedSet && visitedSet.has(id)) {
                nColor = color(0, 200, 100, 180);
                nSize = 3;
                if (activeSnapshot.currentDistances[id] !== undefined && activeSnapshot.currentDistances[id] !== null) {
                    showDist = true;
                    distVal = activeSnapshot.currentDistances[id];
                }
            }
            if (activeSnapshot.currentNode == id) {
                nColor = color(255, 255, 0);
                nSize = 6;
            }
        }

        if (id == currentStartId) { nColor = color(65, 105, 225); nSize = 8; }
        if (id == currentEndId) { nColor = color(255, 50, 50); nSize = 8; }

        const locationName = locationData[id];
        const isNamedLocation = Boolean(locationName);
        if (isNamedLocation) {
            noFill();
            stroke(255, 210, 110, 220);
            strokeWeight(1.4 / zoom);
            circle(x, y, nSize + (4 / zoom));
        }

        noStroke();
        fill(nColor);
        circle(x, y, nSize);

        if (isNamedLocation && zoom > 1.5) {
            push();
            noStroke();
            fill(255, 245);
            textSize(9 / zoom);
            textAlign(CENTER, TOP);
            text(locationName, x, y + (nSize / 2) + (2 / zoom));
            pop();
        }

        if (showDist && zoom > 10) {
            fill(255); textSize(9 / zoom); textAlign(CENTER, BOTTOM);
            let displayDist = Math.round(distVal * 10) / 10;
            text(displayDist, x, y - nSize);
        }
    }
}

function drawHoverTooltip() {
    if (!hoveredLocationId || !locationData[hoveredLocationId]) return;

    let name = locationData[hoveredLocationId];
    push();
    textSize(14);
    let tw = textWidth(name);
    fill(0, 240); noStroke();
    rect(mouseX + 10, mouseY - 25, tw + 20, 30, 5);
    fill(255); textAlign(LEFT, CENTER);
    text(name, mouseX + 20, mouseY - 10);
    pop();
}

function mouseWheel(event) {
    let zoomAmount = event.delta > 0 ? 0.9 : 1.1;
    let newZoom = constrain(zoom * zoomAmount, 0.5, 15);

    // keep world point under mouse stable while zooming
    let wx = (mouseX - width / 2) / zoom + cameraX;
    let wy = (mouseY - height / 2) / zoom + cameraY;

    zoom = newZoom;

    let wx2 = (mouseX - width / 2) / zoom + cameraX;
    let wy2 = (mouseY - height / 2) / zoom + cameraY;

    cameraX += wx - wx2;
    cameraY += wy - wy2;
    return false;
}

function mousePressed() {
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
    if (appState === 'INTRO') return;

    let worldX = (mouseX - width / 2) / zoom + cameraX;
    let worldY = (mouseY - height / 2) / zoom + cameraY;

    let closestId = findClosestLocationId(worldX, worldY, 8 / zoom);

    if (closestId && appState === 'SELECT') {
        if (mapClickMode === 'START') {
            currentStartId = closestId;
            document.getElementById('startSelected').innerText = locationData[closestId];
        } else {
            currentEndId = closestId;
            document.getElementById('endSelected').innerText = locationData[closestId];
        }
        checkReadyToSearch();
        return;
    }

    isDraggingMap = true;
    dragStartMouseX = mouseX;
    dragStartMouseY = mouseY;
    dragStartCamX = cameraX;
    dragStartCamY = cameraY;
}

function mouseDragged() {
    if (isDraggingMap) {
        cameraX = dragStartCamX - (mouseX - dragStartMouseX) / zoom;
        cameraY = dragStartCamY - (mouseY - dragStartMouseY) / zoom;
    }
}

function mouseReleased() { isDraggingMap = false; }

function distToSegment(px, py, x1, y1, x2, y2) {
    let l2 = dist(x1, y1, x2, y2) ** 2;
    if (l2 == 0) return dist(px, py, x1, y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return dist(px, py, x1 + t * (x2 - x1), y1 + t * (y2 - y1));
}

function windowResized() {
    let container = document.getElementById('canvas-container');
    if (container) {
        resizeCanvas(container.clientWidth, container.clientHeight);
        updateMapProjection();
        updateHoveredLocation(true);
    }
}

window.setup = setup; window.draw = draw;
window.windowResized = windowResized; window.mouseWheel = mouseWheel;
window.mousePressed = mousePressed; window.mouseDragged = mouseDragged; window.mouseReleased = mouseReleased;

function initUI() {
    document.getElementById('btn-start-using').onclick = () => {
        document.getElementById('intro-screen').classList.add('hidden');
        document.getElementById('main-sidebar').classList.remove('hidden');
        appState = 'SELECT';
    };

    setupToggle('mode-auto', 'mode-manual', (isAuto) => {
        playMode = isAuto ? 'AUTO' : 'MANUAL';
    });
    setupToggle('algo-dijkstra', 'algo-astar', (isD) => {
        algo = isD ? 'DIJKSTRA' : 'ASTAR';
    });
    setupToggle('click-mode-start', 'click-mode-end', (isStart) => {
        mapClickMode = isStart ? 'START' : 'END';
    });

    initCustomSelect();

    document.getElementById('searchBtn').onclick = startPathfinding;
    document.getElementById('btn-skip-to-end').onclick = skipToEnd;
    document.getElementById('btn-reselect').onclick = goToSelection;
    document.getElementById('btn-back-to-select').onclick = goToSelection;
    document.getElementById('btn-try-again').onclick = startPathfinding;

    document.getElementById('btn-play-pause').onclick = togglePlayPause;
    document.getElementById('btn-step-m100').onclick = () => stepAnim(-100);
    document.getElementById('btn-step-m1').onclick = () => stepAnim(-1);
    document.getElementById('btn-step-p1').onclick = () => stepAnim(1);
    document.getElementById('btn-step-p100').onclick = () => stepAnim(100);

    // 🌟 綁定還原權重按鈕的事件
    document.getElementById('btn-reset-weights').onclick = resetWeights;
}

// 🌟 核心功能：一鍵還原所有權重
function resetWeights() {
    if (modifiedEdges.size === 0) {
        alert('目前沒有修改過任何權重喔！');
        return;
    }

    // 將所有被改過的線，覆蓋回原始地圖的值
    for (let fromId in graphData) {
        for (let toId in graphData[fromId]) {
            graphData[fromId][toId] = originalGraphData[fromId][toId];
        }
    }

    // 清空修改紀錄
    modifiedEdges.clear();
    alert('✅ 地圖權重已全部恢復為預設真實距離！');
}

function setupToggle(btn1Id, btn2Id, callback) {
    const b1 = document.getElementById(btn1Id);
    const b2 = document.getElementById(btn2Id);
    b1.onclick = () => { b1.classList.add('active'); b2.classList.remove('active'); callback(true); };
    b2.onclick = () => { b2.classList.add('active'); b1.classList.remove('active'); callback(false); };
}

function checkReadyToSearch() {
    const btn = document.getElementById('searchBtn');
    if (currentStartId && currentEndId) btn.classList.remove('disabled');
    else btn.classList.add('disabled');
}

function startPathfinding() {
    if (!currentStartId || !currentEndId) return;

    try {
        pathEdgeSet.clear();
        const pf = new PathFinder(graphData, coordData);
        snapshots = pf.runPathfinding(currentStartId, currentEndId, algo);
        autoPlaySpeed = getPlaybackDelay(snapshots.length);

        animIndex = 0;
        appState = 'PLAYBACK';

        document.getElementById('selection-panel').classList.add('hidden');
        document.getElementById('result-panel').classList.add('hidden');
        document.getElementById('playback-panel').classList.remove('hidden');

        if (playMode === 'AUTO') {
            isPlaying = true;
            document.getElementById('btn-play-pause').innerText = '⏸️ 暫停';
            document.getElementById('btn-play-pause').classList.remove('hidden');
        } else {
            isPlaying = false;
            document.getElementById('btn-play-pause').classList.add('hidden');
        }
        updatePlaybackControls();

    } catch (e) {
        console.error("演算法執行失敗", e);
        alert("演算法執行發生錯誤，請按 F12 檢查 Console！");
    }
}

function togglePlayPause() {
    isPlaying = !isPlaying;
    document.getElementById('btn-play-pause').innerText = isPlaying ? '⏸️ 暫停' : '▶️ 播放';
}

function updatePlaybackControls() {
    document.getElementById('btn-step-m100').disabled = false;
    document.getElementById('btn-step-m1').disabled = false;
    document.getElementById('btn-step-p1').disabled = false;
    document.getElementById('btn-step-p100').disabled = false;

    document.getElementById('playback-status').innerText = `目前步數: ${animIndex + 1} / ${snapshots.length}`;
}

function getPlaybackDelay(totalSteps) {
    for (const tier of PLAYBACK_SPEEDS) {
        if (totalSteps <= tier.maxSteps) return tier.delay;
    }
    return 1;
}

function stepAnim(offset) {
    let newIndex = animIndex + offset;
    if (newIndex < 0) newIndex = 0;

    if (newIndex >= snapshots.length - 1) {
        if (animIndex === snapshots.length - 1 && offset > 0) {
            handlePlaybackFinish();
            return;
        }
        newIndex = snapshots.length - 1;
    }

    animIndex = newIndex;
    frameCounter = 0;
    updatePlaybackControls();
}

function skipToEnd() {
    animIndex = snapshots.length - 1;
    handlePlaybackFinish();
}

function handlePlaybackFinish() {
    appState = 'RESULT';
    isPlaying = false;
    currentPath = snapshots[snapshots.length - 1].finalPath || [];
    rebuildPathEdgeSet();

    let finalDist = snapshots[snapshots.length - 1].currentDistances[currentEndId];
    let distStr = currentPath.length > 0 ? `${Math.round(finalDist * 10) / 10} 公尺` : "無法抵達";
    document.getElementById('distanceOutput').innerText = `總距離：${distStr}`;
}

function goToSelection() {
    appState = 'SELECT';
    currentPath = [];
    snapshots = [];
    pathEdgeSet.clear();
    hoveredLocationId = null;
    document.getElementById('playback-panel').classList.add('hidden');
    document.getElementById('result-panel').classList.add('hidden');
    document.getElementById('selection-panel').classList.remove('hidden');
}

function initCustomSelect() {
    createSelectItems('startItems', 'startSelected', (id) => { currentStartId = id; checkReadyToSearch(); });
    createSelectItems('endItems', 'endSelected', (id) => { currentEndId = id; checkReadyToSearch(); });

    document.getElementById('startSelected').onclick = function (e) {
        e.stopPropagation(); closeAllSelect(this);
        document.getElementById('startItems').classList.toggle('select-hide');
    };
    document.getElementById('endSelected').onclick = function (e) {
        e.stopPropagation(); closeAllSelect(this);
        document.getElementById('endItems').classList.toggle('select-hide');
    };
    document.addEventListener('click', closeAllSelect);
}

function createSelectItems(containerId, selectedId, onSelectCallback) {
    const container = document.getElementById(containerId);
    for (let id in locationData) {
        let div = document.createElement('div');
        div.innerHTML = locationData[id];
        div.onclick = function () {
            document.getElementById(selectedId).innerHTML = this.innerHTML;
            onSelectCallback(id);
            closeAllSelect();
        };
        container.appendChild(div);
    }
}

function closeAllSelect(except) {
    document.querySelectorAll('.select-items').forEach(el => {
        if (el.previousElementSibling !== except) el.classList.add('select-hide');
    });
}

function updateMapProjection() {
    const lonSpan = mapBounds.maxLon - mapBounds.minLon;
    const latSpan = mapBounds.maxLat - mapBounds.minLat;
    if (lonSpan <= 0 || latSpan <= 0 || width === 0 || height === 0) return;

    const fitScale = Math.min(width / lonSpan, height / latSpan) * 0.94;
    const mapWidth = lonSpan * fitScale;
    const mapHeight = latSpan * fitScale;

    mapProjection.scale = fitScale;
    mapProjection.offsetX = (width - mapWidth) / 2;
    mapProjection.offsetY = (height - mapHeight) / 2;

    rebuildProjectedNodePositions();
}

function projectLon(lon) {
    return mapProjection.offsetX + (lon - mapBounds.minLon) * mapProjection.scale;
}

function projectLat(lat) {
    return mapProjection.offsetY + (mapBounds.maxLat - lat) * mapProjection.scale;
}

function rebuildProjectedNodePositions() {
    nodePositions = {};
    for (const id of nodeIds) {
        const [lon, lat] = coordData[id];
        nodePositions[id] = {
            x: projectLon(lon),
            y: projectLat(lat)
        };
    }
}

function rebuildPathEdgeSet() {
    pathEdgeSet.clear();
    if (currentPath && currentPath.length > 1) {
        for (let i = 0; i < currentPath.length - 1; i++) {
            const a = currentPath[i], b = currentPath[i + 1];
            pathEdgeSet.add(`${a}-${b}`);
            pathEdgeSet.add(`${b}-${a}`);
        }
    }
}

function getPointerWorldPosition() {
    return {
        x: (mouseX - width / 2) / zoom + cameraX,
        y: (mouseY - height / 2) / zoom + cameraY
    };
}

function findClosestLocationId(worldX, worldY, maxDistance) {
    let closestId = null;
    let closestDistance = maxDistance;

    for (const id of locationIds) {
        const pos = nodePositions[id];
        if (!pos) continue;

        const distance = dist(worldX, worldY, pos.x, pos.y);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestId = id;
        }
    }

    return closestId;
}

function updateHoveredLocation(force = false) {
    const signature = `${mouseX}|${mouseY}|${zoom}|${cameraX}|${cameraY}|${mapProjection.scale}|${mapProjection.offsetX}|${mapProjection.offsetY}`;
    if (!force && signature === hoverStamp) return;

    hoverStamp = signature;
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
        hoveredLocationId = null;
        return;
    }

    const pointer = getPointerWorldPosition();
    hoveredLocationId = findClosestLocationId(pointer.x, pointer.y, 8 / zoom);
}