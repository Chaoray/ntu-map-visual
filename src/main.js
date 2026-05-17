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

// --- 播放器狀態 ---
let isPlaying = false;
let autoPlaySpeed = 2; 
let frameCounter = 0;

// --- 畫布拖曳與縮放 (Pan & Zoom) ---
let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let isDraggingMap = false;
let dragStartX = 0;
let dragStartY = 0;

const mapBounds = { minLon: 121.530, maxLon: 121.550, minLat: 25.008, maxLat: 25.025 };

function setup() {
  let container = document.getElementById('canvas-container');
  let canvas = createCanvas(container.clientWidth, container.clientHeight);
  canvas.parent('canvas-container');
  
  offsetX = width / 2;
  offsetY = height / 2;
  
  // 🌟 初始化時，深層拷貝一份乾淨的原始地圖資料
  originalGraphData = JSON.parse(JSON.stringify(graphData));
  
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
    translate(offsetX, offsetY);
    scale(zoom);
    translate(-width/2, -height/2);

    let padding = 100 / zoom; 
    let viewLeft = (-offsetX) / zoom + width / 2 - padding;
    let viewRight = (width - offsetX) / zoom + width / 2 + padding;
    let viewTop = (-offsetY) / zoom + height / 2 - padding;
    let viewBottom = (height - offsetY) / zoom + height / 2 + padding;

    drawEdges(viewLeft, viewRight, viewTop, viewBottom);
    drawNodesAndState(viewLeft, viewRight, viewTop, viewBottom);

    pop();
    drawHoverTooltip();
}

function drawEdges(vLeft, vRight, vTop, vBottom) {
    for (let fromId in graphData) {
        let fromC = coordData[fromId];
        if (!fromC) continue;
        let x1 = map(fromC[0], mapBounds.minLon, mapBounds.maxLon, 0, width);
        let y1 = map(fromC[1], mapBounds.maxLat, mapBounds.minLat, 0, height);

        for (let toId in graphData[fromId]) {
            let toC = coordData[toId];
            if (!toC) continue;
            let x2 = map(toC[0], mapBounds.minLon, mapBounds.maxLon, 0, width);
            let y2 = map(toC[1], mapBounds.maxLat, mapBounds.minLat, 0, height);
            
            if (Math.max(x1, x2) < vLeft || Math.min(x1, x2) > vRight || 
                Math.max(y1, y2) < vTop || Math.min(y1, y2) > vBottom) {
                continue; 
            }

            let isPath = false;
            if (appState === 'RESULT' || (appState === 'PLAYBACK' && snapshots[animIndex]?.isFinished)) {
                for (let i = 0; i < currentPath.length - 1; i++) {
                    if ((currentPath[i] == fromId && currentPath[i+1] == toId) || (currentPath[i] == toId && currentPath[i+1] == fromId)) {
                        isPath = true; break;
                    }
                }
            }
            
            let edgeKey1 = `${fromId}-${toId}`;
            let edgeKey2 = `${toId}-${fromId}`;
            let isModified = modifiedEdges.has(edgeKey1) || modifiedEdges.has(edgeKey2);

            if (isPath) {
                stroke(color(65, 105, 225)); 
                strokeWeight(4 / zoom);
            } else if (isModified) {
                stroke(color(255, 165, 0)); 
                strokeWeight(3 / zoom);     
            } else {
                stroke(color(60, 60, 60));  
                strokeWeight(1 / zoom);
            }
            
            line(x1, y1, x2, y2);

            if (zoom > 4 || isModified) {
                push();
                fill(isModified ? color(255, 165, 0) : color(180, 180, 180));
                noStroke();
                textSize((isModified ? 14 : 10) / zoom); 
                textAlign(CENTER, CENTER);
                
                let rawWeight = graphData[fromId][toId];
                let displayWeight = Math.round(rawWeight * 10) / 10;
                
                text(displayWeight, (x1 + x2) / 2, (y1 + y2) / 2 - (3 / zoom));
                pop();
            }
        }
    }
}

function drawNodesAndState(vLeft, vRight, vTop, vBottom) {
    let activeSnapshot = (appState === 'PLAYBACK' || appState === 'RESULT') && snapshots.length > 0 ? snapshots[animIndex] : null;

    for (let id in coordData) {
        let [lon, lat] = coordData[id];
        let x = map(lon, mapBounds.minLon, mapBounds.maxLon, 0, width);
        let y = map(lat, mapBounds.maxLat, mapBounds.minLat, 0, height); 

        if (x < vLeft || x > vRight || y < vTop || y > vBottom) {
            continue;
        }

        let nColor = color(90, 90, 90, 150); 
        let nSize = 1.5; 
        let showDist = false;
        let distVal = "";

        if (activeSnapshot) {
            if (activeSnapshot.visitedNodes && activeSnapshot.visitedNodes.includes(id)) {
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

        noStroke();
        fill(nColor);
        circle(x, y, nSize);

        if (showDist && zoom > 3) { 
            fill(255); textSize(9 / zoom); textAlign(CENTER, BOTTOM);
            let displayDist = Math.round(distVal * 10) / 10;
            text(displayDist, x, y - nSize);
        }
    }
}

function drawHoverTooltip() {
    let worldX = (mouseX - offsetX) / zoom + width/2;
    let worldY = (mouseY - offsetY) / zoom + height/2;

    let closestId = null;
    let minDist = 8 / zoom; 

    for (let id in locationData) {
        let [lon, lat] = coordData[id];
        let px = map(lon, mapBounds.minLon, mapBounds.maxLon, 0, width);
        let py = map(lat, mapBounds.maxLat, mapBounds.minLat, 0, height);
        if (dist(worldX, worldY, px, py) < minDist) { 
            minDist = dist(worldX, worldY, px, py);
            closestId = id;
        }
    }

    if (closestId && locationData[closestId]) {
        let name = locationData[closestId];
        push();
        textSize(14);
        let tw = textWidth(name);
        fill(0, 240); noStroke(); 
        rect(mouseX + 10, mouseY - 25, tw + 20, 30, 5); 
        fill(255); textAlign(LEFT, CENTER);
        text(name, mouseX + 20, mouseY - 10);
        pop();
    }
}

function mouseWheel(event) {
    let zoomAmount = event.delta > 0 ? 0.9 : 1.1;
    let newZoom = zoom * zoomAmount;
    newZoom = constrain(newZoom, 0.5, 15); 

    offsetX = mouseX - (mouseX - offsetX) * (newZoom / zoom);
    offsetY = mouseY - (mouseY - offsetY) * (newZoom / zoom);
    zoom = newZoom;
    return false;
}

function mousePressed() {
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
    if (appState === 'INTRO') return;

    let worldX = (mouseX - offsetX) / zoom + width/2;
    let worldY = (mouseY - offsetY) / zoom + height/2;

    let closestId = null;
    let minDist = 8 / zoom; 
    for (let id in locationData) {
        let [lon, lat] = coordData[id];
        let px = map(lon, mapBounds.minLon, mapBounds.maxLon, 0, width);
        let py = map(lat, mapBounds.maxLat, mapBounds.minLat, 0, height);
        if (dist(worldX, worldY, px, py) < minDist) { closestId = id; break; }
    }

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

    if (appState === 'SELECT') {
        for (let fromId in graphData) {
            let [lon1, lat1] = coordData[fromId];
            let x1 = map(lon1, mapBounds.minLon, mapBounds.maxLon, 0, width);
            let y1 = map(lat1, mapBounds.maxLat, mapBounds.minLat, 0, height);
            
            for (let toId in graphData[fromId]) {
                let [lon2, lat2] = coordData[toId];
                let x2 = map(lon2, mapBounds.minLon, mapBounds.maxLon, 0, width);
                let y2 = map(lat2, mapBounds.maxLat, mapBounds.minLat, 0, height);
                
                if (distToSegment(worldX, worldY, x1, y1, x2, y2) < 4 / zoom) { 
                    let oldWeight = Math.round(graphData[fromId][toId] * 10) / 10;
                    let newWeight = prompt(`目前距離權重為: ${oldWeight}\n請輸入新的權重 (整數或小數, ≤ 10^9):`, oldWeight);
                    
                    if (newWeight !== null && !isNaN(newWeight) && parseFloat(newWeight) <= 1000000000) {
                        let w = parseFloat(newWeight); 
                        graphData[fromId][toId] = w;
                        modifiedEdges.add(`${fromId}-${toId}`); 
                        
                        if (graphData[toId] && graphData[toId][fromId] !== undefined) {
                            graphData[toId][fromId] = w;
                            modifiedEdges.add(`${toId}-${fromId}`); 
                        }
                    }
                    return;
                }
            }
        }
    }

    isDraggingMap = true;
    dragStartX = mouseX - offsetX;
    dragStartY = mouseY - offsetY;
}

function mouseDragged() {
    if (isDraggingMap) {
        offsetX = mouseX - dragStartX;
        offsetY = mouseY - dragStartY;
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
    if (container) resizeCanvas(container.clientWidth, container.clientHeight);
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
    document.getElementById('btn-step-m10').onclick = () => stepAnim(-10);
    document.getElementById('btn-step-m1').onclick = () => stepAnim(-1);
    document.getElementById('btn-step-p1').onclick = () => stepAnim(1);
    document.getElementById('btn-step-p10').onclick = () => stepAnim(10);

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
        const pf = new PathFinder(graphData, coordData);
        snapshots = pf.runPathfinding(currentStartId, currentEndId, algo);
        
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
    document.getElementById('btn-step-m10').disabled = false;
    document.getElementById('btn-step-m1').disabled = false;
    document.getElementById('btn-step-p1').disabled = false;
    document.getElementById('btn-step-p10').disabled = false;

    document.getElementById('playback-status').innerText = `目前步數: ${animIndex + 1} / ${snapshots.length}`;
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
    
    let finalDist = snapshots[snapshots.length - 1].currentDistances[currentEndId];
    let distStr = currentPath.length > 0 ? `${Math.round(finalDist * 10) / 10} 公尺` : "無法抵達";
    document.getElementById('distanceOutput').innerText = `總距離：${distStr}`;
}

function goToSelection() {
    appState = 'SELECT';
    currentPath = [];
    snapshots = [];
    document.getElementById('playback-panel').classList.add('hidden');
    document.getElementById('result-panel').classList.add('hidden');
    document.getElementById('selection-panel').classList.remove('hidden');
}

function initCustomSelect() {
    createSelectItems('startItems', 'startSelected', (id) => { currentStartId = id; checkReadyToSearch(); });
    createSelectItems('endItems', 'endSelected', (id) => { currentEndId = id; checkReadyToSearch(); });

    document.getElementById('startSelected').onclick = function(e) {
        e.stopPropagation(); closeAllSelect(this);
        document.getElementById('startItems').classList.toggle('select-hide');
    };
    document.getElementById('endSelected').onclick = function(e) {
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
        div.onclick = function() {
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