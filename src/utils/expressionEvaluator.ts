/**
 * Safe mathematical expression evaluator
 * Supports: +, -, *, / operations with decimal numbers
 * Does NOT use eval() for security
 */

interface EvaluationResult {
  success: boolean;
  result?: number;
  error?: string;
}

/**
 * Tokenize the expression into numbers and operators
 */
function tokenize(expr: string): (number | string)[] {
  const tokens: (number | string)[] = [];
  let i = 0;
  const cleanExpr = expr.replace(/\s+/g, '');
  
  while (i < cleanExpr.length) {
    const char = cleanExpr[i];
    
    // Check for operators
    if (['+', '-', '*', '/'].includes(char)) {
      // Handle negative numbers at start or after an operator
      if (char === '-' && (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string')) {
        // This is a negative sign for a number
        let numStr = '-';
        i++;
        while (i < cleanExpr.length && (/\d/.test(cleanExpr[i]) || cleanExpr[i] === '.')) {
          numStr += cleanExpr[i];
          i++;
        }
        if (numStr === '-') {
          return []; // Invalid: lone minus
        }
        tokens.push(parseFloat(numStr));
      } else {
        tokens.push(char);
        i++;
      }
    } else if (/\d/.test(char) || char === '.') {
      // Parse number
      let numStr = '';
      while (i < cleanExpr.length && (/\d/.test(cleanExpr[i]) || cleanExpr[i] === '.')) {
        numStr += cleanExpr[i];
        i++;
      }
      const num = parseFloat(numStr);
      if (isNaN(num)) {
        return []; // Invalid number
      }
      tokens.push(num);
    } else {
      // Invalid character
      return [];
    }
  }
  
  return tokens;
}

/**
 * Validate that tokens form a valid expression
 */
function validateTokens(tokens: (number | string)[]): boolean {
  if (tokens.length === 0) return false;
  if (tokens.length === 1) return typeof tokens[0] === 'number';
  
  // Must start and end with a number
  if (typeof tokens[0] !== 'number' || typeof tokens[tokens.length - 1] !== 'number') {
    return false;
  }
  
  // Check alternating pattern: number, operator, number, operator, ...
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) {
      if (typeof tokens[i] !== 'number') return false;
    } else {
      if (typeof tokens[i] !== 'string' || !['+', '-', '*', '/'].includes(tokens[i] as string)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Evaluate tokens respecting operator precedence (* / before + -)
 */
function evaluateTokens(tokens: (number | string)[]): number {
  // First pass: handle * and /
  const simplified: (number | string)[] = [];
  let i = 0;
  
  while (i < tokens.length) {
    if (typeof tokens[i] === 'number') {
      if (i + 2 < tokens.length && (tokens[i + 1] === '*' || tokens[i + 1] === '/')) {
        // Handle multiplication/division
        let result = tokens[i] as number;
        while (i + 2 < tokens.length && (tokens[i + 1] === '*' || tokens[i + 1] === '/')) {
          const operator = tokens[i + 1] as string;
          const nextNum = tokens[i + 2] as number;
          if (operator === '*') {
            result *= nextNum;
          } else {
            if (nextNum === 0) {
              throw new Error('Division by zero');
            }
            result /= nextNum;
          }
          i += 2;
        }
        simplified.push(result);
        i++;
      } else {
        simplified.push(tokens[i]);
        i++;
      }
    } else {
      simplified.push(tokens[i]);
      i++;
    }
  }
  
  // Second pass: handle + and -
  let result = simplified[0] as number;
  for (let j = 1; j < simplified.length; j += 2) {
    const operator = simplified[j] as string;
    const nextNum = simplified[j + 1] as number;
    if (operator === '+') {
      result += nextNum;
    } else if (operator === '-') {
      result -= nextNum;
    }
  }
  
  return result;
}

/**
 * Check if a string contains a mathematical expression (has operators)
 */
export function isExpression(value: string): boolean {
  const trimmed = value.trim();
  // Check if it contains any operators (but not just a negative number)
  if (!/[+\-*/]/.test(trimmed)) return false;
  
  // If it's just a negative number like "-123.45", it's not an expression
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return false;
  
  return true;
}

/**
 * Safely evaluate a mathematical expression
 * @param expr The expression string (e.g., "100 + 50 * 2")
 * @returns Result object with success/error status and calculated value
 */
export function evaluateExpression(expr: string): EvaluationResult {
  const trimmed = expr.trim();
  
  // Empty string
  if (!trimmed) {
    return { success: false, error: 'Empty expression' };
  }
  
  // If it's just a plain number, return it directly
  if (!isExpression(trimmed)) {
    const num = parseFloat(trimmed);
    if (isNaN(num)) {
      return { success: false, error: 'Invalid number' };
    }
    return { success: true, result: num };
  }
  
  try {
    const tokens = tokenize(trimmed);
    
    if (!validateTokens(tokens)) {
      return { success: false, error: 'Invalid expression format' };
    }
    
    const result = evaluateTokens(tokens);
    
    // Round to avoid floating point errors (max 10 decimal places)
    const rounded = Math.round(result * 10000000000) / 10000000000;
    
    return { success: true, result: rounded };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Calculation error' 
    };
  }
}
