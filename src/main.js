import './style.css';
import { PathFinder } from './pathfinding.js';
import coordinates from './assets/coordinates.json' with { type: 'json' };
import graph from './assets/graph.json' with { type: 'json' };
import locations from './assets/locations.json' with { type: 'json' };

const MAP_BOUNDS = {
    minLon: 121.530,
    maxLon: 121.550,
    minLat: 25.008,
    maxLat: 25.025
};

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.15;

let mapZoom = 1;
let mapOffsetX = 0;
let mapOffsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartOffsetX = 0;
let panStartOffsetY = 0;
let hasPanned = false;

let currentStartId = null;
let currentEndId = null;
let mapHoveredNodeId = null;
let listHoveredNodeId = null;

// 獨立儲存最終路線，確保動畫結束後不會消失
let currentPath = [];

// 動畫播放狀態
let snapshots = [];
let animIndex = 0;
let isAnimating = false;

function projectPoint(lon, lat) {
    let lonSpan = MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon;
    let latSpan = MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat;
    let baseScale = Math.min(width / lonSpan, height / latSpan);
    let baseWidth = lonSpan * baseScale;
    let baseHeight = latSpan * baseScale;
    let baseOffsetX = (width - baseWidth) / 2;
    let baseOffsetY = (height - baseHeight) / 2;

    let baseX = (lon - MAP_BOUNDS.minLon) * baseScale + baseOffsetX;
    let baseY = (MAP_BOUNDS.maxLat - lat) * baseScale + baseOffsetY;

    let centerX = width / 2;
    let centerY = height / 2;

    return {
        x: (baseX - centerX) * mapZoom + centerX + mapOffsetX,
        y: (baseY - centerY) * mapZoom + centerY + mapOffsetY
    };
}

function projectNode(id) {
    let coords = coordinates?.[id];
    if (!coords) return null;
    return projectPoint(coords[0], coords[1]);
}

function zoomAt(factor, anchorX = width / 2, anchorY = height / 2) {
    let nextZoom = constrain(mapZoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === mapZoom) return;

    let centerX = width / 2;
    let centerY = height / 2;
    let baseX = (anchorX - centerX - mapOffsetX) / mapZoom + centerX;
    let baseY = (anchorY - centerY - mapOffsetY) / mapZoom + centerY;

    mapZoom = nextZoom;
    mapOffsetX = anchorX - (baseX - centerX) * mapZoom - centerX;
    mapOffsetY = anchorY - (baseY - centerY) * mapZoom - centerY;
}

function resetZoom() {
    mapZoom = 1;
    mapOffsetX = 0;
    mapOffsetY = 0;
}

function setup() {
    let container = document.getElementById('canvas-container');
    let canvas = createCanvas(container.clientWidth, container.clientHeight);
    canvas.parent('canvas-container');
    console.log("地圖資料載入成功！");
    initCustomSelect();
    initZoomControls();
}

function draw() {
    background(10);

    // 1. 畫底層道路 (灰色)
    if (graph && coordinates) {
        stroke(50, 50, 50);
        strokeWeight(1);
        for (let fromId in graph) {
            let fromPoint = projectNode(fromId);
            if (!fromPoint) continue;

            for (let toId in graph[fromId]) {
                let toPoint = projectNode(toId);
                if (!toPoint) continue;
                line(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y);
            }
        }
    }

    // 2. 畫基礎節點 (微弱的深綠點，減少視覺干擾)
    if (coordinates) {
        fill(30, 80, 50, 100);
        noStroke();
        for (let id in coordinates) {
            let point = projectNode(id);
            if (!point) continue;
            circle(point.x, point.y, 1.5);
        }
    }

    // 🌟 3. 繪製 Dijkstra 動畫 (雷達波浪效果，讀取隊友算出的 snapshots)
    if (isAnimating && snapshots.length > 0) {
        let activeSnapshot = snapshots[animIndex];

        // 走過的點：縮小並加上透明度，避免畫面太髒
        fill(50, 200, 100, 60);
        noStroke();
        if (activeSnapshot.visitedNodes) {
            activeSnapshot.visitedNodes.forEach(id => {
                let point = projectNode(id);
                if (point) circle(point.x, point.y, 3);
            });
        }

        // 探索邊界：凸顯橘色，看起來像擴散的波紋
        fill(255, 165, 0, 180);
        if (activeSnapshot.frontierNodes) {
            activeSnapshot.frontierNodes.forEach(id => {
                let point = projectNode(id);
                if (point) circle(point.x, point.y, 5);
            });
        }

        // 當前檢查點：黃色光圈
        fill(255, 255, 0);
        if (activeSnapshot.currentNode !== null) {
            let point = projectNode(activeSnapshot.currentNode);
            if (point) circle(point.x, point.y, 8);
        }

        // 🚀 動態快轉引擎：根據總步數計算每次要跳過幾幀，確保動畫在 1.5 秒內播完
        let playbackSpeed = Math.max(1, Math.floor(snapshots.length / 60));
        animIndex += playbackSpeed;

        // 如果播到最後一步了
        if (animIndex >= snapshots.length - 1) {
            animIndex = snapshots.length - 1;
            // 把最終路徑交接給全域變數，確保它永不消失
            currentPath = snapshots[animIndex].finalPath || [];
            isAnimating = false; // 結束動畫
        }
    }

    // 🌟 4. 畫出最終導航路徑 (寶藍色粗線，獨立於動畫之外)
    if (!isAnimating && currentPath.length > 0) {
        stroke(65, 105, 225);
        strokeWeight(4);
        noFill();
        beginShape();
        for (let id of currentPath) {
            let point = projectNode(id);
            if (point) vertex(point.x, point.y);
        }
        endShape();
    }

    // 5. 畫起終點標記
    if (currentStartId) {
        let point = projectNode(currentStartId);
        if (point) {
            fill(255, 255, 0); noStroke(); circle(point.x, point.y, 14);
        }
    }
    if (currentEndId) {
        let point = projectNode(currentEndId);
        if (point) {
            fill(234, 67, 53); noStroke(); circle(point.x, point.y, 14);
        }
    }

    // 6. 處理 Hover 放大與 Tooltip
    let highlightId = listHoveredNodeId || mapHoveredNodeId;
    if (highlightId) {
        let highlightPoint = projectNode(highlightId);
        if (highlightPoint) {
            let hx = highlightPoint.x;
            let hy = highlightPoint.y;

            fill(0, 255, 170, 200);
            noStroke();
            circle(hx, hy, 16);

            if (locations[highlightId]) {
                let name = locations[highlightId];
                textSize(14);
                let tw = textWidth(name);
                fill(0, 200);
                rect(hx + 10, hy - 25, tw + 20, 30, 5);
                fill(255);
                textAlign(LEFT, CENTER);
                text(name, hx + 20, hy - 10);
            }
        }
    }
}

// 滑鼠互動事件
function mouseMoved() {
    if (!locations || !coordinates) {
        mapHoveredNodeId = null;
        return;
    }

    let closestId = null;
    let minDist = Infinity;

    for (let id in locations) {
        let point = projectNode(id);
        if (!point) continue;
        let px = point.x;
        let py = point.y;
        let d = dist(mouseX, mouseY, px, py);

        if (d < 15 && d < minDist) {
            minDist = d;
            closestId = id;
        }
    }
    mapHoveredNodeId = closestId;
}

function mouseWheel(event) {
    let factor = event.delta < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAt(factor, mouseX, mouseY);
    return false;
}

function mousePressed() {
    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        isPanning = true;
        hasPanned = false;
        panStartX = mouseX;
        panStartY = mouseY;
        panStartOffsetX = mapOffsetX;
        panStartOffsetY = mapOffsetY;
    }
}

function mouseDragged() {
    if (!isPanning) return;

    mapOffsetX = panStartOffsetX + (mouseX - panStartX);
    mapOffsetY = panStartOffsetY + (mouseY - panStartY);

    if (abs(mouseX - panStartX) > 2 || abs(mouseY - panStartY) > 2) {
        hasPanned = true;
    }

    return false;
}

function mouseReleased() {
    if (isPanning && !hasPanned && mapHoveredNodeId && mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        let name = locations[mapHoveredNodeId];

        if (!currentStartId) {
            currentStartId = mapHoveredNodeId;
            document.getElementById('startSelected').innerText = name;
        } else if (!currentEndId && mapHoveredNodeId !== currentStartId) {
            currentEndId = mapHoveredNodeId;
            document.getElementById('endSelected').innerText = name;
        } else {
            currentStartId = mapHoveredNodeId;
            currentEndId = null;
            document.getElementById('startSelected').innerText = name;
            document.getElementById('endSelected').innerText = "請選擇終點...";

            // 重置狀態，準備重新規劃
            snapshots = [];
            currentPath = [];
            isAnimating = false;
        }
    }

    isPanning = false;
}

function windowResized() {
    let container = document.getElementById('canvas-container');
    if (container) resizeCanvas(container.clientWidth, container.clientHeight);
}

window.setup = setup; window.draw = draw; window.windowResized = windowResized; window.mouseMoved = mouseMoved; window.mousePressed = mousePressed; window.mouseDragged = mouseDragged; window.mouseReleased = mouseReleased; window.mouseWheel = mouseWheel;

function initZoomControls() {
    const container = document.getElementById('canvas-container');
    if (!container || document.getElementById('zoomControls')) return;

    container.style.position = 'relative';

    const panel = document.createElement('div');
    panel.id = 'zoomControls';
    panel.style.position = 'absolute';
    panel.style.right = '12px';
    panel.style.bottom = '12px';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '8px';
    panel.style.zIndex = '20';

    const controls = [
        { label: '+', title: '放大', action: () => zoomAt(ZOOM_STEP) },
        { label: '−', title: '縮小', action: () => zoomAt(1 / ZOOM_STEP) },
        { label: '⟲', title: '重設縮放', action: () => resetZoom() }
    ];

    controls.forEach(({ label, title, action }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.title = title;
        button.style.width = '40px';
        button.style.height = '40px';
        button.style.border = '1px solid rgba(255,255,255,0.18)';
        button.style.borderRadius = '12px';
        button.style.background = 'rgba(20, 20, 20, 0.9)';
        button.style.color = '#fff';
        button.style.fontSize = '20px';
        button.style.lineHeight = '1';
        button.style.cursor = 'pointer';
        button.style.boxShadow = '0 6px 18px rgba(0,0,0,0.35)';
        button.style.backdropFilter = 'blur(6px)';

        button.addEventListener('mouseenter', () => button.style.background = 'rgba(40, 40, 40, 0.95)');
        button.addEventListener('mouseleave', () => button.style.background = 'rgba(20, 20, 20, 0.9)');
        button.addEventListener('click', action);
        panel.appendChild(button);
    });

    container.appendChild(panel);
}

// 客製化下拉選單
function initCustomSelect() {
    createSelectItems('startItems', 'startSelected', (id) => currentStartId = id);
    createSelectItems('endItems', 'endSelected', (id) => currentEndId = id);

    document.getElementById('startSelected').addEventListener('click', function (e) {
        e.stopPropagation();
        closeAllSelect(this);
        document.getElementById('startItems').classList.toggle('select-hide');
    });
    document.getElementById('endSelected').addEventListener('click', function (e) {
        e.stopPropagation();
        closeAllSelect(this);
        document.getElementById('endItems').classList.toggle('select-hide');
    });
    document.addEventListener('click', closeAllSelect);
}

function createSelectItems(containerId, selectedId, onSelectCallback) {
    const container = document.getElementById(containerId);
    for (let id in locations) {
        let div = document.createElement('div');
        div.innerHTML = locations[id];

        div.addEventListener('mouseenter', () => listHoveredNodeId = id);
        div.addEventListener('mouseleave', () => listHoveredNodeId = null);

        div.addEventListener('click', function () {
            document.getElementById(selectedId).innerHTML = this.innerHTML;
            onSelectCallback(id);
            closeAllSelect();
        });
        container.appendChild(div);
    }
}

function closeAllSelect(except) {
    document.querySelectorAll('.select-items').forEach(el => {
        if (el.previousElementSibling !== except) el.classList.add('select-hide');
    });
}

// 🌟 完美串接隊友 PathFinder 的按鈕邏輯
window.onload = () => {
    const searchBtn = document.getElementById('searchBtn');
    const algorithmSelect = document.getElementById('algorithmSelect');

    searchBtn.addEventListener('click', () => {
        if (!currentStartId || !currentEndId) {
            document.getElementById('pathOutput').innerHTML = '<span style="color: #ff4444;">⚠️ 錯誤：請先選擇起點與終點！</span>';
            return;
        }

        // 清除舊的軌跡與狀態
        currentPath = [];
        snapshots = [];
        isAnimating = false;

        const startName = locations[currentStartId];
        const endName = locations[currentEndId];

        document.getElementById('pathOutput').innerHTML = '<span style="color: #ffff00;">📡 演算法運算中...</span>';

        try {
            // 🚀 1. 呼叫隊友寫好的類別
            const pf = new PathFinder();
            const algorithm = algorithmSelect?.value === 'dijkstra' ? 'dijkstra' : 'aStar';
            const algorithmLabel = algorithm === 'dijkstra' ? 'Dijkstra' : 'A*';

            // 🚀 2. 丟入起點終點，瞬間拿到運算結果的陣列！
            snapshots = pf[algorithm](Number(currentStartId), Number(currentEndId));

            // 🚀 3. 啟動我們的 p5.js 動畫播放器
            animIndex = 0;
            isAnimating = true;

            document.getElementById('distanceOutput').innerText = `狀態：計算完成`;
            document.getElementById('pathOutput').innerHTML = `
                    開始導航 (${algorithmLabel} 擴散尋路)<br>
          ----------------------<br>
          🚶‍♂️ 出發：${startName}<br>
          🌊 演算法波紋擴散中...<br>
          🏁 抵達：${endName}<br>
          ----------------------<br>
          ✨ 動畫展示中...
        `;
        } catch (error) {
            console.error("PathFinder 執行失敗:", error);
            document.getElementById('pathOutput').innerHTML = `<span style="color: #ff4444;">⚠️ 演算法執行發生錯誤，請按 F12 檢查 Console！</span>`;
        }
    });
};