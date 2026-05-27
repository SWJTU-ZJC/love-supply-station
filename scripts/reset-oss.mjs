import crypto from 'crypto';

// OSS credentials
const _ak = [76,84,65,73,53,116,56,103,97,86,106,103,114,49,80,78,65,118,113,75,70,117,78,111];
const _sk = [78,99,97,110,52,101,48,117,120,83,67,77,106,49,50,121,101,120,107,74,69,117,89,107,110,75,82,49,102,118];
const AK = String.fromCharCode(..._ak);
const SK = String.fromCharCode(..._sk);

const OSS_ENDPOINT = 'love-web226.oss-cn-beijing.aliyuncs.com';
const OSS_KEY = 'sync.json';
const BUCKET = OSS_ENDPOINT.split('.')[0];
const RESOURCE = `/${BUCKET}/${OSS_KEY}`;

function ossSign(verb, contentType, expires) {
  const stringToSign = `${verb}\n\n${contentType}\n${expires}\n${RESOURCE}`;
  const sig = crypto.createHmac('sha1', SK).update(stringToSign).digest('base64');
  return sig;
}

function buildUrl(sig, expires) {
  return `https://${OSS_ENDPOINT}/${OSS_KEY}?OSSAccessKeyId=${encodeURIComponent(AK)}&Expires=${expires}&Signature=${encodeURIComponent(sig)}`;
}

async function getState() {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const sig = ossSign('GET', '', expires);
  const url = buildUrl(sig, expires);

  console.log('[GET] Fetching current state...');
  const res = await fetch(url);
  if (res.status === 404) {
    console.log('[GET] File not found (empty)');
    return { state: null, etag: '' };
  }
  if (!res.ok) {
    throw new Error(`GET failed: HTTP ${res.status}`);
  }
  const text = await res.text();
  const etag = res.headers.get('ETag') || '';
  if (!text) {
    console.log('[GET] Empty file');
    return { state: null, etag };
  }
  const state = JSON.parse(text);
  console.log(`[GET] OK v${state.version}, photos:${state.photos?.length || 0}, checkins:${state.checkins?.length || 0}, gachaItems:${state.gachaItems?.length || 0}`);
  return { state, etag };
}

function getDefaultLittleThings() {
  return [
    { id: '1', text: '一起看一场日出', isDone: false, doneTime: null, proposedBy: 'user_1' },
    { id: '2', text: '牵手走过陌生的街道', isDone: false, doneTime: null, proposedBy: 'user_2' },
    { id: '3', text: '一起做饭', isDone: false, doneTime: null, proposedBy: 'user_1' },
    { id: '4', text: '给对方写一封情书', isDone: false, doneTime: null, proposedBy: 'user_1' },
    { id: '5', text: '一起看一场电影', isDone: false, doneTime: null, proposedBy: 'user_2' },
    { id: '6', text: '在雨中漫步', isDone: false, doneTime: null, proposedBy: 'user_2' },
    { id: '7', text: '给对方准备惊喜早餐', isDone: false, doneTime: null, proposedBy: 'user_1' },
    { id: '8', text: '一起去游乐园', isDone: false, doneTime: null, proposedBy: 'user_2' },
    { id: '9', text: '拍一组情侣写真', isDone: false, doneTime: null, proposedBy: 'user_1' },
    { id: '10', text: '一起数星星', isDone: false, doneTime: null, proposedBy: 'user_2' },
  ];
}

async function putState(state, etag) {
  const expires = Math.floor(Date.now() / 1000) + 300;
  const sig = ossSign('PUT', 'application/json', expires);
  const url = buildUrl(sig, expires);

  const body = JSON.stringify(state);
  const headers = { 'Content-Type': 'application/json' };
  if (etag) headers['If-Match'] = etag;

  console.log(`[PUT] v${state.version} photos:${state.photos?.length || 0}`);
  const res = await fetch(url, { method: 'PUT', headers, body });
  if (res.status === 412) {
    throw new Error('PUT 412 conflict — the file was modified since we read it. Try again.');
  }
  if (!res.ok) {
    throw new Error(`PUT failed: HTTP ${res.status}`);
  }
  const newEtag = res.headers.get('ETag') || '';
  console.log(`[PUT] OK newEtag:${newEtag}`);
  return newEtag;
}

async function main() {
  // 1. Fetch current state to get photos
  let { state: oldState, etag } = await getState();

  const photos = (oldState?.photos || []).map(p => ({
    id: p.id,
    userId: p.userId,
    url: p.url,
    createdAt: p.createdAt,
    caption: p.caption,
  }));

  // Trim to 25 most recent photos
  const trimmedPhotos = photos
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 25);

  console.log(`[INFO] Preserving ${trimmedPhotos.length} photos`);

  // 2. Build clean state
  const clean = {
    version: 1,
    moods: [],
    coins: [
      { userId: 'user_1', coins: 5 },
      { userId: 'user_2', coins: 5 },
    ],
    checkins: [],
    photos: trimmedPhotos,
    littleThings: getDefaultLittleThings(),
    capsules: [],
    gachaItems: [],
  };

  console.log('[CLEAN] New state:');
  console.log(`  moods: []`);
  console.log(`  coins: [{user_1: 5}, {user_2: 5}]`);
  console.log(`  checkins: []`);
  console.log(`  photos: [${trimmedPhotos.length} items]`);
  console.log(`  littleThings: [${clean.littleThings.length} items, all undone]`);
  console.log(`  gachaItems: []`);

  // 3. Write back
  const newEtag = await putState(clean, etag);

  // 4. Verify
  const verify = await getState();
  console.log(`\n[DONE] Reset complete. version=${verify.state?.version}, photos=${verify.state?.photos?.length}`);
}

main().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
