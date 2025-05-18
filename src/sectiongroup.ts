import { Transaction, CashAsset, TransactionNegativeTypes, StableCoin } from "./interfaces";
import { isNumericHeader } from "./parser";
import { getRemainingQuantity } from "./processor";

export class SectionGroup {
  private firstTransaction: Transaction;
  private priceCurrency: string;
  private headers: string[];

  constructor(private groupKey: string, private transactions: Transaction[]) {
    if (transactions.length === 0) throw new Error('No transactions provided for ' + groupKey);

    this.firstTransaction = transactions[0];
    this.priceCurrency = this.firstTransaction.priceCurrency;
    this.headers = [
      'Time',
      'Type',
      `Quantity ${this.firstTransaction.asset}`,
      `Price ${this.priceCurrency}`,
      `Fee ${this.priceCurrency}`,
      `Total ${this.priceCurrency}`,
      `Gain/Loss ${this.priceCurrency}`
    ];
  }

  renderGroup(): HTMLDivElement {
    const result = document.createElement('div');
    result.classList.add('transactionGroup');

    if (this.transactions.length === 0) return result;

    this.transactions.sort((a, b) => a.time.getTime() - b.time.getTime());
    result.dataset.sortKey = `${CashAsset.includes(this.firstTransaction.asset) || StableCoin.includes(this.firstTransaction.asset) ? 0 : 1}-${this.firstTransaction.asset}`;

    this.renderGroupHeader(result);
    const table = this.createTableStructure(result);
    this.renderTableHeader(table);
    this.renderTableBody(table);
    this.renderTableFooter(table);
    this.renderGainLossByYear(result);

    return result;
  }

  private renderGroupHeader(parentElement: HTMLElement): void {
    const titleElement = document.createElement('h2');
    titleElement.innerText = this.groupKey;
    titleElement.id = this.firstTransaction.asset;
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

  private renderTableHeader(table: HTMLTableElement): void {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    for (const header of this.headers) {
      const th = document.createElement('th');
      th.innerText = header;
      if (isNumericHeader(header)) th.classList.add('numeric');
      headerRow.appendChild(th);
    }
  }

  private renderTableBody(table: HTMLTableElement): void {
    const groupSign = CashAsset.includes(this.firstTransaction.asset) || StableCoin.includes(this.firstTransaction.asset) ? 1 : -1;

    for (const transaction of this.transactions) {
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
          td.innerText = cell.toFixed(this.headers[i].startsWith('Price') ? 4 : 2);
          td.classList.add('numeric');
          if (this.headers[i].startsWith('Total') || this.headers[i].startsWith('Gain/Loss')) td.classList.add(cell > 0 ? 'positive' : 'negative');
        } else {
          td.innerText = String(cell);
        }
        row.appendChild(td);
      }
    }
  }

  private renderTableFooter(table: HTMLTableElement): void {
    const totalRow = document.createElement('tr');
    totalRow.classList.add('totalRow');
    table.appendChild(totalRow);

    totalRow.appendChild(this.createTd('Total'));
    totalRow.appendChild(document.createElement('td')); // Type

    const sharesSum = getRemainingQuantity(this.transactions);
    totalRow.appendChild(this.createNumericTd(sharesSum, 2, false)); // Quantity

    totalRow.appendChild(document.createElement('td')); // Price

    const totalFeeSum = this.transactions.reduce((total, t) => total + t.fee, 0);
    totalRow.appendChild(this.createNumericTd(totalFeeSum, 2, true)); // Fee

    const groupSign = CashAsset.includes(this.firstTransaction.asset) || StableCoin.includes(this.firstTransaction.asset) ? 1 : -1;
    const totalAmountSum = this.transactions.reduce((total, t) => total + t.total * (TransactionNegativeTypes.includes(t.type) ? -1 : 1) * groupSign, 0);
    totalRow.appendChild(this.createNumericTd(totalAmountSum, 2, true)); // Total Amount

    const gainLossSum = this.transactions.reduce((total, t) => total + t.gainOrLoss, 0);
    totalRow.appendChild(this.createNumericTd(gainLossSum, 2, true)); // Gain/Loss
  }

  private renderGainLossByYear(parentElement: HTMLElement): void {
    const gainLossPerYear = new Map<number, number>();
    for (const transaction of this.transactions) {
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
