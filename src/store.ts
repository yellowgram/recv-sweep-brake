import type { AssetRecord, QuarantineLabel } from "./types.js";

export interface QuarantineStore {
  get(assetKey: string): AssetRecord | undefined;
  set(record: AssetRecord): void;
  listByLabel(label: QuarantineLabel): AssetRecord[];
  isDown(): boolean;
}

export class MemoryQuarantineStore implements QuarantineStore {
  private map = new Map<string, AssetRecord>();
  private down = false;

  setDown(v: boolean): void {
    this.down = v;
  }

  isDown(): boolean {
    return this.down;
  }

  get(assetKey: string): AssetRecord | undefined {
    if (this.down) throw new Error("store_down");
    return this.map.get(assetKey);
  }

  set(record: AssetRecord): void {
    if (this.down) throw new Error("store_down");
    this.map.set(record.assetKey, record);
  }

  listByLabel(label: QuarantineLabel): AssetRecord[] {
    if (this.down) throw new Error("store_down");
    return [...this.map.values()].filter((r) => r.label === label);
  }
}
