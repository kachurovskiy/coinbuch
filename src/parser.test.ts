import { describe, it, expect } from 'vitest'
import { parseCoinbaseNumber, parseTransactionFile, parseTime } from './parser';
import { Money } from './currency';

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

  it('parseCsv simple USD', () => {
    const objects = parseTransactionFile(`
Transactions
User,First Last,uuid-1234
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
uuid1,2020-02-10 13:07:57 UTC,Subscription Rebates (24 Hours),USDC,6.9,USD,$1.00,$6.9,$6.9,$0.00,All Subscription Rebates over a 24 hour period (13 items)
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
          price: new Money(1, 'USD'),
          subtotal: new Money(6.9, 'USD'),
          total: new Money(6.9, 'USD'),
          fee: new Money(0, 'USD'),
          notes: 'All Subscription Rebates over a 24 hour period (13 items)',
          quantitySold: 0,
          gainOrLoss: new Money(0, 'USD'),
        },
      ],
      errors: [],
      warnings: [],
    });
  });

  it('parseCsv with EUR conversion', () => {
    const objects = parseTransactionFile(`
Transactions
User,First Last,uuid-1234
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
uuid2,2020-02-18 10:22:40 UTC,Advanced Trade Buy,USDC,3.72,USD,$1.00,$3.72,$3.72,$0.00,Bought 3.72 USDC for 3.43356 EUR on USDC-EUR at 0.923 EUR/USDC
`);
    expect(objects).toEqual({
      transactions: [
        {
          raw: 'uuid2,2020-02-18 10:22:40 UTC,Advanced Trade Buy,USDC,3.72,USD,$1.00,$3.72,$3.72,$0.00,Bought 3.72 USDC for 3.43356 EUR on USDC-EUR at 0.923 EUR/USDC',
          time: parseTime('2020-02-18 10:22:40 UTC'),
          id: 'uuid2',
          type: 'Advanced Trade Buy',
          asset: 'USDC',
          quantity: 3.72,
          priceCurrency: 'EUR',
          price: new Money(0.923, 'EUR'),
          subtotal: new Money(3.43356, 'EUR'),
          total: new Money(3.43356, 'EUR'),
          fee: new Money(0, 'EUR'),
          notes: 'Bought 3.72 USDC for 3.43356 EUR on USDC-EUR at 0.923 EUR/USDC',
          quantitySold: 0,
          gainOrLoss: new Money(0, 'EUR'),
        },
      ],
      errors: [],
      warnings: [],
    });
  });
});
