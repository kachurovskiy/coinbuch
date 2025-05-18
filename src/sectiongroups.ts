import { DataModel, Transaction, CashAsset, StableCoin, TransactionBuyTypes, TransactionSellTypes } from "./interfaces";
import { SectionGroup } from "./sectiongroup";

export class SectionGroups {
  render(model: DataModel): HTMLDivElement {
    const div = document.createElement('div');
    const groups = groupTransactions(model.executedTransactions);
    const groupChildren: HTMLElement[] = [];
    for (const [groupKey, group] of groups) {
      groupChildren.push(new SectionGroup(groupKey, group).renderGroup());
    }
    groupChildren.sort((a, b) => a.dataset.sortKey!.localeCompare(b.dataset.sortKey!));
    div.replaceChildren(... groupChildren);
    return div;
  }
}

function groupTransactions(transactions: Transaction[]): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = getGroupKey(transaction);
    const group = groups.get(key) || [];
    group.push(transaction);
    groups.set(key, group);
  }
  return groups;
}

function getGroupKey(t: Transaction): string {
  if (t.type === 'Deposit' || t.type === 'Withdrawal') return 'Deposit / Withdrawal';
  if (t.type === 'Reward Income') return t.type;
  if (StableCoin.includes(t.asset) && (TransactionBuyTypes.includes(t.type) || TransactionSellTypes.includes(t.type))) return `${t.asset} Trading`;
  if (!CashAsset.includes(t.asset)) return t.asset;
  return t.type;
}
