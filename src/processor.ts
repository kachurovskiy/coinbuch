import { fetchCurrencyExchangeRate } from "./currency";
import { DataModel, Transaction, TransactionFile, TransactionSellTypes, TransactionBuyTypes, Epsilon, TransactionPositiveTypes, TransactionNegativeTypes } from "./interfaces";

export async function prepareDataModel(file: TransactionFile, effectiveCurrency: string, progressCallback: Function): Promise<DataModel> {
  const executedTransactions = file.transactions.sort((a, b) => a.time.getTime() - b.time.getTime());
  const exchange = await fetchCurrencyExchangeRate(effectiveCurrency, executedTransactions, progressCallback);
  const moreWarnings = processSales(executedTransactions);
  file.warnings.push(...moreWarnings);
  return { file, executedTransactions, exchange };
}

function processSales(transactions: Transaction[]) {
  const sales = transactions.filter(t => TransactionSellTypes.includes(t.type));
  const warnings = [];
  for (const sale of sales) {
    const buys = transactions.filter(t => TransactionBuyTypes.includes(t.type) && t.asset === sale.asset && t.time < sale.time && Math.abs(t.quantitySold - t.quantity) > Epsilon);
    let remainingQuantity = sale.quantity;
    let buyTotal = 0;
    for (const buy of buys) {
      const quantityToSell = Math.min(buy.quantity - buy.quantitySold, remainingQuantity);
      buy.quantitySold += quantityToSell;
      buyTotal += buy.total / buy.quantity * quantityToSell;
      remainingQuantity -= quantityToSell;
      if (remainingQuantity === 0) {
        break;
      }
    }
    if (sale.price * remainingQuantity > 0.05) {
      warnings.push(`Unable to find the buy for ${remainingQuantity} ${sale.asset} in ${sale.raw} - gains can be overstated by ${sale.price * remainingQuantity}`);
    }
    sale.gainOrLoss = sale.total - buyTotal;
  }
  return warnings;
}

export function getRemainingQuantity(transactions: Transaction[]) {
  let remainingQuantity = 0;
  for (const transaction of transactions) {
    if (TransactionPositiveTypes.includes(transaction.type)) {
      remainingQuantity += transaction.quantity;
    } else if (TransactionNegativeTypes.includes(transaction.type)) {
      remainingQuantity -= transaction.quantity;
    }
  }
  return remainingQuantity;
}
