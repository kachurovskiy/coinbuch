import { DataModel, Transaction, CashAsset, TransactionNegativeTypes, StableCoin, TransactionBuyTypes, TransactionSellTypes } from "./interfaces";
import { isNumericHeader } from "./parser";
import { getRemainingQuantity } from "./processor";

export class SectionGroups {
  render(model: DataModel): HTMLDivElement {
    const div = document.createElement('div');
    const groups = groupTransactions(model.executedTransactions);
    const groupChildren: HTMLElement[] = [];
    for (const group of groups) {
      groupChildren.push(this.renderGroup(group[1]));
    }
    groupChildren.sort((a, b) => a.dataset.sortKey!.localeCompare(b.dataset.sortKey!));
    div.replaceChildren(... groupChildren);
    return div;
  }

  private renderGroup(transactions: Transaction[]): HTMLDivElement {
    const result = document.createElement('div');
    result.classList.add('transactionGroup');

    if (transactions.length === 0) return result;

    transactions.sort((a, b) => a.time.getTime() - b.time.getTime());
    const firstTransaction = transactions[0];
    result.dataset.sortKey = `${CashAsset.includes(firstTransaction.asset) || StableCoin.includes(firstTransaction.asset) ? 0 : 1}-${firstTransaction.asset}`;

    this.renderGroupHeader(result, firstTransaction);
    const table = this.createTableStructure(result);
    this.renderTableHeader(table, firstTransaction);
    this.renderTableBody(table, transactions, firstTransaction);
    this.renderTableFooter(table, transactions, firstTransaction);
    this.renderGainLossByYear(result, transactions);

    return result;
  }

  private renderGroupHeader(parentElement: HTMLElement, firstTransaction: Transaction): void {
    const titleElement = document.createElement('h2');
    titleElement.innerText = getGroupKey(firstTransaction);
    titleElement.id = firstTransaction.asset;
    parentElement.appendChild(titleElement);
  }

  private createTableStructure(parentElement: HTMLElement): HTMLTableElement {
    const table = document.createElement('table');
    const tableScroller = document.createElement('div');
    tableScroller.classList.add('tableScroller');
    tableScroller.appendChild(table);
    parentElement.appendChild(tableScroller);
    return table;
  }

  private renderTableHeader(table: HTMLTableElement, firstTransaction: Transaction): void {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const priceCurrency = firstTransaction.priceCurrency;
    const headers = ['Time', 'Type', `Quantity ${firstTransaction.asset}`, `Price ${priceCurrency}`, `Fee ${priceCurrency}`, `Total ${priceCurrency}`, `Gain/Loss ${priceCurrency}`];
    for (const header of headers) {
      const th = document.createElement('th');
      th.innerText = header;
      if (isNumericHeader(header)) th.classList.add('numeric');
      headerRow.appendChild(th);
    }
  }

  private renderTableBody(table: HTMLTableElement, transactions: Transaction[], firstTransaction: Transaction): void {
    const groupSign = CashAsset.includes(firstTransaction.asset) || StableCoin.includes(firstTransaction.asset) ? 1 : -1;
    const priceCurrency = firstTransaction.priceCurrency;
    const headers = ['Time', 'Type', `Quantity ${firstTransaction.asset}`, `Price ${priceCurrency}`, `Fee ${priceCurrency}`, `Total ${priceCurrency}`, `Gain/Loss ${priceCurrency}`]; // Re-define or pass headers

    for (const transaction of transactions) {
      const row = document.createElement('tr');
      row.title = transaction.raw;
      table.appendChild(row);
      const cells = [
        transaction.time.toISOString().split('T')[0],
        transaction.type,
        transaction.quantity,
        transaction.price,
        transaction.fee,
        transaction.total * (TransactionNegativeTypes.includes(transaction.type) ? -1 : 1) * groupSign,
        transaction.gainOrLoss,
      ];
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const td = document.createElement('td');
        if (cell === 0) {
          td.innerText = '';
        } else if (typeof cell === 'number') {
          td.innerText = cell.toFixed(headers[i].startsWith('Price') ? 4 : 2);
          td.classList.add('numeric');
          if (headers[i].startsWith('Total') || headers[i].startsWith('Gain/Loss')) td.classList.add(cell > 0 ? 'positive' : 'negative');
        } else {
          td.innerText = String(cell);
        }
        row.appendChild(td);
      }
    }
  }

  private renderTableFooter(table: HTMLTableElement, transactions: Transaction[], firstTransaction: Transaction): void {
    const totalRow = document.createElement('tr');
    totalRow.classList.add('totalRow');
    table.appendChild(totalRow);

    totalRow.appendChild(this.createTd('Total'));
    totalRow.appendChild(document.createElement('td')); // Type

    const sharesSum = getRemainingQuantity(transactions);
    totalRow.appendChild(this.createNumericTd(sharesSum, 2, false)); // Quantity

    totalRow.appendChild(document.createElement('td')); // Price

    const totalFeeSum = transactions.reduce((total, t) => total + t.fee, 0);
    totalRow.appendChild(this.createNumericTd(totalFeeSum, 2, true)); // Fee

    const groupSign = CashAsset.includes(firstTransaction.asset) || StableCoin.includes(firstTransaction.asset) ? 1 : -1;
    const totalAmountSum = transactions.reduce((total, t) => total + t.total * (TransactionNegativeTypes.includes(t.type) ? -1 : 1) * groupSign, 0);
    totalRow.appendChild(this.createNumericTd(totalAmountSum, 2, true)); // Total Amount

    const gainLossSum = transactions.reduce((total, t) => total + t.gainOrLoss, 0);
    totalRow.appendChild(this.createNumericTd(gainLossSum, 2, true)); // Gain/Loss
  }

  private renderGainLossByYear(parentElement: HTMLElement, transactions: Transaction[]): void {
    const gainLossPerYear = new Map<number, number>();
    for (const transaction of transactions) {
      if (transaction.gainOrLoss === 0) continue;
      const year = transaction.time.getUTCFullYear();
      const gainLoss = gainLossPerYear.get(year) || 0;
      gainLossPerYear.set(year, gainLoss + transaction.gainOrLoss);
    }

    if (gainLossPerYear.size === 0) return;

    parentElement.appendChild(document.createElement('br'));
    const gainTable = document.createElement('table');
    parentElement.appendChild(gainTable);

    const gainThead = document.createElement('thead');
    const gainHeaderRow = document.createElement('tr');
    gainThead.appendChild(gainHeaderRow);
    gainTable.appendChild(gainThead);

    const gainHeaders = ['Year', 'Gain/Loss'];
    for (const header of gainHeaders) {
      const th = document.createElement('th');
      th.innerText = header;
      if (isNumericHeader(header)) th.classList.add('numeric');
      gainHeaderRow.appendChild(th);
    }

    for (const [year, gainLoss] of gainLossPerYear) {
      const row = document.createElement('tr');
      gainTable.appendChild(row);
      row.appendChild(this.createTd(String(year)));
      row.appendChild(this.createNumericTd(gainLoss, 2, true));
    }
  }

  private createTd(text: string): HTMLTableCellElement {
    const td = document.createElement('td');
    td.innerText = text;
    return td;
  }

  private createNumericTd(value: number | undefined | null,toFixed: number, addSignClass: boolean): HTMLTableCellElement {
    const td = document.createElement('td');
    if (value) {
      td.innerText = value.toFixed(toFixed);
      td.classList.add('numeric');
      if (addSignClass) {
        td.classList.add(value > 0 ? 'positive' : 'negative');
      }
    }
    return td;
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
