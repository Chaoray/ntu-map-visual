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
    constructor(graphData, coordData) {
        this.graph = graphData;
        this.coords = coordData;
    }

    getHeuristic(nodeId, targetId) {
        if (!this.coords || !this.coords[nodeId] || !this.coords[targetId]) return 0;
        const [lon1, lat1] = this.coords[nodeId];
        const [lon2, lat2] = this.coords[targetId];
        
        const dx = (lon1 - lon2) * 101751; 
        const dy = (lat1 - lat2) * 110574;
        return Math.sqrt(dx * dx + dy * dy);
    }

    runPathfinding(start, end, algo = 'DIJKSTRA') {
        let step = 0;
        let snapshots = [];

        const vis = {};
        const dis = {};
        const pre = {};

        for (const key of Object.keys(this.graph)) {
            vis[key] = false;
            dis[key] = Number.POSITIVE_INFINITY;
            pre[key] = null;
        }

        const visitedNodes = [];
        const pq = new PriorityQueue(false);
        
        pq.push(new DijkstraNode(0, String(start)));
        dis[String(start)] = 0;
        pre[String(start)] = String(start);

        while (!pq.empty()) {
            const n = pq.pop();
            const u = n.data;

            if (vis[u]) continue;
            vis[u] = true;
            visitedNodes.push(u);

            snapshots.push({
                step: step++,
                currentNode: u,
                visitedNodes: [...visitedNodes],
                frontierNodes: pq.elements.map(e => e.data),
                currentDistances: { ...dis }, 
                isFinished: false,
                finalPath: null
            });

            if (u === String(end)) break;

            const neighbors = this.graph[u] || {};
            for (const v of Object.keys(neighbors)) {
                if (vis[v]) continue;

                const w = neighbors[v];
                if (dis[u] + w < dis[v]) {
                    dis[v] = dis[u] + w;
                    pre[v] = u;
                    
                    let h = (algo === 'ASTAR') ? this.getHeuristic(v, String(end)) : 0;
                    pq.push(new DijkstraNode(dis[v] + h, v));
                }
            }
        }

        let path = null;
        if (Number.isFinite(dis[String(end)])) {
            path = [String(end)];
            let curr = String(end);
            while (pre[curr] !== curr && pre[curr] !== null) {
                path.unshift(pre[curr]);
                curr = pre[curr];
            }
        }

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