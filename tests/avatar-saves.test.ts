import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AVATAR_DESIGN } from '../src/models/avatar/design';
import { AVATAR_SAVE_LIMIT, avatarDownload, emptyAvatarCollection, parseAvatarCollection, parseAvatarDownload } from '../src/data/avatarSaves';

test('Saved characters and portable recipes survive JSON round trips without losing independent outfits',()=>{
  const design={...DEFAULT_AVATAR_DESIGN,name:'Coastal <friend>',topStyle:'vest' as const,bottomStyle:'skirt' as const};
  const collection={version:1,selectedId:'two',avatars:[{id:'one',design:DEFAULT_AVATAR_DESIGN,savedAt:'2026-10-22T12:00:00Z'},{id:'two',design,savedAt:'2026-10-22T12:01:00Z'}]};
  assert.deepEqual(parseAvatarCollection(JSON.stringify(collection)),collection);
  assert.deepEqual(parseAvatarDownload(avatarDownload(design)),design);
  assert.deepEqual(parseAvatarCollection(null),emptyAvatarCollection());
  assert.equal(parseAvatarCollection(JSON.stringify({...collection,selectedId:'missing'})).selectedId,'one');
});

test('Corrupt or incompatible saved collections report failure instead of overwriting existing data',()=>{
  for(const text of ['bad JSON','null','[]','{"version":2,"avatars":[]}','{"version":1,"avatars":[{}]}'])assert.throws(()=>parseAvatarCollection(text));
  const record={id:'one',design:DEFAULT_AVATAR_DESIGN,savedAt:''};
  assert.throws(()=>parseAvatarCollection(JSON.stringify({version:1,avatars:[record,record]})));
  assert.throws(()=>parseAvatarCollection(JSON.stringify({version:1,avatars:Array.from({length:AVATAR_SAVE_LIMIT+1},(_,i)=>({...record,id:String(i)}))})));
});

test('Imported files are bounded and require a supported format; design values are sanitized',()=>{
  assert.throws(()=>parseAvatarDownload(' '.repeat(32769)));
  for(const value of [{},{format:'other',version:1,design:{}},{format:'monterey-bay-cozy-avatar',version:2,design:{}},{format:'monterey-bay-cozy-avatar',version:1,design:null}])assert.throws(()=>parseAvatarDownload(JSON.stringify(value)));
  const imported=parseAvatarDownload(JSON.stringify({format:'monterey-bay-cozy-avatar',version:1,design:{...DEFAULT_AVATAR_DESIGN,skinTone:'url(remote)',topStyle:'injected',name:'<svg onload=alert(1)>',script:'ignore'}}));
  assert.equal(imported.skinTone,DEFAULT_AVATAR_DESIGN.skinTone);assert.equal(imported.topStyle,DEFAULT_AVATAR_DESIGN.topStyle);assert.ok(!('script' in imported));
});


test('Face-line selections survive save/export while older v1 characters retain the original face',()=>{
  const {faceLines: omitted,...legacy}=DEFAULT_AVATAR_DESIGN;
  assert.equal(omitted,'none');
  const oldCollection={version:1,selectedId:'legacy',avatars:[{id:'legacy',design:legacy,savedAt:''}]};
  assert.deepEqual(parseAvatarCollection(JSON.stringify(oldCollection)).avatars[0].design,DEFAULT_AVATAR_DESIGN);
  assert.deepEqual(parseAvatarDownload(JSON.stringify({format:'monterey-bay-cozy-avatar',version:1,design:legacy})),DEFAULT_AVATAR_DESIGN);
  for(const faceLines of ['none','soft','defined'] as const){
    const design={...DEFAULT_AVATAR_DESIGN,faceLines};
    assert.deepEqual(parseAvatarDownload(avatarDownload(design)),design);
    assert.deepEqual(parseAvatarCollection(JSON.stringify({version:1,selectedId:'one',avatars:[{id:'one',design,savedAt:''}]})).avatars[0].design,design);
  }
});
