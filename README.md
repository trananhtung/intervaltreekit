# intervaltreekit

[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)

Zero-dependency augmented interval tree for TypeScript: find all intervals overlapping a point or range in O(log n + k). Port of Python `intervaltree` (400k/week PyPI) / Java Guava `RangeSet`.

[![npm](https://img.shields.io/npm/v/intervaltreekit)](https://www.npmjs.com/package/intervaltreekit)
[![license](https://img.shields.io/npm/l/intervaltreekit)](LICENSE)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)

## Install

```bash
npm install intervaltreekit
```

## Why?

- `interval-tree-1d` (624k/week) — abandoned June 2021, no TypeScript types
- `node-interval-tree` (63k/week) — abandoned December 2022, single maintainer
- `@flatten-js/interval-tree` (763k/week) — active but geometry-library-specific
- `intervaltreekit` — zero-dep, TypeScript-native, general-purpose, actively maintained

The three existing packages combine for ~1.4M weekly downloads with no modern typed standalone option. **intervaltreekit** fills the gap.

## Quick start

```typescript
import { IntervalTree } from "intervaltreekit";

const tree = new IntervalTree();

tree.insert(1, 5);
tree.insert(3, 8);
tree.insert(10, 15);

// Which intervals contain point 4?
tree.queryPoint(4);
// → [{ lo: 1, hi: 5, data: undefined }, { lo: 3, hi: 8, data: undefined }]

// Which intervals overlap with [6, 12)?
tree.queryOverlap(6, 12);
// → [{ lo: 3, hi: 8, data: undefined }, { lo: 10, hi: 15, data: undefined }]
```

## With associated data

```typescript
interface Event {
  title: string;
  room: string;
}

const calendar = new IntervalTree<Event>();

// Times in minutes since midnight
calendar.insert(9 * 60, 10 * 60, { title: "Standup", room: "A" });
calendar.insert(9 * 60 + 30, 11 * 60, { title: "Design review", room: "B" });
calendar.insert(10 * 60, 11 * 60 + 30, { title: "Sprint planning", room: "C" });

// What's happening at 10:15 AM?
const at1015 = calendar.queryPoint(10 * 60 + 15);
at1015.map(e => e.data.title);
// → ["Design review", "Sprint planning"]

// What's scheduled between 9:30 and 10:00?
const morning = calendar.queryOverlap(9 * 60 + 30, 10 * 60);
morning.map(e => e.data.title);
// → ["Standup", "Design review"]
```

## API

### `new IntervalTree<T>(opts?)`

```typescript
const tree = new IntervalTree<string>({
  closed: false,  // half-open [lo, hi) by default; set true for closed [lo, hi]
});
```

**Half-open `[lo, hi)`** (default): lo is inclusive, hi is exclusive. Good for time ranges, array indices.

**Closed `[lo, hi]`**: both lo and hi are inclusive. Good for date ranges, gene coordinates.

### `.insert(lo, hi, data?)`

```typescript
tree.insert(1, 5);             // no data
tree.insert(1, 5, "event A"); // with data
tree.insert(1, 5).insert(3, 8); // chainable
```

Throws `RangeError` if `lo > hi`.

### `.remove(lo, hi, data?)`

```typescript
tree.remove(1, 5);          // remove by lo/hi (first match)
tree.remove(1, 5, "event"); // remove exact interval+data match
```

Returns `true` if found and removed.

### `.queryPoint(p)`

```typescript
tree.queryPoint(4);
// → all intervals [lo, hi) where lo ≤ 4 < hi
```

### `.queryOverlap(lo, hi)`

```typescript
tree.queryOverlap(3, 7);
// → all intervals that overlap with [3, 7)
```

Two intervals overlap if neither is completely before the other:
- Half-open: `A.lo < B.hi && A.hi > B.lo`
- Closed: `A.lo ≤ B.hi && A.hi ≥ B.lo`

### `.containsPoint(p)` / `.hasOverlap(lo, hi)`

Boolean shortcuts — faster than checking `queryPoint().length > 0`.

### `.toArray()`

Returns all intervals sorted by `lo` (then `hi`).

### `.size`, `.isEmpty`, `.clear()`

```typescript
tree.size;    // number of intervals
tree.isEmpty; // boolean
tree.clear();  // remove all
```

## Use cases

### Calendar / scheduling

Find meetings at a specific time, check room availability, detect double-booking:

```typescript
const booked = new IntervalTree<{ room: string }>();
booked.insert(9 * 60, 10 * 60, { room: "A" });

function isRoomFree(room: string, from: number, to: number): boolean {
  return !booked.queryOverlap(from, to).some(e => e.data.room === room);
}
```

### Genomics / bioinformatics

Find all genes in a chromosomal region:

```typescript
const genes = new IntervalTree<{ name: string; strand: "+" | "-" }>();
genes.insert(1000, 5000, { name: "BRCA1", strand: "+" });
genes.insert(3000, 8000, { name: "TP53", strand: "-" });
genes.insert(10000, 15000, { name: "EGFR", strand: "+" });

// Genes overlapping region of interest
const region = genes.queryOverlap(4000, 12000);
region.map(g => g.data.name); // → ["BRCA1", "TP53", "EGFR"]
```

### Network CIDR matching

```typescript
// Convert IP to integer for comparison
function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc * 256) + parseInt(oct), 0);
}

const cidrs = new IntervalTree<{ subnet: string; owner: string }>();
// Add subnets as [network, broadcast]
cidrs.insert(ipToInt("192.168.1.0"), ipToInt("192.168.1.255"),
  { subnet: "192.168.1.0/24", owner: "internal" });

const ip = ipToInt("192.168.1.42");
const match = cidrs.queryPoint(ip);
match[0]?.data.owner; // → "internal"
```

### Text/code range highlighting

```typescript
// Syntax highlighting spans
const highlights = new IntervalTree<{ type: string; color: string }>();
highlights.insert(0, 6, { type: "keyword", color: "#569CD6" });   // "import"
highlights.insert(7, 18, { type: "string", color: "#CE9178" });   // '"intervaltreekit"'

// Get highlights for visible range [0, 20)
const visible = highlights.queryOverlap(0, 20);
```

## Algorithm

Uses an **augmented AVL tree** where each node stores the maximum `hi` value in its subtree. This allows the query algorithms to prune subtrees that can't contain matching intervals:

- **Insert/Remove**: O(log n) — standard AVL insert/delete with augmentation update
- **queryPoint(p)**: O(log n + k) — pruning via maxHi
- **queryOverlap(lo, hi)**: O(log n + k) — pruning via maxHi and sorted lo
- **Space**: O(n)

This is the same augmentation strategy used in _Introduction to Algorithms_ (CLRS) Chapter 14.

## Contributors ✨

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind are welcome — code, docs, bug reports, ideas, reviews! See the [emoji key](https://allcontributors.org/docs/en/emoji-key) for how each contribution is recognized, and open a PR or issue to get involved.

Thanks goes to these wonderful people:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/trananhtung"><img src="https://avatars.githubusercontent.com/u/30992229?v=4?s=100" width="100px;" alt="Tung Tran"/><br /><sub><b>Tung Tran</b></sub></a><br /><a href="https://github.com/trananhtung/intervaltreekit/commits?author=trananhtung" title="Code">💻</a> <a href="#maintenance-trananhtung" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

MIT
