/**
 * Converts LaTeX math notation to plain, readable text
 * This makes mathematical expressions understandable for all students
 */
export function formatMathToPlainText(text: string): string {
  let result = text;
  
  // Remove $$ and $ delimiters
  result = result.replace(/\$\$/g, '');
  result = result.replace(/\$/g, '');
  
  // Replace LaTeX operators with readable symbols
  result = result.replace(/\\cdot/g, '×');
  result = result.replace(/\\times/g, '×');
  result = result.replace(/\\div/g, '÷');
  result = result.replace(/\\pm/g, '±');
  result = result.replace(/\\mp/g, '∓');
  result = result.replace(/\\leq/g, '≤');
  result = result.replace(/\\geq/g, '≥');
  result = result.replace(/\\neq/g, '≠');
  result = result.replace(/\\approx/g, '≈');
  result = result.replace(/\\equiv/g, '≡');
  result = result.replace(/\\infty/g, '∞');
  
  // Replace fractions: \frac{a}{b} -> a/b
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)');
  
  // Replace square roots: \sqrt{x} -> √x
  result = result.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  result = result.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, '$1√($2)');
  
  // Replace superscripts: x^{2} or x^2 -> x²
  const superscriptMap: { [key: string]: string } = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    'n': 'ⁿ', 'x': 'ˣ', '+': '⁺', '-': '⁻'
  };
  
  // Handle x^{...} patterns
  result = result.replace(/\^{([^}]+)}/g, (_, exp) => {
    if (exp.length === 1 && superscriptMap[exp]) {
      return superscriptMap[exp];
    }
    return '^' + exp;
  });
  
  // Handle x^2 style (single character)
  result = result.replace(/\^(\d)/g, (_, digit) => superscriptMap[digit] || '^' + digit);
  
  // Replace subscripts: x_{i} -> x_i (just remove braces)
  result = result.replace(/_{([^}]+)}/g, '_$1');
  
  // Greek letters
  result = result.replace(/\\alpha/g, 'α');
  result = result.replace(/\\beta/g, 'β');
  result = result.replace(/\\gamma/g, 'γ');
  result = result.replace(/\\delta/g, 'δ');
  result = result.replace(/\\epsilon/g, 'ε');
  result = result.replace(/\\theta/g, 'θ');
  result = result.replace(/\\lambda/g, 'λ');
  result = result.replace(/\\mu/g, 'μ');
  result = result.replace(/\\pi/g, 'π');
  result = result.replace(/\\sigma/g, 'σ');
  result = result.replace(/\\omega/g, 'ω');
  result = result.replace(/\\Delta/g, 'Δ');
  result = result.replace(/\\Sigma/g, 'Σ');
  result = result.replace(/\\Omega/g, 'Ω');
  result = result.replace(/\\Pi/g, 'Π');
  
  // Common functions
  result = result.replace(/\\sin/g, 'sin');
  result = result.replace(/\\cos/g, 'cos');
  result = result.replace(/\\tan/g, 'tan');
  result = result.replace(/\\log/g, 'log');
  result = result.replace(/\\ln/g, 'ln');
  result = result.replace(/\\lim/g, 'lim');
  result = result.replace(/\\sum/g, 'Σ');
  result = result.replace(/\\int/g, '∫');
  
  // Text within math: \text{...} -> ...
  result = result.replace(/\\text\{([^}]+)\}/g, '$1');
  result = result.replace(/\\textbf\{([^}]+)\}/g, '$1');
  result = result.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  
  // Remove leftover LaTeX commands
  result = result.replace(/\\left/g, '');
  result = result.replace(/\\right/g, '');
  result = result.replace(/\\quad/g, '  ');
  result = result.replace(/\\,/g, ' ');
  result = result.replace(/\\\\/g, '\n');
  
  // Clean up extra spaces on each line, but preserve newlines
  result = result.replace(/[^\S\n]+/g, ' ');
  result = result.replace(/ *\n */g, '\n');
  result = result.trim();
  
  return result;
}
