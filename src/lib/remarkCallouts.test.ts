import { describe, expect, it } from 'vitest';
import type { Root } from 'mdast';
import { convertContainerCallouts, remarkCallouts, resolveCalloutType } from './remarkCallouts';

describe('convertContainerCallouts', () => {
  it(':::тип … ::: → > [!тип], код и незакрытые блоки не трогает', () => {
    const text = ':::warning\n**Правила:**\n\n- пункт\n:::\n\n```\n:::note\n```\n\n:::meaning Термин\nтекст\r\n:::\r\n\n:::example\nбез конца';
    expect(convertContainerCallouts(text)).toBe(
      '> [!warning]\n> **Правила:**\n>\n> - пункт\n\n\n```\n:::note\n```\n\n> [!meaning] Термин\n> текст\r\n\n\n:::example\nбез конца',
    );
  });
});

function blockquote(text: string): Root {
  return { type: 'root', children: [{ type: 'blockquote', children: [{ type: 'paragraph', children: [{ type: 'text', value: text }] }] }] };
}

describe('remarkCallouts', () => {
  it('типы и русские синонимы как на сайте группы', () => {
    expect(resolveCalloutType('Определение')).toBe('meaning');
    expect(resolveCalloutType('abstract')).toBe('meaning');
    expect(resolveCalloutType('неизвестный')).toBe('note');
  });

  it('[!info] Заголовок\nтекст → div.callout с заголовком и текстом', () => {
    const tree = blockquote('[!info] Метаданные\nтекст');
    remarkCallouts()(tree);
    const node = tree.children[0] as unknown as { data: { hName: string; hProperties: { dataCallout: string } }; children: { children: { value: string }[] }[] };
    expect(node.data.hName).toBe('div');
    expect(node.data.hProperties.dataCallout).toBe('info');
    expect(node.children[0]!.children[0]!.value).toBe('Метаданные');
    expect(node.children[1]!.children[0]!.value).toBe('текст');
  });

  it('без заголовка — подпись типа; обычная цитата не трогается', () => {
    const tree = blockquote('[!formula]');
    remarkCallouts()(tree);
    expect((tree.children[0] as unknown as { children: { children: { value: string }[] }[] }).children).toHaveLength(1);
    const plain = blockquote('просто цитата');
    remarkCallouts()(plain);
    expect(plain.children[0]!.data).toBeUndefined();
  });
});
