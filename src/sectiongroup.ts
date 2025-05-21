import { CurrencyExchangeAPI, Money, needsCurrencyConversion, printCurrency } from "./currency";
import { Transaction, CashAsset, TransactionNegativeTypes, StableCoin } from "./interfaces";
import { isNumericHeader } from "./parser";
import { getRemainingQuantity } from "./processor";

export class SectionGroup {
  private firstTransaction: Transaction;
  private priceCurrency: string;
  private headers: string[];
  private needsCurrencyConversion = false;

  constructor(private groupKey: string, private transactions: Transaction[], private exchange: CurrencyExchangeAPI) {
    if (transactions.length === 0) throw new Error('No transactions provided for ' + groupKey);

    this.firstTransaction = transactions[0];
    this.priceCurrency = this.firstTransaction.priceCurrency;
    this.needsCurrencyConversion = needsCurrencyConversion(transactions, this.exchange.targetCurrency);
    this.headers = [
      'Time',
      'Type',
      `Quantity ${this.firstTransaction.asset}`,
      `Price ${printCurrency(this.priceCurrency)}`,
    ];
    this.needsCurrencyConversion && this.headers.push(`Price ${printCurrency(this.exchange.targetCurrency)}`);
    this.headers.push(`Fee ${printCurrency(this.priceCurrency)}`);
    this.needsCurrencyConversion && this.headers.push(`Fee ${printCurrency(this.exchange.targetCurrency)}`);
    this.headers.push(`Total ${printCurrency(this.priceCurrency)}`);
    this.needsCurrencyConversion && this.headers.push(`Total ${printCurrency(this.exchange.targetCurrency)}`);
    this.headers.push(`Gain ${printCurrency(this.priceCurrency)}`);
    this.needsCurrencyConversion && this.headers.push(`Gain ${printCurrency(this.exchange.targetCurrency)}`);
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
      ];
      this.needsCurrencyConversion && cells.push(transaction.price.convert(transaction.time, this.exchange));
      cells.push(transaction.fee);
      this.needsCurrencyConversion && cells.push(transaction.fee.convert(transaction.time, this.exchange));
      const signedTotal = transaction.total.multiply(groupSign * (TransactionNegativeTypes.includes(transaction.type) ? -1 : 1));
      cells.push(signedTotal);
      this.needsCurrencyConversion && cells.push(signedTotal.convert(transaction.time, this.exchange));
      cells.push(transaction.gainOrLoss);
      this.needsCurrencyConversion && cells.push(transaction.gainOrLoss.convert(transaction.time, this.exchange));
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const td = document.createElement('td');
        const header = this.headers[i];
        if (cell === 0) {
          td.innerText = '';
        } else if (typeof cell === 'number') {
          td.innerText = cell.toFixed(header.startsWith('Price') && Math.abs(cell) < 10000 ? 4 : 2);
          td.classList.add('numeric');
          if (header.startsWith('Total') || header.startsWith('Gain')) td.classList.add(cell > 0 ? 'positive' : 'negative');
        } else if (cell instanceof Money) {
          td.innerText = cell.toFixed(header.startsWith('Price') && Math.abs(cell.amount) < 10000 ? 4 : 2);
          td.classList.add('numeric');
          if (header.startsWith('Total') || header.startsWith('Gain')) td.classList.add(cell.amount > 0 ? 'positive' : 'negative');
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
    this.needsCurrencyConversion && totalRow.appendChild(document.createElement('td')); // Price in target currency

    const totalFeeSum = this.transactions.reduce((total, t) => total.plus(t.fee), new Money(0, this.priceCurrency));
    totalRow.appendChild(this.createMoneyTd(totalFeeSum)); // Fee

    if (this.needsCurrencyConversion) {
      const totalFeeSumInTargetCurrency = this.transactions.reduce((total, t) => total.plus(t.fee.convert(t.time, this.exchange)), new Money(0, this.exchange.targetCurrency));
      totalRow.appendChild(this.createMoneyTd(totalFeeSumInTargetCurrency)); // Fee in target currency
    }

    const groupSign = CashAsset.includes(this.firstTransaction.asset) || StableCoin.includes(this.firstTransaction.asset) ? 1 : -1;
    const totalAmountSum = this.transactions.reduce((total, t) => total.plus(t.total.multiply((TransactionNegativeTypes.includes(t.type) ? -1 : 1) * groupSign)), new Money(0, this.priceCurrency));
    totalRow.appendChild(this.createMoneyTd(totalAmountSum)); // Total Amount

    if (this.needsCurrencyConversion) {
      const totalAmountSumInTargetCurrency =
        this.transactions.reduce(
          (total, t) => total.plus(t.total.convert(t.time, this.exchange).multiply((TransactionNegativeTypes.includes(t.type) ? -1 : 1) * groupSign)), new Money(0, this.exchange.targetCurrency));
      totalRow.appendChild(this.createMoneyTd(totalAmountSumInTargetCurrency)); // Total Amount in target currency
    }

    const gainLossSum = this.transactions.reduce((total, t) => total.plus(t.gainOrLoss.convert(t.time, this.exchange, this.priceCurrency)), new Money(0, this.priceCurrency));
    totalRow.appendChild(this.createMoneyTd(gainLossSum)); // Gain

    if (this.needsCurrencyConversion) {
      const gainLossSumInTargetCurrency = this.transactions.reduce((total, t) => total.plus(t.gainOrLoss.convert(t.time, this.exchange)), new Money(0, this.exchange.targetCurrency));
      totalRow.appendChild(this.createMoneyTd(gainLossSumInTargetCurrency)); // Gain in target currency
    }
  }

  private renderGainLossByYear(parentElement: HTMLElement): void {
    const gainLossPerYear = new Map<number, Money>();
    const gainLossPerYearInTargetCurrency = new Map<number, Money>();
    for (const transaction of this.transactions) {
      if (transaction.gainOrLoss.amount === 0) continue;
      const year = transaction.time.getUTCFullYear();
      const gainLoss = gainLossPerYear.get(year) || new Money(0, this.priceCurrency);
      gainLossPerYear.set(year, gainLoss.plus(transaction.gainOrLoss));
      if (this.needsCurrencyConversion) {
        const gainLossInTargetCurrency = gainLossPerYearInTargetCurrency.get(year) || new Money(0, this.exchange.targetCurrency);
        gainLossPerYearInTargetCurrency.set(year, gainLossInTargetCurrency.plus(transaction.gainOrLoss.convert(transaction.time, this.exchange)));
      }
    }

    // If all gains are zero, show totals instead
    const showTotals = gainLossPerYear.size === 0;

    parentElement.appendChild(document.createElement('br'));
    const table = document.createElement('table');
    parentElement.appendChild(table);

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    if (showTotals) {
      const headers = ['Year', `Total ${printCurrency(this.priceCurrency)}`];
      if (this.needsCurrencyConversion) {
        headers.push(`Total ${printCurrency(this.exchange.targetCurrency)}`);
      }
      for (const header of headers) {
        const th = document.createElement('th');
        th.innerText = header;
        if (isNumericHeader(header)) th.classList.add('numeric');
        headerRow.appendChild(th);
      }

      // Calculate totals per year
      const totalsPerYear = new Map<number, Money>();
      const totalsPerYearInTargetCurrency = new Map<number, Money>();
      for (const transaction of this.transactions) {
        const year = transaction.time.getUTCFullYear();
        const prev = totalsPerYear.get(year) || new Money(0, this.priceCurrency);
        totalsPerYear.set(year, prev.plus(transaction.total));
        if (this.needsCurrencyConversion) {
          const prevTarget = totalsPerYearInTargetCurrency.get(year) || new Money(0, this.exchange.targetCurrency);
          totalsPerYearInTargetCurrency.set(year, prevTarget.plus(transaction.total.convert(transaction.time, this.exchange)));
        }
      }

      for (const [year, total] of totalsPerYear) {
        const row = document.createElement('tr');
        table.appendChild(row);
        row.appendChild(this.createTd(String(year)));
        row.appendChild(this.createMoneyTd(total));
        if (this.needsCurrencyConversion) {
          const totalInTarget = totalsPerYearInTargetCurrency.get(year) || new Money(0, this.exchange.targetCurrency);
          row.appendChild(this.createMoneyTd(totalInTarget));
        }
      }
    } else {
      const gainHeaders = ['Year', `Gain ${printCurrency(this.priceCurrency)}`];
      if (this.needsCurrencyConversion) {
        gainHeaders.push(`Gain ${printCurrency(this.exchange.targetCurrency)}`);
      }
      for (const header of gainHeaders) {
        const th = document.createElement('th');
        th.innerText = header;
        if (isNumericHeader(header)) th.classList.add('numeric');
        headerRow.appendChild(th);
      }

      for (const [year, gainLoss] of gainLossPerYear) {
        const row = document.createElement('tr');
        table.appendChild(row);
        row.appendChild(this.createTd(String(year)));
        row.appendChild(this.createMoneyTd(gainLoss));
        if (this.needsCurrencyConversion) {
          const gainLossInTargetCurrency = gainLossPerYearInTargetCurrency.get(year) || new Money(0, this.exchange.targetCurrency);
          row.appendChild(this.createMoneyTd(gainLossInTargetCurrency));
        }
      }
    }
  }

  private createTd(text: string): HTMLTableCellElement {
    const td = document.createElement('td');
    td.innerText = text;
    return td;
  }

  private createNumericTd(value: number, toFixed: number, addSignClass: boolean): HTMLTableCellElement {
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

  private createMoneyTd(value: Money): HTMLTableCellElement {
    const td = document.createElement('td');
    td.innerText = value.toString();
    td.classList.add('numeric');
    td.classList.add(value.amount > 0 ? 'positive' : 'negative');
    debugger
    return td;
  }
}
