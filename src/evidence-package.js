const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { hash } = require('./eval-evidence');

const root = path.resolve(__dirname, '..');
const slash = file => file.split(path.sep).join('/');
const relative = file => slash(path.relative(root, file));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Evidence packages must not contain symbolic links.');
    return entry.isDirectory() ? filesIn(file) : [file];
  }).sort();
}

function snapshotSources(directory) {
  const files = [
    ...['src', 'agents', 'schemas', 'evals', 'fixtures', 'tests', 'coordinator'].flatMap(name =>
      filesIn(path.join(root, name))),
    ...['package.json', 'package-lock.json', 'sub-agents.config.yaml', 'substance-assessment.json',
      'README.md', 'CERTIFICATION-EVIDENCE.md', 'NEXT-STEPS.md', 'stage5-summary.md',
      'GIT-HISTORY.md', 'prompts/prompt-evolution.md'].map(file => path.join(root, file))
  ];
  const safeFiles = files.filter(file => !/(^|\/)(?:\.env(?:\.[^/]*)?|node_modules)(?:\/|$)/.test(relative(file))
    && !/\.(?:pem|key)$/i.test(file));
  for (const file of safeFiles) {
    const target = path.join(directory, 'source', relative(file));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL);
  }
  return {
    commit: git(['rev-parse', 'HEAD']),
    dirty: Boolean(git(['status', '--porcelain'])),
    status: git(['status', '--porcelain']),
    log: git(['log', '-12', '--format=%H %aI %s']),
    scope: 'Explicit source/config allowlist only; no dotenv files, node_modules, or hidden Git dependency.'
  };
}

function exportBaselines(directory, definitions) {
  const exports = [];
  const fixtures = definitions.fixtures.map((fixture, i) => {
    if (!['required', 'archival-incompatible'].includes(fixture.baseline.state)) return fixture;
    const { ref, file } = fixture.baseline.ref ? fixture.baseline : (fixture.baseline.origin || {});
    if (!ref) throw new Error('Historical export requires an immutable Git baseline reference.');
    const bytes = execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const target = path.join(directory, 'baselines', `ticket${i + 1}-run.json`);
    fs.writeFileSync(target, bytes, { flag: 'wx' });
    exports.push({
      file: relative(target), sourceCommit: git(['rev-parse', ref]), sourcePath: file,
      gitBlob: git(['rev-parse', `${ref}:${file}`]), sha256: hash(bytes),
      compatibility: 'Original bytes, not upgraded to current runtime contracts; no fabricated completed status.'
    });
    return { ...fixture, baseline: {
      state: fixture.baseline.state, file: relative(target),
      ...(fixture.baseline.reason ? { reason: fixture.baseline.reason } : {})
    } };
  });
  writeJson(path.join(directory, 'baselines', 'exports.json'), exports);
  return fixtures;
}

function sealPackage(directory, collection, manifestName = 'manifest.json') {
  if (!/^manifest(?:-final)?\.json$/.test(manifestName)) throw new Error('Invalid manifest name.');
  const entries = filesIn(directory).map(file => ({
    file: slash(path.relative(directory, file)),
    bytes: fs.statSync(file).size,
    sha256: hash(fs.readFileSync(file))
  }));
  writeJson(path.join(directory, manifestName), {
    version: 1, generatedAt: new Date().toISOString(), collection, files: entries,
    integrity: 'SHA-256 detects changes relative to this manifest; not an independent provider attestation.'
  });
}

function verifyPackage(directory) {
  const finalManifest = path.join(directory, 'manifest-final.json');
  const manifestFile = fs.existsSync(finalManifest) ? finalManifest : path.join(directory, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const errors = [];
  const seen = new Set();
  for (const entry of manifest.files) {
    const file = path.resolve(directory, entry.file);
    const rel = path.relative(directory, file);
    if (path.isAbsolute(entry.file) || !rel || rel.startsWith('..') || seen.has(entry.file)) {
      errors.push(`Invalid or duplicate package path: ${entry.file}`);
      continue;
    }
    seen.add(entry.file);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()
      || fs.statSync(file).size !== entry.bytes || hash(fs.readFileSync(file)) !== entry.sha256) {
      errors.push(`Missing or changed file: ${entry.file}`);
    }
  }
  for (const file of filesIn(directory)) {
    if (file !== manifestFile && !seen.has(slash(path.relative(directory, file)))) {
      errors.push(`Unlisted package file: ${slash(path.relative(directory, file))}`);
    }
  }
  return { pass: errors.length === 0, files: seen.size, errors };
}

if (require.main === module) {
  try {
    const result = verifyPackage(path.resolve(process.argv[2]));
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exitCode = 1;
  } catch {
    console.error('Unable to verify evidence package.');
    process.exitCode = 1;
  }
}

module.exports = { root, relative, writeJson, filesIn, snapshotSources, exportBaselines, sealPackage, verifyPackage };
