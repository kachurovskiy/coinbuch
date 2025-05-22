import { fetchCurrencyExchangeRate, Money } from "./currency";
import { DataModel, Transaction, TransactionFile, TransactionSellTypes, TransactionBuyTypes, Epsilon, TransactionPositiveTypes, TransactionNegativeTypes } from "./interfaces";

export async function prepareDataModel(name: string, file: TransactionFile, effectiveCurrency: string, progressCallback: Function): Promise<DataModel> {
  const executedTransactions = file.transactions.sort((a, b) => a.time.getTime() - b.time.getTime());
  const exchange = await fetchCurrencyExchangeRate(effectiveCurrency, executedTransactions, progressCallback);
  const moreWarnings = processSales(executedTransactions);
  file.warnings.push(...moreWarnings);
  return { name, file, executedTransactions, exchange };
}

function processSales(transactions: Transaction[]) {
  const sales = transactions.filter(t => TransactionSellTypes.includes(t.type));
  const warnings = [];
  for (const sale of sales) {
    const buys = transactions.filter(t => TransactionBuyTypes.includes(t.type) && t.asset === sale.asset && t.time < sale.time && Math.abs(t.quantitySold - t.quantity) > Epsilon);
    let remainingQuantity = sale.quantity;
    let buyTotal = new Money(0, sale.priceCurrency);
    let buyFees = new Money(0, sale.priceCurrency);
    for (const buy of buys) {
      const quantityToSell = Math.min(buy.quantity - buy.quantitySold, remainingQuantity);
      buy.quantitySold += quantityToSell;
      sale.buyTransactions.push({ quantity: quantityToSell, transaction: buy });
      buyTotal = buyTotal.plus(buy.total.multiply(quantityToSell / buy.quantity));
      buyFees = buyFees.plus(buy.fee.multiply(quantityToSell / buy.quantity));
      remainingQuantity -= quantityToSell;
      if (remainingQuantity === 0) {
        break;
      }
    }
    if (sale.price.amount * remainingQuantity > 0.05) {
      warnings.push(`Unable to find the buy for ${remainingQuantity} ${sale.asset} in ${sale.raw} - gains can be overstated by ${sale.price.multiply(remainingQuantity).toFixed(2)}`);
    }
    sale.gainOrLoss = sale.total.minus(buyTotal);
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
