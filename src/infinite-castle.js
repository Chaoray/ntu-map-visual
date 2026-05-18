const infiniteCastleSketch = (p) => {
    const DOG_IMG_PATH = '/dog.jpg';     
    const BOSS_IMG_PATH = '/muzan.webp';   
    const MUSHROOM_IMG_PATH = '/tung.png'; 

    const BGM_PATH = '/bgm_infinite.mp3';     
    const DOOR_SFX_PATH = '/door_open.mp3';   
    const WIN_SFX_PATH = '/dog_win.mp3';      
    const TUNG_SFX_PATH = '/tung_tung.mp3';   

    let gameState = 'INTRO_WAIT'; 
    let editMode = 'MOVE'; 

    let doorOpenProgress = 0;
    let dogFallY = 0;
    let dogScale = 1;
    let dogPathIndex = 0;
    let dogAnimProgress = 0; 
    let hasPlayedWin = false; 

    let dogImg = null, muzanImg = null, tungImg = null;
    let bgm, doorSfx, winSfx, tungSfx;

    let nodes = [];
    let edges = [];
    let nextNodeId = 0;
    let selectedNode = null; 
    let draggedNode = null;

    let unvisited = new Set();
    let currentStep = 1; 
    let currentNodeId = null;
    let finalPath = [];

    let startBtn, nextStepBtn, resetBtn, clearBtn;
    let toolbar;

    const COLORS = {
        bg: '#0a0505', grid: '#241010', door: '#f4ebd0', 
        doorWood: '#3a2010', nodeBase: '#1a1a2e', nodeLocked: '#5e1010', 
        highlight: '#ffd700', path: '#800080', text: '#e0e0e0', 
        panelBg: 'rgba(20, 10, 10, 0.85)', boxBg: '#ffffff', 
        boxBorder: '#000000', boxText: '#000000', labelText: '#aaaaaa',
        newUpdate: '#ff0000'
    };

    p.preload = () => {
        dogImg = p.loadImage(DOG_IMG_PATH, () => {}, () => {});
        muzanImg = p.loadImage(BOSS_IMG_PATH, () => {}, () => {});
        tungImg = p.loadImage(MUSHROOM_IMG_PATH, () => {}, () => {});
    };

    p.setup = () => {
        let container = document.getElementById('infinite-castle-container');
        let canvas = p.createCanvas(container.clientWidth, container.clientHeight);
        canvas.parent('infinite-castle-container');
        
        p.textAlign(p.CENTER, p.CENTER);
        p.rectMode(p.CENTER);
        p.imageMode(p.CENTER);

        bgm = new Audio(BGM_PATH); bgm.loop = true; bgm.volume = 0.4;
        doorSfx = new Audio(DOOR_SFX_PATH);
        winSfx = new Audio(WIN_SFX_PATH);
        tungSfx = new Audio(TUNG_SFX_PATH);

        initDefaultGraph();
        createUI();
    };

    p.draw = () => {
        let containerView = document.getElementById('infinite-castle-view');
        
        if (containerView && containerView.classList.contains('hidden')) {
            if (!bgm.paused) bgm.pause(); 
            return;
        } else {
            if (gameState !== 'INTRO_WAIT' && bgm.paused) {
                bgm.play().catch(e => {}); 
            }
        }

        p.background(COLORS.bg);
        drawInfiniteGrid();

        if (gameState === 'INTRO_WAIT' || gameState === 'INTRO_OPEN_DOOR' || gameState === 'INTRO_FALL') {
            drawIntroScene();
        } else {
            drawEdges();
            drawNodes();
            drawInfoPanel();
            
            if (gameState === 'ANIMATE_DOG') animateDogMovement();
        }
    };

    function initDefaultGraph() {
        nodes = [];
        edges = [];
        nextNodeId = 0;
        nodes.push({ 
            id: nextNodeId++, 
            x: p.width / 2, 
            y: p.height / 2, 
            label: '無慘', 
            isStart: false, 
            isBoss: true, 
            cost: Infinity, 
            prev: null, 
            locked: false,
            isNewlyUpdated: false
        });
    }

    function createUI() {
        let container = document.getElementById('infinite-castle-container');
        container.style.position = 'relative'; 

        startBtn = p.createButton('開始墜落');
        startBtn.parent(container);
        startBtn.style('position', 'absolute');
        startBtn.style('left', '50%');
        startBtn.style('top', '55%');
        startBtn.style('transform', 'translate(-50%, -50%)');
        startBtn.style('padding', '12px 24px');
        startBtn.style('font-size', '18px');
        startBtn.style('background', '#8b0000');
        startBtn.style('color', 'white');
        startBtn.style('border', '2px solid #ffd700');
        startBtn.style('cursor', 'pointer');
        startBtn.style('border-radius', '8px');
        
        startBtn.mousePressed(() => {
            if (nodes.length > 0 && nodes[0].isBoss) {
                nodes[0].x = p.width / 2;
                nodes[0].y = p.height / 2;
            }

            gameState = 'INTRO_OPEN_DOOR'; 
            startBtn.hide();

            doorSfx.play().catch(e=>{});
            bgm.play().catch(e=>{});

            doorOpenProgress = p.width; 
        });

        toolbar = p.createDiv();
        toolbar.parent(container);
        toolbar.style('position', 'absolute');
        toolbar.style('left', '20px');
        toolbar.style('bottom', '20px');
        toolbar.style('background', COLORS.panelBg);
        toolbar.style('padding', '15px');
        toolbar.style('border', '1px solid #ffd700');
        toolbar.style('border-radius', '10px');
        toolbar.style('display', 'flex');
        toolbar.style('flex-direction', 'column'); 
        toolbar.style('gap', '10px');
        toolbar.hide();

        let title = p.createSpan('🗺️ 地圖編輯模式');
        title.parent(toolbar);
        title.style('color', COLORS.highlight);
        title.style('font-weight', 'bold');

        let modes = [
            { name: '👆 拖曳節點 (可移無慘)', val: 'MOVE' },
            { name: '➕ 新增房間 (首個為狗)', val: 'ADD_NODE' },
            { name: '🔗 新增通道', val: 'ADD_EDGE' },
            { name: '🍄 設定權重', val: 'SET_WEIGHT' },
            { name: '🗑️ 刪除物件', val: 'DEL' }
        ];

        let modeBtns = [];
        modes.forEach(m => {
            let btn = p.createButton(m.name);
            btn.parent(toolbar);
            btn.style('cursor', 'pointer');
            btn.style('padding', '8px');
            btn.style('background', '#333');
            btn.style('color', 'white');
            btn.style('border', '1px solid #555');
            btn.style('text-align', 'left');
            
            btn.mousePressed(() => { 
                editMode = m.val; 
                modeBtns.forEach(b => b.style('background', '#333'));
                btn.style('background', '#8b0000');
            });
            modeBtns.push(btn);
        });
        modeBtns[0].style('background', '#8b0000'); 

        let runBtn = p.createButton('▶️ 尋找無慘 (Dijkstra)');
        runBtn.parent(toolbar);
        runBtn.style('margin-top', '10px');
        runBtn.style('padding', '10px');
        runBtn.style('background', COLORS.highlight);
        runBtn.style('color', 'black');
        runBtn.style('font-weight', 'bold');
        runBtn.style('cursor', 'pointer');
        runBtn.mousePressed(startDijkstra);

        clearBtn = p.createButton('💣 清除全部重來');
        clearBtn.parent(toolbar);
        clearBtn.style('margin-top', '5px');
        clearBtn.style('padding', '10px');
        clearBtn.style('background', '#444');
        clearBtn.style('color', 'white');
        clearBtn.style('cursor', 'pointer');
        clearBtn.mousePressed(() => {
            initDefaultGraph(); 
        });

        let controlWrapper = p.createDiv();
        controlWrapper.parent(container);
        controlWrapper.style('position', 'absolute');
        controlWrapper.style('right', '20px');
        controlWrapper.style('bottom', '20px');
        controlWrapper.style('display', 'flex');
        controlWrapper.style('gap', '10px');

        nextStepBtn = p.createButton('下一步 ⏭️');
        nextStepBtn.parent(controlWrapper);
        nextStepBtn.style('padding', '12px 24px');
        nextStepBtn.style('font-size', '16px');
        nextStepBtn.style('background', COLORS.highlight);
        nextStepBtn.style('color', 'black');
        nextStepBtn.style('font-weight', 'bold');
        nextStepBtn.style('cursor', 'pointer');
        nextStepBtn.hide();
        nextStepBtn.mousePressed(dijkstraNextStep);

        resetBtn = p.createButton('🔄 返回編輯模式');
        resetBtn.parent(controlWrapper);
        resetBtn.style('padding', '12px 24px');
        resetBtn.style('font-size', '16px');
        resetBtn.style('background', '#555');
        resetBtn.style('color', 'white');
        resetBtn.style('cursor', 'pointer');
        resetBtn.hide();
        resetBtn.mousePressed(resetToEditor);
    }

    function drawIntroScene() {
        p.push();
        let doorW = 300;
        let doorH = 30;
        let doorX = p.width / 2;
        let doorY = p.height / 2;

        function drawShojiHalf(x, y, w, h) {
            p.fill(COLORS.door); 
            p.stroke(COLORS.doorWood); 
            p.strokeWeight(4);
            p.rect(x, y, w, h);
            
            p.strokeWeight(2);
            for(let i=1; i<4; i++) {
                p.line(x - w/2 + (w/4)*i, y - h/2, x - w/2 + (w/4)*i, y + h/2);
            }
        }

        drawShojiHalf(doorX - doorOpenProgress - doorW/4, doorY, doorW / 2, doorH); 
        drawShojiHalf(doorX + doorOpenProgress + doorW/4, doorY, doorW / 2, doorH); 

        let dY = doorY - 50 + dogFallY;
        let size = 100 * dogScale;
        if (dogImg && dogImg.width > 0) {
            p.image(dogImg, doorX, dY, size, size);
        } else {
            p.fill('#fff'); p.textSize(size / 2); p.text('🐶', doorX, dY);
        }

        if (gameState === 'INTRO_OPEN_DOOR') {
            doorOpenProgress += 35; 
            if (doorOpenProgress >= doorW / 2) {
                doorOpenProgress = doorW / 2;
                gameState = 'INTRO_FALL';
            }
        } else if (gameState === 'INTRO_FALL') {
            dogFallY += 12; 
            dogScale -= 0.02;
            if (dogScale <= 0) {
                gameState = 'EDIT_GRAPH';
                toolbar.style('display', 'flex'); 
            }
        }
        p.pop();
    }

    function drawInfiniteGrid() {
        p.stroke(COLORS.grid);
        p.strokeWeight(1);
        for (let x = 0; x < p.width; x += 80) p.line(x, 0, x, p.height);
        for (let y = 0; y < p.height; y += 80) p.line(0, y, p.width, y);
    }

    function drawEdges() {
        edges.forEach(edge => {
            let n1 = nodes.find(n => n.id === edge.u);
            let n2 = nodes.find(n => n.id === edge.v);
            if (!n1 || !n2) return;

            p.stroke(COLORS.path);
            p.strokeWeight(8); 
            p.line(n1.x, n1.y, n2.x, n2.y);

            if (gameState === 'DIJKSTRA_DONE' || gameState === 'ANIMATE_DOG') {
                for (let i = 0; i < finalPath.length - 1; i++) {
                    if ((finalPath[i] === edge.u && finalPath[i+1] === edge.v) ||
                        (finalPath[i] === edge.v && finalPath[i+1] === edge.u)) {
                        p.stroke(COLORS.highlight);
                        p.strokeWeight(5);
                        p.line(n1.x, n1.y, n2.x, n2.y);
                    }
                }
            }

            let midX = (n1.x + n2.x) / 2;
            let midY = (n1.y + n2.y) / 2;
            
            if (tungImg && tungImg.width > 0) {
                p.image(tungImg, midX, midY - 15, 50, 50);
            } else {
                p.fill('#800080'); p.noStroke(); p.circle(midX, midY - 10, 40);
                p.fill('#fff'); p.textSize(18); p.text('🍄', midX, midY - 10);
            }
            
            p.fill(COLORS.highlight); p.noStroke(); p.textSize(20); p.textStyle(p.BOLD);
            p.text(`${edge.weight} HP`, midX, midY + 22);
            p.textStyle(p.NORMAL);
        });

        if (editMode === 'ADD_EDGE' && selectedNode) {
            p.stroke('#fff'); p.strokeWeight(3); p.drawingContext.setLineDash([10, 10]);
            p.line(selectedNode.x, selectedNode.y, p.mouseX, p.mouseY);
            p.drawingContext.setLineDash([]);
        }
    }

    function drawNodes() {
        nodes.forEach(n => {
            p.push();
            
            let nodeW = 90;
            let nodeH = 90;
            p.stroke(n.locked ? COLORS.highlight : '#555');
            p.strokeWeight(n === selectedNode ? 5 : 3);
            p.fill(n.locked ? COLORS.nodeLocked : COLORS.nodeBase);

            if (n.id === currentNodeId && gameState === 'DIJKSTRA') {
                p.stroke('#ff8c00'); p.strokeWeight(6);
            }

            p.rect(n.x, n.y, nodeW, nodeH, 8);

            if (gameState !== 'EDIT_GRAPH') {
                let boxW = 34; 
                let boxH = 24;
                let boxY = n.y - nodeH/2 - boxH/2 - 15; 
                
                p.noStroke();
                p.fill(COLORS.labelText);
                p.textSize(10);
                p.textStyle(p.NORMAL);
                p.text('HP', n.x - boxW, boxY - boxH/2 - 6);
                p.text('狀態', n.x, boxY - boxH/2 - 6);
                p.text('來源', n.x + boxW, boxY - boxH/2 - 6);

                p.stroke(COLORS.boxBorder);
                p.strokeWeight(2);
                p.fill(COLORS.boxBg);
                
                p.rect(n.x - boxW, boxY, boxW, boxH);
                p.rect(n.x, boxY, boxW, boxH);
                p.rect(n.x + boxW, boxY, boxW, boxH);

                p.noStroke();
                p.textSize(14); p.textStyle(p.BOLD);
                
                let costTextColor = n.isNewlyUpdated ? COLORS.newUpdate : COLORS.boxText;
                
                let costText = n.cost === Infinity ? '∞' : n.cost;
                p.fill(costTextColor); 
                p.text(costText, n.x - boxW, boxY); 
                
                p.fill(COLORS.boxText); 
                p.text(n.locked ? '🔒' : ' ', n.x, boxY); 
                
                let prevLabel = '-';
                if (n.prev !== null) {
                    let prevNode = nodes.find(pn => pn.id === n.prev);
                    if(prevNode) prevLabel = prevNode.label.replace('房間 ', ''); 
                    if(prevNode.isStart) prevLabel = 'S';
                }
                
                p.fill(costTextColor); 
                p.text(prevLabel, n.x + boxW, boxY); 
                p.textStyle(p.NORMAL);
            }

            if (n.isStart && dogImg && dogImg.width > 0) p.image(dogImg, n.x, n.y, 70, 70);
            else if (n.isBoss && muzanImg && muzanImg.width > 0) p.image(muzanImg, n.x, n.y, 70, 70);
            else {
                p.noStroke(); p.fill(COLORS.text); p.textSize(18); p.textStyle(p.BOLD);
                p.text(n.label, n.x, n.y);
            }
            p.pop();
        });
    }

    function drawInfoPanel() {
        if (gameState === 'INTRO_WAIT' || gameState === 'INTRO_OPEN_DOOR' || gameState === 'INTRO_FALL' || gameState === 'EDIT_GRAPH') return;

        p.push();
        p.fill(COLORS.panelBg); p.stroke(COLORS.highlight); p.strokeWeight(2); p.rectMode(p.CORNER);
        p.rect(p.width - 340, 20, 320, 180, 10);

        p.fill(COLORS.text); p.noStroke(); p.textAlign(p.LEFT, p.TOP); p.textSize(20);
        p.text('📜 演算法戰報', p.width - 320, 30);
        
        p.textSize(16); p.fill('#aaa');
        let msg = "";
        if (gameState === 'DIJKSTRA') {
            if (currentStep === 1) msg = "1. 尋找目前 HP 耗損最小的未上鎖房間...";
            else if (currentStep === 2) msg = "2. 鎖定房間，並找出它的相鄰通道...";
            else if (currentStep === 3) msg = "3. 結算相鄰房間的總 HP 損耗，並更新距離表！";
        } else if (gameState === 'DIJKSTRA_DONE' || gameState === 'ANIMATE_DOG') {
            p.fill('#0f0');
            msg = "🎉 已找到通往無慘的最短路徑！\n點擊『下一步』發動攻擊！";
        }
        p.text(msg, p.width - 320, 70, 280, 100);
        p.pop();
    }

    p.mousePressed = (event) => {
        let containerView = document.getElementById('infinite-castle-view');
        if (containerView && containerView.classList.contains('hidden')) return;
        
        if (event && event.target && event.target.tagName && event.target.tagName.toUpperCase() !== 'CANVAS') {
            return;
        }

        if (p.mouseX < 280 && p.mouseY > p.height - 380) return; 
        if (p.mouseX > p.width - 320 && p.mouseY > p.height - 120) return;

        if (gameState !== 'EDIT_GRAPH') return;

        let clickedNode = nodes.find(n => p.dist(p.mouseX, p.mouseY, n.x, n.y) < 45); 

        if (editMode === 'MOVE' && clickedNode) draggedNode = clickedNode;
        else if (editMode === 'ADD_NODE' && !clickedNode) {
            let hasDog = nodes.some(n => n.isStart);
            let isFirstNode = !hasDog; 
            let roomCount = nodes.filter(n => !n.isBoss && !n.isStart).length;

            nodes.push({
                id: nextNodeId++, x: p.mouseX, y: p.mouseY, 
                label: isFirstNode ? '我的刀盾' : `房間 ${String.fromCharCode(65 + (roomCount % 26))}`, 
                isStart: isFirstNode, 
                isBoss: false, 
                cost: Infinity, prev: null, locked: false,
                isNewlyUpdated: false
            });
        }
        else if (editMode === 'ADD_EDGE') {
            if (clickedNode) {
                if (!selectedNode) selectedNode = clickedNode;
                else if (selectedNode !== clickedNode) {
                    let exists = edges.find(e => (e.u === selectedNode.id && e.v === clickedNode.id) || (e.v === selectedNode.id && e.u === clickedNode.id));
                    if (!exists) {
                        let w = parseInt(prompt("輸入 Tung Tung 的強度:", "5"));
                        if (!isNaN(w) && w > 0) edges.push({ u: selectedNode.id, v: clickedNode.id, weight: w });
                    }
                    selectedNode = null;
                }
            } else selectedNode = null; 
        }
        else if (editMode === 'DEL') {
            if (clickedNode && !clickedNode.isStart && !clickedNode.isBoss) {
                nodes = nodes.filter(n => n.id !== clickedNode.id);
                edges = edges.filter(e => e.u !== clickedNode.id && e.v !== clickedNode.id);
            } else if (!clickedNode) {
                for (let i = edges.length - 1; i >= 0; i--) {
                    let e = edges[i]; let n1 = nodes.find(n => n.id === e.u); let n2 = nodes.find(n => n.id === e.v);
                    if (distToSegment(p.mouseX, p.mouseY, n1.x, n1.y, n2.x, n2.y) < 20) { edges.splice(i, 1); break; }
                }
            }
        }
        else if (editMode === 'SET_WEIGHT') {
            if (!clickedNode) {
                for (let e of edges) {
                    let n1 = nodes.find(n => n.id === e.u); 
                    let n2 = nodes.find(n => n.id === e.v);
                    
                    // 🌟 修改重點 3：算出連線的中點（香菇所在位置）
                    let midX = (n1.x + n2.x) / 2;
                    let midY = (n1.y + n2.y) / 2;
                    
                    // 🌟 修改重點 4：只要點在香菇圖案附近（半徑 40 內），或者點在連線上，都可以成功觸發修改！
                    if (p.dist(p.mouseX, p.mouseY, midX, midY) < 40 || distToSegment(p.mouseX, p.mouseY, n1.x, n1.y, n2.x, n2.y) < 20) {
                        let w = parseInt(prompt("修改 Tung Tung 的強度:", e.weight));
                        if (!isNaN(w) && w > 0) e.weight = w;
                        break;
                    }
                }
            }
        }
    };

    p.mouseDragged = () => { if (draggedNode && editMode === 'MOVE') { draggedNode.x = p.mouseX; draggedNode.y = p.mouseY; } };
    p.mouseReleased = () => { draggedNode = null; };

    function distToSegment(px, py, x1, y1, x2, y2) {
        let l2 = p.dist(x1, y1, x2, y2) ** 2;
        if (l2 === 0) return p.dist(px, py, x1, y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return p.dist(px, py, x1 + t * (x2 - x1), y1 + t * (y2 - y1));
    }

    function startDijkstra() {
        let hasStart = nodes.find(n => n.isStart);
        if (!hasStart) {
            alert("請先新增「我的刀盾」起點！");
            return;
        }

        toolbar.hide(); nextStepBtn.show(); resetBtn.show();
        gameState = 'DIJKSTRA'; currentStep = 1; hasPlayedWin = false;
        nodes.forEach(n => { n.cost = n.isStart ? 0 : Infinity; n.prev = null; n.locked = false; n.isNewlyUpdated = false; unvisited.add(n.id); });
    }

    function dijkstraNextStep() {
        if (gameState === 'DIJKSTRA_DONE') {
            gameState = 'ANIMATE_DOG'; dogPathIndex = 0; dogAnimProgress = 0; nextStepBtn.hide(); return;
        }

        nodes.forEach(n => n.isNewlyUpdated = false);

        if (currentStep === 1) {
            let minCost = Infinity; let minNodeId = null;
            for (let id of unvisited) {
                let n = nodes.find(x => x.id === id);
                if (n.cost < minCost) { minCost = n.cost; minNodeId = id; }
            }

            if (minNodeId === null) { alert("找不到無慘！路徑可能沒有連接。"); gameState = 'DIJKSTRA_DONE'; return; }

            currentNodeId = minNodeId;
            let cNode = nodes.find(n => n.id === currentNodeId);
            cNode.locked = true; unvisited.delete(currentNodeId);

            if (cNode.isBoss) { gameState = 'DIJKSTRA_DONE'; tracePath(currentNodeId); return; }
            currentStep = 2;
        } else if (currentStep === 2) {
            currentStep = 3;
        } else if (currentStep === 3) {
            edges.forEach(e => {
                let nId = (e.u === currentNodeId && unvisited.has(e.v)) ? e.v : (e.v === currentNodeId && unvisited.has(e.u)) ? e.u : null;
                if (nId !== null) {
                    let nNode = nodes.find(n => n.id === nId);
                    let cNode = nodes.find(n => n.id === currentNodeId);
                    let newCost = cNode.cost + e.weight;
                    if (newCost < nNode.cost) { 
                        nNode.cost = newCost; 
                        nNode.prev = currentNodeId; 
                        nNode.isNewlyUpdated = true; 
                    }
                }
            });
            currentStep = 1;
        }
    }

    function tracePath(bossId) {
        let curr = bossId; finalPath = [];
        while (curr !== null) {
            finalPath.unshift(curr);
            curr = nodes.find(n => n.id === curr).prev;
        }
    }

    function animateDogMovement() {
        if (dogPathIndex >= finalPath.length - 1) {
            if (!hasPlayedWin) {
                winSfx.play().catch(e=>{});
                hasPlayedWin = true;
            }
            p.fill(COLORS.highlight); p.textSize(40); p.text("⚔️ 討伐成功！", p.width / 2, 100);
            return;
        }

        let n1 = nodes.find(n => n.id === finalPath[dogPathIndex]);
        let n2 = nodes.find(n => n.id === finalPath[dogPathIndex + 1]);

        if (dogAnimProgress === 0) {
            let sfx = tungSfx.cloneNode();
            sfx.volume = 0.8;
            sfx.play().catch(e=>{});
        }

        let x = p.lerp(n1.x, n2.x, dogAnimProgress); 
        let y = p.lerp(n1.y, n2.y, dogAnimProgress);

        if (dogImg && dogImg.width > 0) p.image(dogImg, x, y, 70, 70);
        else { p.fill('#fff'); p.textSize(40); p.text('🐶', x, y); }

        dogAnimProgress += 0.03; 
        if (dogAnimProgress >= 1) { dogAnimProgress = 0; dogPathIndex++; }
    }

    function resetToEditor() {
        gameState = 'EDIT_GRAPH';
        toolbar.style('display', 'flex'); nextStepBtn.hide(); resetBtn.hide();
        currentNodeId = null; finalPath = []; unvisited.clear();
        nodes.forEach(n => { n.locked = false; n.cost = Infinity; n.prev = null; n.isNewlyUpdated = false; });
    }

    p.windowResized = () => {
        let container = document.getElementById('infinite-castle-container');
        if(container) {
            p.resizeCanvas(container.clientWidth, container.clientHeight);
        }
    };
};

new p5(infiniteCastleSketch);