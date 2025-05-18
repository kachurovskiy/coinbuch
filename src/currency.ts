import { Transaction } from "./interfaces";

export interface CurrencyExchangeAPI {
  targetCurrency: string;
  convertFromUSD: (amount: number, date: Date) => number;
  getExchangeRateFromUSD: (date: string) => number | undefined;
}

export async function fetchCurrencyExchangeRate(currency: string, transactions: Transaction[], progressCallback: Function): Promise<CurrencyExchangeAPI> {
  if (currency === 'USD') {
    return {
      targetCurrency: 'USD',
      convertFromUSD: (amount: number): number => amount,
      getExchangeRateFromUSD: (): number | undefined => 1,
    };
  }

  const lsKey = `exchangeRates-${currency}`;
  const exchangeRates: Record<string, number> = JSON.parse(localStorage.getItem(lsKey) || '{}');
  const uniqueDates = Array.from(new Set(transactions.map(tx => tx.time.toISOString().split('T')[0])));
  const datesToFetch = uniqueDates.filter(date => !(date in exchangeRates));

  try {
    for (const date of datesToFetch) {
      const url = `https://api.coinbase.com/v2/prices/${currency}-USD/spot?date=${date}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = await response.json();
      const rate = parseFloat(json.data.amount);
      exchangeRates[date] = rate;
      progressCallback(`Fetched exchange rate for ${date}: ${rate}`);
      localStorage.setItem(lsKey, JSON.stringify(exchangeRates));
    }
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    throw new Error('Failed to fetch exchange rates');
  }

  return {
    targetCurrency: currency,
    convertFromUSD: (amount: number, date: Date): number => {
      const dateString = date.toISOString().split('T')[0];
      const rate = exchangeRates[dateString];
      if (rate === undefined) {
        throw new Error(`Exchange rate for ${dateString} not found`);
      }
      return parseFloat((amount / rate).toFixed(2));
    },
    getExchangeRateFromUSD: (date: string): number | undefined => {
      return 1 / exchangeRates[date];
    },
  };
}
