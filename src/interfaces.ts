import { CurrencyExchangeAPI, Money } from "./currency";

export interface TransactionFile {
  transactions: Transaction[];
  errors: string[];
  warnings: string[];
}

export const TransactionBuyTypes = ['Advanced Trade Buy', 'Receive'];
export const TransactionSellTypes = ['Advanced Trade Sell', 'Send'];
export const TransactionNegativeTypes = TransactionSellTypes.concat(['Withdrawal']);
export const TransactionPositiveTypes = TransactionBuyTypes.concat(['Deposit', 'Reward Income', 'Subscription Rebate', 'Subscription Rebates (24 Hours)']);
export const TransactionTypes = ['Advanced Trade Buy', 'Advanced Trade Sell', 'Deposit', 'Receive', 'Reward Income', 'Send', 'Subscription Rebate', 'Subscription Rebates (24 Hours)', 'Withdrawal'];
export type TransactionType = typeof TransactionTypes[number];

export const CashAsset = [
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'EUR',
  'GBP',
  'HKD',
  'JPY',
  'KRW',
  'NZD',
  'SGD',
  'USD',
];
export const CashSymbol: Map<string, string> = new Map([
  ['AUD', 'A$'],
  ['CAD', 'C$'],
  ['CHF', 'CHF'],
  ['CNY', '¥'],
  ['EUR', '€'],
  ['GBP', '£'],
  ['HKD', '$'],
  ['JPY', '¥'],
  ['KRW', '₩'],
  ['NZD', 'NZ$'],
  ['SGD', 'SGD'],
  ['USD', '$'],
]);
export const StableCoin = [
  'USDC',
  'USDT',
];

export const Epsilon = 0.0000001;

export interface Transaction {
  readonly raw: string;
  readonly id: string;
  readonly time: Date;
  readonly type: TransactionType;
  readonly asset: string;
  readonly quantity: number;
  readonly price: Money;
  readonly priceCurrency: string;
  readonly subtotal: Money;
  readonly total: Money;
  readonly fee: Money;
  readonly notes: string;

  // Only used for type === 'Buy'
  quantitySold: number;

  // Only used for type === 'Sell'
  gainOrLoss: Money;
  // Only used for type === 'Sell'. These losses are already included in gainOrLoss.
  lossInFeesIncluded: Money;
}

export interface DataModel {
  file: TransactionFile;
  executedTransactions: Transaction[];
  exchange: CurrencyExchangeAPI;
}

export interface SectionRenderer {
  render(dataModel: DataModel): HTMLDivElement;
}
