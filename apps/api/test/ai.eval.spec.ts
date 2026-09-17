import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { LocalAiProvider } from '../src/ai/local-ai.provider.js';

describe('AI extraction eval set', () => {
  it('matches the labeled title and party count for the synthetic petitions', async () => {
    const cases = JSON.parse(await readFile(new URL('./fixtures/ai-petitions.json', import.meta.url), 'utf8')) as Array<{ text: string; title: string; partyCount: number }>;
    const provider = new LocalAiProvider();
    const results = await Promise.all(cases.map((item) => provider.extractPetition(item.text)));
    expect(results.filter((result, index) => result.case_title === cases[index].title && result.party_names.length === cases[index].partyCount)).toHaveLength(cases.length);
  });
});