class PriorityQueue {
    elements = [];
    _size = 0;
    is_max_heap = true;

    constructor(max_heap = true) {
        this.is_max_heap = max_heap;
    }

    _compare(a, b) {
        if (this.is_max_heap) return a > b;
        return a < b;
    }

    push(val) {
        this.elements.push(val);
        this._size++;
        this._siftUp(this._size - 1);
    }

    pop() {
        if (this.empty()) return null;
        const top = this.elements[0];
        const last = this.elements.pop();
        this._size--;
        if (this._size > 0) {
            this.elements[0] = last;
            this._siftDown(0);
        }
        return top;
    }

    _siftUp(index) {
        while (index > 0) {
            let parentIndex = Math.floor((index - 1) / 2);
            if (this._compare(this.elements[index], this.elements[parentIndex])) {
                [this.elements[index], this.elements[parentIndex]] = [this.elements[parentIndex], this.elements[index]];
                index = parentIndex;
            } else break;
        }
    }

    _siftDown(index) {
        while (true) {
            let target = index;
            let left = 2 * index + 1;
            let right = 2 * index + 2;

            if (left < this._size && this._compare(this.elements[left], this.elements[target])) target = left;
            if (right < this._size && this._compare(this.elements[right], this.elements[target])) target = right;

            if (target !== index) {
                [this.elements[index], this.elements[target]] = [this.elements[target], this.elements[index]];
                index = target;
            } else break;
        }
    }

    empty() { return this._size === 0; }
}

class DijkstraNode {
    constructor(weight = 0, data) {
        this.weight = weight;
        this.data = data;
    }
    valueOf() { return this.weight; }
}

class PathFinder {
    // 接收前端傳來的動態地圖與座標資料
    constructor(graphData, coordData) {
        this.graph = graphData;
        this.coords = coordData;
    }

    // A* 的核心：計算直線預估距離 (Heuristic)
    getHeuristic(nodeId, targetId) {
        if (!this.coords || !this.coords[nodeId] || !this.coords[targetId]) return 0;
        const [lon1, lat1] = this.coords[nodeId];
        const [lon2, lat2] = this.coords[targetId];
        
        // 台灣緯度約 25 度，將經緯度差轉換為大約的公尺距離
        const dx = (lon1 - lon2) * 101751; 
        const dy = (lat1 - lat2) * 110574;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 尋找最短路徑
     * @param {String|Number} start 
     * @param {String|Number} end 
     * @param {String} algo 'DIJKSTRA' 或 'ASTAR'
     */
    runPathfinding(start, end, algo = 'DIJKSTRA') {
        let step = 0;
        let snapshots = [];

        // 使用 Object 儲存狀態，避免非連續陣列索引問題
        const vis = {};
        const dis = {};
        const pre = {};

        // 初始化
        for (const key of Object.keys(this.graph)) {
            vis[key] = false;
            dis[key] = Number.POSITIVE_INFINITY;
            pre[key] = null;
        }

        const visitedNodes = [];
        const pq = new PriorityQueue(false);
        
        // 放入起點
        pq.push(new DijkstraNode(0, String(start)));
        dis[String(start)] = 0;
        pre[String(start)] = String(start);

        while (!pq.empty()) {
            const n = pq.pop();
            const u = n.data;

            if (vis[u]) continue;
            vis[u] = true;
            visitedNodes.push(u);

            // 記錄當下狀態 (Snapshot)
            snapshots.push({
                step: step++,
                currentNode: u,
                visitedNodes: [...visitedNodes],
                frontierNodes: pq.elements.map(e => e.data),
                currentDistances: { ...dis }, 
                isFinished: false,
                finalPath: null
            });

            // 提早結束優化
            if (u === String(end)) break;

            const neighbors = this.graph[u] || {};
            for (const v of Object.keys(neighbors)) {
                if (vis[v]) continue;

                const w = neighbors[v];
                // g(n): 實際走過的距離
                if (dis[u] + w < dis[v]) {
                    dis[v] = dis[u] + w;
                    pre[v] = u;
                    
                    // h(n): 預估剩餘距離
                    let h = (algo === 'ASTAR') ? this.getHeuristic(v, String(end)) : 0;
                    
                    // f(n) = g(n) + h(n) 作為權重放入 PriorityQueue
                    pq.push(new DijkstraNode(dis[v] + h, v));
                }
            }
        }

        // 回溯找尋最終路徑
        let path = null;
        if (Number.isFinite(dis[String(end)])) {
            path = [String(end)];
            let curr = String(end);
            while (pre[curr] !== curr && pre[curr] !== null) {
                path.unshift(pre[curr]);
                curr = pre[curr];
            }
        }

        // 存入最終結果快照
        snapshots.push({
            step: step++,
            currentNode: null,
            visitedNodes: [...visitedNodes],
            frontierNodes: [],
            currentDistances: { ...dis },
            isFinished: true,
            finalPath: path
        });

        return snapshots;
    }
}

export { PathFinder };