export function truncateEnd(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function truncateMiddle(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  const keep = maxLength - 1;
  const left = Math.ceil(keep / 2);
  const right = keep - left;
  return `${input.slice(0, left)}…${input.slice(input.length - right)}`;
}
