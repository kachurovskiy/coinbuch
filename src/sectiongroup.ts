import { CurrencyExchangeAPI, Money, needsCurrencyConversion, printCurrency } from "./currency";
import { Transaction, CashAsset, TransactionNegativeTypes, StableCoin, DataModel, TransactionSellTypes, TransactionBuyTypes } from "./interfaces";
import { isNumericHeader } from "./parser";
import { getRemainingQuantity } from "./processor";

export class SectionGroup {
  private firstTransaction: Transaction;
  private priceCurrency: string;
  private headers: string[];
  private needsCurrencyConversion = false;
  private exchange: CurrencyExchangeAPI;

  constructor(private groupKey: string, private transactions: Transaction[], private model: DataModel) {
    if (transactions.length === 0) throw new Error('No transactions provided for ' + groupKey);

    this.firstTransaction = transactions[0];
    this.exchange = this.model.exchange;
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

    // Add a preamble viaible only in the print mode stating that this document was prepared by coinbuch on this date based on file this.model.name
    const preamble = document.createElement('div');
    preamble.className = 'print-section';
    preamble.style.display = 'none';
    preamble.innerHTML = `<h2>Excerpt from the Coinbase transaction analysis report</h2><p>This document was prepared by the <a href="https://github.com/kachurovskiy/coinbuch">coinbuch tool</a> on ${new Date().toISOString()} based on Coinbase transaction file ${this.model.name}</p>`;
    result.appendChild(preamble);

    this.transactions.sort((a, b) => a.time.getTime() - b.time.getTime());
    result.dataset.sortKey = `${CashAsset.includes(this.firstTransaction.asset) || StableCoin.includes(this.firstTransaction.asset) ? 0 : 1}-${this.firstTransaction.asset}`;

    this.renderGroupHeader(result);
    this.renderGainLossByYear(result);
    const table = this.createTableStructure(result);
    this.renderTableHeader(table);
    this.renderTableBody(table);
    this.renderTableFooter(table);

    // Add raw transactions section, only visible in print mode
    const rawSection = document.createElement('div');
    rawSection.className = 'print-section';
    rawSection.style.display = 'none';
    rawSection.innerHTML = `<h3>Raw Transactions</h3><pre>${this.transactions.map(t => t.raw).join('\n')}</pre>`;
    result.appendChild(rawSection);

    // Add print-only CSS for .print-raw-section
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        .print-section { display: block !important; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
      }
    `;
    result.appendChild(style);

    return result;
  }

  private renderGroupHeader(parentElement: HTMLElement): void {
    const titleElement = document.createElement('h2');
    titleElement.innerText = this.groupKey;
    titleElement.id = this.firstTransaction.asset;
    parentElement.appendChild(titleElement);

    const printBtn = document.createElement('button');
    printBtn.innerText = 'Print';
    printBtn.className = 'print-button';
    printBtn.style.marginLeft = '1em';
    printBtn.onclick = () => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write('<html><head><title>' + this.groupKey + '</title>');
        Array.from(document.querySelectorAll('link[rel="stylesheet"],style')).forEach(styleNode => {
          printWindow.document.write(styleNode.outerHTML);
        });
        printWindow.document.write('</head><body>');
        printWindow.document.write(parentElement.outerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      }
    };
    titleElement.appendChild(printBtn);
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
      if (this.needsCurrencyConversion) {
        if (TransactionSellTypes.includes(transaction.type)) {
          let costBasisTarget = new Money(0, this.exchange.targetCurrency);
          for (const buy of transaction.buyTransactions) {
            const cb = buy.transaction.total.multiply(buy.quantity / buy.transaction.quantity);
            costBasisTarget = costBasisTarget.plus(cb.convert(buy.transaction.time, this.model.exchange));
          }
          cells.push(transaction.total.convert(transaction.time, this.exchange).minus(costBasisTarget));
        } else {
          cells.push(new Money(0, this.exchange.targetCurrency));
        }
      }
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
      // gainOrLoss can not be converted, we need to calculate it by converting total and cost basis.
      const costBasisInTarget = this.transactions.reduce((total, t) => {
        let cb = new Money(0, this.exchange.targetCurrency);
        for (const buy of t.buyTransactions) {
          const cbAmount = buy.transaction.total.multiply(buy.quantity / buy.transaction.quantity);
          cb = cb.plus(cbAmount.convert(buy.transaction.time, this.model.exchange));
        }
        return total.plus(cb);
      }, new Money(0, this.exchange.targetCurrency));
      const proceedsInTarget = this.transactions.filter(t => TransactionSellTypes.includes(t.type)).reduce((total, t) => total.plus(t.total.convert(t.time, this.exchange)), new Money(0, this.exchange.targetCurrency));
      const gainLossSumInTargetCurrency = proceedsInTarget.minus(costBasisInTarget);
      totalRow.appendChild(this.createMoneyTd(gainLossSumInTargetCurrency));
    }
  }

  private renderGainLossByYear(parentElement: HTMLElement): void {
    const costBasisMap = new Map<number, Money>();
    const costBasisMapTarget = new Map<number, Money>();
    const proceedsMap = new Map<number, Money>();
    const proceedsMapTarget = new Map<number, Money>();

    for (const transaction of this.transactions) {
      if (!TransactionSellTypes.includes(transaction.type)) continue;
      const key = transaction.time.getUTCFullYear();

      let costBasis = costBasisMap.get(key) || new Money(0, transaction.priceCurrency);
      let costBasisTarget = costBasisMapTarget.get(key) || new Money(0, this.model.exchange.targetCurrency);
      for (const buy of transaction.buyTransactions) {
        const cb = buy.transaction.total.multiply(buy.quantity / buy.transaction.quantity);
        costBasis = costBasis.plus(cb);
        costBasisTarget = costBasisTarget.plus(cb.convert(buy.transaction.time, this.model.exchange));
      }
      costBasisMap.set(key, costBasis);
      costBasisMapTarget.set(key, costBasisTarget);

      let proceeds = proceedsMap.get(key) || new Money(0, transaction.priceCurrency);
      let proceedsTarget = proceedsMapTarget.get(key) || new Money(0, this.model.exchange.targetCurrency);
      proceeds = proceeds.plus(transaction.total.convert(transaction.time, this.model.exchange, proceeds.currency));
      proceedsTarget = proceedsTarget.plus(transaction.total.convert(transaction.time, this.model.exchange));
      proceedsMap.set(key, proceeds);
      proceedsMapTarget.set(key, proceedsTarget);
    }

    const firstBuyMap = new Map<number, Date>();
    const lastSellMap = new Map<number, Date>();
    for (const transaction of this.transactions) {
      const key = transaction.time.getUTCFullYear();
      if (TransactionBuyTypes.includes(transaction.type)) {
        const firstBuyDate = firstBuyMap.get(key);
        if (!firstBuyDate || transaction.time.getTime() < firstBuyDate.getTime()) {
          firstBuyMap.set(key, transaction.time);
        }
      } else if (TransactionSellTypes.includes(transaction.type)) {
        const lastSellDate = lastSellMap.get(key);
        if (!lastSellDate || transaction.time.getTime() > lastSellDate.getTime()) {
          lastSellMap.set(key, transaction.time);
        }
      }
    }

    // If all gains are zero, show totals instead
    const showTotals = proceedsMap.size === 0;

    const table = document.createElement('table');
    parentElement.appendChild(table);
    parentElement.appendChild(document.createElement('br'));

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    if (showTotals) {
      const headers = ['Year'];
      headers.push(`Total ${printCurrency(this.priceCurrency)}`);
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
        // Total columns
        row.appendChild(this.createMoneyTd(total));
        if (this.needsCurrencyConversion) {
          const totalInTarget = totalsPerYearInTargetCurrency.get(year) || new Money(0, this.exchange.targetCurrency);
          row.appendChild(this.createMoneyTd(totalInTarget));
        }
      }
    } else {
      const gainHeaders = ['Year', 'First Buy', 'Last Sell'];
      gainHeaders.push(`Cost Basis ${printCurrency(this.priceCurrency)}`);
      if (this.needsCurrencyConversion) {
        gainHeaders.push(`Cost Basis ${printCurrency(this.exchange.targetCurrency)}`);
      }
      gainHeaders.push(`Proceeds ${printCurrency(this.priceCurrency)}`);
      if (this.needsCurrencyConversion) {
        gainHeaders.push(`Proceeds ${printCurrency(this.exchange.targetCurrency)}`);
      }
      gainHeaders.push(`Gain ${printCurrency(this.priceCurrency)}`);
      if (this.needsCurrencyConversion) {
        gainHeaders.push(`Gain ${printCurrency(this.exchange.targetCurrency)}`);
      }
      for (const header of gainHeaders) {
        const th = document.createElement('th');
        th.innerText = header;
        if (isNumericHeader(header)) th.classList.add('numeric');
        headerRow.appendChild(th);
      }

      for (const [year] of proceedsMap) {
        const row = document.createElement('tr');
        table.appendChild(row);
        row.appendChild(this.createTd(String(year)));

        const firstBuyDate = firstBuyMap.get(year);
        const lastSellDate = lastSellMap.get(year);
        if (firstBuyDate) {
          row.appendChild(this.createTd(firstBuyDate.toISOString().split('T')[0]));
        } else {
          row.appendChild(this.createTd(''));
        }
        if (lastSellDate) {
          row.appendChild(this.createTd(lastSellDate.toISOString().split('T')[0]));
        } else {
          row.appendChild(this.createTd(''));
        }

        const costBasis = costBasisMap.get(year) || new Money(0, this.priceCurrency);
        row.appendChild(this.createMoneyTd(costBasis));
        const costBasisInTarget = costBasisMapTarget.get(year) || new Money(0, this.exchange.targetCurrency);
        if (this.needsCurrencyConversion) {
          row.appendChild(this.createMoneyTd(costBasisInTarget));
        }

        const proceeds = proceedsMap.get(year) || new Money(0, this.priceCurrency);
        row.appendChild(this.createMoneyTd(proceeds));
        const proceedsInTarget = proceedsMapTarget.get(year) || new Money(0, this.exchange.targetCurrency);
        if (this.needsCurrencyConversion) {
          row.appendChild(this.createMoneyTd(proceedsInTarget));
        }

        const gain = proceeds.minus(costBasis);
        row.appendChild(this.createMoneyTd(gain));
        if (this.needsCurrencyConversion) {
          const gainInTarget = proceedsInTarget.minus(costBasisInTarget);
          row.appendChild(this.createMoneyTd(gainInTarget));
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
