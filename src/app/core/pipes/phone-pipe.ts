import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'phone'
})
export class PhonePipe implements PipeTransform {
  transform(value: string | number | null | undefined): string {
    if (!value) return '';

    const original = value.toString();
    let digits = original.replace(/\D/g, '');

    // Handle US country code: +1XXXXXXXXXX or 1XXXXXXXXXX
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.substring(1);
    }

    // Format standard US 10-digit numbers
    if (digits.length === 10) {
      const area = digits.substring(0, 3);
      const prefix = digits.substring(3, 6);
      const line = digits.substring(6, 10);

      return `(${area}) ${prefix}-${line}`;
    }

    // Leave non-US/incomplete/extension numbers as entered
    return original;
  }
}