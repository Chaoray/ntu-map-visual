import graph from './assets/graph.json' with { type: 'json' };

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

class PathFinder {

    /**
     * Find the shortest-path from start to node2
     * @param {Number} start 
     * @param {Number} end 
     * @returns {Array[]} A series of node id on the path.
     */
    runPathfinding(start, end) {
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
}

export {
    PathFinder,
};
