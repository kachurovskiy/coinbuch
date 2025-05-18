import { needsCurrencyConversion, printCurrency } from "./currency";
import { DataModel, Transaction } from "./interfaces";
import { isNumericHeader } from "./parser";

export class SectionYear {
  private readonly firstTransaction: Transaction;
  private needsCurrencyConversion = false;

  constructor(
    private readonly model: DataModel,
    private readonly year: number,
    private readonly transactions: Transaction[],
  ) {
    if (transactions.length === 0) throw new Error('No transactions for ' + year);
    this.firstTransaction = transactions[0];
    this.needsCurrencyConversion = needsCurrencyConversion(this.firstTransaction, this.model.exchange.targetCurrency);
  }

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
    const securityHeaders = ['Security', 'Gain ' + printCurrency(this.firstTransaction.priceCurrency)];
    if (this.needsCurrencyConversion) {
      securityHeaders.push('Gain ' + printCurrency(this.model.exchange.targetCurrency));
    }
    for (const header of securityHeaders) {
      const th = document.createElement('th');
      th.innerText = header;
      if (isNumericHeader(header)) th.classList.add('numeric');
      securityHeaderRow.appendChild(th);
    }

    const securityMap = new Map<string, number>();
    const securityMapInTargetCurrency = new Map<string, number>();
    for (const transaction of this.transactions) {
      const key = transaction.asset;
      const gainLoss = securityMap.get(key) || 0;
      securityMap.set(key, gainLoss + transaction.gainOrLoss);
      if (this.needsCurrencyConversion) {
        const gainLossInTargetCurrency = securityMapInTargetCurrency.get(key) || 0;
        const convertedGainLoss = this.model.exchange.convertFromUSD(transaction.gainOrLoss, transaction.time);
        securityMapInTargetCurrency.set(key, gainLossInTargetCurrency + convertedGainLoss);
      }
    }

    for (const [security, gainLoss] of securityMap) {
      const row = document.createElement('tr');
      securityTable.appendChild(row);
      const securityCell = document.createElement('td');
      const securityLink = document.createElement('a');
      securityLink.innerText = security;
      securityLink.href = '#' + security;
      securityCell.appendChild(securityLink);
      row.appendChild(securityCell);
      const gainLossCell = document.createElement('td');
      gainLossCell.innerText = gainLoss.toFixed(2);
      gainLossCell.classList.add(gainLoss > 0 ? 'positive' : 'negative');
      row.appendChild(gainLossCell);
      if (this.needsCurrencyConversion) {
        const gainLossInTargetCurrencyCell = document.createElement('td');
        const gainLossInTargetCurrency = securityMapInTargetCurrency.get(security) || 0;
        gainLossInTargetCurrencyCell.innerText = gainLossInTargetCurrency.toFixed(2);
        gainLossInTargetCurrencyCell.classList.add(gainLossInTargetCurrency > 0 ? 'positive' : 'negative');
        row.appendChild(gainLossInTargetCurrencyCell);
      }
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
    const totalGainLoss = document.createElement('td');
    const gainLossSum = this.transactions.reduce((total, t) => total + t.gainOrLoss, 0);
    totalGainLoss.innerText = gainLossSum.toFixed(2);
    totalGainLoss.classList.add(gainLossSum > 0 ? 'positive' : 'negative');
    totalRow.appendChild(totalGainLoss);
    if (this.needsCurrencyConversion) {
      const totalGainLossInTargetCurrency = document.createElement('td');
      const gainLossSumInTargetCurrency = this.transactions.reduce((total, t) => total + this.model.exchange.convertFromUSD(t.gainOrLoss, t.time), 0);
      totalGainLossInTargetCurrency.innerText = gainLossSumInTargetCurrency.toFixed(2);
      totalGainLossInTargetCurrency.classList.add(gainLossSumInTargetCurrency > 0 ? 'positive' : 'negative');
      totalRow.appendChild(totalGainLossInTargetCurrency);
    }

    return result;
  }
}
