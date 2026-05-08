import './style.css';
import { PathFinder } from './pathfinding.js'; // 🌟 檔名修正為 pathfinding.js

let coordData, graphData, locationData;

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

function preload() {
  coordData = loadJSON('/coordinates.json');
  graphData = loadJSON('/graph.json');
  locationData = loadJSON('/locations.json');
}

function setup() {
  let container = document.getElementById('canvas-container');
  let canvas = createCanvas(container.clientWidth, container.clientHeight);
  canvas.parent('canvas-container');
  console.log("地圖資料載入成功！"); 
  initCustomSelect();
}

function draw() {
    background(10); 

    let minLon = 121.530, maxLon = 121.550;
    let minLat = 25.008, maxLat = 25.025;

    // 1. 畫底層道路 (灰色)
    if (graphData && coordData) {
        stroke(50, 50, 50); 
        strokeWeight(1);    
        for (let fromId in graphData) {
            let fromCoords = coordData[fromId];
            if (!fromCoords) continue;
            let x1 = map(fromCoords[0], minLon, maxLon, 0, width);
            let y1 = map(fromCoords[1], maxLat, minLat, 0, height);

            for (let toId in graphData[fromId]) {
                let toCoords = coordData[toId];
                if (!toCoords) continue;
                let x2 = map(toCoords[0], minLon, maxLon, 0, width);
                let y2 = map(toCoords[1], maxLat, minLat, 0, height);
                line(x1, y1, x2, y2);
            }
        }
    }

    // 2. 畫基礎節點 (微弱的深綠點，減少視覺干擾)
    if (coordData) {
        fill(30, 80, 50, 100); 
        noStroke(); 
        for (let id in coordData) {
            let [lon, lat] = coordData[id];
            let x = map(lon, minLon, maxLon, 0, width);
            let y = map(lat, maxLat, minLat, 0, height); 
            circle(x, y, 1.5); 
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
                let coords = coordData[id];
                if(coords) circle(map(coords[0], minLon, maxLon, 0, width), map(coords[1], maxLat, minLat, 0, height), 3);
            });
        }

        // 探索邊界：凸顯橘色，看起來像擴散的波紋
        fill(255, 165, 0, 180);
        if (activeSnapshot.frontierNodes) {
            activeSnapshot.frontierNodes.forEach(id => {
                let coords = coordData[id];
                if(coords) circle(map(coords[0], minLon, maxLon, 0, width), map(coords[1], maxLat, minLat, 0, height), 5);
            });
        }

        // 當前檢查點：黃色光圈
        fill(255, 255, 0);
        if (activeSnapshot.currentNode !== null && coordData[activeSnapshot.currentNode]) {
            let [clon, clat] = coordData[activeSnapshot.currentNode];
            circle(map(clon, minLon, maxLon, 0, width), map(clat, maxLat, minLat, 0, height), 8);
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
            if(coordData[id]) {
                let [px, py] = [map(coordData[id][0], minLon, maxLon, 0, width), map(coordData[id][1], maxLat, minLat, 0, height)];
                vertex(px, py); 
            }
        }
        endShape(); 
    }

    // 5. 畫起終點標記
    if (currentStartId && coordData[currentStartId]) {
        let [x, y] = [map(coordData[currentStartId][0], minLon, maxLon, 0, width), map(coordData[currentStartId][1], maxLat, minLat, 0, height)];
        fill(255, 255, 0); noStroke(); circle(x, y, 14); 
    }
    if (currentEndId && coordData[currentEndId]) {
        let [x, y] = [map(coordData[currentEndId][0], minLon, maxLon, 0, width), map(coordData[currentEndId][1], maxLat, minLat, 0, height)];
        fill(234, 67, 53); noStroke(); circle(x, y, 14); 
    }

    // 6. 處理 Hover 放大與 Tooltip
    let highlightId = listHoveredNodeId || mapHoveredNodeId;
    if (highlightId && coordData[highlightId]) {
        let hx = map(coordData[highlightId][0], minLon, maxLon, 0, width);
        let hy = map(coordData[highlightId][1], maxLat, minLat, 0, height);
        
        fill(0, 255, 170, 200); 
        noStroke();
        circle(hx, hy, 16); 

        if (locationData[highlightId]) {
            let name = locationData[highlightId];
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

// 滑鼠互動事件
function mouseMoved() {
    let minLon = 121.530, maxLon = 121.550;
    let minLat = 25.008, maxLat = 25.025;
    let closestId = null;
    let minDist = Infinity;

    for (let id in locationData) {
        let [lon, lat] = coordData[id];
        let px = map(lon, minLon, maxLon, 0, width);
        let py = map(lat, maxLat, minLat, 0, height);
        let d = dist(mouseX, mouseY, px, py);
        
        if (d < 15 && d < minDist) { 
            minDist = d;
            closestId = id;
        }
    }
    mapHoveredNodeId = closestId;
}

function mousePressed() {
    if (mapHoveredNodeId && mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        let name = locationData[mapHoveredNodeId];
        
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
}

function windowResized() {
    let container = document.getElementById('canvas-container');
    if (container) resizeCanvas(container.clientWidth, container.clientHeight);
}

window.preload = preload; window.setup = setup; window.draw = draw; window.windowResized = windowResized; window.mouseMoved = mouseMoved; window.mousePressed = mousePressed;

// 客製化下拉選單
function initCustomSelect() {
    createSelectItems('startItems', 'startSelected', (id) => currentStartId = id);
    createSelectItems('endItems', 'endSelected', (id) => currentEndId = id);

    document.getElementById('startSelected').addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllSelect(this);
        document.getElementById('startItems').classList.toggle('select-hide');
    });
    document.getElementById('endSelected').addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllSelect(this);
        document.getElementById('endItems').classList.toggle('select-hide');
    });
    document.addEventListener('click', closeAllSelect);
}

function createSelectItems(containerId, selectedId, onSelectCallback) {
    const container = document.getElementById(containerId);
    for (let id in locationData) {
        let div = document.createElement('div');
        div.innerHTML = locationData[id];
        
        div.addEventListener('mouseenter', () => listHoveredNodeId = id);
        div.addEventListener('mouseleave', () => listHoveredNodeId = null);

        div.addEventListener('click', function() {
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
  
  searchBtn.addEventListener('click', () => {
    if (!currentStartId || !currentEndId) {
      document.getElementById('pathOutput').innerHTML = '<span style="color: #ff4444;">⚠️ 錯誤：請先選擇起點與終點！</span>';
      return;
    }

    // 清除舊的軌跡與狀態
    currentPath = [];
    snapshots = [];
    isAnimating = false;
    
    const startName = locationData[currentStartId];
    const endName = locationData[currentEndId];

    document.getElementById('pathOutput').innerHTML = '<span style="color: #ffff00;">📡 演算法運算中...</span>';

    try {
        // 🚀 1. 呼叫隊友寫好的類別
        const pf = new PathFinder();
        
        // 🚀 2. 丟入起點終點，瞬間拿到運算結果的陣列！
        snapshots = pf.runPathfinding(Number(currentStartId), Number(currentEndId));
        
        // 🚀 3. 啟動我們的 p5.js 動畫播放器
        animIndex = 0;
        isAnimating = true;

        document.getElementById('distanceOutput').innerText = `狀態：計算完成`;
        document.getElementById('pathOutput').innerHTML = `
          開始導航 (Dijkstra 擴散尋路)<br>
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