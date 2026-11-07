import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WordDetailModal } from '../../src/components/WordDetailModal';
import { SAMPLE_SCENES } from '../../src/data/sampleScenes';

for (const word of ['coffee', 'whipped cream', '  whipped cream  ', 'traffic light', '  latte art  ', "chef's knife", 'salt & pepper', 'café / tea?# +']) {
  test(`word detail passes the complete query to each dictionary: ${word}`, () => {
    const html = renderToStaticMarkup(createElement(WordDetailModal, {
      item: { ...SAMPLE_SCENES[0].items[0], word },
      onClose() {}, isSaved: false, onToggleSave() {},
    }));
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)];
    assert.equal(links.length, 4);
    const [cambridge, google, oxford, webster] = links.map(match => new URL(match[1].replaceAll('&amp;', '&').replaceAll('&#x27;', "'")));
    assert.equal(cambridge.origin, 'https://dictionary.cambridge.org');
    assert.equal(cambridge.pathname, '/search/direct/');
    assert.equal(cambridge.searchParams.get('datasetsearch'), 'english-chinese-traditional');
    assert.equal(cambridge.searchParams.has('dataset'), false);
    assert.equal(cambridge.searchParams.get('q'), word.trim());
    assert.equal(oxford.origin, 'https://www.oxfordlearnersdictionaries.com');
    assert.equal(oxford.pathname, '/search/english/');
    assert.equal(oxford.searchParams.get('q'), word.trim());
    assert.equal(webster.origin, 'https://www.merriam-webster.com');
    assert.equal(decodeURIComponent(webster.pathname), `/dictionary/${word.trim()}`);
    assert.equal(google.origin, 'https://translate.google.com');
    assert.equal(google.searchParams.get('text'), word.trim());
    assert.equal(google.searchParams.get('sl'), 'en');
    assert.equal(google.searchParams.get('tl'), 'zh-TW');
    for (const link of links) {
      assert.match(link[0], /target="_blank"/);
      assert.match(link[0], /rel="noopener noreferrer"/);
    }
  });
}
