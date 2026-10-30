import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../public/',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const home=read('index.html'),explore=read('explore.html'),styles=read('human-site.css');
test('approved calm home has one main start action and exactly three choices',()=>{
 assert.match(home,/id="welcome"/);
 assert.match(home,/id="choose"/);
 assert.equal((home.match(/class="human-option /g)||[]).length,3);
 assert.match(home,/We educate\. We explain\. We recommend\./);
 assert.match(home,/You decide/);
 assert.match(home,/Keep critically thinking for yourself when using AI/);
});
test('approved artwork and culturally appropriate locally served scene files exist',()=>{
 for(const f of ['images/ai-boss-approved-logo.webp','images/hero-conversation-a.jpg','images/hero-senior-black.jpg','images/hero-mature-latino.jpg']) assert.ok(existsSync(new URL(f,root)),f);
 assert.match(home,/ai-boss-approved-logo.webp/);
 assert.doesNotMatch(home,/images\.pexels\.com/);
 assert.match(styles,/#F8F5ED/);
 assert.match(styles,/prefers-reduced-motion/);
});
test('old content, estimates and AI Twin survive as accessible destinations',()=>{
 assert.match(explore,/id="estimate"/);
 assert.match(explore,/id="start-learning"/);
 assert.match(explore,/id="solutions"/);
 assert.match(explore,/id="trellis"/);
 assert.doesNotMatch(explore,/class="homepage-voice-entry"/);
 assert.match(explore,/class="watch-first"/);
 assert.ok(explore.indexOf('class="watch-first"') < explore.indexOf("Who do you trust"));
 assert.match(explore,/href="\/ask-brian"/);
 assert.match(home,/\/ask-brian/);
 assert.match(home,/location\.replace\("\/explore"\+location\.hash\)/);
});
