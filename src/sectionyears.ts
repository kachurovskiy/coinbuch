import { DataModel, Transaction } from "./interfaces";
import { isNumericHeader } from "./parser";

export class SectionYears {
  constructor(
    private readonly title: string,
  ) {}

  render(model: DataModel): HTMLDivElement {
    const result = document.createElement('div');

    const titleElement = document.createElement('h2');
    titleElement.innerText = 'Realized gain or loss for ' + this.title;
    result.appendChild(titleElement);

    const transactions = model.executedTransactions;
    const years = transactions.map(t => t.time.getUTCFullYear());
    const uniqueYears = Array.from(new Set(years)).sort((a, b) => a - b);
    for (const year of uniqueYears) {
      const yearTransactions = transactions.filter(t => t.time.getUTCFullYear() === year && t.gainOrLoss !== 0);
      if (yearTransactions.length === 0) continue;
      // Render transactions for each priceCurrency separately
      const currencies = new Set(yearTransactions.map(t => t.priceCurrency));
      for (const currency of currencies) {
        const currencyTransactions = yearTransactions.filter(t => t.priceCurrency === currency);
        if (currencyTransactions.length === 0) continue;
        result.appendChild(this.renderYearSection(year, currencyTransactions));
      }
    }

    return result;
  }

  private renderYearSection(year: number, transactions: Transaction[]): HTMLDivElement {
    const result = document.createElement('div');

    const titleElement = document.createElement('h3');
    titleElement.innerText = 'Calendar year ' + year + ' in ' + transactions[0].priceCurrency;
    result.appendChild(titleElement);

    const securityTable = document.createElement('table');
    securityTable.classList.add('yearSecurityTable');
    result.appendChild(securityTable);

    const securityThead = document.createElement('thead');
    securityTable.appendChild(securityThead);
    const securityHeaderRow = document.createElement('tr');
    securityThead.appendChild(securityHeaderRow);
    const securityHeaders = ['Security', 'Gain/Loss ' + transactions[0].priceCurrency];
    for (const header of securityHeaders) {
      const th = document.createElement('th');
      th.innerText = header;
      if (isNumericHeader(header)) th.classList.add('numeric');
      securityHeaderRow.appendChild(th);
    }

    const securityMap = new Map<string, number>();
    for (const transaction of transactions) {
      const key = transaction.asset;
      const gainLoss = securityMap.get(key) || 0;
      securityMap.set(key, gainLoss + transaction.gainOrLoss);
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
    const gainLossSum = transactions.reduce((total, t) => total + t.gainOrLoss, 0);
    totalGainLoss.innerText = gainLossSum.toFixed(2);
    totalGainLoss.classList.add(gainLossSum > 0 ? 'positive' : 'negative');
    totalRow.appendChild(totalGainLoss);

    return result;
  }
}
