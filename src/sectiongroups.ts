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

    // Header
    const titleElement = document.createElement('h2');
    titleElement.innerText = getGroupKey(firstTransaction);
    titleElement.id = firstTransaction.asset;
    result.appendChild(titleElement);

    const table = document.createElement('table');
    const tableScroller = document.createElement('div');
    tableScroller.classList.add('tableScroller');
    tableScroller.appendChild(table);
    result.appendChild(tableScroller);

    // Table header.
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const priceCurrency = firstTransaction.priceCurrency;
    const headers = ['Time', 'Type', 'Quantity ' + firstTransaction.asset, 'Price ' + priceCurrency, 'Fee ' + priceCurrency, 'Total ' + priceCurrency, 'Gain/Loss ' + priceCurrency];
    for (const header of headers) {
      const th = document.createElement('th');
      th.innerText = header;
      if (isNumericHeader(header)) th.classList.add('numeric');
      headerRow.appendChild(th);
    }

    // Transactions for this group.
    const groupSign = CashAsset.includes(firstTransaction.asset) || StableCoin.includes(firstTransaction.asset) ? 1 : -1;
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

    // Remaining shares and sum of amounts
    const totalRow = document.createElement('tr');
    totalRow.classList.add('totalRow');
    table.appendChild(totalRow);
    const totalCell = document.createElement('td');
    totalCell.innerText = 'Total';
    totalRow.appendChild(totalCell);
    totalRow.appendChild(document.createElement('td')); // Type
    const remainingQuantity = document.createElement('td');
    const sharesSum = getRemainingQuantity(transactions);
    if (sharesSum) {
      remainingQuantity.innerText = sharesSum.toFixed(2);
    }
    totalRow.appendChild(remainingQuantity);
    totalRow.appendChild(document.createElement('td')); // Price

    const totalFee = document.createElement('td');
    const totalFeeSum = transactions.reduce((total, t) => total + t.fee, 0);
    if (totalFeeSum) {
      totalFee.innerText = totalFeeSum.toFixed(2);
      totalFee.classList.add(totalFeeSum > 0 ? 'positive' : 'negative');
    }
    totalRow.appendChild(totalFee);

    const totalAmount = document.createElement('td');
    const totalAmountSum = transactions.reduce((total, t) => total + t.total * (TransactionNegativeTypes.includes(t.type) ? -1 : 1) * groupSign, 0);
    if (totalAmountSum) {
      totalAmount.innerText = totalAmountSum.toFixed(2);
      totalAmount.classList.add(totalAmountSum > 0 ? 'positive' : 'negative');
    }
    totalRow.appendChild(totalAmount);

    const totalGainLoss = document.createElement('td');
    const gainLossSum = transactions.reduce((total, t) => total + t.gainOrLoss, 0);
    if (gainLossSum) {
      totalGainLoss.innerText = gainLossSum.toFixed(2);
      totalGainLoss.classList.add(gainLossSum > 0 ? 'positive' : 'negative');
    }
    totalRow.appendChild(totalGainLoss);

    const gainLossPerYear = new Map<number, number>();
    for (const transaction of transactions) {
      if (transaction.gainOrLoss === 0) continue;
      const year = transaction.time.getUTCFullYear();
      const gainLoss = gainLossPerYear.get(year) || 0;
      gainLossPerYear.set(year, gainLoss + transaction.gainOrLoss);
    }

    if (gainLossPerYear.size > 0) {
      const gainLossHeader = document.createElement('br');
      result.appendChild(gainLossHeader);
      const gainTable = document.createElement('table');
      result.appendChild(gainTable);
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
        const yearCell = document.createElement('td');
        yearCell.innerText = String(year);
        row.appendChild(yearCell);
        const gainLossCell = document.createElement('td');
        gainLossCell.innerText = gainLoss.toFixed(2);
        gainLossCell.classList.add(gainLoss > 0 ? 'positive' : 'negative');
        row.appendChild(gainLossCell);
      }
    }

    return result;
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
