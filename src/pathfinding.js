import graph from './assets/graph.json' with { type: 'json' };
import coordinates from './assets/coordinates.json' with { type: 'json' };
import coordinates from './assets/coordinates.json' with { type: 'json' };

class PriorityQueue {
    elements = [];
    _size = 0;
    is_max_heap = true;

    constructor(max_heap = true) {
        this.is_max_heap = max_heap;
    }

    _compare(a, b) {
        if (this.is_max_heap) {
            return a > b;
        }
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
                [this.elements[index], this.elements[parentIndex]] =
                    [this.elements[parentIndex], this.elements[index]];
                index = parentIndex;
            } else {
                break;
            }
        }
    }

    _siftDown(index) {
        while (true) {
            let target = index;
            let left = 2 * index + 1;
            let right = 2 * index + 2;

            if (left < this._size && this._compare(this.elements[left], this.elements[target])) {
                target = left;
            }
            if (right < this._size && this._compare(this.elements[right], this.elements[target])) {
                target = right;
            }

            if (target !== index) {
                [this.elements[index], this.elements[target]] =
                    [this.elements[target], this.elements[index]];
                index = target;
            } else {
                break;
            }
        }
    }

    empty() {
        return this._size === 0;
    }

    get front() {
        return this.empty() ? null : this.elements[0];
    }

    get size() {
        return this._size;
    }
}

class DijkstraNode {
    constructor(weight = 0, data) {
        this.weight = weight;
        this.data = data;
    }

    valueOf() {
        return this.weight;
    }
}

class AStarNode {
    constructor(weight = 0, data) {
        this.weight = weight;
        this.data = data;
    }

    valueOf() {
        return this.weight;
    }
}

class PathFinder {

    /**
     * Find the shortest-path from start to node2
     * @param {Number} start 
     * @param {Number} end 
     * @returns {Array[]} A series of node id on the path.
     */
    dijkstra(start, end) {
        let step = 0;
        let snapshots = [];

        const totalNodeSize = Object.keys(graph).length;
        const vis = new Array(totalNodeSize).fill(false);
        const dis = new Array(totalNodeSize).fill(Number.POSITIVE_INFINITY);
        const pre = new Array(totalNodeSize).fill(-1);

        const visitedNodes = [];

        const pq = new PriorityQueue(false);
        pq.push(new DijkstraNode(0, start));
        dis[start] = 0;
        pre[start] = `${start}`;

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
                currentDistances: [...dis],
                isFinished: false,
                finalPath: null
            });

            const neighbors = graph[u] || {};
            for (const v of Object.keys(neighbors)) {
                if (vis[v]) continue;

                const w = neighbors[v];
                if (dis[u] + w < dis[v]) {
                    dis[v] = dis[u] + w;
                    pre[v] = `${u}`;
                    pq.push(new DijkstraNode(dis[v], v));
                }
            }
        }

        let path = null;
        if (Number.isFinite(dis[end])) {
            path = [`${end}`];
            let curr = end;
            while (pre[curr] !== `${curr}`) {
                path.unshift(pre[curr]);
                curr = pre[curr];
            }
        }

        snapshots.push({
            step: step++,
            currentNode: null,
            visitedNodes: [...visitedNodes],
            frontierNodes: null,
            currentDistances: [...dis],
            isFinished: true,
            finalPath: path
        });

        return snapshots;
    }

    /**
     * Find the shortest path using the A* algorithm.
     * @param {Number} start
     * @param {Number} end
     * @returns {Array[]} A series of node id on the path.
     */
    aStar(start, end) {
        let step = 0;
        let snapshots = [];

        const totalNodeSize = Object.keys(graph).length;
        const vis = new Array(totalNodeSize).fill(false);
        const gScore = new Array(totalNodeSize).fill(Number.POSITIVE_INFINITY);
        const fScore = new Array(totalNodeSize).fill(Number.POSITIVE_INFINITY);
        const pre = new Array(totalNodeSize).fill(-1);

        const visitedNodes = [];
        const closedSet = new Set();

        const heuristic = (from, to) => {
            const fromCoords = coordinates[from];
            const toCoords = coordinates[to];

            if (!fromCoords || !toCoords) {
                return 0;
            }

            const deltaLon = fromCoords[0] - toCoords[0];
            const deltaLat = fromCoords[1] - toCoords[1];
            return Math.hypot(deltaLon, deltaLat);
        };

        const pq = new PriorityQueue(false);
        gScore[start] = 0;
        fScore[start] = heuristic(start, end);
        pre[start] = `${start}`;
        pq.push(new AStarNode(fScore[start], start));

        while (!pq.empty()) {
            const n = pq.pop();
            const u = Number(n.data);

            if (closedSet.has(u)) continue;
            closedSet.add(u);
            vis[u] = true;
            visitedNodes.push(u);

            snapshots.push({
                step: step++,
                currentNode: u,
                visitedNodes: [...visitedNodes],
                frontierNodes: pq.elements.map(e => e.data),
                currentDistances: [...gScore],
                isFinished: false,
                finalPath: null
            });

            if (u === end) {
                break;
            }

            const neighbors = graph[u] || {};
            for (const vKey of Object.keys(neighbors)) {
                const v = Number(vKey);
                if (closedSet.has(v)) continue;

                const tentativeG = gScore[u] + neighbors[vKey];
                if (tentativeG < gScore[v]) {
                    gScore[v] = tentativeG;
                    fScore[v] = tentativeG + heuristic(v, end);
                    pre[v] = `${u}`;
                    pq.push(new AStarNode(fScore[v], v));
                }
            }
        }

        let path = null;
        if (Number.isFinite(gScore[end])) {
            path = [`${end}`];
            let curr = end;
            while (pre[curr] !== `${curr}`) {
                path.unshift(pre[curr]);
                curr = Number(pre[curr]);
            }
        }

        snapshots.push({
            step: step++,
            currentNode: null,
            visitedNodes: [...visitedNodes],
            frontierNodes: null,
            currentDistances: [...gScore],
            isFinished: true,
            finalPath: path
        });

        return snapshots;
    }
}

export {
    PathFinder,
};
