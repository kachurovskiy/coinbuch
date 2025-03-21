import { DataModel } from "./interfaces";

export class SectionErrors {
  render(dataModel: DataModel): HTMLDivElement {
    const div = document.createElement('div');
    div.classList.add('sectionErrors');
    if (dataModel.file.errors.length) {
      const titleElement = document.createElement('h2');
      titleElement.innerText = 'Errors';
      div.appendChild(titleElement);
    }
    for (const error of dataModel.file.errors) {
      const errorElement = document.createElement('div');
      errorElement.innerText = error;
      errorElement.classList.add('error');
      div.appendChild(errorElement);
    }
    if (dataModel.file.warnings.length) {
      const titleElement = document.createElement('h2');
      titleElement.innerText = 'Warnings';
      div.appendChild(titleElement);
    }
    for (const error of dataModel.file.warnings) {
      const errorElement = document.createElement('div');
      errorElement.innerText = error;
      errorElement.classList.add('warning');
      div.appendChild(errorElement);
    }
    return div;
  }
}
