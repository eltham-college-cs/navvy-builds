/**
 * CodeMirror 6 for the Sixth Form builder: one editor per file, a dark theme,
 * and "given" lines (ending in // given) shaded with a GIVEN badge.
 */
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

export type Language = 'html' | 'css' | 'js';

export interface CodeEditor {
  view: EditorView;
  getCode(): string;
  setCode(code: string): void;
  goToLine(line: number): void;
  focus(): void;
}

interface Options {
  parent: HTMLElement;
  doc: string;
  language: Language;
  label: string;
  readOnly?: boolean;
  /** Smaller, for challenge editors. */
  compact?: boolean;
  onChange?(code: string): void;
  onEscape?(): void;
}

const theme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '14px', backgroundColor: '#0D2136', color: '#DCE6F2' },
    // No ligatures: students must see >= and != exactly as they type them.
    '.cm-scroller': {
      fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
      lineHeight: '1.65',
      fontVariantLigatures: 'none',
    },
    '.cm-content': { padding: '10px 0', caretColor: '#F2B533' },
    '.cm-gutters': { backgroundColor: '#0A1B2E', color: '#6F86A1', border: 'none', borderRight: '1px solid #1E3A5A' },
    '.cm-activeLine': { backgroundColor: 'rgba(242,181,51,0.08)' },
    '.cm-activeLineGutter': { backgroundColor: '#163351', color: '#FFE08A' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftWidth: '2px', borderLeftColor: '#F2B533' },
    '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#2F5C8A' },
    '.cm-selectionBackground': { backgroundColor: '#24476B' },
    '.cm-matchingBracket': { backgroundColor: '#24476B', outline: '1px solid #7CC4F2' },
    '.cm-given-line': { backgroundColor: 'rgba(124,196,242,0.09)' },
    '.cm-given': {
      font: "600 10px 'Lexend', system-ui, sans-serif",
      letterSpacing: '0.1em',
      color: '#7CC4F2',
      border: '1px solid #7CC4F2',
      borderRadius: '3px',
      padding: '0 5px',
      marginLeft: '8px',
      verticalAlign: '1px',
    },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: '#F59AC0' },
  { tag: [t.string, t.special(t.string)], color: '#9BE0A8' },
  { tag: [t.number, t.bool, t.null, t.color], color: '#F7A35C' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#7F97B2', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#FFE08A' },
  { tag: [t.tagName, t.className, t.labelName], color: '#7CC4F2' },
  { tag: [t.attributeName, t.propertyName], color: '#F2B533' },
  { tag: [t.attributeValue], color: '#9BE0A8' },
  { tag: [t.angleBracket, t.punctuation, t.bracket], color: '#9AAEC6' },
  { tag: [t.variableName, t.definition(t.variableName)], color: '#DCE6F2' },
  { tag: t.invalid, color: '#FF8A80' },
]);

class GivenBadge extends WidgetType {
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-given';
    span.textContent = 'GIVEN';
    span.title = 'Given code: you won’t need to memorise this for the exam';
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

const GIVEN = /\s*\/\/ given\s*$/;

function givenDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      const m = GIVEN.exec(line.text);
      if (m) {
        builder.add(line.from, line.from, Decoration.line({ class: 'cm-given-line' }));
        builder.add(line.from + m.index, line.to, Decoration.replace({ widget: new GivenBadge() }));
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const givenLines = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = givenDecorations(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = givenDecorations(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

const LANGS = {
  html: () => html({ autoCloseTags: false }),
  css: () => css(),
  js: () => javascript(),
};

export function createCodeEditor(opts: Options): CodeEditor {
  const view = new EditorView({
    parent: opts.parent,
    state: EditorState.create({
      doc: opts.doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        indentUnit.of('  '),
        EditorState.tabSize.of(2),
        LANGS[opts.language](),
        syntaxHighlighting(highlight),
        givenLines,
        EditorState.readOnly.of(!!opts.readOnly),
        EditorView.editable.of(!opts.readOnly),
        keymap.of([
          {
            key: 'Escape',
            run: () => {
              opts.onEscape?.();
              return !!opts.onEscape;
            },
          },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': opts.label,
          'aria-describedby': 'editor-keys',
          spellcheck: 'false',
          autocapitalize: 'off',
          autocorrect: 'off',
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) opts.onChange?.(u.state.doc.toString());
        }),
        theme,
        opts.compact ? EditorView.theme({ '&': { fontSize: '13.5px' } }) : [],
      ],
    }),
  });

  return {
    view,
    getCode: () => view.state.doc.toString(),
    setCode: (code) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } }),
    goToLine: (line) => {
      const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines));
      view.dispatch({ selection: { anchor: l.to }, scrollIntoView: true });
      view.focus();
    },
    focus: () => view.focus(),
  };
}

/** Strip given markers and the loop guard from code that leaves the site. */
export const cleanForDownload = (code: string) => code.replace(/[ \t]*\/\/ given[ \t]*$/gm, '');
