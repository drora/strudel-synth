/**
 * Smoke: all-tracks Code buffer serialize / parse.
 * Run: npm run test:all-code
 */
import assert from 'node:assert/strict'
import {
  CODE_ALL,
  isCodeAllOpen,
  tracksToAllCode,
  parseAllCode,
  applyAllCodeToTracks,
  checkImportCode,
  applyImportToTracks,
  ALL_CODE_FILENAME,
  IMPORT_FILE_ACCEPT,
  allCodeFilename,
  jamFileStem,
  formatJamHeader,
  parseJamHeader,
  hasUnbalancedSyntax,
} from './all-code'
import type { Track } from './types'

function track(id: string, name: string, code: string): Track {
  return {
    id,
    name,
    code,
    role: 'custom',
    color: '#fff',
    muted: false,
    soloed: false,
    locked: false,
    volume: 1,
    octave: 0,
    error: null,
  }
}

console.log('=== all-code smoke ===')

{
  assert.equal(isCodeAllOpen(CODE_ALL), true)
  assert.equal(isCodeAllOpen('kick'), false)
  assert.equal(isCodeAllOpen(null), false)
  console.log('sentinel ok')
}

{
  const tracks = [
    track('a', 'Kick', 's("bd")'),
    track('b', 'Hats', 's("hh*8")'),
  ]
  const buf = tracksToAllCode(tracks)
  assert.match(buf, /\/\/ @track a  Kick/)
  assert.match(buf, /\/\/ @track b  Hats/)
  const parsed = parseAllCode(buf, tracks)
  assert.deepEqual(parsed, [
    { id: 'a', code: 's("bd")' },
    { id: 'b', code: 's("hh*8")' },
  ])
  assert.equal(applyAllCodeToTracks(buf, tracks).length, 0)
  const edited = buf.replace('s("bd")', 's("bd sd")')
  const diff = applyAllCodeToTracks(edited, tracks)
  assert.deepEqual(diff, [{ id: 'a', code: 's("bd sd")' }])
  console.log('roundtrip ok')
}

{
  const tracks = [track('a', 'Kick', 's("bd")'), track('b', 'Hats', 's("hh")')]
  const parsed = parseAllCode('// @track a  Kick\ns("cp")\n\n// leftover', tracks)
  assert.deepEqual(parsed, [{ id: 'a', code: 's("cp")\n\n// leftover' }])
  const unknown = parseAllCode('// @track z  Ghost\ns("xx")', tracks)
  assert.equal(unknown.length, 0)
  console.log('partial parse ok')
}

{
  const tracks = [track('a', 'Kick', 's("bd")'), track('b', 'Hats', 's("hh")')]
  assert.equal(checkImportCode('', tracks).ok, false)
  assert.equal(checkImportCode('s("bd sd"', tracks).ok, false)
  const bad = checkImportCode('s("bd sd"', tracks)
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.match(bad.message, /Invalid syntax/)
  const unknown = checkImportCode('// @track z  Ghost\ns("xx")', tracks)
  assert.equal(unknown.ok, false)
  assert.equal(checkImportCode('hello world', tracks).ok, false)
  assert.equal(checkImportCode('s("bd sd")', tracks).ok, true)
  const buf = tracksToAllCode(tracks)
  assert.equal(checkImportCode(buf, tracks).ok, true)
  const snip = applyImportToTracks('s("cp")', tracks, 'b')
  assert.deepEqual(snip, [{ id: 'b', code: 's("cp")' }])
  console.log('import check ok')
}

{
  assert.equal(ALL_CODE_FILENAME, 'strudel-studio.strudel')
  assert.equal(
    allCodeFilename({ kit: 'Roland TR-909', root: 'f#', scale: 'harmonic_minor', bpm: 128 }),
    'roland-tr-909-fs-harmonic-minor-128.strudel',
  )
  assert.equal(jamFileStem({ kit: 'Amen Chop', root: 'c', scale: 'minor', bpm: 174 }), 'amen-chop-c-minor-174')
  assert.match(IMPORT_FILE_ACCEPT, /\.strudel/)
  assert.doesNotMatch(IMPORT_FILE_ACCEPT, /javascript/)
  assert.doesNotMatch(allCodeFilename({ kit: 'x', root: 'c', scale: 'minor', bpm: 120 }), /\.js/)
  console.log('filename slug ok')
}

{
  const meta = {
    kitId: 'techno-punch909',
    kitName: 'Punch 909',
    root: 'f#',
    scale: 'dorian',
    bpm: 128,
  }
  const line = formatJamHeader(meta)
  assert.equal(
    line,
    '// @jam kit=techno-punch909 name="Punch 909" root=f# scale=dorian bpm=128',
  )
  const parsed = parseJamHeader(line)
  assert.deepEqual(parsed, {
    kitId: 'techno-punch909',
    kitName: 'Punch 909',
    root: 'f#',
    scale: 'dorian',
    bpm: 128,
  })
  const tracks = [track('a', 'Kick', 's("bd")'), track('b', 'Hats', 's("hh")')]
  const buf = tracksToAllCode(tracks, meta)
  assert.ok(buf.startsWith('// @jam '))
  assert.deepEqual(parseJamHeader(buf), parsed)
  const sections = parseAllCode(buf, tracks)
  assert.deepEqual(sections, [
    { id: 'a', code: 's("bd")' },
    { id: 'b', code: 's("hh")' },
  ])
  // @jam must not become a fake track
  assert.equal(sections.some((s) => s.id.includes('jam') || s.code.includes('@jam')), false)
  const onlyJam = parseAllCode('// @jam kit=x name="Y" root=c scale=minor bpm=120\n', tracks)
  assert.equal(onlyJam.length, 0)
  console.log('jam header roundtrip ok')
}


{
  assert.equal(hasUnbalancedSyntax('s("bd sd"'), true)
  assert.equal(hasUnbalancedSyntax('s("bd sd")'), false)
  console.log('hasUnbalancedSyntax ok')
}

{
  // Live typing must persist @track diffs even when import-check false-negatives
  // (comment with `(`, mid-type unbalanced in another lane, etc.).
  const tracks = [track('a', 'Kick', 's("bd")'), track('b', 'Hats', 's("hh")')]
  const withCommentParen = [
    '// @jam kit=none name="" root=c scale=minor bpm=120',
    '// @track a  Kick',
    's("bd sd")',
    '// TODO: tweak (later',  // unmatched `(` in comment — import-check false-negative
    '',
    '// @track b  Hats',
    's("hh*8")',
  ].join('\n')
  const check = checkImportCode(withCommentParen, tracks)
  assert.equal(check.ok, false, 'comment `(` should trip import-check')
  const diffs = applyImportToTracks(withCommentParen, tracks)
  assert.ok(
    diffs.some((d) => d.id === 'a' && d.code.includes('bd sd')),
    'parseable @track diffs must still apply when check fails',
  )
  const midBuf = [
    '// @track a  Kick',
    's("bd cp")',
    '',
    '// @track b  Hats',
    's("hh*4"',
  ].join('\n')
  assert.equal(checkImportCode(midBuf, tracks).ok, false)
  const midDiffs = applyImportToTracks(midBuf, tracks)
  assert.deepEqual(
    midDiffs.find((d) => d.id === 'a'),
    { id: 'a', code: 's("bd cp")' },
  )
  console.log('persist @track diffs when check fails ok')
}

console.log('all-code-smoke.test.ts: ok')
