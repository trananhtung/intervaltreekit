import { describe, test, expect, beforeEach } from "@jest/globals";
import { IntervalTree } from "../src/index.js";

// ── Half-open intervals [lo, hi) ────────────────────────────────────────────

describe("IntervalTree (half-open) — basic", () => {
  let tree: IntervalTree;

  beforeEach(() => { tree = new IntervalTree(); });

  test("empty tree", () => {
    expect(tree.size).toBe(0);
    expect(tree.isEmpty).toBe(true);
    expect(tree.queryPoint(5)).toEqual([]);
    expect(tree.queryOverlap(0, 10)).toEqual([]);
    expect(tree.toArray()).toEqual([]);
  });

  test("insert increases size", () => {
    tree.insert(1, 5);
    expect(tree.size).toBe(1);
    expect(tree.isEmpty).toBe(false);
    tree.insert(3, 8);
    expect(tree.size).toBe(2);
  });

  test("insert is chainable", () => {
    tree.insert(1, 5).insert(3, 8).insert(10, 15);
    expect(tree.size).toBe(3);
  });

  test("rejects lo > hi", () => {
    expect(() => tree.insert(5, 1)).toThrow(RangeError);
  });

  test("allows lo === hi (point interval)", () => {
    expect(() => tree.insert(5, 5)).not.toThrow();
  });
});

describe("IntervalTree (half-open) — queryPoint", () => {
  test("point inside interval [lo, hi)", () => {
    const t = new IntervalTree();
    t.insert(1, 5);
    expect(t.queryPoint(1)).toHaveLength(1); // lo inclusive
    expect(t.queryPoint(3)).toHaveLength(1);
    expect(t.queryPoint(4)).toHaveLength(1);
    expect(t.queryPoint(5)).toHaveLength(0); // hi exclusive
    expect(t.queryPoint(0)).toHaveLength(0);
  });

  test("multiple overlapping intervals at a point", () => {
    const t = new IntervalTree();
    t.insert(1, 5).insert(3, 8).insert(6, 10).insert(2, 7);
    // point 4 is in [1,5), [3,8), [2,7)
    const hits = t.queryPoint(4).map(i => `${i.lo}-${i.hi}`).sort();
    expect(hits).toEqual(["1-5", "2-7", "3-8"]);
  });

  test("point at exact boundary", () => {
    const t = new IntervalTree();
    t.insert(0, 10).insert(10, 20);
    expect(t.queryPoint(10).map(i => `${i.lo}-${i.hi}`).sort()).toEqual(["10-20"]);
  });

  test("adjacent non-overlapping intervals", () => {
    const t = new IntervalTree();
    t.insert(0, 5).insert(5, 10);
    expect(t.queryPoint(4)).toHaveLength(1);
    expect(t.queryPoint(5)).toHaveLength(1); // only [5,10)
    expect(t.queryPoint(9)).toHaveLength(1);
    expect(t.queryPoint(10)).toHaveLength(0);
  });

  test("returns correct interval data", () => {
    const t = new IntervalTree();
    t.insert(1, 5);
    const [hit] = t.queryPoint(3);
    expect(hit).toEqual({ lo: 1, hi: 5, data: undefined });
  });

  test("containsPoint", () => {
    const t = new IntervalTree();
    t.insert(1, 5).insert(10, 20);
    expect(t.containsPoint(3)).toBe(true);
    expect(t.containsPoint(7)).toBe(false);
    expect(t.containsPoint(15)).toBe(true);
  });
});

describe("IntervalTree (half-open) — queryOverlap", () => {
  test("fully overlapping", () => {
    const t = new IntervalTree();
    t.insert(1, 5).insert(3, 8).insert(6, 10);
    // [0, 10) overlaps all three
    expect(t.queryOverlap(0, 10)).toHaveLength(3);
  });

  test("query touches end of interval (half-open)", () => {
    const t = new IntervalTree();
    t.insert(1, 5);
    expect(t.queryOverlap(5, 8)).toHaveLength(0); // [5,8) does NOT overlap [1,5)
    expect(t.queryOverlap(4, 8)).toHaveLength(1); // [4,8) overlaps [1,5) at [4,5)
  });

  test("query touching lo", () => {
    const t = new IntervalTree();
    t.insert(5, 10);
    expect(t.queryOverlap(1, 5)).toHaveLength(0); // [1,5) does NOT overlap [5,10)
    expect(t.queryOverlap(1, 6)).toHaveLength(1); // [1,6) overlaps [5,10) at [5,6)
  });

  test("no overlap", () => {
    const t = new IntervalTree();
    t.insert(1, 3).insert(7, 10);
    expect(t.queryOverlap(4, 6)).toHaveLength(0);
  });

  test("contained query", () => {
    const t = new IntervalTree();
    t.insert(1, 10);
    expect(t.queryOverlap(3, 7)).toHaveLength(1); // [3,7) inside [1,10)
  });

  test("hasOverlap", () => {
    const t = new IntervalTree();
    t.insert(1, 5);
    expect(t.hasOverlap(2, 4)).toBe(true);
    expect(t.hasOverlap(6, 9)).toBe(false);
  });
});

// ── Closed intervals [lo, hi] ────────────────────────────────────────────────

describe("IntervalTree (closed) — queryPoint", () => {
  test("hi is inclusive in closed mode", () => {
    const t = new IntervalTree({ closed: true });
    t.insert(1, 5);
    expect(t.queryPoint(5)).toHaveLength(1); // hi inclusive
    expect(t.queryPoint(6)).toHaveLength(0);
  });

  test("lo is inclusive", () => {
    const t = new IntervalTree({ closed: true });
    t.insert(3, 7);
    expect(t.queryPoint(3)).toHaveLength(1);
    expect(t.queryPoint(2)).toHaveLength(0);
  });
});

describe("IntervalTree (closed) — queryOverlap", () => {
  test("touching intervals overlap in closed mode", () => {
    const t = new IntervalTree({ closed: true });
    t.insert(1, 5);
    expect(t.queryOverlap(5, 8)).toHaveLength(1); // [5,8] overlaps [1,5] at 5
  });
});

// ── Associated data ──────────────────────────────────────────────────────────

describe("IntervalTree — with data", () => {
  test("stores and returns data", () => {
    const t = new IntervalTree<string>();
    t.insert(1, 5, "event A");
    t.insert(3, 8, "event B");

    const hits = t.queryPoint(4);
    expect(hits).toHaveLength(2);
    const labels = hits.map(h => h.data).sort();
    expect(labels).toEqual(["event A", "event B"]);
  });

  test("object data", () => {
    interface Event { id: number; name: string }
    const t = new IntervalTree<Event>();
    t.insert(0, 100, { id: 1, name: "morning" });
    t.insert(50, 150, { id: 2, name: "afternoon" });

    const hits = t.queryPoint(75);
    expect(hits).toHaveLength(2);
    expect(hits.map(h => h.data.name).sort()).toEqual(["afternoon", "morning"]);
  });
});

// ── remove ───────────────────────────────────────────────────────────────────

describe("IntervalTree — remove", () => {
  test("remove existing interval", () => {
    const t = new IntervalTree();
    t.insert(1, 5).insert(3, 8).insert(6, 10);
    expect(t.remove(3, 8)).toBe(true);
    expect(t.size).toBe(2);
    expect(t.queryPoint(4)).toHaveLength(1); // only [1,5) remains
  });

  test("remove non-existent returns false", () => {
    const t = new IntervalTree();
    t.insert(1, 5);
    expect(t.remove(2, 7)).toBe(false);
    expect(t.size).toBe(1);
  });

  test("remove with data discrimination", () => {
    const t = new IntervalTree<string>();
    t.insert(1, 5, "A").insert(1, 5, "B");
    expect(t.size).toBe(2);
    expect(t.remove(1, 5, "A")).toBe(true);
    expect(t.size).toBe(1);
    const remaining = t.queryPoint(3);
    expect(remaining[0].data).toBe("B");
  });

  test("tree remains correct after many insertions and removals", () => {
    const t = new IntervalTree<number>();
    for (let i = 0; i < 50; i++) t.insert(i, i + 10, i);
    for (let i = 0; i < 25; i++) t.remove(i, i + 10, i);
    expect(t.size).toBe(25);

    // All remaining intervals should be i = 25..49
    const hits = t.queryPoint(30);
    expect(hits.every(h => h.data >= 25)).toBe(true);
  });
});

// ── toArray / clear ──────────────────────────────────────────────────────────

describe("IntervalTree — toArray / clear", () => {
  test("toArray returns sorted order", () => {
    const t = new IntervalTree();
    t.insert(5, 10).insert(1, 3).insert(3, 8).insert(1, 2);
    const arr = t.toArray();
    expect(arr).toHaveLength(4);
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i].lo >= arr[i-1].lo).toBe(true);
    }
  });

  test("clear empties the tree", () => {
    const t = new IntervalTree();
    t.insert(1, 5).insert(3, 8);
    t.clear();
    expect(t.size).toBe(0);
    expect(t.queryPoint(3)).toEqual([]);
  });
});

// ── Stress test ──────────────────────────────────────────────────────────────

describe("IntervalTree — stress test", () => {
  test("1000 intervals, queries are correct", () => {
    const t = new IntervalTree<number>();
    const intervals: [number, number][] = [];

    for (let i = 0; i < 1000; i++) {
      const lo = Math.floor(Math.random() * 900);
      const hi = lo + Math.floor(Math.random() * 100) + 1;
      intervals.push([lo, hi]);
      t.insert(lo, hi, i);
    }

    // Random stabbing queries — compare tree result vs brute force
    for (let q = 0; q < 20; q++) {
      const p = Math.floor(Math.random() * 1000);
      const treeHits = t.queryPoint(p).length;
      const bruteForce = intervals.filter(([lo, hi]) => lo <= p && p < hi).length;
      expect(treeHits).toBe(bruteForce);
    }
  });

  test("1000 intervals, overlap queries are correct", () => {
    const t = new IntervalTree<number>();
    const intervals: [number, number][] = [];

    for (let i = 0; i < 1000; i++) {
      const lo = Math.floor(Math.random() * 900);
      const hi = lo + Math.floor(Math.random() * 100) + 1;
      intervals.push([lo, hi]);
      t.insert(lo, hi, i);
    }

    for (let q = 0; q < 20; q++) {
      const lo = Math.floor(Math.random() * 900);
      const hi = lo + Math.floor(Math.random() * 100) + 1;
      const treeHits = t.queryOverlap(lo, hi).length;
      const bruteForce = intervals.filter(([ilo, ihi]) => ilo < hi && ihi > lo).length;
      expect(treeHits).toBe(bruteForce);
    }
  });
});

// ── Real-world: calendar scheduling ─────────────────────────────────────────

describe("IntervalTree — real-world: calendar scheduling", () => {
  interface Meeting { title: string; room: string }

  test("find all meetings at a given time", () => {
    const calendar = new IntervalTree<Meeting>();

    // Times as minutes since midnight
    calendar.insert(9 * 60, 10 * 60, { title: "Standup", room: "A" });
    calendar.insert(9 * 60 + 30, 11 * 60, { title: "Design review", room: "B" });
    calendar.insert(10 * 60, 11 * 60 + 30, { title: "Sprint planning", room: "C" });
    calendar.insert(11 * 60, 12 * 60, { title: "1:1", room: "A" });

    // What's happening at 10:15 AM?
    const at1015 = calendar.queryPoint(10 * 60 + 15);
    expect(at1015.map(m => m.data.title).sort()).toEqual(["Design review", "Sprint planning"]);

    // What's scheduled between 9:30 and 10:00?
    const morning = calendar.queryOverlap(9 * 60 + 30, 10 * 60);
    expect(morning.map(m => m.data.title).sort()).toEqual(["Design review", "Standup"]);
  });

  test("check room availability", () => {
    const calendar = new IntervalTree<Meeting>();
    calendar.insert(9 * 60, 10 * 60, { title: "Standup", room: "A" });
    calendar.insert(10 * 60, 11 * 60, { title: "1:1", room: "A" });

    // Room A is free from 8:00 to 9:00
    const roomAFree = !calendar.queryOverlap(8 * 60, 9 * 60)
      .some(m => m.data.room === "A");
    expect(roomAFree).toBe(true);

    // Room A is busy from 9:00 to 10:00
    const roomABusy = calendar.queryOverlap(9 * 60, 10 * 60)
      .some(m => m.data.room === "A");
    expect(roomABusy).toBe(true);
  });
});
