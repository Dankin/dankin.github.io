import { runIfMain } from '../lib/spec.mjs';
import { storySpec } from '../lib/storyspec.mjs';
const spec = storySpec({ id: '03-story-afu', storyId: 'afu_story', title: '阿福', pre: [], checklist: [] });
export default spec;
await runIfMain(import.meta.url, spec);
