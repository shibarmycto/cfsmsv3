// Common country codes and their patterns
const countryPatterns: { prefix: string; regex: RegExp; format: (num: string) => string; name: string }[] = [
  // UK - starts with 07, 44, or +44
  { 
    prefix: '+44', 
    regex: /^(?:\+?44|0)?(7\d{9})$/, 
    format: (num) => `+44${num}`,
    name: 'UK'
  },
  // USA/Canada - starts with 1 or common area codes
  { 
    prefix: '+1', 
    regex: /^(?:\+?1)?([2-9]\d{9})$/, 
    format: (num) => `+1${num}`,
    name: 'USA/Canada'
  },
  // France - starts with 33 or 0
  { 
    prefix: '+33', 
    regex: /^(?:\+?33|0)?([1-9]\d{8})$/, 
    format: (num) => `+33${num}`,
    name: 'France'
  },
  // Germany - starts with 49 or 0
  { 
    prefix: '+49', 
    regex: /^(?:\+?49|0)?([1-9]\d{6,14})$/, 
    format: (num) => `+49${num}`,
    name: 'Germany'
  },
  // Australia - starts with 61 or 04
  { 
    prefix: '+61', 
    regex: /^(?:\+?61|0)?(4\d{8})$/, 
    format: (num) => `+61${num}`,
    name: 'Australia'
  },
  // India - starts with 91
  { 
    prefix: '+91', 
    regex: /^(?:\+?91)?([6-9]\d{9})$/, 
    format: (num) => `+91${num}`,
    name: 'India'
  },
  // Spain - starts with 34
  { 
    prefix: '+34', 
    regex: /^(?:\+?34)?([6-9]\d{8})$/, 
    format: (num) => `+34${num}`,
    name: 'Spain'
  },
  // Italy - starts with 39
  { 
    prefix: '+39', 
    regex: /^(?:\+?39)?(3\d{8,9})$/, 
    format: (num) => `+39${num}`,
    name: 'Italy'
  },
  // Netherlands - starts with 31
  { 
    prefix: '+31', 
    regex: /^(?:\+?31|0)?([1-9]\d{8})$/, 
    format: (num) => `+31${num}`,
    name: 'Netherlands'
  },
  // Ireland - starts with 353
  { 
    prefix: '+353', 
    regex: /^(?:\+?353|0)?(8[35-9]\d{7})$/, 
    format: (num) => `+353${num}`,
    name: 'Ireland'
  },
];

/**
 * Clean a phone number by removing all non-digit characters except +
 */
export function cleanPhoneNumber(number: string): string {
  // Keep + at start if present, remove all other non-digits
  const hasPlus = number.trim().startsWith('+');
  const digits = number.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Detect the country and format a phone number
 */
export function formatPhoneNumber(rawNumber: string): { formatted: string; country: string | null; valid: boolean } {
  const cleaned = cleanPhoneNumber(rawNumber);
  
  // If already starts with + and has enough digits, validate format
  if (cleaned.startsWith('+') && cleaned.length >= 10) {
    return { formatted: cleaned, country: 'International', valid: true };
  }

  // Try to match against known patterns
  for (const pattern of countryPatterns) {
    const match = cleaned.match(pattern.regex);
    if (match && match[1]) {
      return { 
        formatted: pattern.format(match[1]), 
        country: pattern.name, 
        valid: true 
      };
    }
  }

  // Special handling for numbers that already look international
  if (cleaned.startsWith('+')) {
    return { formatted: cleaned, country: 'International', valid: cleaned.length >= 10 };
  }

  // If number is long enough but unrecognized, try to guess
  if (cleaned.length >= 10) {
    // UK mobile starting with 07
    if (cleaned.startsWith('07') && cleaned.length === 11) {
      return { formatted: `+44${cleaned.slice(1)}`, country: 'UK', valid: true };
    }
    // US number (10 digits, starts with area code 2-9)
    if (cleaned.length === 10 && /^[2-9]/.test(cleaned)) {
      return { formatted: `+1${cleaned}`, country: 'USA/Canada', valid: true };
    }
    // US with 1 prefix
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return { formatted: `+${cleaned}`, country: 'USA/Canada', valid: true };
    }
  }

  // Return as-is if we can't format it
  return { formatted: cleaned, country: null, valid: false };
}

/**
 * Format multiple phone numbers from text input
 */
export function formatPhoneNumbers(input: string): { 
  formatted: string; 
  stats: { total: number; valid: number; invalid: number; countries: Record<string, number> } 
} {
  const lines = input.split(/[\n,;]+/).map(line => line.trim()).filter(Boolean);
  const results: string[] = [];
  const countries: Record<string, number> = {};
  let valid = 0;
  let invalid = 0;

  for (const line of lines) {
    const result = formatPhoneNumber(line);
    results.push(result.formatted);
    
    if (result.valid) {
      valid++;
      if (result.country) {
        countries[result.country] = (countries[result.country] || 0) + 1;
      }
    } else {
      invalid++;
    }
  }

  return {
    formatted: results.join('\n'),
    stats: {
      total: lines.length,
      valid,
      invalid,
      countries,
    },
  };
}

/**
 * Validate a single phone number
 */
export function isValidPhoneNumber(number: string): boolean {
  const cleaned = cleanPhoneNumber(number);
  // Must start with + and have at least 10 digits total
  return cleaned.startsWith('+') && cleaned.length >= 11 && cleaned.length <= 16;
}
