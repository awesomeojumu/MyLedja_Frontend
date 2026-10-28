import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { catalogue, t } from '..';

describe('t()', () => {
  it('fills variables', () => {
    expect(t('welcome.stepOf', { n: 2 })).toBe('Step 2 of 5');
  });
});

describe('copy rules (DESIGN.md 2.12, E-07)', () => {
  const entries = Object.entries(catalogue);
  it.each(entries)('%s follows the punctuation rules', (_key, text) => {
    expect(text).not.toMatch(/[\u2013\u2014]/);
    expect(text).not.toMatch(/\.\.\.|\u2026/);
    expect(text).not.toMatch(/!/);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(text).not.toMatch(/ & /);
    expect(text).not.toMatch(/\b(OK|Submit|Click here|leverage|utilize|empower|unlock|seamless|holistic|robust)\b/i);
  });
});

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx$/.test(e.name) ? [full] : [];
  });
}

describe('no literal user-facing strings in components (F0.5)', () => {
  const root = path.resolve(__dirname, '../../..');
  const files = [...sourceFiles(path.join(root, 'app')), ...sourceFiles(path.join(root, 'src'))];
  const textProps = new Set(['title', 'label', 'accessibilityLabel', 'accessibilityHint', 'placeholder', 'caption', 'message', 'body']);
  it.each(files.map((f) => [path.relative(root, f), f]))('%s', (_rel, file) => {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) found.push(node.text.trim());
      if (
        ts.isJsxAttribute(node) &&
        textProps.has(node.name.getText(source)) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        /[A-Za-z]/.test(node.initializer.text)
      ) {
        found.push(node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(found).toEqual([]);
  });
});
