import crypto from "crypto";
import { LedgerEntry, PurchaseState } from "./types.js";

export class PurchaseLedger {
  private entries: LedgerEntry[] = [];
  private totalBudgetAtomic: bigint;
  private remainingBudgetAtomic: bigint;
  private totalSpentAtomic: bigint = 0n;
  private reservedBudgetAtomic: bigint = 0n;

  constructor(initialBudgetAtomic: bigint) {
    this.totalBudgetAtomic = initialBudgetAtomic;
    this.remainingBudgetAtomic = initialBudgetAtomic;
  }

  public static formatUsd(atomicUnits: bigint): string {
    const unitsStr = atomicUnits.toString().padStart(7, "0");
    const intPart = unitsStr.slice(0, -6) || "0";
    const decPart = unitsStr.slice(-6);
    // Trim trailing zeros but keep at least 2 or 3 decimals
    const formattedDec = decPart.replace(/(0+)$/, "");
    const finalDec = formattedDec.length < 2 ? formattedDec.padEnd(2, "0") : formattedDec;
    return `$${intPart}.${finalDec}`;
  }

  public static generateIdempotencyKey(runId: string, endpointUrl: string, amountAtomic: bigint, payTo: string): string {
    const raw = `${runId}:${endpointUrl.trim().toLowerCase()}:${amountAtomic.toString()}:${payTo.trim().toLowerCase()}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  public getRemainingBudgetAtomic(): bigint {
    return this.remainingBudgetAtomic;
  }

  public getTotalSpentAtomic(): bigint {
    return this.totalSpentAtomic;
  }

  public getReservedBudgetAtomic(): bigint {
    return this.reservedBudgetAtomic;
  }

  public findByIdempotencyKey(key: string): LedgerEntry | undefined {
    return this.entries.find((e) => e.idempotencyKey === key);
  }

  public findSettledByUrl(url: string): LedgerEntry | undefined {
    return this.entries.find(
      (e) => e.endpointUrl.toLowerCase() === url.toLowerCase() && (e.state === "SETTLED" || e.state === "DATA_RETRIEVED")
    );
  }

  public reserveBudget(amountAtomic: bigint): boolean {
    if (amountAtomic > this.remainingBudgetAtomic) {
      return false;
    }
    this.remainingBudgetAtomic -= amountAtomic;
    this.reservedBudgetAtomic += amountAtomic;
    return true;
  }

  public releaseReservation(amountAtomic: bigint): void {
    const toRelease = amountAtomic > this.reservedBudgetAtomic ? this.reservedBudgetAtomic : amountAtomic;
    this.reservedBudgetAtomic -= toRelease;
    this.remainingBudgetAtomic += toRelease;
  }

  public confirmSettlement(amountAtomic: bigint): void {
    const toSettle = amountAtomic > this.reservedBudgetAtomic ? this.reservedBudgetAtomic : amountAtomic;
    this.reservedBudgetAtomic -= toSettle;
    this.totalSpentAtomic += toSettle;
  }

  public appendEntry(entry: Omit<LedgerEntry, "id" | "runningTotalAtomic" | "remainingBudgetAtomic">): LedgerEntry {
    const fullEntry: LedgerEntry = {
      ...entry,
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      runningTotalAtomic: this.totalSpentAtomic.toString(),
      remainingBudgetAtomic: this.remainingBudgetAtomic.toString(),
    };
    this.entries.push(fullEntry);
    return fullEntry;
  }

  public updateEntry(id: string, updates: Partial<LedgerEntry>): LedgerEntry | undefined {
    const index = this.entries.findIndex((e) => e.id === id);
    if (index === -1) return undefined;
    this.entries[index] = {
      ...this.entries[index],
      ...updates,
      runningTotalAtomic: this.totalSpentAtomic.toString(),
      remainingBudgetAtomic: this.remainingBudgetAtomic.toString(),
    };
    return this.entries[index];
  }

  public getAllEntries(): LedgerEntry[] {
    return [...this.entries];
  }
}
