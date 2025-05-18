import './style.css'
import { parseTransactionFile } from './parser';
import { CashAsset, TransactionFile } from './interfaces';
import { SectionErrors } from './sectionerrors';
import { SectionYears } from './sectionyears';
import { prepareDataModel } from './processor';
import { SectionGroups } from './sectiongroups';

const outputElement = document.getElementById('transactionOutput') as HTMLDivElement;
const checkboxElement = document.getElementById('calculateGainLoss') as HTMLInputElement;
const currencySelectElement = document.getElementById('currencySelect') as HTMLSelectElement;
for (const asset of CashAsset.concat().sort()) {
  if (asset === 'USD') continue;
  const option = document.createElement('option');
  option.value = asset;
  option.innerText = asset;
  option.selected = asset === 'EUR';
  currencySelectElement.appendChild(option);
}

const inputElement = document.getElementById('transactionInput') as HTMLInputElement;
inputElement.addEventListener('change', readFile);
function readFile() {
  const files = inputElement.files;
  if (!files) return;
  const file = files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await renderTransactionFile(parseTransactionFile(reader.result as string));
    } catch (e) {
      alert(`Error parsing file: ${e}`);
    }
  };
  reader.onerror = (e) => {
    alert(`Error reading file: ${e}`);
  }
  reader.readAsText(file);
}
readFile();

async function renderTransactionFile(file: TransactionFile) {
  const model = await prepareDataModel(file, getEffectiveCurrency(), (progress: string) => {
    outputElement.innerText = progress;
  });
  outputElement.replaceChildren(
    new SectionErrors().render(model),
    new SectionYears(model).render(),
    new SectionGroups(model).render(),
  );
}

function getEffectiveCurrency() {
  if (!checkboxElement.checked) {
    return 'USD';
  }
  return currencySelectElement.value || 'USD';
}
