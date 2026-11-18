import { runIfMain } from '../lib/spec.mjs';
import { storySpec } from '../lib/storyspec.mjs';
const spec = storySpec({ id: '04-story-laozhou', storyId: 'laozhou_story', title: '老周面包房', pre: ['xiaomi_story','afu_story'], checklist: [], timeout: 1200000 });
export default spec;
await runIfMain(import.meta.url, spec);
