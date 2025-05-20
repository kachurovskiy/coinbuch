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
    const securityHeaders = ['Security', 'First buy', 'Last sell', 'Gain ' + printCurrency(this.model.exchange.targetCurrency)];
    for (const header of securityHeaders) {
      const th = document.createElement('th');
      th.innerText = header;
      if (isNumericHeader(header)) th.classList.add('numeric');
      securityHeaderRow.appendChild(th);
    }

    const securityMapInTargetCurrency = new Map<string, Money>();
    for (const transaction of this.transactions) {
      const key = transaction.asset;
      const gainLossInTargetCurrency = securityMapInTargetCurrency.get(key) || new Money(0, this.model.exchange.targetCurrency);
      const convertedGainLoss = transaction.gainOrLoss.convert(transaction.time, this.model.exchange);
      securityMapInTargetCurrency.set(key, gainLossInTargetCurrency.plus(convertedGainLoss));
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

    for (const [security, gainLoss] of securityMapInTargetCurrency) {
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

      const gainLossInTargetCurrencyCell = document.createElement('td');
      gainLossInTargetCurrencyCell.innerText = gainLoss.toFixed(2);
      gainLossInTargetCurrencyCell.classList.add(gainLoss.amount > 0 ? 'positive' : 'negative');
      row.appendChild(gainLossInTargetCurrencyCell);
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

    const totalGainLossInTargetCurrency = document.createElement('td');
    const gainLossSumInTargetCurrency = this.transactions.reduce((total, t) => total.plus(t.gainOrLoss.convert(t.time, this.model.exchange)), new Money(0, this.model.exchange.targetCurrency));
    totalGainLossInTargetCurrency.innerText = gainLossSumInTargetCurrency.toFixed(2);
    totalGainLossInTargetCurrency.classList.add(gainLossSumInTargetCurrency.amount > 0 ? 'positive' : 'negative');
    totalRow.appendChild(totalGainLossInTargetCurrency);

    return result;
  }
}
