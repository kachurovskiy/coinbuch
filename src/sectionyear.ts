import { Money, printCurrency } from "./currency";
import { DataModel, Transaction, TransactionBuyTypes, TransactionSellTypes } from "./interfaces";
import { isNumericHeader } from "./parser";

export class SectionYear {
  constructor(
    private readonly model: DataModel,
    private readonly year: number,
    private readonly transactions: Transaction[],
  ) {}

  render(): HTMLDivElement {
    const result = document.createElement('div');

    const titleElement = document.createElement('h3');
    titleElement.innerText = 'Calendar year ' + this.year;
    result.appendChild(titleElement);

    const securityTable = document.createElement('table');
    securityTable.classList.add('yearSecurityTable');
    result.appendChild(securityTable);

    const securityThead = document.createElement('thead');
    securityTable.appendChild(securityThead);
    const securityHeaderRow = document.createElement('tr');
    securityThead.appendChild(securityHeaderRow);
    const securityHeaders = [
      'Security',
      'First buy',
      'Last sell',
      'Cost Basis',
      'Cost Basis ' + printCurrency(this.model.exchange.targetCurrency),
      'Proceeds',
      'Proceeds ' + printCurrency(this.model.exchange.targetCurrency),
      'Gain ' + printCurrency(this.model.exchange.targetCurrency),
    ];
    for (const header of securityHeaders) {
      const th = document.createElement('th');
      th.innerText = header;
      if (isNumericHeader(header)) th.classList.add('numeric');
      securityHeaderRow.appendChild(th);
    }

    const costBasisMap = new Map<string, Money>();
    const costBasisMapTarget = new Map<string, Money>();
    const proceedsMap = new Map<string, Money>();
    const proceedsMapTarget = new Map<string, Money>();

    for (const transaction of this.transactions) {
      if (!TransactionSellTypes.includes(transaction.type)) continue;
      const key = transaction.asset;

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

    const firstBuyMap = new Map<string, Date>();
    const lastSellMap = new Map<string, Date>();
    for (const transaction of this.transactions) {
      const key = transaction.asset;
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

    for (const [security] of costBasisMap) {
      const row = document.createElement('tr');
      securityTable.appendChild(row);

      const securityCell = document.createElement('td');
      const securityLink = document.createElement('a');
      securityLink.innerText = security;
      securityLink.href = '#' + security;
      securityCell.appendChild(securityLink);
      row.appendChild(securityCell);

      const firstBuyDate = firstBuyMap.get(security);
      const firstBuyCell = document.createElement('td');
      if (firstBuyDate) firstBuyCell.innerText = firstBuyDate.toISOString().split('T')[0];
      row.appendChild(firstBuyCell);

      const lastSellDate = lastSellMap.get(security);
      const lastSellCell = document.createElement('td');
      if (lastSellDate) lastSellCell.innerText = lastSellDate.toISOString().split('T')[0];
      row.appendChild(lastSellCell);

      // Cost Basis
      const costBasis = costBasisMap.get(security) || new Money(0, this.model.exchange.targetCurrency);
      row.appendChild(createTd(costBasis));

      const costBasisTarget = costBasisMapTarget.get(security) || new Money(0, this.model.exchange.targetCurrency);
      row.appendChild(createTd(costBasisTarget));

      // Proceeds
      const proceeds = proceedsMap.get(security) || new Money(0, this.model.exchange.targetCurrency);
      row.appendChild(createTd(proceeds));

      const proceedsTarget = proceedsMapTarget.get(security) || new Money(0, this.model.exchange.targetCurrency);
      row.appendChild(createTd(proceedsTarget));

      // Gain
      const gainTarget = proceedsTarget.minus(costBasisTarget);
      row.appendChild(createTd(gainTarget, true));
    }

    // Sort all rows in securityTable by first cell (security name) asc.
    const rows = Array.from(securityTable.rows).slice(1);
    rows.sort((a, b) => a.cells[0].innerText.localeCompare(b.cells[0].innerText));
    for (const row of rows) {
      securityTable.appendChild(row);
    }

    // Total gain/loss for the year
    const totalRow = document.createElement('tr');
    totalRow.classList.add('totalRow');
    securityTable.appendChild(totalRow);
    const totalCell = document.createElement('td');
    totalCell.innerText = 'Total';
    totalRow.appendChild(totalCell);
    totalRow.appendChild(document.createElement('td'));
    totalRow.appendChild(document.createElement('td'));
    totalRow.appendChild(document.createElement('td'));

    const totalCostBasisTarget = Array.from(costBasisMapTarget.values()).reduce((a, b) => a.plus(b), new Money(0, this.model.exchange.targetCurrency));
    totalRow.appendChild(createTd(totalCostBasisTarget));

    totalRow.appendChild(document.createElement('td'));

    const totalProceedsTarget = Array.from(proceedsMapTarget.values()).reduce((a, b) => a.plus(b), new Money(0, this.model.exchange.targetCurrency));
    totalRow.appendChild(createTd(totalProceedsTarget));

    const totalGainTarget = totalProceedsTarget.minus(totalCostBasisTarget);
    totalRow.appendChild(createTd(totalGainTarget, true));

    return result;
  }
}

function createTd(money: Money, addClass: boolean = false): HTMLTableCellElement {
  const td = document.createElement('td');
  td.innerText = money.toFixed(2);
  if (addClass) {
    td.classList.add(money.amount > 0 ? 'positive' : 'negative');
  }
  return td;
}
