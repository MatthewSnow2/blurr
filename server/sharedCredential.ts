import { readFileSync } from 'node:fs';

/** Literal assignment only: never execute/source the shared configuration. */
export const parseNebiusCredential = (text: string): string => {
  const lines = text.split('\n').filter(line => /^\s*(?:export\s+)?NEBIUS_API_KEY\s*=/u.test(line));
  if (lines.length !== 1) throw new Error('CREDENTIAL_DEFINITION_INVALID');
  let value = lines[0].slice(lines[0].indexOf('=') + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!/^[A-Za-z0-9._~+/=-]{16,4096}$/u.test(value)) throw new Error('CREDENTIAL_VALUE_INVALID');
  return value;
};
export const readApprovedNebiusCredential = (): string => parseNebiusCredential(readFileSync('~/.env.shared', 'utf8'));
