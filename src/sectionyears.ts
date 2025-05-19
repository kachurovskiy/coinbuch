import { DataModel } from "./interfaces";
import { SectionYear } from "./sectionyear";

export class SectionYears {
  constructor(
    private readonly model: DataModel,
  ) {}

  render(): HTMLDivElement {
    const result = document.createElement('div');

    const titleElement = document.createElement('h2');
    titleElement.innerText = 'Realized gain or loss for all years';
    result.appendChild(titleElement);

    const transactions = this.model.executedTransactions;
    const years = transactions.map(t => t.time.getUTCFullYear());
    const uniqueYears = Array.from(new Set(years)).sort((a, b) => a - b);
    for (const year of uniqueYears) {
      const yearTransactions = transactions.filter(t => t.time.getUTCFullYear() === year);
      result.appendChild(new SectionYear(this.model, year, yearTransactions).render());
    }

    return result;
  }
}
