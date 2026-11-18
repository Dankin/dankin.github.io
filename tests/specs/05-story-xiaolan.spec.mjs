import { runIfMain } from '../lib/spec.mjs';
import { storySpec } from '../lib/storyspec.mjs';
const spec = storySpec({ id: '05-story-xiaolan', storyId: 'xiaolan_story', title: '小蓝', pre: ['xiaomi_story','afu_story','laozhou_story'], checklist: [], timeout: 1200000 });
export default spec;
await runIfMain(import.meta.url, spec);
