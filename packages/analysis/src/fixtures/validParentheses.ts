export const validParenthesesFixture = {
  name: 'Valid Parentheses',
  slug: 'valid-parentheses',
  language: 'JavaScript',
  code: `
var isValid = function(s) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push(ch);
    } else {
      if (stack.length === 0 || stack.pop() !== pairs[ch]) {
        return false;
      }
    }
  }
  return stack.length === 0;
};
`.trim(),
};
