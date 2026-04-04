import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'phone'
})
export class PhonePipe implements PipeTransform {

  transform(value: string | number | null | undefined): string {
    if (!value) return '';

    const digits = value.toString().replace(/\D/g, '');

    if (digits.length !== 10) return value.toString();

    const area = digits.substring(0, 3);
    const prefix = digits.substring(3, 6);
    const line = digits.substring(6, 10);

    return `(${area}) ${prefix}-${line}`;
  }

}