import { describe, it, expect } from 'vitest'
import { parseCoinbaseNumber, parseTransactionFile, parseTime } from './parser';

describe('parser', () => {
  it('parseCoinbaseNumber', () => {
    expect(parseCoinbaseNumber('-7.104')).toEqual(7.104);
    expect(parseCoinbaseNumber('220.87')).toEqual(220.87);
    expect(parseCoinbaseNumber('$220.87')).toEqual(220.87);
    expect(parseCoinbaseNumber('-$220.87')).toEqual(220.87);
    expect(parseCoinbaseNumber('0')).toEqual(0);
    expect(parseCoinbaseNumber('$1.00')).toEqual(1);
    expect(parseCoinbaseNumber('2.690')).toEqual(2.690);
  });

  it('parseCsv', () => {
    const objects = parseTransactionFile(`
Transactions
User,First Last,uuid-1234
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
uuid1,2020-02-10 13:07:57 UTC,Subscription Rebates (24 Hours),USDC,6.9,USD,$1.00,$6.9,$6.9,$0.00,All Subscription Rebates over a 24 hour period (13 items)
uuid2,2020-02-18 10:22:40 UTC,Advanced Trade Buy,USDC,3.72,USD,$1.00,$3.72,$3.72,$0.00,Bought 3.72 USDC for 3.43356 EUR on USDC-EUR at 0.923 EUR/USDC
`);
    expect(objects).toEqual({
      transactions: [
        {
          raw: 'uuid1,2020-02-10 13:07:57 UTC,Subscription Rebates (24 Hours),USDC,6.9,USD,$1.00,$6.9,$6.9,$0.00,All Subscription Rebates over a 24 hour period (13 items)',
          time: parseTime('2020-02-10 13:07:57 UTC'),
          id: 'uuid1',
          type: 'Subscription Rebates (24 Hours)',
          asset: 'USDC',
          quantity: 6.9,
          priceCurrency: 'USD',
          price: 1,
          subtotal: 6.9,
          total: 6.9,
          fee: 0,
          notes: 'All Subscription Rebates over a 24 hour period (13 items)',
          quantitySold: 0,
          gainOrLoss: 0,
        },
        {
          raw: 'uuid2,2020-02-18 10:22:40 UTC,Advanced Trade Buy,USDC,3.72,USD,$1.00,$3.72,$3.72,$0.00,Bought 3.72 USDC for 3.43356 EUR on USDC-EUR at 0.923 EUR/USDC',
          time: parseTime('2020-02-18 10:22:40 UTC'),
          id: 'uuid2',
          type: 'Advanced Trade Buy',
          asset: 'USDC',
          quantity: 3.72,
          priceCurrency: 'EUR',
          price: 0.923,
          subtotal: 3.43356,
          total: 3.43356,
          fee: 0,
          notes: 'Bought 3.72 USDC for 3.43356 EUR on USDC-EUR at 0.923 EUR/USDC',
          quantitySold: 0,
          gainOrLoss: 0,
        },
      ],
      errors: [],
      warnings: [],
    });
  });
});
