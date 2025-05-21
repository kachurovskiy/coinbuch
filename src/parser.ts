import { Money } from "./currency";
import { Transaction, TransactionTypes, TransactionFile, TransactionType, TransactionSellTypes } from "./interfaces";

function getRowError(t: Transaction, row: any): string {
  if (t.time.getFullYear() < 2000 || t.time.getFullYear() > 2100) {
    return `Invalid year ${t.time.getFullYear()} in row ${JSON.stringify(row)}`;
  }
  if (!TransactionTypes.includes(t.type)) {
    return `Invalid transaction type ${t.type} in row ${JSON.stringify(row)}`;
  }
  if (isNaN(t.quantity)) {
    return `Invalid quantity ${t.quantity} in row ${JSON.stringify(row)}`;
  }
  if (isNaN(t.price.amount) || t.price.amount < 0) {
    return `Invalid price ${t.price} in row ${JSON.stringify(row)}`;
  }
  if (isNaN(t.fee.amount) || t.fee.amount < 0) {
    return `Invalid fee ${t.fee} in row ${JSON.stringify(row)}`;
  }
  if (isNaN(t.subtotal.amount)) {
    return `Invalid subtotal ${t.subtotal} in row ${JSON.stringify(row)}`;
  }
  if (isNaN(t.total.amount)) {
    return `Invalid total ${t.total} in row ${JSON.stringify(row)}`;
  }
  return '';
}

function getRowWarning(t: Transaction, row: any): string {
  const expectedTotal = t.subtotal.plus(t.fee.multiply(TransactionSellTypes.includes(t.type) ? -1 : 1));
  if (expectedTotal.amount > 0 && Math.abs(1 - t.total.amount / expectedTotal.amount) > 0.001 && Math.abs(t.total.amount - expectedTotal.amount) > 1) {
    return `Invalid total ${t.total} - expected ${expectedTotal} in row ${JSON.stringify(row)}`;
  }
  // if shares is not 0 and price times shares is diferent from amount by 0.01, error
  const subtotal = Math.abs(t.price.amount * t.quantity);
  if (t.quantity !== 0 && Math.abs(1 - subtotal / t.subtotal.amount) > 0.002 && Math.abs(subtotal - t.subtotal.amount) > 1) {
    return `Invalid subtotal ${subtotal} - expected ${t.subtotal} in row ${JSON.stringify(row)}`;
  }
  return '';
}

export function parseRows(input: string) {
  const rows = input.split('\n');

  // Skip empty row, Transactions, user name.
  while (!rows[0].startsWith('ID')) rows.shift();

  // Parse column names.
  const headers = rows[0].split(',');
  rows.shift();

  const result = [];
  for (let rowText of rows) {
    rowText = rowText.trim();
    if (!rowText) continue;
    const values = rowText.split(',');
    if (values.length !== headers.length) throw new Error(`Invalid row: ${rowText}`);
    const row = new Map<string, string>();
    row.set('raw', rowText);
    for (let i = 0; i < headers.length; i++) {
      let value = values[i];
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      row.set(headers[i], value);
    }
    result.push(Object.fromEntries(row));
  }

  return result;
}

export function parseTransactionFile(input: string): TransactionFile {
  const rows = parseRows(input);

  const transactions: Transaction[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  // ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,
  // Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
  for (const row of rows) {
    const currency = row['Price Currency'];
    let transaction = {
      raw: row['raw'],
      id: row['ID'],
      time: parseTime(row['Timestamp']),
      type: row['Transaction Type'] as TransactionType,
      asset: row['Asset'],
      quantity: parseCoinbaseNumber(row['Quantity Transacted']),
      price: new Money(parseCoinbaseNumber(row['Price at Transaction']), currency),
      priceCurrency: currency,
      subtotal: new Money(parseCoinbaseNumber(row['Subtotal']), currency),
      total: new Money(parseCoinbaseNumber(row['Total (inclusive of fees and/or spread)']), currency),
      fee: new Money(parseCoinbaseNumber(row['Fees and/or Spread']), currency),
      notes: row['Notes'],
      quantitySold: 0,
      gainOrLoss: new Money(0, currency),
    };
    // Not informative to price USDC in USD, better show gain / loss in the other currency.
    if (transaction.asset === 'USDC' && transaction.priceCurrency === 'USD') {
      transaction = convertTransactionCurrency(transaction);
    }
    const error = getRowError(transaction, row);
    if (error) {
      errors.push(error);
      continue;
    }
    const warning = getRowWarning(transaction, row);
    if (warning) warnings.push(warning);
    transactions.push(transaction);
  };
  transactions.sort((a, b) => a.time.getTime() - b.time.getTime());
  return { transactions, errors, warnings };
}

export function convertTransactionCurrency(t: Transaction): Transaction {
  const match = t.notes.match(/(Bought|Sold) ([0-9.]+) USDC for ([0-9.]+) ([A-Z]+) on ([A-Z]+-[A-Z]+) at ([0-9.]+) ([A-Z]+\/USDC)/);
  if (!match) return t;
  const quantity = parseCoinbaseNumber(match[2]);
  const priceCurrency = match[4];
  const exchangeRate = parseCoinbaseNumber(match[6]);
  const total = new Money(parseCoinbaseNumber(match[3]), priceCurrency);
  const fee = new Money(t.fee.amount * exchangeRate, priceCurrency);
  return { ...t, quantity, price: new Money(exchangeRate, priceCurrency), priceCurrency, fee, subtotal: total.minus(fee), total };
}

export function isNumericHeader(header: string): boolean {
  return ['Quantity Transacted', 'Price at Transaction', 'Subtotal', 'Total (inclusive of fees and/or spread)', 'Fees and/or Spread'].includes(header);
}

export function parseCoinbaseNumber(input: string): number {
  if (!input) return 0;
  // Coinbase uses negative for withdrawals and sends, not sells. To avoid confusion, make all numbers positive
  // and base logic on the transaction type.
  return Math.abs(parseFloat(input.replace(/\$/, '')));
}

/** Parse format '2025-03-10 13:17:55 UTC' */
export function parseTime(timestamp: string): Date {
  if (!timestamp) throw new Error('Invalid timestamp: ' + timestamp);
  const parts = timestamp.split(' ');
  if (parts.length !== 3) throw new Error(`Invalid timestamp: ${timestamp}`);
  if (parts[2] !== 'UTC') throw new Error(`Invalid timezone: ${parts[2]}`);
  const dateParts = parts[0].split('-');
  const timeParts = parts[1].split(':');
  return new Date(Date.UTC(
    parseInt(dateParts[0]),
    parseInt(dateParts[1]) - 1,
    parseInt(dateParts[2]),
    parseInt(timeParts[0]),
    parseInt(timeParts[1]),
    parseInt(timeParts[2])
  ));
}
