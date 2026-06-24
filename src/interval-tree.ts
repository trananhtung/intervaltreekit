export interface Interval<T = undefined> {
  lo: number;
  hi: number;
  data: T;
}

export interface IntervalTreeOptions {
  /**
   * Comparison for upper bound. Default: half-open [lo, hi) — lo inclusive, hi exclusive.
   * Set to true to use closed intervals [lo, hi] — both inclusive.
   */
  closed?: boolean;
}

type Node<T> = {
  lo: number;
  hi: number;
  data: T;
  maxHi: number;
  height: number;
  left: Node<T> | null;
  right: Node<T> | null;
};

function height<T>(n: Node<T> | null): number {
  return n ? n.height : 0;
}

function maxHi<T>(n: Node<T> | null): number {
  return n ? n.maxHi : -Infinity;
}

function update<T>(n: Node<T>): void {
  n.height = 1 + Math.max(height(n.left), height(n.right));
  n.maxHi = Math.max(n.hi, maxHi(n.left), maxHi(n.right));
}

function rotateRight<T>(y: Node<T>): Node<T> {
  const x = y.left!;
  y.left = x.right;
  x.right = y;
  update(y);
  update(x);
  return x;
}

function rotateLeft<T>(x: Node<T>): Node<T> {
  const y = x.right!;
  x.right = y.left;
  y.left = x;
  update(x);
  update(y);
  return y;
}

function balance<T>(n: Node<T>): number {
  return height(n.left) - height(n.right);
}

function rebalance<T>(n: Node<T>): Node<T> {
  update(n);
  const bf = balance(n);

  if (bf > 1) {
    if (balance(n.left!) < 0) n.left = rotateLeft(n.left!);
    return rotateRight(n);
  }
  if (bf < -1) {
    if (balance(n.right!) > 0) n.right = rotateRight(n.right!);
    return rotateLeft(n);
  }
  return n;
}

function insert<T>(root: Node<T> | null, lo: number, hi: number, data: T): Node<T> {
  if (!root) return { lo, hi, data, maxHi: hi, height: 1, left: null, right: null };
  if (lo < root.lo || (lo === root.lo && hi < root.hi)) {
    root.left = insert(root.left, lo, hi, data);
  } else {
    root.right = insert(root.right, lo, hi, data);
  }
  return rebalance(root);
}

function minNode<T>(n: Node<T>): Node<T> {
  while (n.left) n = n.left;
  return n;
}

function removeMin<T>(n: Node<T>): Node<T> | null {
  if (!n.left) return n.right;
  n.left = removeMin(n.left);
  return rebalance(n);
}

function remove<T>(
  root: Node<T> | null,
  lo: number,
  hi: number,
  data: T,
  eq: (a: T, b: T) => boolean
): [Node<T> | null, boolean] {
  if (!root) return [null, false];

  let found = false;
  if (lo < root.lo || (lo === root.lo && hi < root.hi)) {
    [root.left, found] = remove(root.left, lo, hi, data, eq);
  } else if (lo > root.lo || (lo === root.lo && hi > root.hi)) {
    [root.right, found] = remove(root.right, lo, hi, data, eq);
  } else {
    // lo/hi match — search both sides for the exact data
    if (eq(root.data, data)) {
      // Delete this node
      if (!root.right) return [root.left, true];
      const successor = minNode(root.right);
      root.lo = successor.lo;
      root.hi = successor.hi;
      root.data = successor.data;
      root.right = removeMin(root.right);
      return [rebalance(root), true];
    }
    // Same lo/hi, different data — try both subtrees
    [root.left, found] = remove(root.left, lo, hi, data, eq);
    if (!found) [root.right, found] = remove(root.right, lo, hi, data, eq);
  }

  return [rebalance(root), found];
}

function queryPoint<T>(
  n: Node<T> | null,
  p: number,
  closed: boolean,
  out: Interval<T>[]
): void {
  if (!n || n.maxHi < p || (!closed && n.maxHi <= p)) return;
  // Left subtree: only visit if its max hi can contain p
  if (n.left && (n.left.maxHi > p || (closed && n.left.maxHi >= p))) {
    queryPoint(n.left, p, closed, out);
  }
  // This node
  const contains = closed
    ? n.lo <= p && p <= n.hi
    : n.lo <= p && p < n.hi;
  if (contains) out.push({ lo: n.lo, hi: n.hi, data: n.data });
  // Right subtree: only if lo <= p (sorted by lo, so pruning is possible)
  if (n.right && n.lo <= p) {
    queryPoint(n.right, p, closed, out);
  }
}

function queryOverlap<T>(
  n: Node<T> | null,
  lo: number,
  hi: number,
  closed: boolean,
  out: Interval<T>[]
): void {
  if (!n) return;
  // Prune: if max hi in this subtree can't overlap [lo, hi], stop
  if (closed ? n.maxHi < lo : n.maxHi <= lo) return;

  queryOverlap(n.left, lo, hi, closed, out);

  // This node: overlaps if n.lo < hi (or <=) AND n.hi > lo (or >=)
  const overlaps = closed
    ? n.lo <= hi && n.hi >= lo
    : n.lo < hi && n.hi > lo;
  if (overlaps) out.push({ lo: n.lo, hi: n.hi, data: n.data });

  // Prune right: if n.lo > hi, all right subtree intervals have lo >= n.lo > hi — no overlap
  if (closed ? n.lo <= hi : n.lo < hi) {
    queryOverlap(n.right, lo, hi, closed, out);
  }
}

function toArray<T>(n: Node<T> | null, out: Interval<T>[]): void {
  if (!n) return;
  toArray(n.left, out);
  out.push({ lo: n.lo, hi: n.hi, data: n.data });
  toArray(n.right, out);
}

function countNodes<T>(n: Node<T> | null): number {
  if (!n) return 0;
  return 1 + countNodes(n.left) + countNodes(n.right);
}

/**
 * Augmented interval tree for fast overlap and stabbing queries.
 *
 * By default uses half-open intervals [lo, hi) — lo inclusive, hi exclusive.
 * Pass `{ closed: true }` to use closed intervals [lo, hi].
 *
 * All operations are O(log n) amortized (AVL-balanced). Overlap/stabbing
 * queries return k results in O(log n + k).
 *
 * @example
 * const tree = new IntervalTree();
 * tree.insert(1, 5);
 * tree.insert(3, 8);
 * tree.insert(10, 15);
 *
 * tree.queryPoint(4);   // → [{lo:1,hi:5,...}, {lo:3,hi:8,...}]
 * tree.queryOverlap(4, 12); // → [{lo:3,hi:8,...}, {lo:10,hi:15,...}]
 */
export class IntervalTree<T = undefined> {
  private _root: Node<T> | null = null;
  private _size = 0;
  private readonly _closed: boolean;

  constructor(opts?: IntervalTreeOptions) {
    this._closed = opts?.closed ?? false;
  }

  /**
   * Insert an interval [lo, hi) with optional associated data.
   * For closed trees: [lo, hi].
   */
  insert(lo: number, hi: number, data?: T): this {
    if (lo > hi) throw new RangeError(`Invalid interval: lo (${lo}) > hi (${hi})`);
    this._root = insert(this._root, lo, hi, data as T);
    this._size++;
    return this;
  }

  /**
   * Remove the first interval matching [lo, hi] + data (using referential equality).
   * Returns true if found and removed.
   */
  remove(lo: number, hi: number, data?: T): boolean {
    const [newRoot, found] = remove(
      this._root,
      lo,
      hi,
      data as T,
      (a, b) => a === b
    );
    if (found) {
      this._root = newRoot;
      this._size--;
    }
    return found;
  }

  /**
   * Find all intervals containing point `p`.
   * Half-open (default): lo ≤ p < hi
   * Closed: lo ≤ p ≤ hi
   */
  queryPoint(p: number): Interval<T>[] {
    const out: Interval<T>[] = [];
    queryPoint(this._root, p, this._closed, out);
    return out;
  }

  /**
   * Find all intervals overlapping the range [lo, hi).
   * Half-open (default): intervals where lo < other.hi AND hi > other.lo
   * Closed: intervals where lo ≤ other.hi AND hi ≥ other.lo
   */
  queryOverlap(lo: number, hi: number): Interval<T>[] {
    const out: Interval<T>[] = [];
    queryOverlap(this._root, lo, hi, this._closed, out);
    return out;
  }

  /**
   * Check if any interval contains point p (faster than queryPoint when you only need existence).
   */
  containsPoint(p: number): boolean {
    return this.queryPoint(p).length > 0;
  }

  /**
   * Check if any interval overlaps [lo, hi).
   */
  hasOverlap(lo: number, hi: number): boolean {
    return this.queryOverlap(lo, hi).length > 0;
  }

  /** Total number of intervals stored. */
  get size(): number {
    return this._size;
  }

  /** True if no intervals are stored. */
  get isEmpty(): boolean {
    return this._size === 0;
  }

  /** All intervals in sorted order (by lo, then hi). */
  toArray(): Interval<T>[] {
    const out: Interval<T>[] = [];
    toArray(this._root, out);
    return out;
  }

  /** Remove all intervals. */
  clear(): void {
    this._root = null;
    this._size = 0;
  }
}
