export function ukPostcode(address: string): string | null {
  const match = address.toUpperCase().match(/\b(GIR\s?0AA|(?:[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}))\b/);
  return match ? match[1].replace(/\s/g, "") : null;
}
